// Profil, réglages, consentements, questionnaire d'accueil, export et suppression (5.1, 5.13, 8.2).
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Appointment, Availability, Booking, DailyLog, DhikrDay, FastPlan, Favorite, MadeUpFast, MissedFast, Mosque, Note, Notification, Period, Practitioner, PrayerLog, Pregnancy, PushSubscription, Review, Service, Subscription, User, Verification, VoluntaryFast } from '../models/index.js';
import { ADHAN_KEYS } from '../services/adhan.js';
import { distanceKm, reverseGeocode } from '../services/geo.js';
import { ensureOsmMosque } from '../services/mosques.js';
import { forgetMosque } from '../services/prayerSource.js';
import { purgeUser } from '../services/purge.js';
import { nowFor } from '../services/context.js';
import { mask, normalizeIdentifier, sendOtp, verifyOtp } from '../services/otp.js';
import { endSession } from '../services/session.js';
import { sendMail } from '../services/mailer.js';
import { addDays, isDay, safeTimeZone } from '../utils/dates.js';
import { badRequest, conflict } from '../utils/http.js';
import bcrypt from 'bcryptjs';
import { citySchema, passwordField, sessionPayload } from './auth.js';
import { plainNote } from '../services/notes.js';

const router = Router();
router.use(requireAuth);

const day = z.string().refine(isDay, 'Date invalide (AAAA-MM-JJ)');
const adj = z.number().int().min(-30).max(30);

router.get('/', async (req, res) => {
  res.json(await sessionPayload(req.user));
});

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  age: z.number().int().min(15).max(100).optional(),
  city: citySchema.optional(),
  situation: z.enum(['mariee', 'celibataire']).optional(),
  fertilitySigns: z.boolean().optional(),
  specialProfile: z.enum(['aucun', 'adolescente', 'arret_pilule', 'post_partum', 'allaitement', 'premenopause']).optional(),
  lastSpace: z.enum(['personnel', 'pro']).optional(),
  prayerSettings: z
    .object({
      notifications: z.boolean().optional(),
      adhan: z.boolean().optional(),
      dhikrDuringPeriod: z.boolean().optional(),
      followLocation: z.boolean().optional(),
      adhanVoice: z.enum(ADHAN_KEYS).optional(),
      adhanMode: z.enum(['notification', 'adhan']).optional(),
      adhanPrayers: z.object({ fajr: z.boolean(), dhuhr: z.boolean(), asr: z.boolean(), maghrib: z.boolean(), isha: z.boolean() }).partial().optional(),
      notifyPrayers: z.object({ fajr: z.boolean(), dhuhr: z.boolean(), asr: z.boolean(), maghrib: z.boolean(), isha: z.boolean() }).partial().optional(),
      prayerSound: z.object({ fajr: z.enum(['complet', 'court', 'bip', 'silencieux']), dhuhr: z.enum(['complet', 'court', 'bip', 'silencieux']), asr: z.enum(['complet', 'court', 'bip', 'silencieux']), maghrib: z.enum(['complet', 'court', 'bip', 'silencieux']), isha: z.enum(['complet', 'court', 'bip', 'silencieux']) }).partial().optional(),
      notifyOffset: z.union([z.literal(0), z.literal(10), z.literal(15)]).optional(),
      periodHome: z.enum(['horaires', 'ligne']).optional(),
      keepRemindersDuringPeriod: z.boolean().optional(),
      keepDhikrDuringPeriod: z.boolean().optional(),
      purificationReminders: z.boolean().optional(),
      adhkarMorning: z.boolean().optional(),
      adhkarEvening: z.boolean().optional(),
      jumua: z.boolean().optional(),
      adjustments: z.object({ fajr: adj, dhuhr: adj, asr: adj, maghrib: adj, isha: adj }).partial().optional(),
    })
    .optional(),
  notificationPrefs: z
    .object({
      periodSoon: z.boolean(),
      fertileWindow: z.boolean(),
      periodEndQuestion: z.boolean(),
      fastMakeup: z.boolean(),
      ramadan: z.boolean(),
      whiteDays: z.boolean(),
      dailyReminder: z.boolean(),
      frequency: z.enum(['faible', 'moderee', 'elevee']),
      frequencyAsked: z.boolean(),
      hideNotePreview: z.boolean(),
      fastPlanned: z.boolean(),
      messages: z.boolean(),
      events: z.boolean(),
    })
    .partial()
    .optional(),
  contraception: z
    .object({
      type: z.enum(['aucune', 'pilule', 'sterilet', 'implant', 'preservatif', 'autre']),
      pillReminder: z.boolean(),
      pillTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    })
    .partial()
    .optional(),
  goal: z.enum(['suivre', 'enfant', 'enceinte']).optional(),
});

router.patch('/', validate(profileSchema), async (req, res) => {
  const u = req.user;
  const b = req.body;
  for (const key of ['firstName', 'city', 'situation', 'fertilitySigns', 'specialProfile', 'lastSpace']) if (b[key] !== undefined) u[key] = b[key];
  if (b.age !== undefined) u.birthYear = new Date().getUTCFullYear() - b.age;
  if (b.goal) u.onboarding.goal = b.goal;
  if (b.prayerSettings) {
    const { adjustments, adhanPrayers, notifyPrayers, prayerSound, ...rest } = b.prayerSettings;
    if (prayerSound) Object.assign(u.prayerSettings.prayerSound, prayerSound);
    Object.assign(u.prayerSettings, rest);
    if (adjustments) Object.assign(u.prayerSettings.adjustments, adjustments);
    if (adhanPrayers) Object.assign(u.prayerSettings.adhanPrayers, adhanPrayers);
    if (notifyPrayers) Object.assign(u.prayerSettings.notifyPrayers, notifyPrayers);
  }
  if (b.notificationPrefs) Object.assign(u.notificationPrefs, b.notificationPrefs);
  if (b.contraception) Object.assign(u.contraception, b.contraception);
  await u.save();
  res.json(await sessionPayload(u));
});

// 6.8 — Position exacte du téléphone : les horaires (API Aladhan), la qibla, la météo et les jeûnes
// sont calculés aux coordonnées GPS et suivent l'utilisatrice quand elle se déplace (au-delà de 500 m).
const MIN_MOVE_KM = 0.5;
router.put(
  '/location',
  validate(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), timezone: z.string().max(64).optional(), force: z.boolean().optional() })),
  async (req, res) => {
    const u = req.user;
    const { lat, lng, force } = req.body;
    if (u.prayerSettings?.followLocation === false && !force) return res.json({ updated: false, reason: 'manuel', session: await sessionPayload(u) });
    const tz = req.body.timezone ? safeTimeZone(req.body.timezone) : null;
    const moved = !u.city?.lat || distanceKm(u.city, { lat, lng }) >= MIN_MOVE_KM;
    if (!force && !moved && u.city?.source === 'gps' && (!tz || tz === u.city.timezone)) return res.json({ updated: false, reason: 'proche', session: await sessionPayload(u) });

    const place = await reverseGeocode(lat, lng).catch(() => null);
    u.city = {
      name: place?.name || u.city?.name || 'Ma position',
      admin: place?.admin || '',
      country: place?.country || '',
      countryCode: place?.countryCode || '',
      lat: Math.round(lat * 1e4) / 1e4, // arrondi à ~10 m
      lng: Math.round(lng * 1e4) / 1e4,
      timezone: tz || place?.timezone || 'Europe/Paris', // fuseau du téléphone (réglé par le réseau), sinon celui des coordonnées
      source: 'gps',
      updatedAt: new Date(),
    };
    if (force) u.prayerSettings.followLocation = true;
    await u.save();
    res.json({ updated: true, city: u.city, session: await sessionPayload(u) });
  },
);

// 5.7 — Source des horaires : « Ma ville » ou « Ma mosquée » (partenaire ou trouvée sur OpenStreetMap).
router.put(
  '/prayer-source',
  validate(
    z.object({
      mode: z.enum(['ville', 'mosquee']),
      mosqueId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
      osm: z.object({ osmId: z.string().max(40), name: z.string().min(1).max(140), address: z.string().max(200).optional().default(''), city: z.string().max(120).optional().default(''), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
    }),
  ),
  async (req, res) => {
    const u = req.user;
    if (req.body.mode === 'ville') {
      u.prayerSource = { mode: 'ville' };
    } else {
      let mosque = req.body.mosqueId ? await Mosque.findOne({ _id: req.body.mosqueId, active: true }) : null;
      if (!mosque && req.body.osm) mosque = await ensureOsmMosque({ ...req.body.osm, timezone: u.city?.timezone });
      if (!mosque) throw badRequest('Choisis une mosquée');
      u.prayerSource = { mode: 'mosquee', mosque: mosque._id };
      forgetMosque(mosque._id);
    }
    await u.save();
    res.json(await sessionPayload(u));
  },
);

// Bascule entre l'espace personnel et l'espace pro, sans se déconnecter.
router.put('/space', validate(z.object({ space: z.enum(['personnel', 'pro']) })), async (req, res) => {
  req.user.lastSpace = req.body.space;
  await req.user.save();
  res.json(await sessionPayload(req.user));
});

// Ajouter ou changer l'e-mail (vérifié par un code envoyé par e-mail) ou le téléphone
// (enregistré directement : aucun SMS n'est envoyé).
router.post('/identifier/otp', validate(z.object({ identifier: z.string().min(3).max(120) })), async (req, res) => {
  const id = normalizeIdentifier(req.body.identifier);
  const taken = await User.findOne(id.channel === 'email' ? { email: id.target } : { phone: id.target });
  if (taken && !taken._id.equals(req.user._id)) throw conflict('Cet identifiant est déjà utilisé par un autre compte');
  if (id.channel !== 'email') {
    Object.assign(req.user, { phone: id.target, phoneVerified: false });
    await req.user.save();
    return res.json({ saved: true, ...(await sessionPayload(req.user)) });
  }
  res.json(await sendOtp({ ...id, purpose: 'change', user: req.user }));
});

router.post('/identifier/verify', validate(z.object({ identifier: z.string(), code: z.string().regex(/^\d{6}$/) })), async (req, res) => {
  const id = normalizeIdentifier(req.body.identifier);
  await verifyOtp({ target: id.target, purpose: 'change', code: req.body.code });
  if (id.channel === 'email') Object.assign(req.user, { email: id.target, emailVerified: true });
  else Object.assign(req.user, { phone: id.target, phoneVerified: true });
  await req.user.save();
  res.json(await sessionPayload(req.user));
});

// --- Profil praticienne créé avec une autre adresse --------------------------------------------
// L'utilisatrice indique l'e-mail (ou le numéro) de son compte pro : s'il porte un profil praticienne,
// un code y est envoyé ; une fois vérifié, le profil est rattaché à ce compte et elle bascule entre ses
// deux espaces sans se déconnecter.

/** Compte qui a aussi un espace personnel (questionnaire, consentement santé, âge ou situation renseignés). */
function isPersonalAccount(u) {
  return Boolean(u.onboarding?.completed || u.consents?.health?.accepted || u.birthYear || u.situation || u.lastSpace === 'personnel');
}

async function findProAccount(req, identifier) {
  const id = normalizeIdentifier(identifier);
  const other = await User.findOne(id.channel === 'email' ? { email: id.target } : { phone: id.target });
  if (!other || other.role === 'admin') return { id, other: null, practitioner: null };
  const practitioner = await Practitioner.findOne({ user: other._id });
  return { id, other, practitioner };
}

router.post('/pro-link/check', validate(z.object({ identifier: z.string().min(3).max(120) })), async (req, res) => {
  const own = await Practitioner.findOne({ user: req.user._id }).lean();
  if (own) return res.json({ status: 'linked', displayName: own.displayName, practitionerStatus: own.status });
  const { id, other, practitioner } = await findProAccount(req, req.body.identifier);
  if (other?._id.equals(req.user._id) || !practitioner) return res.json({ status: 'none', target: mask(id.target, id.channel) });
  if (isPersonalAccount(other) || env.demoIdentifiers.test(id.target)) {
    // Compte complet (ou de démonstration) : on ne le fusionne pas, on invite à s'y connecter.
    return res.json({ status: 'own_account', displayName: practitioner.displayName, target: mask(id.target, id.channel) });
  }
  const otp = await sendOtp({ ...id, purpose: 'link', user: req.user });
  res.json({ status: 'code_sent', displayName: practitioner.displayName, practitionerStatus: practitioner.status, ...otp });
});

router.post('/pro-link/verify', validate(z.object({ identifier: z.string().min(3).max(120), code: z.string().regex(/^\d{6}$/) })), async (req, res) => {
  if (await Practitioner.exists({ user: req.user._id })) throw conflict('Ton compte a déjà un profil praticienne');
  const { id, other, practitioner } = await findProAccount(req, req.body.identifier);
  await verifyOtp({ target: id.target, purpose: 'link', code: req.body.code });
  if (!other || !practitioner) throw badRequest('Aucun profil praticienne pour cette adresse', 'PRO_NOT_FOUND');

  if (env.demoIdentifiers.test(id.target)) throw conflict('Compte de démonstration : connecte-toi directement avec cette adresse.', 'PRO_LINK_DEMO');
  // Le compte pro ne doit contenir aucun suivi personnel : sinon on le garde tel quel.
  const personal = await Promise.all([
    isPersonalAccount(other),
    Period.exists({ user: other._id }),
    DailyLog.exists({ user: other._id }),
    PrayerLog.exists({ user: other._id }),
    Pregnancy.exists({ user: other._id }),
    MissedFast.exists({ user: other._id }),
    MadeUpFast.exists({ user: other._id }),
    Booking.exists({ client: other._id }),
  ]);
  if (personal.some(Boolean)) {
    throw conflict('Ce compte a aussi son propre suivi personnel. Connecte-toi avec cette adresse : tu pourras y basculer entre tes deux espaces.', 'PRO_LINK_PERSONAL_DATA');
  }

  practitioner.user = req.user._id;
  await practitioner.save();
  await Promise.all([
    Notification.deleteMany({ user: other._id }),
    PushSubscription.deleteMany({ user: other._id }),
    Verification.deleteMany({ user: other._id }),
    FastPlan.deleteMany({ user: other._id }),
    Favorite.deleteMany({ client: other._id }),
  ]);
  await other.deleteOne();
  // L'adresse vérifiée devient un identifiant de ce compte (si le champ est libre) : même connexion sur le web pro.
  const field = id.channel === 'email' ? 'email' : 'phone';
  const adopted = !req.user[field];
  if (adopted) Object.assign(req.user, { [field]: id.target, [`${field}Verified`]: true });
  await req.user.save();
  console.log(`[pro-link] profil ${practitioner.id} rattaché au compte ${req.user.id}`);
  res.json({ linked: true, adopted, session: await sessionPayload(req.user) });
});

// Mot de passe facultatif : créer, changer ou supprimer (retour à la connexion par code seul).
router.put('/password', validate(z.object({ password: passwordField, currentPassword: z.string().max(128).optional() })), async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (user.passwordHash && !(req.body.currentPassword && (await bcrypt.compare(req.body.currentPassword, user.passwordHash)))) {
    throw badRequest('Mot de passe actuel incorrect', 'BAD_CURRENT_PASSWORD');
  }
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.passwordSet = true;
  await user.save();
  res.json(await sessionPayload(user));
});

router.delete('/password', validate(z.object({ currentPassword: z.string().max(128) })), async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (user.role === 'admin') throw badRequest('Le mot de passe est obligatoire pour les administratrices');
  if (user.passwordHash && !(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw badRequest('Mot de passe actuel incorrect', 'BAD_CURRENT_PASSWORD');
  user.passwordHash = undefined;
  user.passwordSet = false;
  await user.save();
  res.json(await sessionPayload(user));
});

// Consentements séparés, modifiables à tout moment (RG-03, RG-04, 8.2).
const consentSchema = z.object({
  health: z.boolean().optional(),
  marketingEmail: z.boolean().optional(),
  marketingSms: z.boolean().optional(),
  marketingWhatsapp: z.boolean().optional(),
});

router.patch('/consents', validate(consentSchema), async (req, res) => {
  const now = new Date();
  for (const [key, accepted] of Object.entries(req.body)) {
    req.user.consents[key] = { accepted, at: now };
  }
  req.user.markModified('consents');
  await req.user.save();
  res.json(await sessionPayload(req.user));
});

// RG-05 — questionnaire d'accueil.
const onboardingSchema = z.object({
  lastPeriodStart: day.nullable().optional(),
  cycleLength: z.number().int().min(15).max(60).nullable().optional(),
  periodLength: z.number().int().min(1).max(15).nullable().optional(),
  goal: z.enum(['suivre', 'enfant', 'enceinte']).default('suivre'),
  pastPeriods: z.array(z.object({ start: day, end: day.optional() })).max(12).optional(),
  pregnancy: z.object({ lmp: day.optional(), dueDate: day.optional(), conceptionDate: day.optional() }).optional(),
});

router.post('/onboarding', validate(onboardingSchema), async (req, res) => {
  const u = req.user;
  const b = req.body;
  if (!u.consents?.health?.accepted) throw badRequest('Accepte le traitement de tes données de santé pour utiliser le suivi', 'HEALTH_CONSENT_REQUIRED');
  const { today } = nowFor(u);
  const periodLength = b.periodLength || 5;

  u.onboarding = { completed: true, goal: b.goal, cycleLength: b.cycleLength ?? undefined, periodLength: b.periodLength ?? undefined };

  const entries = [...(b.pastPeriods || []).map((p) => ({ ...p, source: 'historique' }))];
  if (b.lastPeriodStart && b.goal !== 'enceinte') entries.push({ start: b.lastPeriodStart, source: 'accueil' });
  for (const e of entries) {
    if (e.start > today) continue;
    const end = e.end || addDays(e.start, periodLength - 1);
    const exists = await Period.exists({ user: u._id, start: e.start });
    if (exists) continue;
    await Period.create({ user: u._id, start: e.start, end: end < today ? end : undefined, source: e.source });
  }

  if (b.goal === 'enceinte') {
    u.mode = 'grossesse';
    await Pregnancy.updateMany({ user: u._id, status: 'active' }, { $set: { status: 'arretee', endedOn: today } });
    await Pregnancy.create({
      user: u._id,
      lmp: b.pregnancy?.lmp || b.lastPeriodStart || undefined,
      dueDate: b.pregnancy?.dueDate,
      conceptionDate: b.pregnancy?.conceptionDate,
      cycleLength: b.cycleLength || 28,
    });
  }
  await u.save();
  res.json(await sessionPayload(u));
});

// Jeton de notifications (Expo push ou Web Push).
router.post(
  '/push',
  validate(z.object({ token: z.string().min(10).max(500).optional(), subscription: z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }).optional() })),
  async (req, res) => {
    const endpoint = req.body.token || req.body.subscription?.endpoint;
    if (!endpoint) throw badRequest('Jeton manquant');
    await PushSubscription.updateOne({ endpoint }, { $set: { user: req.user._id, keys: req.body.subscription?.keys } }, { upsert: true });
    res.json({ ok: true });
  },
);

// Export des données (8.2).
/** RGPD — toutes les données du compte. */
async function exportData(req) {
  const user = req.user._id;
  const practitioner = await Practitioner.findOne({ user }).lean();
  const data = {
    exportedAt: new Date().toISOString(),
    profile: req.user.toPublic(),
    periods: await Period.find({ user }).lean(),
    healthLogs: await DailyLog.find({ user }).lean(),
    prayers: await PrayerLog.find({ user }).lean(),
    fasts: {
      missed: await MissedFast.find({ user }).lean(),
      madeUp: await MadeUpFast.find({ user }).lean(),
      plan: await FastPlan.findOne({ user }).lean(),
      voluntary: await VoluntaryFast.find({ user }).lean(),
    },
    pregnancies: await Pregnancy.find({ user }).lean(),
    notes: (await Note.find({ user }).lean()).map(plainNote),
    dhikr: await DhikrDay.find({ user }).lean(),
    appointments: await Appointment.find({ user }).lean(),
    bookings: await Booking.find({ client: user }).lean(),
    reviews: await Review.find({ client: user }).lean(),
    practitioner: practitioner
      ? {
          profile: practitioner,
          services: await Service.find({ practitioner: practitioner._id }).lean(),
          availability: await Availability.find({ practitioner: practitioner._id }).lean(),
          subscriptions: await Subscription.find({ practitioner: practitioner._id }).lean(),
        }
      : null,
  };
  return data;
}

router.get('/export', async (req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="nissali-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(await exportData(req));
});

// 4.5 · 4.5 — « Télécharger mes données » : fichier envoyé par e-mail (RGPD, au plus tard sous 48 h).
router.post('/export/email', async (req, res) => {
  if (!req.user.email) throw badRequest('Ajoute une adresse e-mail à ton compte pour recevoir tes données', 'NO_EMAIL');
  const data = await exportData(req);
  const name = `nissali-export-${new Date().toISOString().slice(0, 10)}.json`;
  await sendMail({
    to: req.user.email,
    subject: 'Tes données Nissali',
    title: 'Tes données Nissali',
    preheader: 'Le fichier de tes données est joint à cet e-mail.',
    html: `<p>Salam ${String(req.user.firstName || '').replace(/[<>&"']/g, '')},</p><p>Tu trouveras en pièce jointe le fichier de toutes tes données Nissali (format JSON).</p><p>Si tu n’es pas à l’origine de cette demande, change ton mot de passe et écris-nous à contact@nissali.fr.</p>`,
    text: 'Le fichier de tes données Nissali est joint à cet e-mail.',
    attachments: [{ filename: name, content: JSON.stringify(data, null, 2), contentType: 'application/json' }],
  });
  res.json({ ok: true, to: mask(req.user.email, 'email') });
});

// RG-07 — suppression du compte et de toutes les données, en quelques gestes.
router.delete('/', async (req, res) => {
  await purgeUser(req.user._id);
  endSession(req, res);
  res.json({ ok: true, message: 'Ton compte et toutes tes données ont été supprimés.' });
});

export default router;

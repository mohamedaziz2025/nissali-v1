// Espace praticienne (mobile et web) : inscription avec formule, profil public, prestations,
// disponibilités, réservations, fiches clientes, avis, statistiques.
// Même compte que l'espace personnel : on bascule sans se déconnecter.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Availability, Booking, BOOKING_STATUSES, Category, ClientRecord, Conversation, Message, Plan, Practitioner, Review, Service, Subscription, TimeOff, User } from '../models/index.js';
import { bestCity } from '../services/geo.js';
import { activePlanFor, ACTIVE_BOOKING, activeTrialPlan, assertFeature, assertServiceQuota, endOtherOnlineSubscriptions, featureList, FREE_PLAN_KEY, getPractitionerFor, touchClientRecord, trialInfo } from '../services/marketplace.js';
import { cancelAtPeriodEnd as stripeCancelAtPeriodEnd, createPortalSession, createSubscriptionCheckout, stripeEnabled } from '../services/stripe.js';
import { sendMail } from '../services/mailer.js';
import { notify } from '../services/notifications.js';
import { createJitsiLink } from '../services/video.js';
import { addDays, isDay, isTime, localParts, timeToMinutes } from '../utils/dates.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/http.js';
import { sessionPayload } from './auth.js';
import { createFileToken } from '../services/session.js';

const router = Router();
router.use(requireAuth);

const time = z.string().refine(isTime, 'Heure invalide (HH:mm)');
const day = z.string().refine(isDay, 'Date invalide');

async function loadPro(req) {
  const p = await getPractitionerFor(req.user);
  if (!p) throw forbidden('Crée d’abord ton profil professionnel', 'NOT_PRACTITIONER');
  return p;
}

/** Crée (ou remplace) l'abonnement : la formule gratuite est active tout de suite. */
async function subscribe(practitioner, planKey, billing) {
  const plan = await Plan.findOne({ key: planKey, active: true });
  if (!plan) throw badRequest('Formule introuvable');
  if (plan.trial) return startTrial(practitioner, plan);
  const amount = billing === 'annuel' ? plan.priceYearly : plan.priceMonthly;
  const free = amount === 0;
  // Formule déjà active : on ne crée pas un second abonnement (Stripe facturerait deux fois).
  const current = await Subscription.findOne({ practitioner: practitioner._id, plan: plan.key, billing, status: 'active' });
  if (current) return current;
  // Retour à la formule gratuite : l'abonnement en ligne précédent cesse de facturer.
  if (free) await endOtherOnlineSubscriptions(practitioner._id);
  await Subscription.updateMany({ practitioner: practitioner._id, status: 'en_attente' }, { $set: { status: 'annulee' } });
  if (free) await Subscription.updateMany({ practitioner: practitioner._id, status: 'active' }, { $set: { status: 'annulee' } });
  return Subscription.create({
    practitioner: practitioner._id,
    plan: plan.key,
    billing,
    amount,
    status: free ? 'active' : 'en_attente',
    startedAt: free ? new Date() : undefined,
    paymentReference: free ? undefined : `NIS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
  });
}

/** Essai gratuit : actif tout de suite, une seule fois par praticienne, avec les fonctionnalités réglées par l'équipe. */
async function startTrial(practitioner, plan) {
  if (await Subscription.exists({ practitioner: practitioner._id, trial: true })) throw badRequest('Tu as déjà profité de l’essai gratuit', 'TRIAL_USED');
  const now = new Date();
  return Subscription.create({
    practitioner: practitioner._id,
    plan: plan.key,
    billing: 'mensuel',
    amount: 0,
    status: 'active',
    trial: true,
    startedAt: now,
    endsAt: plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 86_400_000) : undefined,
  });
}

/**
 * Formule de départ à l'inscription : l'essai gratuit (s'il est actif) quand aucune formule payante
 * n'est choisie, sinon la formule choisie, sinon la formule gratuite.
 */
async function signupPlan(key, billing) {
  const chosen = key ? await Plan.findOne({ key, active: true }) : null;
  if (key && !chosen) throw badRequest('Formule introuvable');
  const paid = chosen && (billing === 'annuel' ? chosen.priceYearly : chosen.priceMonthly) > 0;
  if (paid) return chosen;
  return (await activeTrialPlan()) || chosen || (await Plan.findOne({ key: FREE_PLAN_KEY, active: true }));
}

/**
 * Ouvre une session Stripe Checkout pour un abonnement payant et renvoie l'URL de paiement.
 * Retourne null (paiement manuel par l'équipe) si Stripe est coupé ou si la formule est gratuite.
 */
async function attachCheckout(practitioner, sub, user) {
  // Formule déjà active : il n'y a rien à acheter (sinon double facturation).
  if (!stripeEnabled() || !sub?.amount || sub.status === 'active') return null;
  const plan = await Plan.findOne({ key: sub.plan });
  if (!plan) return null;
  const returnUrl = `${env.appUrl}/pro/abonnement`;
  try {
    const session = await createSubscriptionCheckout({ practitioner, user, plan, billing: sub.billing, subscriptionId: sub._id, returnUrl });
    sub.stripeSessionId = session.id;
    sub.stripeCustomerId = practitioner.stripeCustomerId;
    await sub.save();
    return session.url;
  } catch (err) {
    // Stripe indisponible : on retombe sur le règlement manuel par l'équipe (référence déjà créée).
    console.warn('[stripe] session Checkout impossible :', err.message);
    return null;
  }
}

// --- Inscription ------------------------------------------------------------

const registerSchema = z.object({
  displayName: z.string().trim().min(2, 'Ton nom professionnel est obligatoire').max(80),
  specialty: z.string().min(1, 'Choisis ta spécialité'),
  city: z.string().trim().min(1, 'Ta ville d’exercice est obligatoire').max(80),
  address: z.string().max(200).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  siret: z.string().max(20).optional().default(''),
  inPerson: z.boolean().default(true),
  supportsVideo: z.boolean().default(false),
  languages: z.array(z.string().max(30)).max(6).optional(),
  plan: z.string().optional(), // absent : essai gratuit (ou formule gratuite)
  billing: z.enum(['mensuel', 'annuel']).default('mensuel'),
  phone: z.string().trim().max(30).optional(),
  showPhone: z.boolean().optional(),
  diplomas: z.array(z.string().trim().min(2).max(120)).max(10).optional(),
  professionalId: z.string().trim().max(20).optional(),
});

router.post('/register', validate(registerSchema), async (req, res) => {
  if (await getPractitionerFor(req.user)) throw conflict('Tu as déjà un profil professionnel');
  const b = req.body;
  if (!(await Category.exists({ key: b.specialty, active: true }))) throw badRequest('Spécialité inconnue');
  const startPlan = await signupPlan(b.plan, b.billing);
  const p = await Practitioner.create({
    user: req.user._id,
    displayName: b.displayName,
    specialty: b.specialty,
    categories: [b.specialty],
    description: b.description,
    location: { city: b.city, address: b.address },
    legal: { siret: b.siret },
    phone: b.phone || '',
    showPhone: Boolean(b.showPhone && b.phone),
    diplomas: b.diplomas || [],
    professionalId: b.professionalId || '',
    inPerson: b.inPerson,
    supportsVideo: b.supportsVideo,
    languages: b.languages?.length ? b.languages : ['Français'],
    timezone: req.user.city?.timezone || 'Europe/Paris',
  });
  await locate(p);
  await p.save();
  const sub = startPlan ? await subscribe(p, startPlan.key, b.billing) : null;
  const checkoutUrl = await attachCheckout(p, sub, req.user);
  req.user.lastSpace = 'pro';
  await req.user.save();

  const admins = await User.find({ role: 'admin' }).lean();
  for (const a of admins) {
    if (a.email) await sendMail({ to: a.email, subject: 'Nouvelle inscription praticienne', html: `<p>${p.displayName} (${b.specialty}, ${b.city}) vient de s’inscrire${startPlan ? ` (${startPlan.trial ? 'essai gratuit' : `formule « ${startPlan.name} »`})` : ''}.</p>`, text: `Nouvelle praticienne : ${p.displayName}` });
  }
  res.status(201).json({ ...(await sessionPayload(req.user)), subscription: sub, checkoutUrl, trial: trialInfo(sub, startPlan) });
});

// --- Profil -----------------------------------------------------------------

router.get('/me', async (req, res) => {
  const p = await loadPro(req);
  const { plan, subscription } = await activePlanFor(p);
  const pending = await Subscription.findOne({ practitioner: p._id, status: 'en_attente' }).lean();
  res.json({
    practitioner: p,
    plan,
    subscription,
    pendingSubscription: pending,
    trial: trialInfo(subscription, plan),
    included: featureList(plan?.features),
    videoActive: Boolean(p.supportsVideo && plan?.features?.video),
    // Paiement en ligne : activé par l'équipe, portail disponible dès qu'un client Stripe existe.
    billing: { online: stripeEnabled(), portal: Boolean(p.stripeCustomerId) },
    counts: {
      services: await Service.countDocuments({ practitioner: p._id, active: true }),
      pending: await Booking.countDocuments({ practitioner: p._id, status: 'en_attente' }),
    },
  });
});

const profileSchema = registerSchema
  .omit({ plan: true, billing: true })
  .partial()
  .extend({
    lat: z.number().optional(),
    lng: z.number().optional(),
    minNoticeHours: z.number().int().min(0).max(168).optional(),
    autoConfirm: z.boolean().optional(),
    // RG-26 : numéro professionnel, affiché seulement si showPhone
    phone: z.string().trim().max(30).regex(/^[+\d][\d\s.()-]{5,}$/, 'Numéro invalide').optional().or(z.literal('')),
    showPhone: z.boolean().optional(),
    diplomas: z.array(z.string().trim().min(2).max(120)).max(10).optional(),
    professionalId: z.string().trim().max(20).optional(),
  });

/** Ville d'exercice → coordonnées et région (Open-Meteo), pour la distance et le filtre Région de l'annuaire. */
async function locate(p) {
  const place = await bestCity(p.location.city);
  if (!place) return;
  p.location.lat = place.lat;
  p.location.lng = place.lng;
  p.location.region = place.admin || '';
}

router.patch('/me', validate(profileSchema), async (req, res) => {
  const p = await loadPro(req);
  const b = req.body;
  for (const k of ['displayName', 'specialty', 'description', 'inPerson', 'supportsVideo', 'languages', 'minNoticeHours', 'autoConfirm', 'phone', 'showPhone', 'diplomas', 'professionalId']) if (b[k] !== undefined) p[k] = b[k];
  if (p.showPhone && !p.phone) p.showPhone = false;
  const cityChanged = b.city !== undefined && b.city !== p.location.city;
  if (b.city !== undefined) p.location.city = b.city;
  if (b.address !== undefined) p.location.address = b.address;
  if (b.lat !== undefined) p.location.lat = b.lat;
  if (b.lng !== undefined) p.location.lng = b.lng;
  if ((cityChanged && b.lat === undefined) || p.location.lat == null) await locate(p);
  if (b.siret !== undefined) p.legal.siret = b.siret;
  // La visio est mémorisée même si la formule ne l'inclut pas encore (formule payante en attente) :
  // elle n'est proposée aux utilisatrices qu'avec une formule qui l'inclut.
  await p.save();
  const { plan } = await activePlanFor(p);
  res.json({ ...p.toObject(), id: p.id, videoActive: Boolean(p.supportsVideo && plan?.features?.video) });
});

const uploadDir = path.resolve(env.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

router.post('/photo', upload.single('photo'), async (req, res) => {
  const p = await loadPro(req);
  if (!req.file) throw badRequest('Image JPEG, PNG ou WebP attendue');
  p.photoUrl = `${env.publicApiUrl}/uploads/${req.file.filename}`;
  await p.save();
  res.json({ photoUrl: p.photoUrl });
});

// --- Abonnement -------------------------------------------------------------

router.get('/plans', async (req, res) => {
  const p = await getPractitionerFor(req.user);
  const plans = await Plan.find({ active: true }).sort({ order: 1 }).lean();
  const active = p ? await activePlanFor(p) : null;
  // L'essai gratuit ne se souscrit pas ici : il est proposé une seule fois, à l'inscription.
  res.json({ plans: plans.filter((x) => !x.trial).map((x) => ({ ...x, included: featureList(x.features) })), current: active?.plan?.key || null, trial: trialInfo(active?.subscription, active?.plan), online: stripeEnabled() });
});

router.post('/subscription', validate(z.object({ plan: z.string(), billing: z.enum(['mensuel', 'annuel']).default('mensuel') })), async (req, res) => {
  const p = await loadPro(req);
  const sub = await subscribe(p, req.body.plan, req.body.billing);
  const checkoutUrl = await attachCheckout(p, sub, req.user);
  res.status(201).json({
    subscription: sub,
    checkoutUrl,
    message:
      sub.status === 'active'
        ? 'Ta formule est active.'
        : checkoutUrl
          ? `Termine le règlement en ligne (référence ${sub.paymentReference}) pour activer ta formule « ${sub.plan} ».`
          : `Ta demande est enregistrée (référence ${sub.paymentReference}). L’équipe Nissali te contacte pour le règlement, puis active ta formule.`,
  });
});

/** Portail de paiement Stripe : gérer moyen de paiement et résiliation. */
router.post('/subscription/portal', async (req, res) => {
  const p = await loadPro(req);
  if (!stripeEnabled() || !p.stripeCustomerId) throw badRequest('La gestion en ligne de l’abonnement n’est pas disponible');
  const returnUrl = `${env.appUrl}/pro/abonnement`;
  const session = await createPortalSession(p.stripeCustomerId, returnUrl);
  res.json({ url: session.url });
});

/** Résiliation à la fin de la période en cours : la formule reste active jusque-là. */
router.post('/subscription/cancel', async (req, res) => {
  const p = await loadPro(req);
  const sub = await Subscription.findOne({ practitioner: p._id, status: 'active', stripeSubscriptionId: { $ne: null } }).sort({ createdAt: -1 });
  if (!sub?.stripeSubscriptionId) throw badRequest('Aucun abonnement en ligne à résilier');
  await stripeCancelAtPeriodEnd(sub.stripeSubscriptionId);
  sub.cancelAtPeriodEnd = true;
  await sub.save();
  res.json({ subscription: sub, message: `Ta formule reste active jusqu’au ${sub.endsAt ? sub.endsAt.toISOString().slice(0, 10) : 'terme de la période'}, puis repassera en formule gratuite.` });
});

// --- Prestations ------------------------------------------------------------

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(1000).optional().default(''),
  price: z.number().min(0).max(10000),
  durationMinutes: z.number().int().min(10).max(480),
  mode: z.enum(['cabinet', 'visio', 'les_deux']).default('cabinet'),
  active: z.boolean().default(true),
});

router.get('/services', async (req, res) => {
  const p = await loadPro(req);
  res.json(await Service.find({ practitioner: p._id }).sort({ createdAt: 1 }).lean());
});

router.post('/services', validate(serviceSchema), async (req, res) => {
  const p = await loadPro(req);
  if (req.body.active) await assertServiceQuota(p);
  if (req.body.mode !== 'cabinet') await assertFeature(p, 'video');
  res.status(201).json(await Service.create({ ...req.body, practitioner: p._id }));
});

router.patch('/services/:id', validate(serviceSchema.partial()), async (req, res) => {
  const p = await loadPro(req);
  const s = await Service.findOne({ _id: req.params.id, practitioner: p._id });
  if (!s) throw notFound('Prestation introuvable');
  if (req.body.active && !s.active) await assertServiceQuota(p);
  // Seul un passage vers la visio est contrôlé : modifier une prestation existante reste toujours possible.
  if (req.body.mode && req.body.mode !== 'cabinet' && req.body.mode !== s.mode) await assertFeature(p, 'video');
  Object.assign(s, req.body);
  await s.save();
  res.json(s);
});

router.delete('/services/:id', async (req, res) => {
  const p = await loadPro(req);
  const hasBookings = await Booking.exists({ service: req.params.id, status: { $in: ACTIVE_BOOKING } });
  if (hasBookings) {
    await Service.updateOne({ _id: req.params.id, practitioner: p._id }, { $set: { active: false } });
    return res.json({ ok: true, archived: true });
  }
  await Service.deleteOne({ _id: req.params.id, practitioner: p._id });
  res.json({ ok: true });
});

// --- Disponibilités ---------------------------------------------------------

router.get('/availability', async (req, res) => {
  const p = await loadPro(req);
  const [slots, timeOff] = await Promise.all([Availability.find({ practitioner: p._id }).sort({ weekday: 1, start: 1 }).lean(), TimeOff.find({ practitioner: p._id, to: { $gte: localParts(new Date(), p.timezone).day } }).sort({ from: 1 }).lean()]);
  res.json({ slots, timeOff });
});

router.put(
  '/availability',
  validate(z.object({ slots: z.array(z.object({ weekday: z.number().int().min(0).max(6), start: time, end: time, active: z.boolean().default(true) })).max(50) })),
  async (req, res) => {
    const p = await loadPro(req);
    for (const s of req.body.slots) if (timeToMinutes(s.end) <= timeToMinutes(s.start)) throw badRequest('L’heure de fin doit suivre l’heure de début');
    await Availability.deleteMany({ practitioner: p._id });
    await Availability.insertMany(req.body.slots.map((s) => ({ ...s, practitioner: p._id })));
    res.json(await Availability.find({ practitioner: p._id }).sort({ weekday: 1, start: 1 }).lean());
  },
);

router.post('/time-off', validate(z.object({ from: day, to: day, reason: z.string().max(120).optional() })), async (req, res) => {
  const p = await loadPro(req);
  if (req.body.to < req.body.from) throw badRequest('Dates incohérentes');
  res.status(201).json(await TimeOff.create({ ...req.body, practitioner: p._id }));
});

router.delete('/time-off/:id', async (req, res) => {
  const p = await loadPro(req);
  await TimeOff.deleteOne({ _id: req.params.id, practitioner: p._id });
  res.json({ ok: true });
});

// --- Réservations -----------------------------------------------------------

const clientCard = (u) => (u ? { id: String(u._id), firstName: u.firstName, email: u.email, phone: u.phone, city: u.city?.name } : null);

router.get('/bookings', async (req, res) => {
  const p = await loadPro(req);
  const filter = { practitioner: p._id };
  if (BOOKING_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (isDay(req.query.from)) filter.day = { ...(filter.day || {}), $gte: req.query.from };
  if (isDay(req.query.to)) filter.day = { ...(filter.day || {}), $lte: req.query.to };
  const list = await Booking.find(filter).sort({ startAt: req.query.order === 'desc' ? -1 : 1 }).limit(300).populate({ path: 'client', model: User, select: 'firstName email phone city' }).lean();
  res.json(list.map((b) => ({ ...b, id: String(b._id), client: clientCard(b.client) })));
});

/** Confirmation : lien visio Jitsi gratuit si besoin, fiche cliente, notification. */
export async function confirmBooking(booking, practitioner) {
  if (booking.mode === 'visio' && !booking.videoUrl) booking.videoUrl = createJitsiLink();
  booking.status = 'confirmee';
  await booking.save();
  await touchClientRecord(booking);
  await notify(booking.client, {
    key: `booking-ok-${booking.id}`,
    type: 'reservation',
    body: 'Ton rendez-vous est confirmé',
    detail: `${practitioner.displayName} a confirmé « ${booking.serviceName} » le ${booking.day} à ${booking.time}.${booking.videoUrl ? ' Le lien de visio est disponible dans tes rendez-vous.' : ''}`,
    link: '/praticiennes/rendez-vous',
  });
}

const statusSchema = z.object({ status: z.enum(['confirmee', 'refusee', 'annulee', 'terminee', 'absente']), reason: z.string().max(300).optional() });

router.patch('/bookings/:id', validate(statusSchema), async (req, res) => {
  const p = await loadPro(req);
  const b = await Booking.findOne({ _id: req.params.id, practitioner: p._id });
  if (!b) throw notFound('Réservation introuvable');
  const next = req.body.status;
  const allowed = {
    en_attente: ['confirmee', 'refusee', 'annulee'],
    confirmee: ['annulee', 'terminee', 'absente'],
    terminee: [],
    refusee: [],
    annulee: [],
    absente: ['terminee'],
  };
  if (!allowed[b.status].includes(next)) throw badRequest(`Impossible de passer de « ${b.status} » à « ${next} »`);

  if (next === 'confirmee') {
    await confirmBooking(b, p);
  } else {
    b.status = next;
    if (next === 'annulee') {
      b.cancelledBy = 'praticienne';
      b.cancelReason = req.body.reason;
    }
    await b.save();
    const texts = {
      refusee: 'Ta demande de rendez-vous n’a pas pu être acceptée',
      annulee: 'Ton rendez-vous a été annulé',
      terminee: 'Comment s’est passé ton rendez-vous ?',
    };
    if (texts[next]) {
      await notify(b.client, {
        key: `booking-${next}-${b.id}`,
        type: 'reservation',
        body: texts[next],
        detail: `${p.displayName} · « ${b.serviceName} » le ${b.day} à ${b.time}.${req.body.reason ? ` ${req.body.reason}` : ''}${next === 'terminee' ? ' Tu peux laisser un avis.' : ''}`,
        link: '/praticiennes/rendez-vous',
      });
    }
  }
  res.json({ ...b.toObject(), id: b.id });
});

// --- Fiches clientes (CRM) --------------------------------------------------

/** Statistiques d'une cliente à partir de ses rendez-vous. */
function clientStats(bookings, today) {
  const done = bookings.filter((b) => b.status === 'terminee').sort((a, b) => (a.day < b.day ? -1 : 1));
  const upcoming = bookings.filter((b) => ['en_attente', 'confirmee'].includes(b.status) && b.day >= today).sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
  const gaps = done.slice(1).map((b, i) => (new Date(b.day) - new Date(done[i].day)) / 86_400_000);
  return {
    visits: done.length,
    noShows: bookings.filter((b) => b.status === 'absente').length,
    cancellations: bookings.filter((b) => b.status === 'annulee').length,
    firstVisit: done[0]?.day || null,
    lastVisit: done[done.length - 1]?.day || null,
    nextBooking: upcoming[0] ? { day: upcoming[0].day, time: upcoming[0].time, serviceName: upcoming[0].serviceName, status: upcoming[0].status } : null,
    averageGapDays: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
  };
}

async function loadRecord(req, p) {
  await assertFeature(p, 'crm');
  const record = await ClientRecord.findOne({ practitioner: p._id, client: req.params.clientId });
  if (!record) throw notFound('Fiche introuvable');
  return record;
}

router.get('/clients', async (req, res) => {
  const p = await loadPro(req);
  await assertFeature(p, 'crm');
  const today = localParts(new Date(), p.timezone).day;
  const [records, bookings] = await Promise.all([
    ClientRecord.find({ practitioner: p._id }).sort({ lastBookingAt: -1 }).populate({ path: 'client', model: User, select: 'firstName email phone city' }).lean(),
    Booking.find({ practitioner: p._id }).select('client day time startAt status price serviceName').lean(),
  ]);
  res.json(
    records.map((r) => {
      const stats = clientStats(bookings.filter((b) => String(b.client) === String(r.client?._id)), today);
      return { id: String(r._id), status: r.status, tags: r.tags, consent: r.consent, client: clientCard(r.client), stats, notesCount: r.notes?.length || 0, filesCount: r.files?.length || 0, createdAt: r.createdAt };
    }),
  );
});

router.get('/clients/:clientId', async (req, res) => {
  const p = await loadPro(req);
  const record = await loadRecord(req, p);
  await record.populate({ path: 'client', model: User, select: 'firstName email phone city createdAt' });
  const today = localParts(new Date(), p.timezone).day;
  const bookings = await Booking.find({ practitioner: p._id, client: req.params.clientId }).sort({ startAt: -1 }).lean();
  const r = record.toObject();
  res.json({
    ...r,
    id: record.id,
    client: clientCard(record.client),
    files: (r.files || []).map(({ storedName, ...f }) => ({ ...f, id: String(f._id) })),
    notes: [...(r.notes || [])].sort((a, b) => new Date(b.at) - new Date(a.at)),
    bookings: bookings.map((b) => ({ ...b, id: String(b._id) })),
    stats: clientStats(bookings, today),
    history: await clientHistory(p, record, bookings),
  });
});

const BOOKING_LABEL = { en_attente: 'Demande de rendez-vous', confirmee: 'Rendez-vous confirmé', terminee: 'Séance réalisée', annulee: 'Rendez-vous annulé', refusee: 'Demande refusée', absente: 'Absente au rendez-vous' };

/** Historique de la cliente avec cette praticienne : rendez-vous, notes de séance, documents, avis, messages. */
async function clientHistory(p, record, bookings) {
  const [reviews, conv] = await Promise.all([
    Review.find({ practitioner: p._id, client: record.client._id }).lean(),
    Conversation.findOne({ practitioner: p._id, user: record.client._id }).lean(),
  ]);
  const events = [];
  events.push({ at: record.createdAt, kind: 'fiche', title: 'Première prise de contact', detail: 'Fiche cliente créée' });
  for (const b of bookings) {
    events.push({ at: b.startAt, kind: 'rdv', status: b.status, title: BOOKING_LABEL[b.status] || 'Rendez-vous', detail: `${b.serviceName} · ${b.mode === 'visio' ? 'visio' : 'cabinet'}`, day: b.day, time: b.time, bookingId: String(b._id) });
  }
  for (const n of record.notes || []) events.push({ at: n.at, kind: n.kind === 'seance' ? 'seance' : 'note', title: n.kind === 'seance' ? n.title || 'Compte rendu de séance' : n.title || 'Note', detail: (n.content || '').slice(0, 160) });
  for (const f of record.files || []) events.push({ at: f.uploadedAt || f.at || record.updatedAt, kind: 'document', title: 'Document ajouté', detail: f.name });
  for (const r of reviews) events.push({ at: r.createdAt, kind: 'avis', title: `Avis laissé · ${r.rating}/5`, detail: r.comment?.slice(0, 160) || '' });
  if (conv) {
    const count = await Message.countDocuments({ conversation: conv._id });
    const first = await Message.findOne({ conversation: conv._id }).sort({ createdAt: 1 }).lean();
    if (first) events.push({ at: first.createdAt, kind: 'message', title: 'Premier message', detail: `${count} message${count > 1 ? 's' : ''} échangé${count > 1 ? 's' : ''}`, conversationId: String(conv._id) });
  }
  return events.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at));
}

const optionalText = (max) => z.string().max(max).optional().nullable();
const clientPatchSchema = z.object({
  status: z.enum(['nouvelle', 'reguliere', 'fidele', 'inactive']).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(15).optional(),
  profile: z
    .object({
      birthDate: z.string().refine(isDay, 'Date invalide').optional().nullable().or(z.literal('')),
      address: optionalText(300),
      occupation: optionalText(120),
      emergencyContact: optionalText(200),
      referral: z.enum(['annuaire', 'bouche_a_oreille', 'reseaux', 'medecin', 'autre']).optional().nullable().or(z.literal('')),
      preferredMode: z.enum(['cabinet', 'visio', 'indifferent']).optional().nullable().or(z.literal('')),
      preferredTimes: optionalText(200),
    })
    .partial()
    .optional(),
  care: z.object({ reason: optionalText(2000), history: optionalText(4000), allergies: optionalText(1000), treatments: optionalText(2000), goals: optionalText(2000) }).partial().optional(),
  consent: z.boolean().optional(),
});

router.patch('/clients/:clientId', validate(clientPatchSchema), async (req, res) => {
  const p = await loadPro(req);
  const record = await loadRecord(req, p);
  const b = req.body;
  if (b.status) record.status = b.status;
  if (b.tags) record.tags = b.tags;
  for (const group of ['profile', 'care']) {
    if (!b[group]) continue;
    for (const [k, v] of Object.entries(b[group])) record[group][k] = v === '' || v === null ? undefined : v;
  }
  if (b.consent !== undefined) record.consent = { given: b.consent, at: b.consent ? new Date() : undefined };
  await record.save();
  res.json({ ok: true });
});

const noteSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  kind: z.enum(['note', 'seance']).default('note'),
  title: z.string().trim().max(120).optional(),
  bookingId: z.string().optional(),
});

router.post('/clients/:clientId/notes', validate(noteSchema), async (req, res) => {
  const p = await loadPro(req);
  const record = await loadRecord(req, p);
  let booking;
  if (req.body.bookingId) {
    booking = await Booking.findOne({ _id: req.body.bookingId, practitioner: p._id, client: req.params.clientId }).select('_id');
    if (!booking) throw badRequest('Rendez-vous introuvable pour cette cliente');
  }
  record.notes.push({ content: req.body.content, kind: req.body.kind, title: req.body.title, booking: booking?._id });
  await record.save();
  res.status(201).json(record.notes[record.notes.length - 1]);
});

router.patch('/clients/:clientId/notes/:noteId', validate(noteSchema.partial()), async (req, res) => {
  const p = await loadPro(req);
  const record = await loadRecord(req, p);
  const note = record.notes.id(req.params.noteId);
  if (!note) throw notFound('Note introuvable');
  for (const k of ['content', 'kind', 'title']) if (req.body[k] !== undefined) note[k] = req.body[k];
  await record.save();
  res.json(note);
});

router.delete('/clients/:clientId/notes/:noteId', async (req, res) => {
  const p = await loadPro(req);
  const record = await loadRecord(req, p);
  record.notes.pull({ _id: req.params.noteId });
  await record.save();
  res.json({ ok: true });
});

// Documents privés (ordonnances, bilans, comptes rendus…) : stockés hors du dossier public.
const privateDir = path.resolve(env.privateDir);
fs.mkdirSync(privateDir, { recursive: true });
const ALLOWED_DOCS = /^(application\/pdf|image\/(jpeg|png|webp))$/;
const docUpload = multer({
  storage: multer.diskStorage({
    destination: privateDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase().slice(0, 6)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_DOCS.test(file.mimetype)),
});

router.post('/clients/:clientId/files', docUpload.single('file'), async (req, res) => {
  const p = await loadPro(req);
  const record = await loadRecord(req, p);
  if (!req.file) throw badRequest('Document PDF, JPEG, PNG ou WebP attendu (10 Mo max)');
  record.files.push({ name: req.file.originalname.slice(0, 200), storedName: req.file.filename, mime: req.file.mimetype, size: req.file.size });
  await record.save();
  const f = record.files[record.files.length - 1];
  res.status(201).json({ id: f.id, name: f.name, mime: f.mime, size: f.size, at: f.at });
});

router.get('/clients/:clientId/files/:fileId', async (req, res) => {
  const p = await loadPro(req);
  const record = await loadRecord(req, p);
  const f = record.files.id(req.params.fileId);
  if (!f) throw notFound('Document introuvable');
  res.setHeader('Content-Type', f.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(path.join(privateDir, f.storedName));
});

router.get('/clients/:clientId/files/:fileId/link', async (req, res) => {
  const p = await loadPro(req);
  const record = await loadRecord(req, p);
  if (!record.files.id(req.params.fileId)) throw notFound('Document introuvable');
  res.json({ token: await createFileToken(record._id, req.params.fileId), expiresIn: 300 });
});

router.delete('/clients/:clientId/files/:fileId', async (req, res) => {
  const p = await loadPro(req);
  const record = await loadRecord(req, p);
  const f = record.files.id(req.params.fileId);
  if (f) {
    fs.rm(path.join(privateDir, f.storedName), { force: true }, () => {});
    record.files.pull({ _id: f._id });
    await record.save();
  }
  res.json({ ok: true });
});

// --- Avis -------------------------------------------------------------------

router.get('/reviews', async (req, res) => {
  const p = await loadPro(req);
  const reviews = await Review.find({ practitioner: p._id }).sort({ createdAt: -1 }).populate({ path: 'client', model: User, select: 'firstName' }).lean();
  res.json(reviews.map((r) => ({ ...r, id: String(r._id), author: r.client?.firstName })));
});

router.post('/reviews/:id/reply', validate(z.object({ reply: z.string().trim().min(1).max(1000) })), async (req, res) => {
  const p = await loadPro(req);
  const r = await Review.findOneAndUpdate({ _id: req.params.id, practitioner: p._id }, { $set: { reply: req.body.reply } }, { new: true });
  if (!r) throw notFound();
  res.json(r);
});

// --- Tableau de bord et statistiques ----------------------------------------

router.get('/overview', async (req, res) => {
  const p = await loadPro(req);
  const today = localParts(new Date(), p.timezone).day;
  const month = today.slice(0, 7);
  const prev = new Date(`${month}-01T12:00:00Z`);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const prevMonth = prev.toISOString().slice(0, 7);
  const weekEnd = addDays(today, 6);
  const { plan, subscription } = await activePlanFor(p);
  const populateClient = { path: 'client', model: User, select: 'firstName email phone city' };
  const [upcoming, pending, monthBookings, prevBookings, todayBookings, weekBookings, clients, newClients, services, slots, reviews] = await Promise.all([
    Booking.find({ practitioner: p._id, status: 'confirmee', day: { $gte: today } }).sort({ startAt: 1 }).limit(6).populate(populateClient).lean(),
    Booking.find({ practitioner: p._id, status: 'en_attente', day: { $gte: today } }).sort({ startAt: 1 }).limit(10).populate(populateClient).lean(),
    Booking.find({ practitioner: p._id, day: { $regex: `^${month}` } }).lean(),
    Booking.find({ practitioner: p._id, day: { $regex: `^${prevMonth}` } }).lean(),
    Booking.find({ practitioner: p._id, day: today, status: { $in: ['en_attente', 'confirmee', 'terminee', 'absente'] } }).sort({ time: 1 }).populate(populateClient).lean(),
    Booking.find({ practitioner: p._id, day: { $gte: today, $lte: weekEnd }, status: { $in: ['en_attente', 'confirmee'] } }).select('day status').lean(),
    ClientRecord.countDocuments({ practitioner: p._id }),
    ClientRecord.countDocuments({ practitioner: p._id, createdAt: { $gte: new Date(`${month}-01T00:00:00Z`) } }),
    Service.countDocuments({ practitioner: p._id, active: true }),
    Availability.countDocuments({ practitioner: p._id, active: true }),
    Review.find({ practitioner: p._id, hidden: false }).sort({ createdAt: -1 }).limit(3).populate({ path: 'client', model: User, select: 'firstName' }).lean(),
  ]);

  const kept = (list) => list.filter((b) => ['confirmee', 'terminee'].includes(b.status));
  const revenue = (list) => list.filter((b) => b.status === 'terminee').reduce((a, b) => a + (b.price || 0), 0);
  const trend = (cur, prv) => (prv ? Math.round(((cur - prv) / prv) * 100) : null);
  const stats = {
    monthBookings: kept(monthBookings).length,
    monthBookingsTrend: trend(kept(monthBookings).length, kept(prevBookings).length),
    monthRevenue: revenue(monthBookings),
    monthRevenueTrend: trend(revenue(monthBookings), revenue(prevBookings)),
    monthCancelled: monthBookings.filter((b) => b.status === 'annulee').length,
    clients,
    newClients,
    rating: p.rating,
    reviewsCount: p.reviewsCount,
  };

  // Semaine à venir : rendez-vous par jour.
  const week = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(today, i);
    const list = weekBookings.filter((b) => b.day === d);
    week.push({ day: d, confirmed: list.filter((b) => b.status === 'confirmee').length, pending: list.filter((b) => b.status === 'en_attente').length });
  }

  // Profil complet = plus de visibilité dans l'annuaire.
  const checks = [
    { key: 'photo', label: 'Ajouter une photo', done: Boolean(p.photoUrl), href: '/pro/profil' },
    { key: 'description', label: 'Rédiger une présentation (80 caractères minimum)', done: (p.description || '').length >= 80, href: '/pro/profil' },
    { key: 'services', label: 'Créer au moins une prestation', done: services > 0, href: '/pro/prestations' },
    { key: 'availability', label: 'Renseigner tes disponibilités', done: slots > 0, href: '/pro/disponibilites' },
    { key: 'address', label: 'Indiquer l’adresse du cabinet', done: Boolean(p.location?.address) || !p.inPerson, href: '/pro/profil' },
  ];

  let series = null;
  if (plan?.features?.stats) {
    series = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(`${month}-01T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - i);
      const m = d.toISOString().slice(0, 7);
      const list = await Booking.find({ practitioner: p._id, day: { $regex: `^${m}` }, status: { $in: ['confirmee', 'terminee'] } }).lean();
      series.push({ month: m, bookings: list.length, revenue: revenue(list) });
    }
  }
  const map = (b) => ({ ...b, id: String(b._id), client: clientCard(b.client) });
  res.json({
    practitioner: { id: p.id, displayName: p.displayName, status: p.status, photoUrl: p.photoUrl, specialty: p.specialty, city: p.location?.city },
    plan,
    subscription,
    today,
    upcoming: upcoming.map(map),
    pending: pending.map(map),
    todayBookings: todayBookings.map(map),
    week,
    stats,
    series,
    completion: { percent: Math.round((checks.filter((c) => c.done).length / checks.length) * 100), checks },
    reviews: reviews.map((r) => ({ id: String(r._id), rating: r.rating, comment: r.comment, author: r.client?.firstName, createdAt: r.createdAt, replied: Boolean(r.reply) })),
  });
});

export default router;

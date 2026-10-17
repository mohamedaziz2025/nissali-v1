// 11 — Back-office (suite) : notifications push, événements, mosquées partenaires, conseils santé,
// signalements de la messagerie.
import { Router } from 'express';
import { z } from 'zod';
import { CATEGORY_GROUPS } from '../content/categories.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Article, AuditLog, Broadcast, Conversation, Event, EventRegistration, HealthTip, Message, Mosque, Practitioner, PushSubscription, User } from '../models/index.js';
import { COMMISSION_RATE, presentEvent } from '../services/events.js';
import { bestCity } from '../services/geo.js';
import { forgetTips } from '../services/healthTips.js';
import { notify } from '../services/notifications.js';
import { forgetMosque } from '../services/prayerSource.js';
import { imageUpload, publicUploadUrl } from '../services/upload.js';
import { isDay, isTime, zonedToDate } from '../utils/dates.js';
import { badRequest, escapeRegex, notFound } from '../utils/http.js';

const router = Router();
router.use(requireRole('admin'));

const audit = (req, action, target, meta) => AuditLog.create({ admin: req.user._id, action, target: target ? String(target) : undefined, meta }).catch(() => {});
const oid = /^[a-f\d]{24}$/i;

router.get('/category-groups', (_req, res) => res.json(CATEGORY_GROUPS));

// Image publique (notifications, événements).
router.post('/upload-image', imageUpload.single('image'), async (req, res) => {
  if (!req.file) throw badRequest('Image JPEG, PNG ou WebP attendue (5 Mo maximum)');
  res.status(201).json({ url: publicUploadUrl(req.file.filename) });
});

// --- Notifications push envoyées par l'équipe -----------------------------------------

const audienceSchema = z.object({
  type: z.enum(['toutes', 'actualites', 'praticiennes', 'ville', 'situation', 'utilisatrice']),
  city: z.string().max(80).optional(),
  situation: z.enum(['mariee', 'celibataire']).optional(),
  userId: z.string().regex(oid).optional(),
});

async function audienceUsers(a) {
  const base = { role: 'user', status: 'active' };
  if (a.type === 'actualites') return User.find({ ...base, $or: [{ 'consents.marketingEmail.accepted': true }, { 'consents.marketingSms.accepted': true }, { 'consents.marketingWhatsapp.accepted': true }] }).select('_id').lean();
  if (a.type === 'praticiennes') return (await Practitioner.find({ status: 'validee' }).select('user').lean()).map((p) => ({ _id: p.user }));
  if (a.type === 'ville') {
    if (!a.city) throw badRequest('Indique la ville');
    return User.find({ ...base, 'city.name': new RegExp(`^${escapeRegex(a.city)}`, 'i') }).select('_id').lean();
  }
  if (a.type === 'situation') return User.find({ ...base, situation: a.situation }).select('_id').lean();
  if (a.type === 'utilisatrice') return User.find({ _id: a.userId }).select('_id').lean();
  return User.find(base).select('_id').lean();
}

router.get('/broadcasts', async (_req, res) => {
  const list = await Broadcast.find().sort({ createdAt: -1 }).limit(100).populate({ path: 'sentBy', model: User, select: 'firstName email' }).lean();
  const devices = await PushSubscription.countDocuments({ endpoint: /^ExponentPushToken/ });
  res.json({ items: list.map((b) => ({ ...b, id: String(b._id) })), devices });
});

router.post('/broadcasts/preview', validate(z.object({ audience: audienceSchema })), async (req, res) => {
  const users = await audienceUsers(req.body.audience);
  const devices = await PushSubscription.countDocuments({ user: { $in: users.map((u) => u._id) }, endpoint: /^ExponentPushToken/ });
  res.json({ recipients: users.length, devices });
});

router.post(
  '/broadcasts',
  validate(
    z.object({
      title: z.string().trim().min(2).max(80),
      body: z.string().trim().min(2).max(300),
      detail: z.string().max(2000).optional(),
      imageUrl: z.string().url().max(500).optional(),
      link: z.string().max(200).optional(),
      audience: audienceSchema,
    }),
  ),
  async (req, res) => {
    const b = req.body;
    const users = await audienceUsers(b.audience);
    if (!users.length) throw badRequest('Aucune destinataire pour cette audience');
    const broadcast = await Broadcast.create({ title: b.title, body: b.body, detail: b.detail, imageUrl: b.imageUrl, link: b.link, audience: b.audience, sentBy: req.user._id, recipients: users.length });
    let pushed = 0;
    for (const u of users) {
      const n = await notify(u._id, { key: `broadcast-${broadcast.id}`, type: 'annonce', title: b.title, body: b.body, detail: b.detail || b.body, link: b.link || '/notifications', imageUrl: b.imageUrl }).catch(() => null);
      if (n?.pushed) pushed += 1;
    }
    broadcast.pushed = pushed;
    await broadcast.save();
    await audit(req, 'notification_envoyee', broadcast._id, { recipients: users.length, pushed });
    res.status(201).json({ ...broadcast.toObject(), id: broadcast.id });
  },
);

// --- Événements (RG-28 à RG-31) ---------------------------------------------------------

router.get('/events', async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);
  const events = await Event.find(filter).sort({ status: 1, startAt: 1 }).limit(200).populate({ path: 'organizer', model: User, select: 'firstName email phone' }).lean();
  const regs = await EventRegistration.find({ event: { $in: events.map((e) => e._id) }, status: 'inscrite' }).lean();
  const byEvent = (id) => regs.filter((r) => String(r.event) === String(id));
  const items = events.map((e) => {
    const r = byEvent(e._id);
    const sales = r.reduce((a, x) => a + (x.amount || 0), 0);
    const commission = r.reduce((a, x) => a + (x.commission || 0), 0);
    return { ...presentEvent(e, { mine: true }), organizer: e.organizer ? { name: e.organizer.firstName, email: e.organizer.email, phone: e.organizer.phone } : null, payoutStatus: e.payoutStatus, sales, commission, payout: Math.round((sales - commission) * 100) / 100, createdAt: e.createdAt };
  });
  const counts = await Event.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  res.json({ items, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])), commissionRate: COMMISSION_RATE });
});

router.get('/events/:id/registrations', async (req, res) => {
  const regs = await EventRegistration.find({ event: req.params.id }).sort({ createdAt: 1 }).populate({ path: 'user', model: User, select: 'firstName email phone' }).lean();
  res.json(regs.map((r) => ({ id: String(r._id), name: r.user?.firstName, email: r.user?.email, phone: r.user?.phone, status: r.status, amount: r.amount, commission: r.commission, paymentStatus: r.paymentStatus, createdAt: r.createdAt })));
});

router.patch('/events/:id/registrations/:regId', validate(z.object({ paymentStatus: z.enum(['a_regler', 'paye', 'rembourse']) })), async (req, res) => {
  const r = await EventRegistration.findOneAndUpdate({ _id: req.params.regId, event: req.params.id }, { $set: { paymentStatus: req.body.paymentStatus } }, { new: true });
  if (!r) throw notFound();
  res.json(r);
});

// Valider, refuser avec motif, ou demander une modification (l'organisatrice est prévenue).
router.post('/events/:id/moderate', validate(z.object({ action: z.enum(['valider', 'refuser', 'modification']), note: z.string().max(1000).optional() })), async (req, res) => {
  const e = await Event.findById(req.params.id);
  if (!e) throw notFound();
  const { action, note } = req.body;
  if (action !== 'valider' && !note?.trim()) throw badRequest('Indique le motif pour l’organisatrice');
  e.status = action === 'valider' ? 'publie' : action === 'refuser' ? 'refuse' : 'modification';
  e.moderationNote = note || undefined;
  await e.save();
  if (e.organizer) {
    const detail = action === 'valider' ? `Ton événement « ${e.title} » est publié dans Lifestyle.` : action === 'refuser' ? `Ton événement « ${e.title} » n’a pas été retenu : ${note}` : `Une modification est demandée pour « ${e.title} » : ${note}`;
    await notify(e.organizer, { key: `event-moderation-${e.id}-${Date.now()}`, type: 'evenement', title: 'Nissali', body: action === 'valider' ? 'Ton événement est publié' : 'Ton événement : réponse de l’équipe', detail, link: `/evenement/${e.id}` });
  }
  await audit(req, `evenement_${action}`, e._id, { note });
  res.json(presentEvent(e.toObject(), { mine: true }));
});

const adminEventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  programme: z.string().max(4000).optional().default(''),
  day: z.string().refine(isDay),
  time: z.string().refine(isTime),
  endTime: z.string().refine(isTime).optional().or(z.literal('')),
  location: z.object({ name: z.string().max(120).optional().default(''), address: z.string().max(200).optional().default(''), city: z.string().trim().min(1).max(80), online: z.boolean().optional().default(false) }),
  imageUrl: z.string().url().max(500).optional().or(z.literal('')),
  capacity: z.number().int().min(1).max(5000),
  price: z.number().min(0).max(1000).default(0),
  ticketUrl: z.string().trim().max(500).regex(/^(https:\/\/\S+\.\S+)?$/, 'Le lien de billetterie doit être une adresse sécurisée (https://)').optional(),
  cancellationPolicy: z.string().max(600).optional(),
  status: z.enum(['publie', 'annule']).optional(),
}).refine((b) => !b.price || b.ticketUrl, { message: 'Ajoute le lien de billetterie externe (https://) pour un événement payant', path: ['ticketUrl'] });

async function eventFields(b) {
  const tz = 'Europe/Paris';
  const place = await bestCity(b.location.city);
  return {
    title: b.title,
    description: b.description,
    programme: b.programme,
    startAt: zonedToDate(b.day, b.time, tz),
    endAt: b.endTime ? zonedToDate(b.day, b.endTime, tz) : undefined,
    timezone: tz,
    location: { ...b.location, region: place?.admin || '', lat: place?.lat, lng: place?.lng },
    imageUrl: b.imageUrl || undefined,
    capacity: b.capacity,
    price: b.price,
    ticketUrl: b.price ? b.ticketUrl : undefined,
    ...(b.cancellationPolicy ? { cancellationPolicy: b.cancellationPolicy } : {}),
  };
}

// Événements organisés par Nissali : publiés directement, sans commission.
router.post('/events', validate(adminEventSchema), async (req, res) => {
  const e = await Event.create({ ...(await eventFields(req.body)), organizerType: 'nissali', organizerName: 'Nissali', status: 'publie' });
  await audit(req, 'evenement_cree', e._id);
  res.status(201).json(presentEvent(e.toObject(), { mine: true }));
});

router.put('/events/:id', validate(adminEventSchema), async (req, res) => {
  const e = await Event.findById(req.params.id);
  if (!e) throw notFound();
  Object.assign(e, await eventFields(req.body));
  if (req.body.status) e.status = req.body.status;
  await e.save();
  res.json(presentEvent(e.toObject(), { mine: true }));
});

router.patch('/events/:id/payout', validate(z.object({ payoutStatus: z.enum(['a_verser', 'verse']) })), async (req, res) => {
  const e = await Event.findByIdAndUpdate(req.params.id, { $set: { payoutStatus: req.body.payoutStatus } }, { new: true });
  if (!e) throw notFound();
  await audit(req, `reversement_${req.body.payoutStatus}`, e._id);
  res.json({ ok: true });
});

// --- Mosquées partenaires et leurs horaires -------------------------------------------

const mosqueSchema = z.object({
  name: z.string().trim().min(2).max(140),
  address: z.string().max(200).optional().default(''),
  city: z.string().trim().min(1).max(80),
  jumua: z.string().refine(isTime, 'Heure invalide').optional().or(z.literal('')),
  jumua2: z.string().refine(isTime, 'Heure invalide').optional().or(z.literal('')),
  lat: z.number().optional(),
  lng: z.number().optional(),
  timetableNote: z.string().max(300).optional(),
  active: z.boolean().optional(),
});

const presentAdminMosque = (m) => ({ ...m, id: String(m._id), timetable: undefined, timetableDays: m.timetable?.length || 0, timetableFrom: m.timetable?.[0]?.day || null, timetableTo: m.timetable?.[m.timetable.length - 1]?.day || null });

router.get('/mosques', async (_req, res) => {
  const list = await Mosque.find({ partner: true }).sort({ city: 1, name: 1 }).lean();
  const chosen = await User.aggregate([{ $match: { 'prayerSource.mode': 'mosquee' } }, { $group: { _id: '$prayerSource.mosque', n: { $sum: 1 } } }]);
  const counts = new Map(chosen.map((c) => [String(c._id), c.n]));
  res.json(list.map((m) => ({ ...presentAdminMosque(m), followers: counts.get(String(m._id)) || 0 })));
});

router.get('/mosques/:id', async (req, res) => {
  const m = await Mosque.findById(req.params.id).lean();
  if (!m) throw notFound();
  res.json({ ...m, id: String(m._id) });
});

async function mosqueFields(b) {
  const out = { name: b.name, address: b.address, city: b.city, jumua: b.jumua || '', jumua2: b.jumua2 || '', timetableNote: b.timetableNote, ...(b.active !== undefined ? { active: b.active } : {}) };
  if (b.lat != null && b.lng != null) Object.assign(out, { lat: b.lat, lng: b.lng });
  else {
    const place = await bestCity(b.city);
    if (!place) throw badRequest('Ville introuvable : précise la ville ou les coordonnées');
    Object.assign(out, { lat: place.lat, lng: place.lng, region: place.admin || '', country: place.country || '', timezone: place.timezone || 'Europe/Paris' });
  }
  return out;
}

router.post('/mosques', validate(mosqueSchema), async (req, res) => {
  const m = await Mosque.create({ ...(await mosqueFields(req.body)), partner: true });
  await audit(req, 'mosquee_ajoutee', m._id);
  res.status(201).json({ ...m.toObject(), id: m.id });
});

router.patch('/mosques/:id', validate(mosqueSchema.partial()), async (req, res) => {
  const m = await Mosque.findById(req.params.id);
  if (!m) throw notFound();
  const b = req.body;
  if (b.city || (b.lat != null && b.lng != null)) Object.assign(m, await mosqueFields({ ...m.toObject(), ...b }));
  else for (const k of ['name', 'address', 'jumua', 'jumua2', 'timetableNote', 'active']) if (b[k] !== undefined) m[k] = b[k];
  m.partner = true;
  await m.save();
  forgetMosque(m._id);
  res.json({ ...m.toObject(), id: m.id });
});

// Horaires : collage d'un tableau « date;fajr;lever;dhuhr;asr;maghrib;isha;jumu'a » (séparateur ; , ou tabulation).
const hhmm = (v) => {
  const t = String(v || '').trim().replace('h', ':').replace('.', ':');
  if (!t) return '';
  const [h, m = '00'] = t.split(':');
  const out = `${String(Number(h)).padStart(2, '0')}:${String(m).padStart(2, '0').slice(0, 2)}`;
  return isTime(out) ? out : null;
};
const toDay = (v) => {
  const t = String(v || '').trim();
  if (isDay(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};

router.put('/mosques/:id/timetable', validate(z.object({ csv: z.string().max(200_000), replace: z.boolean().default(false) })), async (req, res) => {
  const m = await Mosque.findById(req.params.id);
  if (!m) throw notFound();
  const rows = [];
  const errors = [];
  req.body.csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const cells = line.split(/[;\t,]/).map((c) => c.trim());
      const day = toDay(cells[0]);
      if (!day) {
        if (i > 0) errors.push(`Ligne ${i + 1} : date illisible`);
        return; // ligne d'en-tête
      }
      const [fajr, sunrise, dhuhr, asr, maghrib, isha, jumua, jumua2] = cells.slice(1).map(hhmm);
      if ([fajr, dhuhr, asr, maghrib, isha].some((v) => !v)) return errors.push(`Ligne ${i + 1} : horaire manquant ou invalide`);
      rows.push({ day, fajr, sunrise: sunrise || undefined, dhuhr, asr, maghrib, isha, jumua: jumua || undefined, jumua2: jumua2 || undefined });
    });
  if (!rows.length) throw badRequest(errors[0] || 'Aucune ligne valide');
  const map = new Map((req.body.replace ? [] : m.timetable.map((r) => r.toObject())).map((r) => [r.day, r]));
  for (const r of rows) map.set(r.day, r);
  m.timetable = [...map.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  await m.save();
  forgetMosque(m._id);
  await audit(req, 'horaires_mosquee', m._id, { rows: rows.length });
  res.json({ imported: rows.length, errors, total: m.timetable.length });
});

router.delete('/mosques/:id', async (req, res) => {
  const followers = await User.countDocuments({ 'prayerSource.mosque': req.params.id });
  if (followers) await User.updateMany({ 'prayerSource.mosque': req.params.id }, { $set: { prayerSource: { mode: 'ville' } } });
  await Mosque.deleteOne({ _id: req.params.id });
  forgetMosque(req.params.id);
  res.json({ ok: true, switchedToCity: followers });
});

// --- Conseils santé (RG-08 ter) --------------------------------------------------------

const tipSchema = z.object({
  phase: z.enum(['menstruelle', 'folliculaire', 'ovulatoire', 'luteale', 'grossesse']),
  title: z.string().trim().min(3).max(120),
  text: z.string().trim().min(10).max(600),
  theme: z.enum(['alimentation', 'sommeil', 'activite', 'douleurs', 'hydratation', 'bien_etre']).default('bien_etre'),
  articleSlug: z.string().max(120).optional().or(z.literal('')),
  reviewed: z.boolean().optional(),
  active: z.boolean().optional(),
});

router.get('/health-tips', async (_req, res) => {
  const tips = await HealthTip.find().sort({ phase: 1, createdAt: 1 }).lean();
  res.json(tips.map((t) => ({ ...t, id: String(t._id) })));
});
// 15 / 16 — l'article lié est choisi explicitement (ou aucun) : il doit exister.
async function checkTipArticle(slug) {
  if (slug && !(await Article.exists({ slug }))) throw badRequest('Article introuvable : choisis un article du magazine ou « Aucun article »');
}

router.post('/health-tips', validate(tipSchema), async (req, res) => {
  await checkTipArticle(req.body.articleSlug);
  const t = await HealthTip.create(req.body);
  forgetTips();
  res.status(201).json({ ...t.toObject(), id: t.id });
});
router.patch('/health-tips/:id', validate(tipSchema.partial()), async (req, res) => {
  await checkTipArticle(req.body.articleSlug);
  const t = await HealthTip.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
  if (!t) throw notFound();
  forgetTips();
  if (req.body.reviewed) await audit(req, 'conseil_relu', t._id);
  res.json({ ...t, id: String(t._id) });
});
router.delete('/health-tips/:id', async (req, res) => {
  await HealthTip.deleteOne({ _id: req.params.id });
  forgetTips();
  res.json({ ok: true });
});

// --- Signalements de la messagerie -----------------------------------------------------

router.get('/message-reports', async (_req, res) => {
  const convs = await Conversation.find({ 'reports.0': { $exists: true } })
    .sort({ updatedAt: -1 })
    .limit(100)
    .populate({ path: 'user', model: User, select: 'firstName email' })
    .populate({ path: 'practitioner', model: Practitioner, select: 'displayName' })
    .lean();
  const items = await Promise.all(
    convs.map(async (c) => ({
      id: String(c._id),
      client: c.user ? { name: c.user.firstName, email: c.user.email } : null,
      practitioner: c.practitioner ? { id: String(c.practitioner._id), name: c.practitioner.displayName } : null,
      reports: c.reports,
      open: c.reports.some((r) => !r.handled),
      blocked: c.blockedByUser || c.blockedByPro,
      // Contexte limité aux derniers messages, pour la modération uniquement.
      recent: (await Message.find({ conversation: c._id }).sort({ createdAt: -1 }).limit(10).lean()).reverse().map((m) => ({ from: m.from, text: m.text, at: m.createdAt })),
    })),
  );
  res.json(items);
});

router.post('/message-reports/:id', validate(z.object({ action: z.enum(['traite', 'bloquer']) })), async (req, res) => {
  const c = await Conversation.findById(req.params.id);
  if (!c) throw notFound();
  c.reports.forEach((r) => (r.handled = true));
  if (req.body.action === 'bloquer') {
    c.blockedByPro = true;
    c.blockedByUser = true;
  }
  await c.save();
  await audit(req, `signalement_${req.body.action}`, c._id);
  res.json({ ok: true });
});

export default router;

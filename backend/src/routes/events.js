// 5.11 — Lifestyle › Événements : liste (près de moi, ce mois-ci, gratuit, payant), fiche, inscription,
// proposition par une sœur (validée par l'équipe avant publication, RG-28).
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Event, EventRegistration, User } from '../models/index.js';
import { nowFor } from '../services/context.js';
import { commissionFor, COMMISSION_RATE, presentEvent } from '../services/events.js';
import { bestCity } from '../services/geo.js';
import { notify } from '../services/notifications.js';
import { imageUpload, publicUploadUrl } from '../services/upload.js';
import { isDay, isTime, zonedToDate } from '../utils/dates.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const oid = /^[a-f\d]{24}$/i;
const positionOf = (req) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return req.user.city?.lat != null ? { lat: req.user.city.lat, lng: req.user.city.lng } : null;
};

router.get('/', async (req, res) => {
  const filter = { status: 'publie', startAt: { $gte: new Date(Date.now() - 3 * 3600_000) } };
  const f = String(req.query.filter || '');
  if (f === 'gratuit') filter.price = 0;
  if (f === 'payant') filter.price = { $gt: 0 };
  if (f === 'mois') {
    const { today, tz } = nowFor(req.user);
    const [y, m] = today.split('-').map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    filter.startAt.$lt = zonedToDate(nextMonth, '00:00', tz);
  }
  const from = positionOf(req);
  const events = await Event.find(filter).sort({ startAt: 1 }).limit(100).lean();
  const regs = new Map((await EventRegistration.find({ user: req.user._id, event: { $in: events.map((e) => e._id) } }).lean()).map((r) => [String(r.event), r]));
  let items = events.map((e) => presentEvent(e, { from, registration: regs.get(String(e._id)) }));
  if (f === 'proche' && from) items = items.filter((e) => e.distanceKm == null || e.distanceKm <= 60).sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  res.json({ items, commissionRate: COMMISSION_RATE });
});

router.get('/mine', async (req, res) => {
  const [proposed, regs] = await Promise.all([
    Event.find({ organizer: req.user._id }).sort({ startAt: -1 }).lean(),
    EventRegistration.find({ user: req.user._id, status: 'inscrite' }).populate({ path: 'event', model: Event }).lean(),
  ]);
  res.json({
    proposed: proposed.map((e) => presentEvent(e, { mine: true })),
    registrations: regs.filter((r) => r.event).map((r) => presentEvent(r.event, { registration: r })),
  });
});

router.post('/image', imageUpload.single('image'), async (req, res) => {
  if (!req.file) throw badRequest('Image JPEG, PNG ou WebP attendue');
  res.status(201).json({ url: publicUploadUrl(req.file.filename) });
});

const eventSchema = z.object({
  title: z.string().trim().min(3, 'Titre trop court').max(120),
  description: z.string().trim().min(10, 'Décris ton événement en quelques lignes').max(4000),
  programme: z.string().max(4000).optional().default(''),
  day: z.string().refine(isDay, 'Date invalide'),
  time: z.string().refine(isTime, 'Heure invalide'),
  endTime: z.string().refine(isTime).optional(),
  location: z.object({ name: z.string().max(120).optional().default(''), address: z.string().max(200).optional().default(''), city: z.string().trim().min(1, 'Indique la ville').max(80), online: z.boolean().optional().default(false) }),
  imageUrl: z.string().url().max(500).optional(),
  photos: z.array(z.string().max(500).refine((u) => /^https?:\/\/\S+$/.test(u) || u.startsWith('/uploads/'), 'Adresse de photo invalide')).max(12, '12 photos au maximum').optional(),
  capacity: z.number().int().min(1).max(5000),
  price: z.number().min(0).max(1000).default(0),
  // 17 / 18 — billetterie externe sécurisée (Billetweb, HelloAsso…) : lien HTTPS obligatoire.
  ticketUrl: z.string().trim().url('Lien de billetterie invalide').regex(/^https:\/\/[^\s]+\.[^\s]+/, 'Le lien de billetterie doit être une adresse sécurisée (https://)').max(500).optional().or(z.literal('')),
  cancellationPolicy: z.string().max(600).optional(),
}).refine((b) => !b.price || b.ticketUrl, { message: 'Ajoute le lien de billetterie externe (https://) pour un événement payant', path: ['ticketUrl'] });

async function buildEvent(b, tz) {
  const startAt = zonedToDate(b.day, b.time, tz);
  if (startAt < new Date()) throw badRequest('La date doit être dans le futur');
  const place = await bestCity(b.location.city);
  return {
    title: b.title,
    description: b.description,
    programme: b.programme,
    startAt,
    endAt: b.endTime ? zonedToDate(b.day, b.endTime, tz) : undefined,
    timezone: tz,
    location: { ...b.location, region: place?.admin || '', lat: place?.lat, lng: place?.lng },
    imageUrl: b.imageUrl,
    photos: b.photos || [],
    capacity: b.capacity,
    price: Math.round(b.price * 100) / 100,
    ticketUrl: b.price ? b.ticketUrl : undefined,
    ...(b.cancellationPolicy ? { cancellationPolicy: b.cancellationPolicy } : {}),
  };
}

// Proposer un événement (RG-28) : en attente de validation par l'équipe.
router.post('/', validate(eventSchema), async (req, res) => {
  const tz = req.user.city?.timezone || 'Europe/Paris';
  const event = await Event.create({ ...(await buildEvent(req.body, tz)), organizerType: 'soeur', organizer: req.user._id, organizerName: req.user.firstName, status: 'en_attente', payoutStatus: req.body.price > 0 ? 'a_verser' : 'non_applicable' });
  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  for (const a of admins) await notify(a._id, { key: `event-proposed-${event.id}`, type: 'evenement', title: 'Nissali', body: 'Nouvel événement à valider', detail: `« ${event.title} » proposé par ${req.user.firstName}.`, link: '/admin/evenements' }, { sendPush: false });
  res.status(201).json(presentEvent(event.toObject(), { mine: true }));
});

// Modifier sa proposition (en attente ou modification demandée) : elle repart en validation.
router.patch('/:id', validate(eventSchema), async (req, res) => {
  if (!oid.test(req.params.id)) throw notFound();
  const event = await Event.findOne({ _id: req.params.id, organizer: req.user._id });
  if (!event) throw notFound('Événement introuvable');
  if (!['en_attente', 'modification'].includes(event.status)) throw badRequest('Cet événement ne peut plus être modifié');
  Object.assign(event, await buildEvent(req.body, event.timezone), { status: 'en_attente', payoutStatus: req.body.price > 0 ? 'a_verser' : 'non_applicable' });
  await event.save();
  res.json(presentEvent(event.toObject(), { mine: true }));
});

router.get('/:id', async (req, res) => {
  if (!oid.test(req.params.id)) throw notFound();
  const event = await Event.findById(req.params.id).lean();
  const mine = event && event.organizer && String(event.organizer) === String(req.user._id);
  if (!event || (event.status !== 'publie' && !mine)) throw notFound('Événement introuvable');
  const registration = await EventRegistration.findOne({ event: event._id, user: req.user._id }).lean();
  res.json(presentEvent(event, { from: positionOf(req), registration, mine }));
});

// « Je m'inscris » (gratuit) ou « Prendre ma place » (payant).
router.post('/:id/register', async (req, res) => {
  if (!oid.test(req.params.id)) throw notFound();
  const event = await Event.findOne({ _id: req.params.id, status: 'publie' });
  if (!event) throw notFound('Événement introuvable');
  if (event.startAt < new Date()) throw badRequest('Cet événement est passé');
  if (event.organizer?.equals(req.user._id)) throw badRequest('Tu organises cet événement');
  const existing = await EventRegistration.findOne({ event: event._id, user: req.user._id });
  if (existing?.status === 'inscrite') throw conflict('Tu es déjà inscrite');
  const updated = await Event.findOneAndUpdate({ _id: event._id, registrationsCount: { $lt: event.capacity } }, { $inc: { registrationsCount: 1 } }, { new: true });
  if (!updated) throw conflict('Plus de place disponible', 'EVENT_FULL');
  const amount = event.price || 0;
  const reg = await EventRegistration.findOneAndUpdate(
    { event: event._id, user: req.user._id },
    { $set: { status: 'inscrite', amount, commission: commissionFor(event, amount), paymentStatus: amount ? (event.ticketUrl ? 'billetterie' : 'a_regler') : 'gratuit' } },
    { upsert: true, new: true },
  );
  if (event.organizer) await notify(event.organizer, { key: `event-reg-${reg.id}-${Date.now()}`, type: 'evenement', title: 'Nissali', body: 'Nouvelle inscription à ton événement', detail: `${req.user.firstName} s’est inscrite à « ${event.title} ».`, link: `/evenement/${event.id}` }).catch(() => {});
  res.status(201).json(presentEvent(updated.toObject(), { registration: reg }));
});

router.post('/:id/unregister', async (req, res) => {
  if (!oid.test(req.params.id)) throw notFound();
  const reg = await EventRegistration.findOne({ event: req.params.id, user: req.user._id, status: 'inscrite' });
  if (!reg) throw notFound('Inscription introuvable');
  reg.status = 'annulee';
  if (reg.paymentStatus === 'paye') reg.paymentStatus = 'rembourse';
  await reg.save();
  const event = await Event.findByIdAndUpdate(req.params.id, { $inc: { registrationsCount: -1 } }, { new: true }).lean();
  res.json(presentEvent(event, { registration: reg }));
});

// L'organisatrice annule son événement : les participantes sont prévenues (RG-31, remboursement intégral).
router.post('/:id/cancel', async (req, res) => {
  if (!oid.test(req.params.id)) throw notFound();
  const event = await Event.findOne({ _id: req.params.id, organizer: req.user._id });
  if (!event) throw forbidden();
  event.status = 'annule';
  await event.save();
  const regs = await EventRegistration.find({ event: event._id, status: 'inscrite' });
  for (const r of regs) {
    if (r.paymentStatus === 'paye') r.paymentStatus = 'rembourse';
    await r.save();
    await notify(r.user, { key: `event-cancel-${event.id}`, type: 'evenement', title: 'Nissali', body: 'Un événement a été annulé', detail: `« ${event.title} » est annulé par l’organisatrice.${r.amount ? ' Ta place te sera remboursée intégralement.' : ''}`, link: `/evenement/${event.id}` });
  }
  res.json({ ok: true });
});

export default router;

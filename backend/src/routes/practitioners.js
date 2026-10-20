// 5.10 — Praticiennes côté utilisatrice : annuaire, fiche, créneaux, réservation, avis, favoris.
// Tant que l'annuaire n'est pas ouvert (paramètre back-office), l'onglet reste flouté « Bientôt disponible ».
import { Router } from 'express';
import { FAMILIES, familySpecialties } from '../content/categories.js';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Booking, Category, Favorite, Plan, Practitioner, Review, Service, User } from '../models/index.js';
import { activePlanFor, ACTIVE_BOOKING, availableSlots, directoryOpen, LISTED, nextAvailableDays, nextSlot, planCard, publicPractitioner, refreshRating, specialtyLabelOf } from '../services/marketplace.js';
import { sendMail } from '../services/mailer.js';
import { notify } from '../services/notifications.js';
import { getSettings } from '../services/settings.js';
import { isDay, isTime, minutesToTime, timeToMinutes, zonedToDate } from '../utils/dates.js';
import { badRequest, conflict, escapeRegex, forbidden, notFound } from '../utils/http.js';

const router = Router();

async function assertOpen() {
  if (!(await directoryOpen(await getSettings()))) throw forbidden('Bientôt disponible', 'COMING_SOON');
}


// État de l'onglet + formules d'abonnement pour l'inscription des professionnelles.
router.get('/status', async (_req, res) => {
  const settings = await getSettings();
  const [plans, categories] = await Promise.all([Plan.find({ active: true }).sort({ order: 1 }).lean(), Category.find({ active: true }).sort({ order: 1 }).lean()]);
  res.json({
    enabled: await directoryOpen(settings),
    contactEmail: settings.contactEmail,
    // Formules à souscrire ; l'essai gratuit (s'il est actif) est proposé à part, par défaut.
    plans: plans.filter((p) => !p.trial).map(planCard),
    trial: ((t) => (t ? planCard(t) : null))(plans.find((p) => p.trial)),
    categories: categories.map((c) => ({ key: c.key, label: c.label, group: c.group, requiresRpps: c.requiresRpps, requiresSterile: c.requiresSterile, disclaimer: c.disclaimer })),
    // 5.10 — Catégories de l'annuaire (gérées dans le back-office).
    groups: categories.map((c) => ({ key: c.key, label: c.label, specialties: [{ key: c.key, label: c.label }] })),
    // Cahier V3 : les 6 catégories qui regroupent ces spécialités dans les filtres.
    families: FAMILIES.map((f) => ({ key: f.key, label: f.label, specialties: familySpecialties(f.key, categories) })).filter((f) => f.specialties.length),
  });
});

// Villes et régions où exercent des praticiennes (filtres Ville et Région avec saisie automatique).
router.get('/places', requireAuth, async (_req, res) => {
  const list = await Practitioner.find(LISTED).select('location').lean();
  const count = (key) => Object.entries(list.reduce((acc, p) => ((v) => (v ? { ...acc, [v]: (acc[v] || 0) + 1 } : acc))(p.location?.[key]?.trim()), {})).map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
  res.json({ cities: count('city'), regions: count('region') });
});

/** Résumé commercial d'une praticienne : tarif « dès », modes, prochaine disponibilité. */
async function offerSummary(p) {
  const services = await Service.find({ practitioner: p._id, active: true }).select('price durationMinutes mode').lean();
  if (!services.length) return { servicesCount: 0, minPrice: null, nextAvailable: null, modes: [] };
  const cheapest = [...services].sort((a, b) => a.price - b.price)[0];
  const modes = new Set(services.flatMap((s) => (s.mode === 'les_deux' ? ['cabinet', 'visio'] : [s.mode])));
  return { servicesCount: services.length, minPrice: cheapest.price, nextAvailable: await nextSlot(p, cheapest), modes: [...modes] };
}

/** Position de référence pour la distance : GPS envoyé par l'appli, sinon ville de l'utilisatrice. */
function positionOf(req) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return req.user.city?.lat != null ? { lat: req.user.city.lat, lng: req.user.city.lng } : null;
}

// 5.10 — Recherche par spécialité ou nom, filtres Ville / Région / catégorie, tri du plus proche au plus loin
// (ou alphabétique, ou nouvelles inscrites), distance affichée sur chaque fiche.
router.get('/', requireAuth, async (req, res) => {
  const enabled = await directoryOpen(await getSettings());
  // Une praticienne ne se voit pas elle-même dans l'annuaire de son espace personnel.
  const filter = { ...LISTED, user: { $ne: req.user._id } };
  // RG-47 — filtre « Diplômées ».
  if (req.query.diplome === '1') filter.diplomaVerified = true;
  const categories = await Category.find().lean();
  if (req.query.specialty) filter.specialty = String(req.query.specialty);
  if (req.query.family) filter.specialty = { $in: familySpecialties(String(req.query.family), categories) };
  if (req.query.group) filter.specialty = { $in: categories.filter((c) => c.key === String(req.query.group) || c.group === String(req.query.group)).map((c) => c.key) };
  if (req.query.city) filter['location.city'] = new RegExp(escapeRegex(String(req.query.city).slice(0, 60)), 'i');
  if (req.query.region) filter['location.region'] = new RegExp(escapeRegex(String(req.query.region).slice(0, 60)), 'i');
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i');
    const cats = categories.filter((c) => rx.test(c.label)).map((c) => c.key);
    filter.$or = [{ displayName: rx }, { description: rx }, { specialty: { $in: cats } }];
  }
  if (req.query.visio === '1') filter.supportsVideo = true;
  const from = positionOf(req);
  const list = await Practitioner.find(filter).limit(enabled ? 200 : 3).lean();
  const withPlans = await Promise.all(list.map(async (p) => ({ ...publicPractitioner(p, await activePlanFor(p), from), ...(enabled ? await offerSummary(p) : {}) })));
  const sort = String(req.query.sort || 'distance');
  // 5.10 — tri par défaut du plus proche au plus loin ; autres tris : mieux notées, prix, nouvelles inscrites.
  if (sort === 'alpha') withPlans.sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));
  else if (sort === 'rating') withPlans.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewsCount || 0) - (a.reviewsCount || 0));
  else if (sort === 'price') withPlans.sort((a, b) => (a.minPrice ?? 1e9) - (b.minPrice ?? 1e9));
  else if (sort === 'recent') withPlans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else withPlans.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || Number(b.featured) - Number(a.featured));
  const labels = new Map(categories.map((c) => [c.key, c]));
  const favorites = new Set((await Favorite.find({ client: req.user._id }).lean()).map((f) => String(f.practitioner)));
  res.json({
    enabled,
    sort,
    total: withPlans.length,
    items: withPlans.map((p) => {
      const raw = list.find((x) => String(x._id) === p.id);
      const label = specialtyLabelOf(raw || p, labels.get(p.specialty));
      return { ...p, specialtyLabel: label, group: p.specialty, groupLabel: label, favorite: favorites.has(p.id) };
    }),
  });
});

router.get('/favorites', requireAuth, async (req, res) => {
  const favs = await Favorite.find({ client: req.user._id }).populate({ path: 'practitioner', model: Practitioner }).lean();
  const list = favs.filter((f) => f.practitioner && f.practitioner.status === 'validee' && f.practitioner.visible !== false && !f.practitioner.user.equals(req.user._id)).map((f) => f.practitioner);
  res.json(await Promise.all(list.map(async (p) => ({ ...publicPractitioner(p, await activePlanFor(p)), ...(await offerSummary(p)), favorite: true }))));
});

router.get('/bookings/mine', requireAuth, async (req, res) => {
  const bookings = await Booking.find({ client: req.user._id }).sort({ startAt: -1 }).populate({ path: 'practitioner', model: Practitioner, select: 'displayName specialty location photoUrl' }).lean();
  const reviewed = new Set((await Review.find({ client: req.user._id }).lean()).map((r) => String(r.booking)));
  res.json(
    bookings.map((b) => ({
      id: String(b._id),
      practitioner: b.practitioner ? { id: String(b.practitioner._id), displayName: b.practitioner.displayName, specialty: b.practitioner.specialty, city: b.practitioner.location?.city, photoUrl: b.practitioner.photoUrl } : null,
      serviceName: b.serviceName,
      mode: b.mode,
      day: b.day,
      time: b.time,
      endTime: b.endTime,
      status: b.status,
      price: b.price,
      videoUrl: b.status === 'confirmee' ? b.videoUrl : null,
      canReview: b.status === 'terminee' && !reviewed.has(String(b._id)),
      canCancel: ACTIVE_BOOKING.includes(b.status) && new Date(b.startAt) > new Date(),
    })),
  );
});

router.get('/:id', requireAuth, async (req, res) => {
  await assertOpen();
  const p = await Practitioner.findOne({ _id: req.params.id, ...LISTED });
  if (!p) throw notFound('Praticienne introuvable');
  // 9.3 — vues du mois (sa propre visite ne compte pas).
  if (!p.user.equals(req.user._id)) {
    const month = new Date().toISOString().slice(0, 7);
    await Practitioner.updateOne({ _id: p._id }, p.viewsMonth?.month === month ? { $inc: { 'viewsMonth.count': 1 } } : { $set: { viewsMonth: { month, count: 1 } } });
  }
  const [services, reviews, planInfo, fav] = await Promise.all([
    Service.find({ practitioner: p._id, active: true }).sort({ price: 1 }).lean(),
    Review.find({ practitioner: p._id, hidden: false }).sort({ createdAt: -1 }).limit(20).populate({ path: 'client', model: User, select: 'firstName' }).lean(),
    activePlanFor(p),
    Favorite.exists({ client: req.user._id, practitioner: p._id }),
  ]);
  const summary = await offerSummary(p);
  const cat = await Category.findOne({ key: p.specialty }).lean();
  res.json({
    ...publicPractitioner(p, planInfo, positionOf(req)),
    specialtyLabel: specialtyLabelOf(p, cat),
    group: p.specialty,
    groupLabel: specialtyLabelOf(p, cat),
    disclaimer: cat?.disclaimer || '',
    ...summary,
    isSelf: p.user.equals(req.user._id),
    favorite: Boolean(fav),
    services: services.map((s) => ({ id: String(s._id), name: s.name, description: s.description, price: s.price, durationMinutes: s.durationMinutes, mode: s.mode })),
    reviews: reviews.map((r) => ({ id: String(r._id), rating: r.rating, comment: r.comment, reply: r.reply, author: r.client?.firstName || 'Une sœur', createdAt: r.createdAt })),
    ratingBreakdown: [5, 4, 3, 2, 1].map((n) => ({ stars: n, count: reviews.filter((r) => r.rating === n).length })),
  });
});

router.get('/:id/slots', requireAuth, async (req, res) => {
  await assertOpen();
  const p = await Practitioner.findOne({ _id: req.params.id, ...LISTED });
  if (!p) throw notFound('Praticienne introuvable');
  const service = await Service.findOne({ _id: req.query.service, practitioner: p._id, active: true });
  if (!service) throw notFound('Prestation introuvable');
  if (isDay(req.query.day)) return res.json({ day: req.query.day, slots: await availableSlots(p, service, req.query.day) });
  res.json({ days: await nextAvailableDays(p, service) });
});

router.post('/:id/favorite', requireAuth, async (req, res) => {
  await Favorite.updateOne({ client: req.user._id, practitioner: req.params.id }, { $setOnInsert: { client: req.user._id, practitioner: req.params.id } }, { upsert: true });
  res.json({ favorite: true });
});

router.delete('/:id/favorite', requireAuth, async (req, res) => {
  await Favorite.deleteOne({ client: req.user._id, practitioner: req.params.id });
  res.json({ favorite: false });
});

const bookingSchema = z.object({
  serviceId: z.string().min(1),
  day: z.string().refine(isDay, 'Date invalide'),
  time: z.string().refine(isTime, 'Heure invalide'),
  mode: z.enum(['cabinet', 'visio']),
  note: z.string().max(500).optional(),
});

router.post('/:id/bookings', requireAuth, validate(bookingSchema), async (req, res) => {
  await assertOpen();
  const p = await Practitioner.findOne({ _id: req.params.id, ...LISTED });
  if (!p) throw notFound('Praticienne introuvable');
  if (p.user.equals(req.user._id)) throw badRequest('Tu ne peux pas réserver chez toi-même');
  const service = await Service.findOne({ _id: req.body.serviceId, practitioner: p._id, active: true });
  if (!service) throw notFound('Prestation introuvable');
  if (req.body.mode === 'visio' && service.mode === 'cabinet') throw badRequest('Cette prestation se fait uniquement au cabinet');
  if (req.body.mode === 'cabinet' && service.mode === 'visio') throw badRequest('Cette prestation se fait uniquement en visio');

  const { plan } = await activePlanFor(p);
  if (req.body.mode === 'visio' && !plan?.features?.video) throw badRequest('La visio n’est pas proposée par cette praticienne pour le moment');

  const slots = await availableSlots(p, service, req.body.day);
  if (!slots.some((s) => s.time === req.body.time)) throw conflict('Ce créneau n’est plus disponible', 'SLOT_TAKEN');

  const max = plan?.features?.maxBookingsPerMonth || 0;
  if (max > 0) {
    const month = req.body.day.slice(0, 7);
    const count = await Booking.countDocuments({ practitioner: p._id, day: { $regex: `^${month}` }, status: { $in: [...ACTIVE_BOOKING, 'terminee'] } });
    if (count >= max) throw conflict('Cette praticienne n’a plus de disponibilité ce mois-ci', 'PRACTITIONER_FULL');
  }

  const tz = p.timezone || 'Europe/Paris';
  const endTime = minutesToTime(timeToMinutes(req.body.time) + service.durationMinutes);
  const booking = await Booking.create({
    client: req.user._id,
    practitioner: p._id,
    service: service._id,
    serviceName: service.name,
    mode: req.body.mode,
    day: req.body.day,
    time: req.body.time,
    endTime,
    startAt: zonedToDate(req.body.day, req.body.time, tz),
    endAt: zonedToDate(req.body.day, endTime, tz),
    price: service.price,
    clientNote: req.body.note,
    status: p.autoConfirm ? 'confirmee' : 'en_attente',
  });
  if (p.autoConfirm) {
    const { confirmBooking } = await import('./pro.js');
    await confirmBooking(booking, p);
  }

  const proUser = await User.findById(p.user);
  await notify(p.user, { key: `pro-booking-${booking.id}`, type: 'reservation', title: 'Nissali Pro', body: 'Nouvelle demande de rendez-vous', detail: `${req.user.firstName} souhaite réserver « ${service.name} » le ${booking.day} à ${booking.time}.`, link: '/pro/reservations' });
  if (proUser?.email) await sendMail({ to: proUser.email, subject: 'Nouvelle demande de rendez-vous', html: `<p>${req.user.firstName} souhaite réserver « ${service.name} » le ${booking.day} à ${booking.time}.</p><p>Connecte-toi à ton espace pro pour l’accepter.</p>`, text: `Nouvelle demande : ${service.name} le ${booking.day} à ${booking.time}` });
  res.status(201).json({ id: booking.id, status: booking.status, day: booking.day, time: booking.time });
});

router.post('/bookings/:bookingId/cancel', requireAuth, validate(z.object({ reason: z.string().max(300).optional() })), async (req, res) => {
  const b = await Booking.findOne({ _id: req.params.bookingId, client: req.user._id });
  if (!b) throw notFound('Réservation introuvable');
  if (!ACTIVE_BOOKING.includes(b.status)) throw badRequest('Cette réservation ne peut plus être annulée');
  b.status = 'annulee';
  b.cancelledBy = 'cliente';
  b.cancelReason = req.body.reason;
  await b.save();
  const p = await Practitioner.findById(b.practitioner);
  if (p) await notify(p.user, { key: `pro-cancel-${b.id}`, type: 'reservation', title: 'Nissali Pro', body: 'Un rendez-vous a été annulé', detail: `Le rendez-vous « ${b.serviceName} » du ${b.day} à ${b.time} a été annulé par la cliente.`, link: '/pro/reservations' });
  res.json({ ok: true });
});

router.post('/bookings/:bookingId/review', requireAuth, validate(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() })), async (req, res) => {
  const b = await Booking.findOne({ _id: req.params.bookingId, client: req.user._id });
  if (!b) throw notFound('Réservation introuvable');
  if (b.status !== 'terminee') throw badRequest('Tu pourras laisser un avis après ton rendez-vous');
  if (await Review.exists({ booking: b._id })) throw conflict('Tu as déjà laissé un avis');
  await Review.create({ booking: b._id, practitioner: b.practitioner, client: req.user._id, rating: req.body.rating, comment: req.body.comment || '' });
  await refreshRating(b.practitioner);
  res.status(201).json({ ok: true });
});

export default router;

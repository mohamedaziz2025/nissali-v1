// 11 — Back-office (réservé à l'équipe Nissali, double authentification).
// Les données de santé ne sont jamais exposées ni exportées ici.
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  Article,
  AuditLog,
  Booking,
  BOOKING_STATUSES,
  CATEGORIES,
  Category,
  ClientRecord,
  MadeUpFast,
  Period,
  Plan,
  Practitioner,
  Reminder,
  Review,
  Service,
  SettingHistory,
  Subscription,
  User,
} from '../models/index.js';
import { activePlanFor, refreshRating } from '../services/marketplace.js';
import { removeClientFiles } from '../services/purge.js';
import { notify } from '../services/notifications.js';
import { METHODS, HIGH_LATITUDE_RULES } from '../services/prayerService.js';
import { getSettings, SETTING_DEFINITIONS, updateSettings } from '../services/settings.js';
import { isDay } from '../utils/dates.js';
import { badRequest, escapeRegex, notFound } from '../utils/http.js';

const router = Router();
router.use(requireRole('admin'));

const audit = (req, action, target, meta) => AuditLog.create({ admin: req.user._id, action, target: target ? String(target) : undefined, meta }).catch(() => {});
const page = (req) => {
  const p = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 25));
  return { skip: (p - 1) * limit, limit, page: p };
};

// --- Statistiques (13 — indicateurs) -----------------------------------------

router.get('/stats', async (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const now = Date.now();
  const day = 86_400_000;
  const users = { role: 'user' };
  const since = new Date(now - days * day);
  const prevSince = new Date(now - 2 * days * day);
  const [total, dau, mau, marketing, practitioners, pendingPractitioners, pendingSubs, bookings, madeUp, articles, pendingArticles] = await Promise.all([
    User.countDocuments(users),
    User.countDocuments({ ...users, lastActiveAt: { $gte: new Date(now - day) } }),
    User.countDocuments({ ...users, lastActiveAt: { $gte: new Date(now - 30 * day) } }),
    User.countDocuments({ ...users, $or: [{ 'consents.marketingEmail.accepted': true }, { 'consents.marketingSms.accepted': true }, { 'consents.marketingWhatsapp.accepted': true }] }),
    Practitioner.countDocuments({ status: 'validee' }),
    Practitioner.countDocuments({ status: 'en_attente' }),
    Subscription.countDocuments({ status: 'en_attente' }),
    Booking.countDocuments({ status: { $in: ['confirmee', 'terminee'] } }),
    MadeUpFast.countDocuments(),
    Article.find().sort({ views: -1 }).limit(5).select('title views slug category').lean(),
    Article.countDocuments({ validation: 'a_valider' }),
  ]);

  // Période choisie et période précédente (tendances).
  const [signupsPeriod, signupsPrev, bookingsPeriod, bookingsPrev, practitionersPeriod] = await Promise.all([
    User.countDocuments({ ...users, createdAt: { $gte: since } }),
    User.countDocuments({ ...users, createdAt: { $gte: prevSince, $lt: since } }),
    Booking.countDocuments({ createdAt: { $gte: since } }),
    Booking.countDocuments({ createdAt: { $gte: prevSince, $lt: since } }),
    Practitioner.countDocuments({ createdAt: { $gte: since } }),
  ]);

  // Inscriptions jour par jour sur la période (jours sans inscription = 0).
  const daily = await User.aggregate([
    { $match: { ...users, createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Europe/Paris' } }, n: { $sum: 1 } } },
  ]);
  const byDay = new Map(daily.map((d) => [d._id, d.n]));
  const signupsDaily = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now - i * day).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
    signupsDaily.push({ day: d, count: byDay.get(d) || 0 });
  }

  // Part des utilisatrices ayant saisi au moins 2 cycles (3 débuts de règles).
  const twoCycles = await Period.aggregate([{ $match: { kind: 'hayd' } }, { $group: { _id: '$user', n: { $sum: 1 } } }, { $match: { n: { $gte: 3 } } }, { $count: 'n' }]);

  // Inscriptions par mois (12 derniers mois).
  const since12 = new Date();
  since12.setUTCMonth(since12.getUTCMonth() - 11, 1);
  const signups = await User.aggregate([
    { $match: { ...users, createdAt: { $gte: since12 } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  // Rétention à 1, 3 et 6 mois : actives dans les 30 derniers jours parmi les inscrites depuis au moins N mois.
  const retention = {};
  for (const months of [1, 3, 6]) {
    const before = new Date(now - months * 30 * day);
    const cohort = await User.countDocuments({ ...users, createdAt: { $lte: before } });
    const active = await User.countDocuments({ ...users, createdAt: { $lte: before }, lastActiveAt: { $gte: new Date(now - 30 * day) } });
    retention[`m${months}`] = cohort ? Math.round((active / cohort) * 100) : null;
  }

  // Revenu mensuel récurrent des formules praticiennes actives.
  const activeSubs = await Subscription.find({ status: 'active', amount: { $gt: 0 } }).select('amount billing').lean();
  const mrr = Math.round(activeSubs.reduce((a, s) => a + (s.billing === 'annuel' ? s.amount / 12 : s.amount), 0) * 100) / 100;

  const [recentUsers, recentBookings] = await Promise.all([
    User.find(users).sort({ createdAt: -1 }).limit(6).select('firstName city situation email phone createdAt').lean(),
    Booking.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .populate({ path: 'practitioner', model: Practitioner, select: 'displayName' })
      .populate({ path: 'client', model: User, select: 'firstName' })
      .lean(),
  ]);

  const trend = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : cur ? 100 : 0);
  res.json({
    days,
    users: { total, dau, mau, marketingRate: total ? Math.round((marketing / total) * 100) : 0, twoCyclesRate: total ? Math.round(((twoCycles[0]?.n || 0) / total) * 100) : 0 },
    period: {
      signups: signupsPeriod,
      signupsTrend: trend(signupsPeriod, signupsPrev),
      bookings: bookingsPeriod,
      bookingsTrend: trend(bookingsPeriod, bookingsPrev),
      practitioners: practitionersPeriod,
    },
    signupsDaily,
    retention,
    signups: signups.map((s) => ({ month: s._id, count: s.n })),
    practitioners: { validated: practitioners, pending: pendingPractitioners, pendingSubscriptions: pendingSubs, activeSubscriptions: activeSubs.length, mrr },
    tasks: { practitioners: pendingPractitioners, subscriptions: pendingSubs, articles: pendingArticles },
    bookings,
    fastsMadeUp: madeUp,
    topArticles: articles,
    recentUsers: recentUsers.map((u) => ({ id: String(u._id), firstName: u.firstName, city: u.city?.name, situation: u.situation, contact: u.email || u.phone, createdAt: u.createdAt })),
    recentBookings: recentBookings.map((b) => ({ id: String(b._id), practitioner: b.practitioner?.displayName, client: b.client?.firstName, serviceName: b.serviceName, day: b.day, time: b.time, status: b.status, price: b.price })),
  });
});

// Recherche rapide (barre du haut du back-office).
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.json({ users: [], practitioners: [] });
  const rx = new RegExp(escapeRegex(q), 'i');
  const [users, practitioners] = await Promise.all([
    User.find({ $or: [{ firstName: rx }, { email: rx }, { phone: rx }, { 'city.name': rx }] }).limit(5).select('firstName email phone city role').lean(),
    Practitioner.find({ $or: [{ displayName: rx }, { 'location.city': rx }] }).limit(5).select('displayName specialty location status').lean(),
  ]);
  res.json({
    users: users.map((u) => ({ id: String(u._id), firstName: u.firstName, contact: u.email || u.phone, city: u.city?.name, role: u.role })),
    practitioners: practitioners.map((p) => ({ id: String(p._id), displayName: p.displayName, specialty: p.specialty, city: p.location?.city, status: p.status })),
  });
});

// --- Utilisatrices -------------------------------------------------------------

const publicUser = (u) => ({
  id: String(u._id),
  firstName: u.firstName,
  age: u.birthYear ? new Date().getUTCFullYear() - u.birthYear : null,
  city: u.city?.name,
  situation: u.situation,
  email: u.email,
  phone: u.phone,
  role: u.role,
  status: u.status,
  marketing: { email: Boolean(u.consents?.marketingEmail?.accepted), sms: Boolean(u.consents?.marketingSms?.accepted), whatsapp: Boolean(u.consents?.marketingWhatsapp?.accepted) },
  createdAt: u.createdAt,
  lastActiveAt: u.lastActiveAt,
});

router.get('/users', async (req, res) => {
  const { skip, limit, page: p } = page(req);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.situation) filter.situation = req.query.situation;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i');
    filter.$or = [{ firstName: rx }, { email: rx }, { phone: rx }, { 'city.name': rx }];
  }
  const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(filter)]);
  const pros = new Set((await Practitioner.find({ user: { $in: items.map((u) => u._id) } }).select('user').lean()).map((p) => String(p.user)));
  res.json({ items: items.map((u) => ({ ...publicUser(u), isPractitioner: pros.has(String(u._id)) })), total, page: p, pages: Math.ceil(total / limit) });
});

// Répartition par âge, ville et situation.
router.get('/users/distribution', async (_req, res) => {
  const year = new Date().getUTCFullYear();
  const users = await User.find({ role: 'user' }).select('birthYear city.name situation').lean();
  const buckets = { '15-17': 0, '18-25': 0, '26-32': 0, '33-45': 0, '46+': 0, inconnu: 0 };
  const cities = {};
  const situations = { mariee: 0, celibataire: 0, inconnue: 0 };
  for (const u of users) {
    const age = u.birthYear ? year - u.birthYear : null;
    if (age == null) buckets.inconnu += 1;
    else if (age < 18) buckets['15-17'] += 1;
    else if (age <= 25) buckets['18-25'] += 1;
    else if (age <= 32) buckets['26-32'] += 1;
    else if (age <= 45) buckets['33-45'] += 1;
    else buckets['46+'] += 1;
    if (u.city?.name) cities[u.city.name] = (cities[u.city.name] || 0) + 1;
    situations[u.situation || 'inconnue'] += 1;
  }
  res.json({
    ages: Object.entries(buckets).map(([label, count]) => ({ label, count })),
    cities: Object.entries(cities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([label, count]) => ({ label, count })),
    situations: Object.entries(situations).map(([label, count]) => ({ label, count })),
  });
});

// Export CSV des contacts ayant accepté les communications (jamais de données de santé).
router.get('/users/export.csv', async (req, res) => {
  const users = await User.find({
    role: 'user',
    $or: [{ 'consents.marketingEmail.accepted': true }, { 'consents.marketingSms.accepted': true }, { 'consents.marketingWhatsapp.accepted': true }],
  }).lean();
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const year = new Date().getUTCFullYear();
  const rows = [
    ['prenom', 'age', 'ville', 'situation', 'email', 'telephone', 'ok_email', 'ok_sms', 'ok_whatsapp', 'inscription'].join(';'),
    ...users.map((u) =>
      [
        u.firstName,
        u.birthYear ? year - u.birthYear : '',
        u.city?.name,
        u.situation,
        u.consents?.marketingEmail?.accepted ? u.email : '',
        u.consents?.marketingSms?.accepted || u.consents?.marketingWhatsapp?.accepted ? u.phone : '',
        u.consents?.marketingEmail?.accepted ? 'oui' : 'non',
        u.consents?.marketingSms?.accepted ? 'oui' : 'non',
        u.consents?.marketingWhatsapp?.accepted ? 'oui' : 'non',
        u.createdAt?.toISOString().slice(0, 10),
      ]
        .map(esc)
        .join(';'),
    ),
  ];
  await audit(req, 'export_contacts', null, { count: users.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="nissali-contacts-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${rows.join('\n')}`);
});

router.get('/users/:id', async (req, res) => {
  const u = await User.findById(req.params.id).lean();
  if (!u) throw notFound();
  const practitioner = await Practitioner.findOne({ user: u._id }).lean();
  res.json({ ...publicUser(u), practitioner, bookings: await Booking.countDocuments({ client: u._id }) });
});

router.patch('/users/:id', validate(z.object({ status: z.enum(['active', 'suspendue']) })), async (req, res) => {
  const u = await User.findOneAndUpdate({ _id: req.params.id, role: { $ne: 'admin' } }, { $set: req.body }, { new: true }).lean();
  if (!u) throw notFound();
  await audit(req, `utilisatrice_${req.body.status}`, u._id);
  res.json(publicUser(u));
});

// --- Praticiennes --------------------------------------------------------------

router.get('/practitioners', async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i');
    filter.$or = [{ displayName: rx }, { 'location.city': rx }];
  }
  const items = await Practitioner.find(filter).sort({ createdAt: -1 }).populate({ path: 'user', model: User, select: 'firstName email phone' }).lean();
  const enriched = await Promise.all(
    items.map(async (p) => {
      const { plan } = await activePlanFor(p);
      return { ...p, id: String(p._id), planName: plan?.name, services: await Service.countDocuments({ practitioner: p._id, active: true }), bookings: await Booking.countDocuments({ practitioner: p._id }) };
    }),
  );
  res.json(enriched);
});

router.get('/practitioners/:id', async (req, res) => {
  const p = await Practitioner.findById(req.params.id).populate({ path: 'user', model: User, select: 'firstName email phone createdAt' }).lean();
  if (!p) throw notFound();
  const [services, subscriptions, reviews, bookings] = await Promise.all([
    Service.find({ practitioner: p._id }).lean(),
    Subscription.find({ practitioner: p._id }).sort({ createdAt: -1 }).lean(),
    Review.find({ practitioner: p._id }).sort({ createdAt: -1 }).limit(20).lean(),
    Booking.find({ practitioner: p._id }).sort({ startAt: -1 }).limit(30).lean(),
  ]);
  res.json({ ...p, id: String(p._id), services, subscriptions, reviews, bookings, plan: (await activePlanFor(p)).plan });
});

router.patch(
  '/practitioners/:id',
  validate(z.object({ status: z.enum(['en_attente', 'validee', 'refusee', 'suspendue']).optional(), rejectionReason: z.string().max(500).optional(), displayName: z.string().max(80).optional(), specialty: z.string().optional(), description: z.string().max(2000).optional() })),
  async (req, res) => {
    const p = await Practitioner.findById(req.params.id);
    if (!p) throw notFound();
    const previous = p.status;
    Object.assign(p, req.body);
    await p.save();
    if (req.body.status && req.body.status !== previous) {
      const texts = { validee: 'Ton profil professionnel est validé !', refusee: 'Ton inscription professionnelle n’a pas été retenue', suspendue: 'Ton profil professionnel est suspendu' };
      if (texts[req.body.status]) await notify(p.user, { key: `pro-status-${p.id}-${req.body.status}-${Date.now()}`, type: 'pro', title: 'Nissali Pro', body: texts[req.body.status], detail: req.body.rejectionReason || texts[req.body.status], link: '/pro' });
    }
    await audit(req, `praticienne_${req.body.status || 'modifiee'}`, p._id);
    res.json(p);
  },
);

router.delete('/practitioners/:id', async (req, res) => {
  const p = await Practitioner.findById(req.params.id);
  if (!p) throw notFound();
  await removeClientFiles({ practitioner: p._id });
  await Promise.all([Service.deleteMany({ practitioner: p._id }), Subscription.deleteMany({ practitioner: p._id }), Review.deleteMany({ practitioner: p._id }), ClientRecord.deleteMany({ practitioner: p._id })]);
  await Booking.updateMany({ practitioner: p._id, status: { $in: ['en_attente', 'confirmee'] } }, { $set: { status: 'annulee', cancelledBy: 'admin' } });
  await p.deleteOne();
  await audit(req, 'praticienne_supprimee', p._id);
  res.json({ ok: true });
});

// --- Formules et abonnements ---------------------------------------------------

const planSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]{2,30}$/, 'Clé : minuscules, chiffres, tirets'),
  name: z.string().min(1).max(40),
  tagline: z.string().max(120).optional(),
  priceMonthly: z.number().min(0).max(10000),
  priceYearly: z.number().min(0).max(100000),
  features: z.object({
    maxServices: z.number().int().min(0).max(100),
    maxBookingsPerMonth: z.number().int().min(0).max(10000),
    video: z.boolean(),
    crm: z.boolean(),
    stats: z.boolean(),
    featured: z.boolean(),
    verifiedBadge: z.boolean(),
    prioritySupport: z.boolean(),
  }),
  highlights: z.array(z.string().max(80)).max(10).optional(),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
});

router.get('/plans', async (_req, res) => res.json(await Plan.find().sort({ order: 1 }).lean()));
router.post('/plans', validate(planSchema), async (req, res) => {
  const plan = await Plan.create(req.body);
  await audit(req, 'formule_creee', plan._id);
  res.status(201).json(plan);
});
router.patch('/plans/:id', validate(planSchema.partial()), async (req, res) => {
  const plan = await Plan.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!plan) throw notFound();
  await audit(req, 'formule_modifiee', plan._id);
  res.json(plan);
});
router.delete('/plans/:id', async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw notFound();
  if (await Subscription.exists({ plan: plan.key, status: 'active' })) throw badRequest('Des praticiennes utilisent cette formule : désactive-la plutôt');
  await plan.deleteOne();
  res.json({ ok: true });
});

router.get('/subscriptions', async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const items = await Subscription.find(filter).sort({ createdAt: -1 }).limit(200).populate({ path: 'practitioner', model: Practitioner, select: 'displayName location.city' }).lean();
  res.json(items);
});

// Confirmation du paiement d'une formule payante (règlement hors appli).
router.patch('/subscriptions/:id', validate(z.object({ status: z.enum(['active', 'annulee', 'expiree']) })), async (req, res) => {
  const sub = await Subscription.findById(req.params.id);
  if (!sub) throw notFound();
  if (req.body.status === 'active') {
    await Subscription.updateMany({ practitioner: sub.practitioner, status: 'active', _id: { $ne: sub._id } }, { $set: { status: 'annulee' } });
    sub.startedAt = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + (sub.billing === 'annuel' ? 12 : 1));
    sub.endsAt = end;
    const p = await Practitioner.findById(sub.practitioner);
    if (p) await notify(p.user, { key: `sub-${sub.id}-active`, type: 'pro', title: 'Nissali Pro', body: 'Ta formule est active', detail: `Ta formule « ${sub.plan} » est active jusqu’au ${end.toISOString().slice(0, 10)}.`, link: '/pro/abonnement' });
  }
  sub.status = req.body.status;
  await sub.save();
  await audit(req, `abonnement_${req.body.status}`, sub._id);
  res.json(sub);
});

// --- Spécialités ---------------------------------------------------------------

const categorySchema = z.object({ key: z.string().regex(/^[a-z0-9_]{2,30}$/), label: z.string().min(1).max(60), group: z.string().regex(/^[a-z0-9_]{2,30}$/).optional(), description: z.string().max(300).optional(), order: z.number().int().optional(), active: z.boolean().optional() });
router.get('/categories', async (_req, res) => res.json(await Category.find().sort({ order: 1 }).lean()));
router.post('/categories', validate(categorySchema), async (req, res) => res.status(201).json(await Category.create({ ...req.body, group: req.body.group || req.body.key })));
router.patch('/categories/:id', validate(categorySchema.partial()), async (req, res) => res.json(await Category.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true })));
router.delete('/categories/:id', async (req, res) => {
  const c = await Category.findById(req.params.id);
  if (!c) throw notFound();
  if (await Practitioner.exists({ specialty: c.key })) throw badRequest('Spécialité utilisée : désactive-la plutôt');
  await c.deleteOne();
  res.json({ ok: true });
});

// --- Réservations et avis ------------------------------------------------------

router.get('/bookings', async (req, res) => {
  const filter = BOOKING_STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
  const items = await Booking.find(filter)
    .sort({ startAt: -1 })
    .limit(200)
    .populate({ path: 'practitioner', model: Practitioner, select: 'displayName' })
    .populate({ path: 'client', model: User, select: 'firstName' })
    .lean();
  res.json(items);
});

router.patch('/bookings/:id', validate(z.object({ status: z.enum(BOOKING_STATUSES) })), async (req, res) => {
  const b = await Booking.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status, ...(req.body.status === 'annulee' ? { cancelledBy: 'admin' } : {}) } }, { new: true });
  if (!b) throw notFound();
  await audit(req, `reservation_${req.body.status}`, b._id);
  res.json(b);
});

router.get('/reviews', async (_req, res) => {
  res.json(
    await Review.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: 'practitioner', model: Practitioner, select: 'displayName' })
      .populate({ path: 'client', model: User, select: 'firstName' })
      .lean(),
  );
});

router.patch('/reviews/:id', validate(z.object({ hidden: z.boolean() })), async (req, res) => {
  const r = await Review.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!r) throw notFound();
  await refreshRating(r.practitioner);
  await audit(req, req.body.hidden ? 'avis_masque' : 'avis_visible', r._id);
  res.json(r);
});

// --- Blog ------------------------------------------------------------------------

const articleSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,120}$/, 'Slug : minuscules, chiffres et tirets'),
  title: z.string().min(3).max(200),
  category: z.enum(Object.keys(CATEGORIES)),
  excerpt: z.string().max(400).optional(),
  body: z.string().min(10),
  readMinutes: z.number().int().min(1).max(60).optional(),
  featured: z.boolean().optional(),
  phases: z.array(z.enum(['menstruelle', 'folliculaire', 'ovulatoire', 'luteale'])).optional(),
  validation: z.enum(['a_valider', 'valide_comite', 'valide_sante']).optional(),
  reviewer: z.string().max(120).optional(),
  sources: z.array(z.string().max(300)).optional(),
  publishAt: z.string().datetime({ offset: true }).or(z.string().refine(isDay)).optional(),
  published: z.boolean().optional(),
  color: z.enum(['rose', 'or', 'blush', 'bordeaux']).optional(),
});

router.get('/articles', async (_req, res) => res.json(await Article.find().sort({ publishAt: -1 }).lean()));
router.get('/articles/:id', async (req, res) => res.json(await Article.findById(req.params.id).lean()));
router.post('/articles', validate(articleSchema), async (req, res) => {
  if (req.body.featured) await Article.updateMany({}, { $set: { featured: false } });
  const a = await Article.create(req.body);
  await audit(req, 'article_cree', a._id);
  res.status(201).json(a);
});
router.patch('/articles/:id', validate(articleSchema.partial()), async (req, res) => {
  if (req.body.featured) await Article.updateMany({ _id: { $ne: req.params.id } }, { $set: { featured: false } });
  const a = await Article.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!a) throw notFound();
  await audit(req, 'article_modifie', a._id);
  res.json(a);
});
router.delete('/articles/:id', async (req, res) => {
  await Article.deleteOne({ _id: req.params.id });
  await audit(req, 'article_supprime', req.params.id);
  res.json({ ok: true });
});

// --- Petit rappel du jour --------------------------------------------------------

const reminderSchema = z.object({ kind: z.enum(['verset', 'hadith', 'conseil']), text: z.string().min(3).max(500), source: z.string().max(200).optional(), scheduledFor: z.string().refine(isDay).nullable().optional(), validated: z.boolean().optional() });
router.get('/reminders', async (_req, res) => res.json(await Reminder.find().sort({ scheduledFor: -1, createdAt: -1 }).lean()));
router.post('/reminders', validate(reminderSchema), async (req, res) => res.status(201).json(await Reminder.create(req.body)));
router.patch('/reminders/:id', validate(reminderSchema.partial()), async (req, res) => res.json(await Reminder.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true })));
router.delete('/reminders/:id', async (req, res) => {
  await Reminder.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

// --- Paramètres religieux, calendrier hégirien, application ----------------------

router.get('/settings', async (_req, res) => {
  const values = await getSettings();
  const optionLabels = {
    prayerMethod: Object.fromEntries(Object.entries(METHODS).map(([k, v]) => [k, v.label])),
    highLatitudeRule: Object.fromEntries(Object.entries(HIGH_LATITUDE_RULES).map(([k, v]) => [k, v.label])),
    hijriAdjustment: { '-1': '− 1 jour', 0: 'Aucun', 1: '+ 1 jour' },
    termRule: { fr: 'France : 41 SA (DDR + 287 j)', naegele: 'Naegele : 40 SA (DDR + 280 j)' },
    practitionersMode: { auto: 'Automatique : ouvert dès qu’une praticienne est validée', ouvert: 'Toujours ouvert', ferme: 'Fermé (flouté « Bientôt disponible »)' },
  };
  res.json({ definitions: SETTING_DEFINITIONS, values, optionLabels });
});

router.put('/settings', async (req, res) => {
  if (!req.body || typeof req.body !== 'object') throw badRequest('Paramètres attendus');
  const result = await updateSettings(req.body, req.user);
  if (Object.keys(result.applied).length) await audit(req, 'parametres_modifies', null, result.applied);
  res.status(result.errors.length ? 400 : 200).json({ ...result, values: await getSettings() });
});

router.get('/settings/history', async (_req, res) => res.json(await SettingHistory.find().sort({ createdAt: -1 }).limit(200).lean()));

router.get('/audit', async (req, res) => {
  const { skip, limit } = page(req);
  res.json(await AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate({ path: 'admin', model: User, select: 'firstName email' }).lean());
});

export default router;

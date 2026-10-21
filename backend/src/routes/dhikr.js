// 5.7 bis — Dhikr : objectifs du jour, tasbih après la prière, compteurs, total et série.
// RG-38 : la journée de dhikr commence à Fajr. RG-39 : la série compte les jours avec au moins un objectif
// atteint, sans jamais être cassée pendant les règles. RG-40 : comptage hors connexion, synchronisé ensuite
// (le téléphone envoie le total absolu de chaque dhikr, donc un envoi rejoué ne compte jamais deux fois).
import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { GOAL_CHOICES, MAX_DHIKR, TASBIH_STEPS } from '../content/dhikr.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { DhikrDay, Period } from '../models/index.js';
import { nowFor } from '../services/context.js';
import { userTimings } from '../services/prayerSource.js';
import { dhikrCatalog } from '../services/dhikrCatalog.js';
import { getSettings } from '../services/settings.js';
import { addDays, weekday } from '../utils/dates.js';
import { badRequest, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Journée de dhikr en cours : avant Fajr, c'est encore la veille (RG-38). */
async function dhikrToday(user) {
  const { today, time } = nowFor(user);
  try {
    const { timings } = await userTimings(user, await getSettings(), today);
    if (timings?.fajr && time < timings.fajr) return addDays(today, -1);
  } catch {
    // horaires indisponibles : la journée civile
  }
  return today;
}

/** Fiche d'un dhikr : bibliothèque (back-office) ou dhikr personnel de l'utilisatrice (RG-48). */
function entryOf(user, cat, key) {
  const own = (user.dhikr?.custom || []).find((c) => c.key === key);
  if (own) return { key, arabic: own.arabic || '', name: own.name, meaning: '', goal: own.goal, personal: true };
  return cat.byKey.get(key) || null;
}

/** Mes dhikr du jour : la liste choisie, ou les six plus connus proposés au départ. */
export function dhikrList(user, cat) {
  const list = user.dhikr?.list?.length ? user.dhikr.list : cat.defaults.map((d) => ({ key: d.key, goal: d.goal }));
  return list.filter((d) => entryOf(user, cat, d.key));
}

function recompute(doc, user, cat) {
  const list = dhikrList(user, cat);
  let total = 0;
  const reached = [];
  for (const [key, count] of doc.counts) {
    total += count;
    const goal = list.find((d) => d.key === key)?.goal || entryOf(user, cat, key)?.goal || 33;
    doc.goals.set(key, goal);
    if (count >= goal && list.some((d) => d.key === key)) reached.push(key);
  }
  doc.total = total;
  doc.reached = reached;
}

/** Jours de règles ou de nifas (confirmés) depuis `from` : la série n'y est jamais cassée. */
async function periodDays(user, from, to) {
  const periods = await Period.find({ user: user._id, start: { $lte: to }, $or: [{ end: null }, { end: { $exists: false } }, { end: { $gte: from } }] }).select('start end').lean();
  const days = new Set();
  for (const p of periods) {
    for (let d = p.start < from ? from : p.start; d <= (p.end || to) && d <= to; d = addDays(d, 1)) days.add(d);
  }
  return days;
}

export async function dhikrSummary(user, day) {
  const from = addDays(day, -120);
  const [docs, paused] = await Promise.all([DhikrDay.find({ user: user._id, day: { $gte: from, $lte: day } }).select('day total reached counts').lean(), periodDays(user, from, day)]);
  const byDay = new Map(docs.map((d) => [d.day, d]));
  // Série : aujourd'hui pas encore atteint ne casse rien ; un jour de règles non plus (RG-39).
  let streak = 0;
  let d = byDay.get(day)?.reached?.length ? day : addDays(day, -1);
  for (let i = 0; i < 120; i += 1, d = addDays(d, -1)) {
    if (byDay.get(d)?.reached?.length) streak += 1;
    else if (!paused.has(d)) break;
  }
  const monday = addDays(day, -((weekday(day) + 6) % 7));
  // 4.6 · 5.1 — la semaine en 7 ronds : doré = au moins un objectif atteint, blanc = aujourd'hui, pointillé sinon.
  const week = WEEK_LABELS.map((label, i) => {
    const wd = addDays(monday, i);
    return { day: wd, label, total: wd > day ? null : byDay.get(wd)?.total || 0, reached: Boolean(byDay.get(wd)?.reached?.length), today: wd === day, future: wd > day };
  });
  const today = byDay.get(day);
  return { today, streak, week, weekTotal: week.reduce((n, w) => n + (w.total || 0), 0), inPeriod: paused.has(day) };
}

const card = (d, extra = {}) => ({ key: d.key, arabic: d.arabic, name: d.name, meaning: d.meaning || '', ...(d.personal ? { personal: true } : {}), ...extra });

router.get('/', async (req, res) => {
  const cat = await dhikrCatalog();
  const day = await dhikrToday(req.user);
  const { today, streak, week, weekTotal, inPeriod } = await dhikrSummary(req.user, day);
  const counts = today?.counts || {};
  const list = dhikrList(req.user, cat).map(({ key, goal }) => {
    const count = counts[key] || 0;
    return card(entryOf(req.user, cat, key), { goal, count, reached: count >= goal });
  });
  res.json({
    day,
    total: today?.total || 0,
    dailyGoal: req.user.dhikr?.dailyGoal || 250,
    reachedCount: list.filter((d) => d.reached).length,
    goalsCount: list.length,
    streak,
    inPeriod,
    week,
    weekTotal,
    list,
    counts,
    max: MAX_DHIKR,
    tasbih: TASBIH_STEPS.filter((t) => cat.byKey.has(t.key)).map((t) => card(cat.byKey.get(t.key), { goal: t.goal })),
    catalog: cat.published.map((d) => card(d, { goal: d.goal })),
    custom: (req.user.dhikr?.custom || []).map((c) => card({ ...c, personal: true }, { goal: c.goal })),
    goalChoices: GOAL_CHOICES,
    settings: req.user.toPublic().dhikr,
  });
});

// Total absolu d'un dhikr pour une journée (idempotent : rejouable depuis la file hors connexion).
router.put(
  '/count',
  validate(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), key: z.string().max(40), count: z.number().int().min(0).max(100000) })),
  async (req, res) => {
    const { day, key, count } = req.body;
    const cat = await dhikrCatalog();
    if (!entryOf(req.user, cat, key)) throw badRequest('Dhikr inconnu');
    const current = await dhikrToday(req.user);
    if (day > addDays(current, 1) || day < addDays(current, -14)) throw badRequest('Journée de dhikr invalide');
    const doc = (await DhikrDay.findOne({ user: req.user._id, day })) || new DhikrDay({ user: req.user._id, day });
    doc.counts.set(key, count);
    recompute(doc, req.user, cat);
    await doc.save();
    res.json({ day, key, count, total: doc.total, reached: doc.reached });
  },
);

// Mes dhikr du jour : ordre, ajouts (bibliothèque ou dhikr personnels) et objectifs (33, 99, 100 ou libre). Max 20.
router.put(
  '/list',
  validate(z.object({ list: z.array(z.object({ key: z.string().max(40), goal: z.number().int().min(1).max(10000) })).min(1, 'Garde au moins un dhikr').max(MAX_DHIKR, `${MAX_DHIKR} dhikr au maximum dans ta liste`) })),
  async (req, res) => {
    const cat = await dhikrCatalog();
    const seen = new Set();
    const list = req.body.list.filter((d) => entryOf(req.user, cat, d.key) && !seen.has(d.key) && seen.add(d.key));
    if (!list.length) throw badRequest('Dhikr inconnu');
    req.user.set('dhikr.list', list);
    await req.user.save();
    res.json({ list: dhikrList(req.user, cat) });
  },
);

// RG-48 — Créer mon dhikr : texte libre (2 à 80 caractères), arabe facultatif, objectif (33 par défaut).
// Il s'ajoute à la liste du jour avec la mention « Personnel ».
const customSchema = z.object({
  name: z.string().trim().min(2, 'Au moins 2 caractères').max(80, '80 caractères au maximum'),
  arabic: z.string().trim().max(200).optional().nullable(),
  goal: z.number().int().min(1).max(10000).default(33),
});
router.post('/custom', validate(customSchema), async (req, res) => {
  const cat = await dhikrCatalog();
  const list = dhikrList(req.user, cat);
  if (list.length >= MAX_DHIKR) throw badRequest(`${MAX_DHIKR} dhikr au maximum dans ta liste : retires-en un d’abord.`);
  const key = `perso_${randomBytes(5).toString('hex')}`;
  req.user.set('dhikr.custom', [...(req.user.dhikr?.custom || []), { key, name: req.body.name, arabic: req.body.arabic || '', goal: req.body.goal }]);
  req.user.set('dhikr.list', [...list.map(({ key: k, goal }) => ({ key: k, goal })), { key, goal: req.body.goal }]);
  await req.user.save();
  res.status(201).json({ key, list: dhikrList(req.user, cat) });
});
router.patch('/custom/:key', validate(customSchema.partial()), async (req, res) => {
  const custom = req.user.dhikr?.custom || [];
  const c = custom.find((x) => x.key === req.params.key);
  if (!c) throw notFound('Dhikr introuvable');
  for (const k of ['name', 'arabic', 'goal']) if (req.body[k] !== undefined) c[k] = req.body[k] || (k === 'arabic' ? '' : c[k]);
  req.user.set('dhikr.custom', custom.map((x) => (x.key === c.key ? { key: c.key, name: c.name, arabic: c.arabic, goal: c.goal } : x)));
  if (req.body.goal) req.user.set('dhikr.list', (req.user.dhikr?.list || []).map((d) => (d.key === c.key ? { key: d.key, goal: req.body.goal } : d)));
  await req.user.save();
  res.json({ ok: true });
});
router.delete('/custom/:key', async (req, res) => {
  const cat = await dhikrCatalog();
  const custom = req.user.dhikr?.custom || [];
  if (!custom.some((x) => x.key === req.params.key)) throw notFound('Dhikr introuvable');
  const list = dhikrList(req.user, cat).filter((d) => d.key !== req.params.key);
  req.user.set('dhikr.custom', custom.filter((x) => x.key !== req.params.key));
  req.user.set('dhikr.list', list.length ? list.map(({ key, goal }) => ({ key, goal })) : cat.defaults.map((d) => ({ key: d.key, goal: d.goal })));
  await req.user.save();
  res.json({ ok: true });
});

router.patch(
  '/settings',
  validate(z.object({ haptics: z.boolean().optional(), reminder: z.boolean().optional(), reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), dailyGoal: z.number().int().min(1).max(100000).optional() })),
  async (req, res) => {
    for (const [k, v] of Object.entries(req.body)) req.user.set(`dhikr.${k}`, v);
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  },
);

export default router;

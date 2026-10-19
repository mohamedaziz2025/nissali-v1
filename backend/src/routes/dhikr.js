// 5.7 bis — Dhikr : objectifs du jour, tasbih après la prière, compteurs, total et série.
// RG-38 : la journée de dhikr commence à Fajr. RG-39 : la série compte les jours avec au moins un objectif
// atteint, sans jamais être cassée pendant les règles. RG-40 : comptage hors connexion, synchronisé ensuite
// (le téléphone envoie le total absolu de chaque dhikr, donc un envoi rejoué ne compte jamais deux fois).
import { Router } from 'express';
import { z } from 'zod';
import { DEFAULT_DHIKR, DHIKR_BY_KEY, DHIKR_CATALOG, GOAL_CHOICES, TASBIH_STEPS } from '../content/dhikr.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { DhikrDay, Period } from '../models/index.js';
import { nowFor } from '../services/context.js';
import { userTimings } from '../services/prayerSource.js';
import { getSettings } from '../services/settings.js';
import { addDays, weekday } from '../utils/dates.js';
import { badRequest } from '../utils/http.js';

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

/** Mes dhikr du jour : la liste choisie, ou les six proposés au départ. */
export function dhikrList(user) {
  const list = user.dhikr?.list?.length ? user.dhikr.list : DEFAULT_DHIKR.map((key) => ({ key, goal: DHIKR_BY_KEY.get(key).goal }));
  return list.filter((d) => DHIKR_BY_KEY.has(d.key));
}

const goalOf = (user, key) => dhikrList(user).find((d) => d.key === key)?.goal || DHIKR_BY_KEY.get(key)?.goal || 33;

function recompute(doc, user) {
  let total = 0;
  const reached = [];
  for (const [key, count] of doc.counts) {
    total += count;
    const goal = goalOf(user, key);
    doc.goals.set(key, goal);
    if (count >= goal && dhikrList(user).some((d) => d.key === key)) reached.push(key);
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
  const week = WEEK_LABELS.map((label, i) => {
    const wd = addDays(monday, i);
    return { day: wd, label, total: wd > day ? null : byDay.get(wd)?.total || 0 };
  });
  const today = byDay.get(day);
  return { today, streak, week, weekTotal: week.reduce((n, w) => n + (w.total || 0), 0), inPeriod: paused.has(day) };
}

const card = (key, extra = {}) => {
  const d = DHIKR_BY_KEY.get(key);
  return { key, arabic: d.arabic, name: d.name, meaning: d.meaning, ...extra };
};

router.get('/', async (req, res) => {
  const day = await dhikrToday(req.user);
  const { today, streak, week, weekTotal, inPeriod } = await dhikrSummary(req.user, day);
  const counts = today?.counts || {};
  const list = dhikrList(req.user).map(({ key, goal }) => {
    const count = counts[key] || 0;
    return card(key, { goal, count, reached: count >= goal });
  });
  res.json({
    day,
    total: today?.total || 0,
    reachedCount: list.filter((d) => d.reached).length,
    goalsCount: list.length,
    streak,
    inPeriod,
    week,
    weekTotal,
    list,
    counts,
    tasbih: TASBIH_STEPS.map((s) => card(s.key, { goal: s.goal })),
    catalog: DHIKR_CATALOG.map((d) => card(d.key, { goal: d.goal })),
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
    if (!DHIKR_BY_KEY.has(key)) throw badRequest('Dhikr inconnu');
    const current = await dhikrToday(req.user);
    if (day > addDays(current, 1) || day < addDays(current, -14)) throw badRequest('Journée de dhikr invalide');
    const doc = (await DhikrDay.findOne({ user: req.user._id, day })) || new DhikrDay({ user: req.user._id, day });
    doc.counts.set(key, count);
    recompute(doc, req.user);
    await doc.save();
    res.json({ day, key, count, total: doc.total, reached: doc.reached });
  },
);

// Mes dhikr du jour : ordre, ajouts (liste validée par le comité) et objectifs (33, 99, 100 ou libre).
router.put(
  '/list',
  validate(z.object({ list: z.array(z.object({ key: z.string().max(40), goal: z.number().int().min(1).max(10000) })).min(1, 'Garde au moins un dhikr').max(20) })),
  async (req, res) => {
    const seen = new Set();
    const list = req.body.list.filter((d) => DHIKR_BY_KEY.has(d.key) && !seen.has(d.key) && seen.add(d.key));
    if (!list.length) throw badRequest('Dhikr inconnu');
    req.user.set('dhikr.list', list);
    await req.user.save();
    res.json({ list: dhikrList(req.user) });
  },
);

router.patch(
  '/settings',
  validate(z.object({ haptics: z.boolean().optional(), reminder: z.boolean().optional(), reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional() })),
  async (req, res) => {
    for (const [k, v] of Object.entries(req.body)) req.user.set(`dhikr.${k}`, v);
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  },
);

export default router;

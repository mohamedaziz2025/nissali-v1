// 5.9 — Santé du jour, signes de fertilité et graphiques d'évolution sur plusieurs cycles.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireHealthConsent } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { DailyLog, MOODS, SYMPTOMS } from '../models/index.js';
import { loadCycleContext, nowFor } from '../services/context.js';
import { buildHealthTips, getWeather } from '../services/health.js';
import { prayerOptionsFor } from '../services/prayerService.js';
import { getSettings } from '../services/settings.js';
import { addDays, isDay } from '../utils/dates.js';
import { badRequest, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth, requireHealthConsent);

router.get('/options', (_req, res) => {
  res.json({ moods: MOODS, symptoms: SYMPTOMS });
});

router.get('/day/:day', async (req, res) => {
  if (!isDay(req.params.day)) throw badRequest('Date invalide');
  res.json((await DailyLog.findOne({ user: req.user._id, day: req.params.day }).lean()) || { day: req.params.day });
});

const logSchema = z
  .object({
    mood: z.enum(MOODS).nullable(),
    energy: z.number().int().min(1).max(5).nullable(),
    symptoms: z.array(z.string().max(40)).max(20),
    sleepHours: z.number().min(0).max(24).nullable(),
    weight: z.number().min(25).max(300).nullable(),
    medications: z.array(z.string().max(60)).max(20),
    pillTaken: z.boolean().nullable(),
    temperature: z.number().min(34).max(42).nullable(),
    cervicalMucus: z.enum(['seche', 'collante', 'cremeuse', 'aqueuse', 'blanc_oeuf']).nullable(),
    ovulationTest: z.enum(['positif', 'negatif']).nullable(),
    notes: z.string().max(1000).nullable(),
  })
  .partial();

router.put('/day/:day', validate(logSchema), async (req, res) => {
  if (!isDay(req.params.day)) throw badRequest('Date invalide');
  const { today } = nowFor(req.user);
  if (req.params.day > today) throw badRequest('Impossible de noter un jour futur');
  const set = {};
  const unset = {};
  for (const [k, v] of Object.entries(req.body)) {
    if (v === null) unset[k] = '';
    else set[k] = v;
  }
  const log = await DailyLog.findOneAndUpdate(
    { user: req.user._id, day: req.params.day },
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { upsert: true, new: true },
  ).lean();
  res.json(log);
});

// 02 / 03 — Mon poids : dernière mesure, historique, ajout daté (aujourd'hui par défaut), correction, suppression.
router.get('/weights', async (req, res) => {
  const list = await DailyLog.find({ user: req.user._id, weight: { $exists: true, $ne: null } }).sort({ day: 1 }).select('day weight').lean();
  const items = list.map((l) => ({ day: l.day, weight: l.weight }));
  res.json({ items, last: items[items.length - 1] || null });
});

const weightSchema = z.object({ weight: z.number({ invalid_type_error: 'Indique ton poids en kg' }).min(25, 'Poids invalide : entre 25 et 300 kg').max(300, 'Poids invalide : entre 25 et 300 kg') });

router.put('/weights/:day', validate(weightSchema), async (req, res) => {
  if (!isDay(req.params.day)) throw badRequest('Date invalide');
  if (req.params.day > nowFor(req.user).today) throw badRequest('Impossible de noter un poids pour une date future');
  const weight = Math.round(req.body.weight * 10) / 10;
  await DailyLog.updateOne({ user: req.user._id, day: req.params.day }, { $set: { weight } }, { upsert: true });
  res.json({ day: req.params.day, weight });
});

router.delete('/weights/:day', async (req, res) => {
  if (!isDay(req.params.day)) throw badRequest('Date invalide');
  const r = await DailyLog.updateOne({ user: req.user._id, day: req.params.day, weight: { $exists: true } }, { $unset: { weight: '' } });
  if (!r.modifiedCount) throw notFound('Aucune mesure ce jour-là');
  res.json({ ok: true });
});

// Graphiques d'évolution : séries quotidiennes + moyennes par cycle.
router.get('/stats', async (req, res) => {
  const days = Math.min(365, Math.max(30, Number(req.query.days) || 180));
  const ctx = await loadCycleContext(req.user, { logsSince: addDays(nowFor(req.user).today, -days) });
  const logs = [...ctx.logs].sort((a, b) => (a.day < b.day ? -1 : 1));
  const series = (key) => logs.filter((l) => typeof l[key] === 'number').map((l) => ({ day: l.day, value: l[key] }));

  const cycles = ctx.summary.cycles.slice(-6).map((c) => {
    const inCycle = logs.filter((l) => l.day >= c.start && l.day <= c.end);
    const avg = (key) => {
      const v = inCycle.filter((l) => typeof l[key] === 'number').map((l) => l[key]);
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    };
    const symptomCounts = {};
    for (const l of inCycle) for (const s of l.symptoms || []) symptomCounts[s] = (symptomCounts[s] || 0) + 1;
    return { start: c.start, length: c.length, periodLength: c.periodLength, sleep: avg('sleepHours'), weight: avg('weight'), energy: avg('energy'), symptoms: symptomCounts };
  });

  const moods = {};
  for (const l of logs) if (l.mood) moods[l.mood] = (moods[l.mood] || 0) + 1;
  const symptoms = {};
  for (const l of logs) for (const s of l.symptoms || []) symptoms[s] = (symptoms[s] || 0) + 1;

  res.json({
    from: addDays(ctx.today, -days),
    to: ctx.today,
    weight: series('weight'),
    sleep: series('sleepHours'),
    temperature: series('temperature'),
    energy: series('energy'),
    moods,
    symptoms,
    cycles,
    cycleLengths: ctx.summary.cycles.slice(-12).map((c) => ({ start: c.start, value: c.length })),
  });
});

// Conseils santé : météo et qualité de l'air (Open-Meteo) + phase du cycle.
router.get('/tips', async (req, res) => {
  const settings = await getSettings();
  const ctx = await loadCycleContext(req.user);
  const options = prayerOptionsFor(req.user, settings);
  const weather = await getWeather(options.lat, options.lng).catch(() => null);
  res.json({ weather, tips: buildHealthTips({ phase: ctx.summary.phase, weather, pregnant: req.user.mode === 'grossesse' }) });
});

export default router;

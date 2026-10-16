// 5.8 / 6.11 — Jeûnes : compteur automatique, saisie manuelle, rattrapage, plan, Ramadan.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireHealthConsent } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { FastPlan, MadeUpFast, MissedFast, PriorMadeUp } from '../models/index.js';
import { loadFastContext, nowFor } from '../services/context.js';
import { rhythmAdvice } from '../services/fastCalc.js';
import { forbiddenFastReason, isRamadan, ramadanInfo, ramadanRange, supererogatoryFasts, toHijri, whiteDays } from '../services/hijri.js';
import { userTimingsRange } from '../services/prayerSource.js';
import { getSettings } from '../services/settings.js';
import { diffDays, isDay } from '../utils/dates.js';
import { badRequest, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth, requireHealthConsent);

router.get('/', async (req, res) => {
  const f = await loadFastContext(req.user);
  const { today, settings } = f.ctx;
  const adj = settings.hijriAdjustment || 0;
  const ramadan = ramadanInfo(today, adj);
  const latestYear = f.counter.byYear.length ? f.counter.byYear[f.counter.byYear.length - 1].hijriYear : toHijri(today, adj).year;

  // RG-24 bis — prochain Ramadan (estimation hégirienne + ajustement du back-office) et jours restants.
  const next = ramadan.current ? ramadanRange(ramadan.hijriYear + 1, adj) : ramadan;
  const daysLeft = diffDays(next.start, today);
  const madeUpSorted = [...f.madeUp].sort((a, b) => (a.day < b.day ? -1 : 1));
  const white = whiteDays(today, adj, settings.excludeDhulHijja13);
  const hijriWhite = white.days.map((d) => ({ ...d, hijri: toHijri(d.day, adj) }));

  res.json({
    today,
    nextRamadan: { hijriYear: ramadan.current ? ramadan.hijriYear + 1 : ramadan.hijriYear, start: next.start, daysLeft },
    rhythm: rhythmAdvice(daysLeft, f.counter.remaining),
    // Une case par jour à rattraper (RG-23) : les cases cochées portent la date du rattrapage.
    boxes: Array.from({ length: Math.max(f.counter.missed, f.counter.madeUp) }, (_, i) => (madeUpSorted[i] ? { index: i + 1, done: true, id: String(madeUpSorted[i]._id), day: madeUpSorted[i].day } : { index: i + 1, done: false })),
    whiteDays: { inProgress: white.inProgress, daysUntil: white.daysUntil, monthName: white.monthName, days: hijriWhite.map((d) => ({ day: d.day, hijriDay: d.hijriDay, hijriMonth: d.hijri.monthName || white.monthName })) },
    counter: f.counter,
    label: `${f.counter.madeUp} rattrapé${f.counter.madeUp > 1 ? 's' : ''} sur ${f.counter.missed} · Ramadan ${latestYear}`,
    autoMissed: f.autoMissed,
    manual: f.manual.map(({ _id, ...m }) => ({ id: String(_id), ...m })),
    madeUp: f.madeUp.map(({ _id, day }) => ({ id: String(_id), day })),
    // 08 — jours déjà rattrapés hors application (par nombre ou par dates).
    prior: f.prior.map((p) => ({ id: String(p._id), hijriYear: p.hijriYear, mode: p.mode, count: p.count, dates: p.dates, createdAt: p.createdAt })),
    // Années de Ramadan proposées pour rattacher un ajout : celles qui ont des jours à rattraper, sinon le dernier Ramadan.
    years: f.counter.byYear.length ? f.counter.byYear.map((y) => y.hijriYear) : [ramadan.current ? ramadan.hijriYear : ramadan.hijriYear - 1],
    madeUpToday: f.madeUp.some((m) => m.day === today),
    plan: f.plan ? { active: f.plan.active, perWeek: f.plan.perWeek, weekdays: f.plan.weekdays, reminderTime: f.plan.reminderTime } : null,
    planDays: f.planDays.slice(0, 8),
    ramadan,
    supererogatory: supererogatoryFasts(today, adj),
    fidyaInfo: settings.fidyaInfo,
    todayStatus: {
      forbidden: forbiddenFastReason(today, adj),
      ramadan: isRamadan(today, adj),
      inPeriod: f.ctx.summary.inPeriod && !f.ctx.summary.istihada,
    },
  });
});

// Ajout manuel de jours manqués (maladie, voyage, années précédentes…).
const missedSchema = z.object({
  hijriYear: z.number().int().min(1380).max(1500),
  count: z.number().int().min(1).max(30).default(1),
  reason: z.enum(['maladie', 'voyage', 'grossesse', 'allaitement', 'regles', 'autre']).default('autre'),
  day: z.string().refine(isDay).optional(),
  note: z.string().max(300).optional(),
});

router.post('/missed', validate(missedSchema), async (req, res) => {
  res.status(201).json(await MissedFast.create({ ...req.body, user: req.user._id }));
});

router.delete('/missed/:id', async (req, res) => {
  const r = await MissedFast.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!r.deletedCount) throw notFound();
  res.json({ ok: true });
});

// « J'ai jeûné aujourd'hui » : chaque jour rattrapé fait baisser le compteur.
router.post('/made-up', validate(z.object({ day: z.string().refine(isDay).optional() })), async (req, res) => {
  const settings = await getSettings();
  const { today } = nowFor(req.user);
  const day = req.body.day || today;
  if (day > today) throw badRequest('Tu ne peux cocher qu’un jour passé ou aujourd’hui');
  const forbidden = forbiddenFastReason(day, settings.hijriAdjustment);
  if (forbidden) throw badRequest(`Le jeûne n’est pas permis ce jour-là (${forbidden})`);
  if (isRamadan(day, settings.hijriAdjustment)) throw badRequest('Un jour de Ramadan ne peut pas servir de rattrapage');
  if (await PriorMadeUp.exists({ user: req.user._id, dates: day })) throw badRequest('Ce jour est déjà noté dans tes jours rattrapés hors application', 'DUPLICATE_DATE');
  const doc = await MadeUpFast.findOneAndUpdate({ user: req.user._id, day }, { $setOnInsert: { user: req.user._id, day } }, { upsert: true, new: true });
  res.status(201).json({ id: doc.id, day: doc.day });
});

router.delete('/made-up/:id', async (req, res) => {
  await MadeUpFast.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ ok: true });
});

// 08 / 09 / 10 — Jours déjà rattrapés hors application.
const priorSchema = z
  .object({
    hijriYear: z.number().int().min(1380).max(1500),
    mode: z.enum(['nombre', 'dates']),
    count: z.number().int().optional(),
    dates: z.array(z.string().refine(isDay, 'Date invalide')).max(60).default([]),
    requestId: z.string().min(6).max(80).optional(),
  })
  .refine((b) => b.mode === 'dates' || Number.isInteger(b.count), { message: 'Indique le nombre de jours', path: ['count'] });

/** Contrôle d'un ajout : nombre positif, dans le solde du Ramadan choisi, dates passées et sans doublon. */
async function checkPrior(user, b, { replacing } = {}) {
  const f = await loadFastContext(user);
  const { today, settings } = f.ctx;
  const count = b.mode === 'dates' ? b.dates.length : b.count;
  if (!count || count < 1) throw badRequest(b.mode === 'dates' ? 'Choisis au moins une date' : 'Le nombre de jours doit être au moins 1');
  if (b.mode === 'nombre' && b.dates.length > count) throw badRequest(`Tu as choisi ${b.dates.length} dates pour ${count} jour${count > 1 ? 's' : ''}`);
  const year = f.counter.byYear.find((y) => y.hijriYear === b.hijriYear);
  const available = (year?.remaining || 0) + (replacing?.hijriYear === b.hijriYear ? replacing.count : 0);
  if (available <= 0) throw badRequest('Tous tes jours sont rattrapés', 'ALL_MADE_UP');
  if (count > available) throw badRequest(`Tu ne peux pas ajouter plus de ${available} jour${available > 1 ? 's' : ''} : c’est ton solde pour le Ramadan ${b.hijriYear}`, 'OVER_BALANCE');
  if (new Set(b.dates).size !== b.dates.length) throw badRequest('Une même date est choisie deux fois');
  const adj = settings.hijriAdjustment || 0;
  for (const d of b.dates) {
    if (d > today) throw badRequest('Une date de rattrapage ne peut pas être dans le futur');
    if (isRamadan(d, adj)) throw badRequest('Un jour de Ramadan ne peut pas servir de rattrapage');
  }
  const taken = new Set([...f.madeUp.map((m) => m.day), ...f.prior.filter((p) => String(p._id) !== String(replacing?._id)).flatMap((p) => p.dates)]);
  const dup = b.dates.find((d) => taken.has(d));
  if (dup) throw badRequest(`Le ${new Date(`${dup}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} est déjà noté comme rattrapé`, 'DUPLICATE_DATE');
  return count;
}

router.post('/prior', validate(priorSchema), async (req, res) => {
  const b = req.body;
  if (b.requestId) {
    const same = await PriorMadeUp.findOne({ user: req.user._id, requestId: b.requestId }).lean();
    if (same) return res.json({ id: String(same._id), duplicate: true });
  }
  const count = await checkPrior(req.user, b);
  try {
    const doc = await PriorMadeUp.create({ user: req.user._id, hijriYear: b.hijriYear, mode: b.mode, count, dates: [...b.dates].sort(), requestId: b.requestId });
    res.status(201).json({ id: doc.id, count });
  } catch (e) {
    if (e.code === 11000) return res.json({ duplicate: true }); // deuxième clic simultané
    throw e;
  }
});

router.patch('/prior/:id', validate(priorSchema), async (req, res) => {
  const doc = await PriorMadeUp.findOne({ _id: req.params.id, user: req.user._id });
  if (!doc) throw notFound();
  const count = await checkPrior(req.user, req.body, { replacing: doc });
  Object.assign(doc, { hijriYear: req.body.hijriYear, mode: req.body.mode, count, dates: [...req.body.dates].sort() });
  await doc.save();
  res.json({ id: doc.id, count });
});

router.delete('/prior/:id', async (req, res) => {
  const r = await PriorMadeUp.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!r.deletedCount) throw notFound();
  res.json({ ok: true });
});

// « Total initial · Modifier » : nombre de jours à rattraper pour un Ramadan (jours comptés automatiquement + ajout manuel).
router.put('/total', validate(z.object({ hijriYear: z.number().int().min(1380).max(1500), total: z.number().int().min(0).max(30) })), async (req, res) => {
  const { hijriYear, total } = req.body;
  const f = await loadFastContext(req.user);
  const year = f.counter.byYear.find((y) => y.hijriYear === hijriYear);
  const auto = year?.auto || 0;
  if (total < auto) throw badRequest(`Le total ne peut pas être inférieur aux ${auto} jours comptés automatiquement pendant tes règles`);
  if (total < (year?.prior || 0)) throw badRequest(`Le total ne peut pas être inférieur aux ${year.prior} jours déjà rattrapés hors application`);
  await MissedFast.deleteMany({ user: req.user._id, hijriYear });
  if (total > auto) await MissedFast.create({ user: req.user._id, hijriYear, count: total - auto, reason: 'autre', note: 'Total saisi' });
  res.json({ hijriYear, total });
});

// Plan de rattrapage : rythme choisi (ex. 2 jours par semaine), rappel la veille.
const planSchema = z.object({
  active: z.boolean().default(true),
  perWeek: z.number().int().min(1).max(7),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('21:00'),
});

router.put('/plan', validate(planSchema), async (req, res) => {
  const b = req.body;
  const weekdays = b.weekdays?.length ? b.weekdays.slice(0, b.perWeek) : undefined;
  const plan = await FastPlan.findOneAndUpdate(
    { user: req.user._id },
    { $set: { active: b.active, perWeek: b.perWeek, reminderTime: b.reminderTime, ...(weekdays ? { weekdays } : {}) } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (!weekdays) {
    const { DEFAULT_WEEKDAYS } = await import('../services/fastCalc.js');
    plan.weekdays = DEFAULT_WEEKDAYS[b.perWeek];
    await plan.save();
  }
  res.json(plan);
});

// Calendrier de Ramadan : suhur (Fajr) et iftar (Maghrib) pour la ville de l'utilisatrice.
router.get('/ramadan-calendar', async (req, res) => {
  const settings = await getSettings();
  const { today } = nowFor(req.user);
  const info = ramadanInfo(today, settings.hijriAdjustment);
  const timings = await userTimingsRange(req.user, settings, info.start, info.end);
  res.json({
    hijriYear: info.hijriYear,
    start: info.start,
    end: info.end,
    current: info.current,
    days: timings.map((t, i) => ({ day: t.day, hijriDay: i + 1, suhur: t.fajr, iftar: t.maghrib })),
  });
});

export default router;

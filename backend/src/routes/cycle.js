// 5.3 / 5.4 — Saisie des règles et onglet Cycle (calendrier, phases, historique).
import { Router } from 'express';
import { upcomingNotes } from '../services/notes.js';
import { z } from 'zod';
import { requireAuth, requireHealthConsent } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Appointment, Booking, DailyLog, MadeUpFast, Period, Practitioner, VoluntaryFast } from '../models/index.js';
import { GHUSL_STEPS, HEALTH_ALERTS, PHASES, RELIABILITY_LABELS } from '../content/phases.js';
import { loadCycleContext, loadFastContext, nowFor } from '../services/context.js';
import { plannedFast } from '../services/contextCard.js';
import { VOLUNTARY_LABELS } from '../services/voluntary.js';
import { phaseOf } from '../services/cycleCalc.js';
import { tipOfTheDay } from '../services/healthTips.js';
import { isRamadan, toHijri } from '../services/hijri.js';
import { notify } from '../services/notifications.js';
import { prayersAfterPurification } from '../services/prayerService.js';
import { userTimings } from '../services/prayerSource.js';
import { addDays, diffDays, eachDay, isDay, isTime, minDay, monthBounds, weekday } from '../utils/dates.js';
import { badRequest, conflict, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth, requireHealthConsent);

const day = z.string().refine(isDay, 'Date invalide (AAAA-MM-JJ)');
const time = z.string().refine(isTime, 'Heure invalide (HH:mm)');

/** Jours du mois avec leur statut pour le calendrier (5.4). */
export function buildCalendar(month, ctx, appointments) {
  const { start, end } = monthBounds(month);
  const { summary, periods, today, settings } = ctx;
  const luteal = settings.lutealLength || 14;
  const days = eachDay(start, end);

  const actual = periods.map((p) => ({ ...p, until: p.end || today }));
  const flows = new Map(periods.flatMap((p) => (p.flows || []).map((f) => [f.day, f.level])));

  // Fenêtres fertiles : cycles passés (estimées a posteriori) + cycle en cours et cycles prédits.
  const windows = summary.cycles.map((c) => {
    const ovulation = addDays(c.nextStart, -luteal);
    return { fertileStart: addDays(ovulation, -5), ovulation };
  });
  const predicted = [];
  if (!summary.noPrediction && summary.projections.length) {
    for (const c of summary.projections) windows.push({ fertileStart: c.fertileStart, ovulation: c.ovulation });
    for (const c of summary.projections.slice(1)) predicted.push([c.start, c.periodEnd]);
  }
  const range = summary.nextPeriod?.rangeStart ? [summary.nextPeriod.rangeStart, summary.nextPeriod.rangeEnd] : null;
  const appts = new Map();
  for (const a of appointments) appts.set(a.day, [...(appts.get(a.day) || []), a]);

  return days.map((d) => {
    const real = actual.find((p) => d >= p.start && d <= p.until);
    const isPredicted = !real && d > today && predicted.some(([s, e]) => d >= s && d <= e);
    const fertile = windows.some((w) => d >= w.fertileStart && d <= w.ovulation);
    const ovulation = windows.some((w) => d === w.ovulation);
    return {
      day: d,
      period: real ? (real.kind === 'nifas' ? 'nifas' : 'reelle') : isPredicted ? 'prevue' : null,
      inRange: Boolean(range && !real && d >= range[0] && d <= range[1]),
      fertile: !real && fertile,
      ovulation: !real && ovulation,
      today: d === today,
      flow: flows.get(d) || null,
      appointments: appts.get(d) || [],
    };
  });
}

async function appointmentsFor(user, from, to) {
  const [medical, bookings] = await Promise.all([
    Appointment.find({ user: user._id, day: { $gte: from, $lte: to }, status: { $ne: 'annule' } }).lean(),
    Booking.find({ client: user._id, day: { $gte: from, $lte: to }, status: { $in: ['en_attente', 'confirmee', 'terminee'] } })
      .populate({ path: 'practitioner', model: Practitioner, select: 'displayName specialty' })
      .lean(),
  ]);
  return [
    ...medical.map((a) => ({ id: String(a._id), type: 'medical', title: a.title, day: a.day, time: a.time })),
    ...bookings.map((b) => ({ id: String(b._id), type: 'praticienne', title: `${b.serviceName} · ${b.practitioner?.displayName || ''}`, day: b.day, time: b.time, status: b.status })),
  ].sort((a, b) => `${a.day}${a.time || ''}`.localeCompare(`${b.day}${b.time || ''}`));
}

/** Jours du calendrier (règles notées / prévues, fenêtre fertile…) sur une période qui peut couvrir deux mois. */
function calendarDays(ctx, appointments, from, to) {
  const months = [...new Set(eachDay(from, to).map((d) => d.slice(0, 7)))];
  return months.flatMap((m) => buildCalendar(m, ctx, appointments)).filter((c) => c.day >= from && c.day <= to);
}

router.get('/', async (req, res) => {
  const ctx = await loadCycleContext(req.user);
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : ctx.today.slice(0, 7);
  const { start, end } = monthBounds(month);
  const monday = addDays(ctx.today, -((weekday(ctx.today) + 6) % 7));
  const [appointments, todayLog, lastWeight, notes] = await Promise.all([
    appointmentsFor(req.user, addDays(minDay(start, monday), -7), addDays(end, 60)),
    DailyLog.findOne({ user: req.user._id, day: ctx.today }).lean(),
    DailyLog.findOne({ user: req.user._id, weight: { $exists: true, $ne: null } }).sort({ day: -1 }).select('day weight').lean(),
    // 5.4 — notes « affichées dans le calendrier » : un petit point sur les jours concernés.
    upcomingNotes(req.user._id, minDay(start, monday), { days: 45, limit: 400 }),
  ]);
  const noteMap = new Map();
  for (const n of notes) if (n.showInCalendar) noteMap.set(n.day, [...(noteMap.get(n.day) || []), { id: n.noteId, text: n.text, time: n.time, type: n.type }]);
  const withNotes = (days) => days.map((d) => (noteMap.has(d.day) ? { ...d, notes: noteMap.get(d.day) } : d));
  const s = ctx.summary;
  const current = s.projections[0];

  res.json({
    today: ctx.today,
    month,
    mode: req.user.mode,
    // Carte « Prochaines règles dans X jours » (ajout demandé dans l'onglet Cycle)
    next: s.nextPeriod
      ? { date: s.nextPeriod.date, daysUntil: s.daysUntilNext, rangeStart: s.nextPeriod.rangeStart, rangeEnd: s.nextPeriod.rangeEnd, lateDays: s.lateDays, cycleDay: s.cycleDay, cycleLength: s.cycleLength }
      : null,
    inPeriod: s.inPeriod ? { day: s.periodDay, start: s.currentPeriod.start, id: s.currentPeriod.id, askPeriodEnded: s.askPeriodEnded, istihada: s.istihada } : null,
    nifas: s.nifas || null,
    noPrediction: s.noPrediction,
    phase: s.phase ? { key: s.phase, label: PHASES[s.phase].label, what: PHASES[s.phase].what, tips: PHASES[s.phase].tips, bounds: s.phaseBounds } : null,
    ovulation: s.ovulation,
    fertileToday: current ? ctx.today >= current.fertileStart && ctx.today <= current.fertileEnd : false,
    reliability: { key: s.reliability, label: RELIABILITY_LABELS[s.reliability] },
    isDefault: s.isDefault,
    averages: { cycleLength: s.cycleLength, periodLength: s.periodLength, cyclesUsed: s.cyclesUsed, irregular: s.irregular, spread: s.regularity.spread, min: s.regularity.min, max: s.regularity.max },
    history: [...s.cycles].reverse().map((c) => ({ ...c })),
    aberrantPending: s.aberrantPending,
    predictions: s.projections.slice(1).map((c) => ({ start: c.start, end: c.periodEnd, ovulation: c.ovulation, fertileStart: c.fertileStart })),
    periods: [...ctx.periods].reverse(),
    calendar: withNotes(buildCalendar(month, ctx, appointments)),
    // 11 — semaine en cours (lundi → dimanche) pour la bande du haut de « Mon cycle ».
    week: withNotes(calendarDays(ctx, appointments, monday, addDays(monday, 6))),
    // Raccourcis : dernière mesure de poids réelle (sinon « Ajouter mon poids ») et note du jour.
    lastWeight: lastWeight ? { day: lastWeight.day, weight: lastWeight.weight } : null,
    journal: { day: ctx.today, notes: todayLog?.notes || '', mood: todayLog?.mood || null, symptoms: todayLog?.symptoms || [] },
    appointments: appointments.filter((a) => a.day >= ctx.today).slice(0, 10),
    alerts: s.alerts.map((a) => ({ key: a, text: HEALTH_ALERTS[a] })),
    // 4.7 · 6.1 — carte Ma phase : frise des 4 phases proportionnelle aux durées calculées.
    frieze: s.phaseBounds ? { bounds: s.phaseBounds, cycleLength: s.cycleLength, cycleDay: s.cycleDay } : null,
    // Conseil santé de la phase (RG-08 ter), déplacé de l'accueil vers l'onglet Cycle.
    healthTip: await tipOfTheDay(req.user.mode === 'grossesse' ? 'grossesse' : s.phase, ctx.today),
    hijriToday: toHijri(ctx.today, ctx.settings.hijriAdjustment || 0)?.label || null,
  });
});

// 11 — Vue « Année » du calendrier : les 12 mois (règles notées et prévues distinctes).
router.get('/year/:year', async (req, res) => {
  const year = Number(req.params.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw badRequest('Année invalide');
  const ctx = await loadCycleContext(req.user, { logsSince: `${year - 1}-12-01` });
  const appointments = await appointmentsFor(req.user, `${year}-01-01`, `${year}-12-31`);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  res.json({ year, today: ctx.today, months: months.map((m) => ({ month: m, days: buildCalendar(m, ctx, appointments).map(({ day, period, fertile, ovulation, today }) => ({ day, period, fertile, ovulation, today })) })) });
});

// RG-09 / RG-18 — « Mes règles ont commencé » (date du jour proposée, modifiable).
router.post('/periods/start', validate(z.object({ day: day.optional(), time: time.optional(), kind: z.enum(['hayd', 'nifas']).default('hayd'), level: z.enum(['leger', 'moyen', 'abondant']).default('moyen') })), async (req, res) => {
  const ctx = await loadCycleContext(req.user);
  const start = req.body.day || ctx.today;
  if (start > ctx.today) throw badRequest('La date ne peut pas être dans le futur');
  if (diffDays(ctx.today, start) > 60) throw badRequest('Choisis une date dans les 60 derniers jours (ou ajoute des règles passées depuis Mes règles)');
  const open = await Period.findOne({ user: req.user._id, end: { $exists: false }, kind: req.body.kind });
  if (open && open.start <= start) throw conflict('Des règles sont déjà en cours. Indique d’abord leur fin.', 'PERIOD_OPEN');

  const warnings = [];
  const previous = [...ctx.periods].reverse().find((p) => p.start < start && p.kind === 'hayd' && p.end);
  if (previous && diffDays(start, previous.end) - 1 < (ctx.settings.minPurityDays ?? 15)) {
    warnings.push({ key: 'purete_minimale', text: `Moins de ${ctx.settings.minPurityDays} jours depuis la fin de tes dernières règles : selon l’avis retenu par notre comité, ce saignement peut être de l’istihada. En cas de doute, rapproche-toi d’une personne de science.` });
  }
  const period = await Period.create({ user: req.user._id, start, startTime: req.body.time, kind: req.body.kind, flows: [{ day: start, level: req.body.level }] });
  if (isRamadan(start, ctx.settings.hijriAdjustment)) warnings.push({ key: 'ramadan', text: 'C’est Ramadan : tes jours de règles s’ajoutent automatiquement à ton compteur de jeûnes.' });
  res.status(201).json({ period: period.toPlain(), warnings });
});

// RG-11 / RG-16 / RG-19 — « Mes règles sont terminées », avec l'heure si elle le souhaite.
router.post('/periods/:id/end', validate(z.object({ day: day.optional(), time: time.optional(), endSign: z.enum(['secheresse', 'pertes_blanches']).optional() })), async (req, res) => {
  const period = await Period.findOne({ _id: req.params.id, user: req.user._id });
  if (!period) throw notFound('Règles introuvables');
  const ctx = await loadCycleContext(req.user);
  const end = req.body.day || ctx.today;
  if (end < period.start) throw badRequest('La fin ne peut pas précéder le début');
  if (end > ctx.today) throw badRequest('La date ne peut pas être dans le futur');
  period.end = end;
  period.endTime = req.body.time;
  if (req.body.endSign) period.endSign = req.body.endSign;
  period.after = { ghusl: false, prayersDone: [] };
  await period.save();
  // Au-delà de la durée maximale (7.2) : message istihada avant l'écran « Ghusl et prières ».
  const days = diffDays(end, period.start) + 1;
  const istihada = ctx.summary.maxPeriodDays && days > ctx.summary.maxPeriodDays ? ctx.settings.istihadaInfo : null;

  let prayers = null;
  if (req.body.time) {
    const { timings } = await userTimings(req.user, ctx.settings, end);
    prayers = prayersAfterPurification(req.body.time, timings, ctx.settings.purificationMarginMinutes);
  }
  // Notification « Ghusl » (5.12) — discrète sur l'écran verrouillé.
  await notify(req.user._id, {
    key: `ghusl-${period.id}`,
    type: 'ghusl',
    detail: 'Pense à ton ghusl : tes prières reprennent. Retrouve le guide des grandes ablutions dans le blog.',
    link: '/aujourdhui',
  });
  res.json({ period: period.toPlain(), prayers, ghuslSteps: GHUSL_STEPS, endSigns: ctx.settings.endSigns, days, istihada });
});

// 4.2 · 1.4 — Ghusl et prières : « J'ai fait mon ghusl », prières accomplies cochées une par une.
router.put(
  '/periods/:id/after',
  validate(z.object({ ghusl: z.boolean().optional(), prayersDone: z.array(z.enum(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'])).max(5).optional() })),
  async (req, res) => {
    const period = await Period.findOne({ _id: req.params.id, user: req.user._id });
    if (!period) throw notFound('Règles introuvables');
    if (req.body.ghusl !== undefined) period.set('after.ghusl', req.body.ghusl);
    if (req.body.prayersDone) period.set('after.prayersDone', [...new Set(req.body.prayersDone)]);
    await period.save();
    res.json({ period: period.toPlain() });
  },
);

router.patch(
  '/periods/:id',
  validate(z.object({ start: day.optional(), startTime: time.nullable().optional(), end: day.nullable().optional(), endTime: time.nullable().optional(), symptoms: z.array(z.string().max(40)).max(20).optional() })),
  async (req, res) => {
    const period = await Period.findOne({ _id: req.params.id, user: req.user._id });
    if (!period) throw notFound('Règles introuvables');
    for (const [k, v] of Object.entries(req.body)) period[k] = v === null ? undefined : v;
    if (period.end && period.end < period.start) throw badRequest('La fin ne peut pas précéder le début');
    await period.save();
    res.json({ period: period.toPlain() });
  },
);

router.delete('/periods/:id', async (req, res) => {
  const r = await Period.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!r.deletedCount) throw notFound('Règles introuvables');
  res.json({ ok: true });
});

// RG-13 — saisie des cycles passés.
router.post('/periods/past', validate(z.object({ periods: z.array(z.object({ start: day, end: day })).min(1).max(12) })), async (req, res) => {
  const created = [];
  for (const p of req.body.periods) {
    if (p.end < p.start) throw badRequest(`Dates incohérentes pour les règles du ${p.start}`);
    if (await Period.exists({ user: req.user._id, start: p.start })) continue;
    created.push((await Period.create({ user: req.user._id, start: p.start, end: p.end, source: 'historique' })).toPlain());
  }
  res.status(201).json({ created });
});

async function periodCovering(userId, d) {
  const [period] = await Period.find({ user: userId, start: { $lte: d } }).sort({ start: -1 }).limit(1);
  return period && (!period.end || period.end >= d) ? period : null;
}

// 04 / 05 — Flux du jour : un seul niveau par jour (léger, moyen, abondant), retrouvé à la réouverture.
// Rien n'est pré-sélectionné : `level` vaut null tant que l'utilisatrice n'a rien noté.
router.get('/flow/:day', async (req, res) => {
  if (!isDay(req.params.day)) throw badRequest('Date invalide');
  const [period, log] = await Promise.all([periodCovering(req.user._id, req.params.day), DailyLog.findOne({ user: req.user._id, day: req.params.day }).lean()]);
  const level = period?.flows.find((f) => f.day === req.params.day)?.level || null;
  res.json({ day: req.params.day, inPeriod: Boolean(period), level: level === 'traces' ? null : level, spotting: Boolean(log?.spotting) || level === 'traces', symptoms: log?.symptoms || [] });
});

// RG-10 — flux jour par jour. Les traces seules ne marquent pas le début d'un cycle.
router.put('/flow', validate(z.object({ day, level: z.enum(['traces', 'leger', 'moyen', 'abondant']), symptoms: z.array(z.string().max(40)).max(20).optional() })), async (req, res) => {
  const { day: d, level, symptoms } = req.body;
  if (d > nowFor(req.user).today) throw badRequest('Impossible de noter le flux d’un jour futur');
  if (symptoms) await DailyLog.updateOne({ user: req.user._id, day: d }, { $set: { symptoms } }, { upsert: true });
  const period = await periodCovering(req.user._id, d);
  if (!period) {
    if (level !== 'traces') throw badRequest('Pour un nouveau saignement, utilise « Mes règles ont commencé ».', 'NO_PERIOD');
    await DailyLog.updateOne({ user: req.user._id, day: d }, { $set: { spotting: true } }, { upsert: true });
    return res.json({ spotting: true });
  }
  period.flows = [...period.flows.filter((f) => f.day !== d), { day: d, level }];
  await period.save();
  res.json({ day: d, level, period: period.toPlain() });
});

// Traces / spotting : saisie distincte du flux (n'ouvre pas de règles).
router.put('/spotting', validate(z.object({ day, spotting: z.boolean() })), async (req, res) => {
  if (req.body.day > nowFor(req.user).today) throw badRequest('Impossible de noter un jour futur');
  await DailyLog.updateOne({ user: req.user._id, day: req.body.day }, { $set: { spotting: req.body.spotting } }, { upsert: true });
  res.json({ day: req.body.day, spotting: req.body.spotting });
});

// 6.2 — confirmation d'un cycle aberrant à écarter (ou à garder).
router.post('/cycles/:periodId/exclude', validate(z.object({ exclude: z.boolean() })), async (req, res) => {
  const period = await Period.findOneAndUpdate({ _id: req.params.periodId, user: req.user._id }, { $set: { cycleExcluded: req.body.exclude } }, { new: true });
  if (!period) throw notFound();
  res.json({ ok: true });
});

// 4.7 · 6.3 — Détail d'un jour (feuille ouverte en touchant une date) : jour du cycle, phase, date hégirienne,
// jeûne prévu ou fait, notes, règles et flux, symptômes notés, prévisions si le jour est futur.
router.get('/day/:day', async (req, res) => {
  const d = req.params.day;
  if (!isDay(d)) throw badRequest('Date invalide');
  const ctx = await loadCycleContext(req.user);
  const s = ctx.summary;
  const luteal = ctx.settings.lutealLength || 14;
  const adj = ctx.settings.hijriAdjustment || 0;
  const projected = s.projections.find((p) => d >= p.start && d < p.nextStart);
  const past = !projected && s.cycles.find((c) => d >= c.start && d < c.nextStart);
  const cycle = projected || (past ? { start: past.start, periodEnd: past.periodEnd || addDays(past.start, (past.periodLength || s.periodLength) - 1), ovulation: addDays(past.nextStart, -luteal) } : null);
  const phase = cycle ? phaseOf(d, cycle) : null;
  const period = ctx.periods.find((p) => d >= p.start && d <= (p.end || ctx.today));
  const [log, notes, madeUp, voluntary, fastCtx] = await Promise.all([
    DailyLog.findOne({ user: req.user._id, day: d }).lean(),
    upcomingNotes(req.user._id, d, { days: 0, limit: 20 }),
    MadeUpFast.exists({ user: req.user._id, day: d }),
    VoluntaryFast.findOne({ user: req.user._id, day: d }).lean(),
    d > ctx.today ? loadFastContext(req.user, ctx) : null,
  ]);
  const planned = fastCtx ? plannedFast(d, { fastCtx, user: req.user, adj, excl: ctx.settings.excludeDhulHijja13 !== false }) : null;
  const fast = madeUp ? { status: 'fait', label: 'Jeûne rattrapé' } : voluntary ? { status: 'fait', label: `Jeûne · ${VOLUNTARY_LABELS[voluntary.type] || 'volontaire'}` } : planned ? { status: 'prevu', label: planned.label } : null;
  const next = s.nextPeriod;
  const future = d > ctx.today;
  const ovulation = cycle ? cycle.ovulation : null;
  res.json({
    day: d,
    today: ctx.today,
    hijri: toHijri(d, adj)?.label || null,
    cycleDay: cycle ? diffDays(d, cycle.start) + 1 : null,
    phase: phase ? { key: phase, label: PHASES[phase].label } : null,
    period: period ? { id: period.id, kind: period.kind, day: diffDays(d, period.start) + 1, start: period.start, flow: (period.flows || []).find((f) => f.day === d)?.level || null } : null,
    log: log ? { mood: log.mood || null, symptoms: log.symptoms || [], energy: log.energy ?? null, sleepHours: log.sleepHours ?? null, weight: log.weight ?? null } : null,
    notes: notes.filter((n) => n.day === d).map((n) => ({ id: n.noteId, text: n.text, time: n.time, type: n.type, repeatLabel: n.repeatLabel, repeat: n.repeat })),
    fast,
    forecast: future
      ? {
          period: Boolean(projected && d >= projected.start && d <= projected.periodEnd) || Boolean(next && d >= (next.rangeStart || next.date) && d <= (next.rangeEnd || next.date)),
          fertile: Boolean(projected && d >= projected.fertileStart && d <= ovulation),
          ovulation: Boolean(ovulation && d === ovulation),
        }
      : null,
  });
});

export default router;

// Chargement du contexte d'une utilisatrice : cycle, jeûnes, Ramadan.
// Une seule saisie met tout à jour (3.2) : tout est recalculé à partir des règles enregistrées.

import { DailyLog, FastPlan, MadeUpFast, MissedFast, Period, Pregnancy, PriorMadeUp } from '../models/index.js';
import { addDays, diffDays, localParts, maxDay, minDay, safeTimeZone } from '../utils/dates.js';
import { cycleSummary, projectCycles } from './cycleCalc.js';
import { fastCounter, missedRamadanDays, planMakeupDays } from './fastCalc.js';
import { forbiddenFastReason, isRamadan, ramadanRange, toHijri } from './hijri.js';
import { userTimingsRange } from './prayerSource.js';
import { pregnancyStatus } from './pregnancyCalc.js';
import { getSettings } from './settings.js';

export function nowFor(user) {
  const tz = safeTimeZone(user.city?.timezone);
  const { day, time } = localParts(new Date(), tz);
  return { tz, today: day, time };
}

export async function loadCycleContext(user, { logsSince } = {}) {
  const settings = await getSettings();
  const { tz, today, time } = nowFor(user);
  const [periods, logs, pregnancy] = await Promise.all([
    Period.find({ user: user._id }).sort({ start: 1 }),
    DailyLog.find({ user: user._id, day: { $gte: logsSince || addDays(today, -70) } }).lean(),
    user.mode === 'grossesse' ? Pregnancy.findOne({ user: user._id, status: 'active' }).sort({ createdAt: -1 }) : null,
  ]);
  const plainPeriods = periods.map((p) => p.toPlain());
  const summary = cycleSummary({
    periods: plainPeriods,
    logs,
    declared: { cycleLength: user.onboarding?.cycleLength, periodLength: user.onboarding?.periodLength },
    settings,
    today,
    specialProfile: user.specialProfile && user.specialProfile !== 'aucun',
    sinceDelivery: user.mode === 'postpartum' ? user.deliveryDate : null,
    // « Absence de règles plus de 3 mois hors grossesse » : pas d'alerte enceinte, après l'accouchement ou en allaitement.
    pregnant: user.mode !== 'cycle' || ['post_partum', 'allaitement'].includes(user.specialProfile),
  });

  let pregnancyInfo = null;
  if (pregnancy) {
    pregnancyInfo = {
      id: pregnancy.id,
      ...pregnancyStatus(
        { lmp: pregnancy.lmp, conceptionDate: pregnancy.conceptionDate, dueDate: pregnancy.dueDate, cycleLength: pregnancy.cycleLength, termRule: settings.termRule },
        today,
      ),
    };
  }

  return { settings, tz, today, time, periods: plainPeriods, periodDocs: periods, logs, summary, pregnancy: pregnancyInfo };
}

/** Pause des prières (RG-15, RG-18) : règles confirmées ou nifas, hors istihada. */
export function prayerPause(ctx) {
  const s = ctx.summary;
  if (s.nifas && !s.nifas.exceeded) return { paused: true, reason: 'nifas' };
  if (s.inPeriod && !s.istihada) return { paused: true, reason: 'regles' };
  return { paused: false, reason: null };
}

/** Années de Ramadan touchées par les règles ou le nifas enregistrés. */
function ramadanYearsFor(periods, today, adjustment) {
  const years = new Set();
  for (const p of periods) {
    const from = toHijri(p.start, adjustment).year;
    const to = toHijri(minDay(p.end || today, today), adjustment).year;
    for (let y = from; y <= to; y += 1) years.add(y);
  }
  return [...years].sort();
}

export async function loadFastContext(user, cycleCtx) {
  const ctx = cycleCtx || (await loadCycleContext(user));
  const { settings, today, time, periods, summary } = ctx;
  const adj = settings.hijriAdjustment || 0;

  // RG-21 / RG-22 — jours de Ramadan manqués, calculés automatiquement.
  const autoMissed = [];
  for (const year of ramadanYearsFor(periods, today, adj)) {
    const range = ramadanRange(year, adj);
    if (range.start > today) continue;
    const until = minDay(range.end, today);
    const overlapping = periods.filter((p) => p.start <= until && (p.end || today) >= range.start);
    if (!overlapping.length) continue;
    const from = maxDay(range.start, overlapping.map((p) => p.start).reduce(minDay));
    const timings = await userTimingsRange(user, settings, from, until);
    const ramadanDays = timings.map((t) => ({ day: t.day, fajr: t.fajr, maghrib: t.maghrib, hijriYear: year, hijriDay: toHijri(t.day, adj).day }));
    autoMissed.push(...missedRamadanDays({ ramadanDays, periods: overlapping, now: { day: today, time } }));
  }

  const [manual, madeUp, plan, prior] = await Promise.all([
    MissedFast.find({ user: user._id }).sort({ hijriYear: 1, createdAt: 1 }).lean(),
    MadeUpFast.find({ user: user._id }).sort({ day: 1 }).lean(),
    FastPlan.findOne({ user: user._id }).lean(),
    PriorMadeUp.find({ user: user._id }).sort({ createdAt: 1 }).lean(),
  ]);
  const counter = fastCounter({ autoMissed, manual, madeUp, prior });

  // Règles prévues ou en cours (RG-24, RG-33) : aucun jour de jeûne programmé n'y est placé.
  const predicted = [];
  if (summary.hasData && !summary.noPrediction && user.mode === 'cycle') {
    const last = periods.filter((p) => p.kind !== 'nifas').pop();
    const cycles = projectCycles({ lastStart: last.start, cycleLength: summary.cycleLength, periodLength: summary.periodLength, count: 14 }).slice(1);
    for (const c of cycles) predicted.push([c.start, c.periodEnd]);
  }
  const ongoing = summary.inPeriod && !summary.istihada;
  const periodOn = (day) => {
    if (ongoing && day >= today && diffDays(day, today) < Math.max(1, summary.periodLength - summary.periodDay + 1)) return 'regles';
    if (predicted.some(([s, e]) => day >= s && day <= e)) return 'regles_prevues';
    return null;
  };

  // Plan de rattrapage (RG-24) : jamais sur des règles prévues, jours interdits ou Ramadan.
  let planDays = [];
  if (plan?.active && counter.remaining > 0) {
    const done = new Set(madeUp.map((m) => m.day));
    const from = madeUp.some((m) => m.day === today) || time >= '12:00' ? addDays(today, 1) : today;
    planDays = planMakeupDays({
      remaining: counter.remaining,
      perWeek: plan.perWeek,
      weekdays: plan.weekdays,
      from,
      alreadyDone: done,
      blockedReason: (day) => {
        if (ongoing && diffDays(day, today) < Math.max(1, summary.periodLength - summary.periodDay + 1)) return 'regles';
        if (predicted.some(([s, e]) => day >= s && day <= e)) return 'regles_prevues';
        if (isRamadan(day, adj)) return 'ramadan';
        return forbiddenFastReason(day, adj);
      },
    }).map((p) => ({
      ...p,
      nearPeriod: predicted.some(([s, e]) => diffDays(s, p.day) <= 4 && diffDays(p.day, e) <= 4),
    }));
  }

  return { ctx, autoMissed, manual, madeUp, prior, plan, counter, planDays, periodOn, predicted };
}

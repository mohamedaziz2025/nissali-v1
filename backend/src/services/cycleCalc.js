// Méthodes de calcul du cycle — cahier des charges, partie 6 (6.1 à 6.6).
// Fonctions pures : aucune dépendance à la base, testées dans tests/cycleCalc.test.js.

import { addDays, diffDays } from '../utils/dates.js';

export const DEFAULTS = { cycleLength: 28, periodLength: 5, lutealLength: 14 };
export const ABERRANT = { min: 15, max: 60 };
const HISTORY_SIZE = 6;
const IRREGULAR_SPREAD = 7;

const byStart = (a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);

/** Moyenne pondérée : le plus ancien pèse 1, le suivant 2 … le plus récent n. */
export function weightedAverage(values) {
  if (!values.length) return null;
  const n = values.length;
  const total = values.reduce((acc, v, i) => acc + v * (i + 1), 0);
  return total / ((n * (n + 1)) / 2);
}

/** Durée des règles : jours de saignement depuis J1, sans les traces finales. */
export function periodDuration(period) {
  if (!period.end) return null;
  const levels = new Map((period.flows || []).map((f) => [f.day, f.level]));
  let last = period.end;
  while (last > period.start && levels.get(last) === 'traces') last = addDays(last, -1);
  return diffDays(last, period.start) + 1;
}

/**
 * Cycles complets entre deux J1 consécutifs (règles « hayd » uniquement).
 * Un cycle qui contient un nifas (accouchement) n'est pas un cycle.
 */
export function buildCycles(periods) {
  const all = [...periods].sort(byStart);
  const cycles = [];
  let prev = null;
  let nifasBetween = false;
  for (const p of all) {
    if (p.kind === 'nifas') {
      nifasBetween = true;
      continue;
    }
    if (prev && !nifasBetween) {
      const length = diffDays(p.start, prev.start);
      cycles.push({
        start: prev.start,
        end: addDays(p.start, -1),
        nextStart: p.start,
        length,
        periodId: prev.id,
        periodLength: periodDuration(prev),
        aberrant: length < ABERRANT.min || length > ABERRANT.max,
        excluded: Boolean(prev.cycleExcluded),
      });
    }
    prev = p;
    nifasBetween = false;
  }
  return cycles;
}

export function haydPeriods(periods) {
  return periods.filter((p) => p.kind !== 'nifas').sort(byStart);
}

/** 6.2 — durée moyenne du cycle et des règles. */
export function computeAverages(cycles, periods, declared = {}) {
  const usable = cycles.filter((c) => !c.excluded).slice(-HISTORY_SIZE);
  const durations = haydPeriods(periods)
    .map(periodDuration)
    .filter((d) => d != null)
    .slice(-HISTORY_SIZE);

  const declaredCycle = declared.cycleLength || null;
  const declaredPeriod = declared.periodLength || null;

  return {
    cycleLength: usable.length ? Math.round(weightedAverage(usable.map((c) => c.length))) : declaredCycle || DEFAULTS.cycleLength,
    periodLength: durations.length ? Math.round(weightedAverage(durations)) : declaredPeriod || DEFAULTS.periodLength,
    cyclesUsed: usable.length,
    periodsUsed: durations.length,
    usedCycles: usable,
    isDefault: !usable.length && !declaredCycle,
  };
}

/** 6.6 — régularité : écart entre le plus court et le plus long des 6 derniers cycles. */
export function regularity(usedCycles) {
  if (usedCycles.length < 2) return { min: null, max: null, spread: null, irregular: false };
  const lengths = usedCycles.map((c) => c.length);
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  return { min, max, spread: max - min, irregular: max - min > IRREGULAR_SPREAD };
}

const LEVELS = ['faible', 'moyen', 'eleve'];

/** 6.3 — indice de fiabilité. */
export function reliability(cyclesUsed, irregular, specialProfile = false) {
  let level;
  if (irregular || cyclesUsed < 3) level = 0;
  else if (cyclesUsed >= HISTORY_SIZE) level = 2;
  else level = 1;
  if (specialProfile) level = Math.max(0, level - 1);
  return LEVELS[level];
}

/**
 * 6.3 et 6.4 — projette le cycle en cours et les suivants.
 * L'ovulation est calculée à partir des prochaines règles : prochaines règles − phase lutéale.
 */
export function projectCycles({ lastStart, lastPeriodEnd, cycleLength, periodLength, lutealLength = DEFAULTS.lutealLength, count = 4 }) {
  const cycles = [];
  for (let i = 0; i <= count; i += 1) {
    const start = addDays(lastStart, cycleLength * i);
    const nextStart = addDays(lastStart, cycleLength * (i + 1));
    const ovulation = addDays(nextStart, -lutealLength);
    cycles.push({
      index: i,
      start,
      periodEnd: i === 0 && lastPeriodEnd ? lastPeriodEnd : addDays(start, periodLength - 1),
      predictedPeriod: i > 0,
      ovulation,
      fertileStart: addDays(ovulation, -5),
      fertileEnd: ovulation,
      nextStart,
    });
  }
  return cycles;
}

/**
 * 6.4 — les données saisies remplacent l'estimation.
 * Température : hausse d'au moins 0,2 °C pendant 3 jours consécutifs → ovulation la veille de la hausse.
 * Test positif : ovulation dans les 24 à 36 h → lendemain du test.
 */
export function detectOvulation(logs, cycleStart) {
  const inCycle = logs.filter((l) => l.day >= cycleStart).sort((a, b) => (a.day < b.day ? -1 : 1));
  const temps = inCycle.filter((l) => typeof l.temperature === 'number');

  for (let i = 3; i + 2 < temps.length; i += 1) {
    const consecutive = diffDays(temps[i + 1].day, temps[i].day) === 1 && diffDays(temps[i + 2].day, temps[i + 1].day) === 1;
    if (!consecutive) continue;
    const baseline = Math.max(...temps.slice(Math.max(0, i - 6), i).map((t) => t.temperature));
    if ([0, 1, 2].every((k) => temps[i + k].temperature >= baseline + 0.2)) {
      return { day: addDays(temps[i].day, -1), method: 'temperature', confirmed: true };
    }
  }

  const positive = inCycle.find((l) => l.ovulationTest === 'positif');
  if (positive) return { day: addDays(positive.day, 1), method: 'test', confirmed: false };
  return null;
}

/** 6.5 — phase du cycle pour un jour donné. */
export function phaseOf(day, cycle) {
  if (day >= cycle.start && day <= cycle.periodEnd) return 'menstruelle';
  const ovulatoryStart = addDays(cycle.ovulation, -2);
  const ovulatoryEnd = addDays(cycle.ovulation, 1);
  if (day >= ovulatoryStart && day <= ovulatoryEnd) return 'ovulatoire';
  if (day < ovulatoryStart) return 'folliculaire';
  return 'luteale';
}

/** Bornes de chaque phase (en jours du cycle, J1 = 1). */
export function phaseBounds(cycle) {
  const j = (d) => diffDays(d, cycle.start) + 1;
  const ovStart = j(addDays(cycle.ovulation, -2));
  const ovEnd = j(addDays(cycle.ovulation, 1));
  const periodEnd = j(cycle.periodEnd);
  const last = j(addDays(cycle.nextStart, -1));
  // Cycle très court : l'ovulation peut tomber pendant les règles, la phase folliculaire disparaît.
  const ovFrom = Math.max(ovStart, periodEnd + 1);
  return {
    menstruelle: [1, periodEnd],
    folliculaire: ovStart - 1 >= periodEnd + 1 ? [periodEnd + 1, ovStart - 1] : null,
    ovulatoire: ovFrom <= ovEnd ? [ovFrom, ovEnd] : null,
    luteale: [Math.max(ovEnd, periodEnd) + 1, last],
  };
}

/** 6.6 — messages de santé, sans diagnostic. */
export function healthAlerts({ cycles, periods, today, lastStart, pregnant = false }) {
  const alerts = [];
  const recent = cycles.filter((c) => !c.excluded).slice(-3);
  if (recent.filter((c) => c.length < 21).length >= 2) alerts.push('cycles_courts');
  if (recent.filter((c) => c.length > 45).length >= 2) alerts.push('cycles_longs');
  if (!pregnant && lastStart && diffDays(today, lastStart) > 90) alerts.push('amenorrhee');

  const recentPeriods = haydPeriods(periods).slice(-3);
  const tooLong = recentPeriods.some((p) => {
    const d = p.end ? periodDuration(p) : diffDays(today, p.start) + 1;
    return d > 8;
  });
  if (tooLong) alerts.push('regles_longues');

  const last = recentPeriods[recentPeriods.length - 1];
  if (last && (last.flows || []).filter((f) => f.level === 'abondant').length >= 3) alerts.push('saignements_abondants');
  return alerts;
}

/**
 * Synthèse du cycle à une date donnée : règles en cours, prochaines règles, phase,
 * fiabilité, retard, questions à poser (RG-12, retard J+7), alertes santé.
 */
export function cycleSummary({ periods = [], logs = [], declared = {}, settings = {}, today, specialProfile = false, sinceDelivery = null, pregnant = false }) {
  const lutealLength = settings.lutealLength || DEFAULTS.lutealLength;
  const hayd = haydPeriods(periods);
  const cycles = buildCycles(periods);
  const averages = computeAverages(cycles, periods, declared);
  const reg = regularity(averages.usedCycles);
  const last = hayd[hayd.length - 1] || null;

  const summary = {
    hasData: Boolean(last),
    cycleLength: averages.cycleLength,
    periodLength: averages.periodLength,
    cyclesUsed: averages.cyclesUsed,
    isDefault: averages.isDefault,
    irregular: reg.irregular,
    regularity: reg,
    reliability: reliability(averages.cyclesUsed, reg.irregular, specialProfile),
    cycles,
    aberrantPending: cycles.filter((c) => c.aberrant && !c.excluded),
    inPeriod: false,
    currentPeriod: null,
    periodDay: null,
    istihada: false,
    maxPeriodDays: null,
    askPeriodEnded: false,
    cycleDay: null,
    nextPeriod: null,
    daysUntilNext: null,
    lateDays: 0,
    askPregnancy: false,
    phase: null,
    projections: [],
    ovulation: null,
    noPrediction: false,
    alerts: [],
  };

  // Nifas en cours (post-partum)
  const nifas = periods.filter((p) => p.kind === 'nifas').sort(byStart).pop();
  // Une fin saisie (même aujourd'hui) termine la période : la pause s'arrête dès la purification.
  if (nifas && nifas.start <= today && (!nifas.end || nifas.end > today)) {
    const day = diffDays(today, nifas.start) + 1;
    const max = settings.maxNifasDays || 60;
    summary.nifas = { ...nifas, day, max, exceeded: day > max };
  }

  if (!last) return summary;

  // Règles en cours
  const ongoing = last.start <= today && (!last.end || last.end > today);
  if (ongoing) {
    const periodDay = diffDays(today, last.start) + 1;
    const maxFirst = settings.maxPeriodDaysFirst || 15;
    const habitPlus = settings.habitPlusDays ?? 3;
    const hasHabit = averages.periodsUsed > 0;
    const maxDays = hasHabit ? Math.min(averages.periodLength + habitPlus, maxFirst) : maxFirst;
    summary.inPeriod = true;
    summary.currentPeriod = last;
    summary.periodDay = periodDay;
    summary.maxPeriodDays = maxDays;
    summary.istihada = periodDay > maxDays;
    summary.askPeriodEnded = !last.end && periodDay > averages.periodLength;
  }

  // Après un accouchement : pas de prédiction avant 2 cycles enregistrés (6.7).
  if (sinceDelivery) {
    const after = hayd.filter((p) => p.start >= sinceDelivery);
    if (after.length < 3) {
      summary.noPrediction = true;
      summary.cycleDay = diffDays(today, last.start) + 1;
      return summary;
    }
  }

  const projections = projectCycles({
    lastStart: last.start,
    lastPeriodEnd: last.end || (ongoing ? addDays(today, 0) : null),
    cycleLength: averages.cycleLength,
    periodLength: averages.periodLength,
    lutealLength,
    count: 4,
  });

  if (ongoing && !last.end) {
    // Règles en cours sans fin saisie : la fin prévue reste la durée habituelle.
    projections[0].periodEnd = addDays(last.start, Math.max(averages.periodLength, diffDays(today, last.start) + 1) - 1);
  }

  const detected = detectOvulation(logs, last.start);
  if (detected && detected.day < projections[0].nextStart) {
    const c = projections[0];
    c.ovulation = detected.day;
    c.fertileStart = addDays(detected.day, -5);
    c.fertileEnd = detected.day;
    c.ovulationSource = detected.method;
  }

  const current = projections[0];
  const next = projections[1];
  summary.projections = projections;
  summary.cycleDay = diffDays(today, last.start) + 1;
  summary.ovulation = { day: current.ovulation, fertileStart: current.fertileStart, fertileEnd: current.fertileEnd, source: current.ovulationSource || 'estimation' };

  const nextPeriod = { date: next.start };
  if (reg.irregular || specialProfile) {
    const lo = reg.min ?? averages.cycleLength - 3;
    const hi = reg.max ?? averages.cycleLength + 3;
    nextPeriod.rangeStart = addDays(last.start, Math.min(lo, averages.cycleLength - (specialProfile ? 3 : 0)));
    nextPeriod.rangeEnd = addDays(last.start, Math.max(hi, averages.cycleLength + (specialProfile ? 3 : 0)));
  }
  summary.nextPeriod = nextPeriod;
  summary.daysUntilNext = diffDays(next.start, today);

  if (!ongoing && today >= next.start) {
    summary.lateDays = diffDays(today, next.start);
    summary.askPregnancy = summary.lateDays >= 7;
  }

  summary.phase = ongoing ? 'menstruelle' : summary.lateDays > 0 ? 'luteale' : phaseOf(today, current);
  summary.phaseBounds = phaseBounds(current);
  summary.alerts = healthAlerts({ cycles, periods, today, lastStart: last.start, pregnant });
  return summary;
}

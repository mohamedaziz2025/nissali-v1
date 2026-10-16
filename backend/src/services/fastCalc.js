// 6.11 — Jeûnes à rattraper (RG-21 à RG-24). Fonctions pures.

import { addDays, moment, weekday } from '../utils/dates.js';

/**
 * RG-21 / RG-22 — un jour de Ramadan est manqué si l'utilisatrice est en règles
 * ou en nifas à un moment quelconque entre Fajr et Maghrib.
 * Heure de début inconnue → 00:00 ; heure de fin inconnue → 23:59 (le jour est compté).
 *
 * ramadanDays : [{ day, fajr: 'HH:mm', maghrib: 'HH:mm', hijriYear, hijriDay }]
 * periods     : [{ start, startTime, end, endTime, kind }]
 * now         : { day, time } — pour une période encore en cours.
 */
export function missedRamadanDays({ ramadanDays, periods, now }) {
  const nowMoment = moment(now.day, now.time);
  const intervals = periods.map((p) => ({
    from: moment(p.start, p.startTime || '00:00'),
    to: p.end ? moment(p.end, p.endTime || '23:59') : nowMoment,
    kind: p.kind || 'hayd',
  }));

  const missed = [];
  for (const rd of ramadanDays) {
    const windowStart = moment(rd.day, rd.fajr);
    const windowEnd = moment(rd.day, rd.maghrib);
    if (windowStart > nowMoment) continue; // jour pas encore commencé
    const hit = intervals.find((i) => i.from < windowEnd && i.to > windowStart);
    if (hit) missed.push({ day: rd.day, hijriYear: rd.hijriYear, hijriDay: rd.hijriDay, reason: hit.kind === 'nifas' ? 'nifas' : 'regles' });
  }
  return missed;
}

/**
 * RG-23 — compteur = jours manqués automatiques + jours ajoutés − jours rattrapés.
 * Le détail est conservé par année hégirienne ; les rattrapages soldent d'abord les plus anciennes.
 */
export function fastCounter({ autoMissed = [], manual = [], madeUp = [] }) {
  const years = new Map();
  const bucket = (y) => {
    if (!years.has(y)) years.set(y, { hijriYear: y, auto: 0, manual: 0, missed: 0, madeUp: 0, remaining: 0 });
    return years.get(y);
  };
  for (const m of autoMissed) {
    const b = bucket(m.hijriYear);
    b.auto += 1;
    b.missed += 1;
  }
  for (const m of manual) {
    const b = bucket(m.hijriYear);
    b.manual += m.count || 1;
    b.missed += m.count || 1;
  }
  const ordered = [...years.values()].sort((a, b) => a.hijriYear - b.hijriYear);
  let toAllocate = madeUp.length;
  for (const y of ordered) {
    const used = Math.min(y.missed, toAllocate);
    y.madeUp = used;
    y.remaining = y.missed - used;
    toAllocate -= used;
  }
  const missed = ordered.reduce((a, y) => a + y.missed, 0);
  return {
    missed,
    madeUp: madeUp.length,
    remaining: Math.max(0, missed - madeUp.length),
    extraMadeUp: toAllocate,
    byYear: ordered,
  };
}

export const DEFAULT_WEEKDAYS = { 1: [1], 2: [1, 4], 3: [1, 3, 4], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };

const isoWeekKey = (day) => {
  // Lundi de la semaine du jour
  const wd = weekday(day);
  return addDays(day, wd === 0 ? -6 : 1 - wd);
};

/**
 * Plan de rattrapage (RG-24) : place les jours selon le rythme choisi, en évitant
 * les règles prévues, les jours interdits et le Ramadan.
 * blockedReason(day) → texte si le jour est exclu, null sinon.
 */
export function planMakeupDays({ remaining, perWeek, weekdays, from, blockedReason, horizonDays = 365, alreadyDone = new Set() }) {
  const preferred = (weekdays && weekdays.length ? weekdays : DEFAULT_WEEKDAYS[perWeek] || [1, 4]).slice().sort();
  const plan = [];
  const usedPerWeek = new Map();
  const skipped = [];

  for (let i = 0; i < horizonDays && plan.length < remaining; i += 1) {
    const day = addDays(from, i);
    if (alreadyDone.has(day)) continue;
    const week = isoWeekKey(day);
    const used = usedPerWeek.get(week) || 0;
    if (used >= perWeek) continue;

    const wd = weekday(day);
    const isPreferred = preferred.includes(wd);
    // Un jour non préféré n'est utilisé que pour compenser un jour préféré exclu cette semaine.
    const pendingCompensation = skipped.filter((s) => s.week === week).length;
    if (!isPreferred && pendingCompensation === 0) continue;

    const reason = blockedReason(day);
    if (reason) {
      if (isPreferred) skipped.push({ week, day, reason });
      continue;
    }
    if (!isPreferred) skipped.splice(skipped.findIndex((s) => s.week === week), 1);
    plan.push({ day, weekday: wd, compensation: !isPreferred });
    usedPerWeek.set(week, used + 1);
  }
  return plan;
}

/**
 * RG-24 ter — Conseil de rythme : écart = jours restants ÷ jours à rattraper (arrondi à l'inférieur).
 * < 7 → « X jours par semaine » (X = 7 ÷ écart, arrondi au supérieur) ; 7–13 → 1 par semaine ;
 * 14–29 → 1 toutes les 2 semaines ; ≥ 30 → 1 par mois. Moins de jours que de jeûnes → alerte douce.
 */
export function rhythmAdvice(daysLeft, remaining) {
  if (!remaining || remaining <= 0) return null;
  if (daysLeft < remaining) {
    return { gap: 0, phrase: null, alert: true, label: 'Il reste moins de jours que de jeûnes à rattraper avant le prochain Ramadan. Avance à ton rythme, chaque jour compte.' };
  }
  const gap = Math.floor(daysLeft / remaining);
  let phrase;
  if (gap < 7) {
    const x = Math.ceil(7 / gap);
    phrase = `${x} jour${x > 1 ? 's' : ''} par semaine`;
  } else if (gap <= 13) phrase = '1 jour par semaine';
  else if (gap <= 29) phrase = '1 jour toutes les 2 semaines';
  else phrase = '1 jour par mois';
  return { gap, phrase, alert: false, label: `${phrase[0].toUpperCase()}${phrase.slice(1)} suffit pour finir à temps.` };
}

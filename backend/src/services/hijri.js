// 6.10 — Calendrier hégirien (Umm al-Qura, calcul local via ICU) avec
// ajustement administrable de ± 1 jour depuis le back-office.

import { addDays, diffDays, parseDay, formatDay } from '../utils/dates.js';

const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export const HIJRI_MONTHS = [
  'Mouharram',
  'Safar',
  'Rabi al-awwal',
  'Rabi ath-thani',
  'Joumada al-oula',
  'Joumada ath-thania',
  'Rajab',
  'Chaabane',
  'Ramadan',
  'Chawwal',
  "Dhou al-qi'da",
  'Dhou al-hijja',
];

const cache = new Map();

/** Date hégirienne d'un jour grégorien. adjustment = +1 avance le calendrier d'un jour. */
export function toHijri(day, adjustment = 0) {
  const key = `${day}|${adjustment}`;
  if (cache.has(key)) return cache.get(key);
  const date = parseDay(addDays(day, adjustment));
  date.setUTCHours(12);
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  const result = {
    year: Number(String(parts.year).replace(/\D/g, '')),
    month: Number(parts.month),
    day: Number(parts.day),
  };
  result.monthName = HIJRI_MONTHS[result.month - 1];
  result.label = `${result.day} ${result.monthName} ${result.year}`;
  if (cache.size > 20000) cache.clear();
  cache.set(key, result);
  return result;
}

const EPOCH = '0622-07-19';

/** Jour grégorien correspondant à une date hégirienne. */
export function fromHijri(year, month, day, adjustment = 0) {
  const approx = Math.round((year - 1) * 354.36707 + (month - 1) * 29.530589 + (day - 1));
  const guess = formatDay(new Date(parseDay(EPOCH).getTime() + approx * 86_400_000));
  for (let delta = 0; delta <= 6; delta += 1) {
    for (const d of delta === 0 ? [0] : [delta, -delta]) {
      const candidate = addDays(guess, d);
      const h = toHijri(candidate, adjustment);
      if (h.year === year && h.month === month && h.day === day) return candidate;
    }
  }
  // Le jour 30 n'existe pas toujours : on renvoie null dans ce cas.
  return null;
}

export function monthRange(year, month, adjustment = 0) {
  const start = fromHijri(year, month, 1, adjustment);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = addDays(fromHijri(nextYear, nextMonth, 1, adjustment), -1);
  return { start, end, length: diffDays(end, start) + 1 };
}

export function ramadanRange(hijriYear, adjustment = 0) {
  return { hijriYear, ...monthRange(hijriYear, 9, adjustment) };
}

export function isRamadan(day, adjustment = 0) {
  return toHijri(day, adjustment).month === 9;
}

/** RG-24 — jours où le jeûne est interdit : les deux Aïd et les jours de Tachriq. */
export function forbiddenFastReason(day, adjustment = 0) {
  const h = toHijri(day, adjustment);
  if (h.month === 10 && h.day === 1) return 'Aïd al-Fitr';
  if (h.month === 12 && h.day === 10) return 'Aïd al-Adha';
  if (h.month === 12 && h.day >= 11 && h.day <= 13) return 'Jour de Tachriq';
  return null;
}

/** Ramadan en cours ou à venir, avec compte à rebours. */
export function ramadanInfo(today, adjustment = 0) {
  const h = toHijri(today, adjustment);
  if (h.month === 9) {
    const range = ramadanRange(h.year, adjustment);
    return { current: true, hijriYear: h.year, day: h.day, ...range, daysLeft: diffDays(range.end, today) };
  }
  const year = h.month < 9 ? h.year : h.year + 1;
  const range = ramadanRange(year, adjustment);
  const daysUntil = diffDays(range.start, today);
  return { current: false, hijriYear: year, ...range, daysUntil, monthsUntil: Math.round(daysUntil / 30.4) };
}

/** Jours blancs : 13, 14 et 15 de chaque mois hégirien (sans le 13 Dhou al-hijja si demandé). */
export function whiteDays(today, adjustment = 0, excludeDhulHijja13 = true) {
  const h = toHijri(today, adjustment);
  const build = (year, month) =>
    [13, 14, 15]
      .filter((d) => !(excludeDhulHijja13 && month === 12 && d === 13))
      .map((d) => ({ hijriDay: d, day: fromHijri(year, month, d, adjustment) }))
      .filter((x) => x.day);

  let days = build(h.year, h.month);
  if (!days.length || days[days.length - 1].day < today) {
    const year = h.month === 12 ? h.year + 1 : h.year;
    const month = h.month === 12 ? 1 : h.month + 1;
    days = build(year, month);
  }
  const first = days[0].day;
  return {
    inProgress: first <= today,
    daysUntil: Math.max(0, diffDays(first, today)),
    days,
    monthName: toHijri(first, adjustment).monthName,
  };
}

/** Prochaine occurrence d'une date hégirienne (mois, jour) à partir d'aujourd'hui. */
export function nextHijriDate(today, month, day, adjustment = 0) {
  const h = toHijri(today, adjustment);
  let candidate = fromHijri(h.year, month, day, adjustment);
  if (!candidate || candidate < today) candidate = fromHijri(h.year + 1, month, day, adjustment);
  return candidate;
}

/** Jeûnes surérogatoires à venir : lundis, jeudis, jours blancs, Arafat, Achoura. */
export function supererogatoryFasts(today, adjustment = 0) {
  const nextWeekday = (target) => {
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(today, i);
      if (parseDay(d).getUTCDay() === target) return d;
    }
    return today;
  };
  const white = whiteDays(today, adjustment);
  const items = [
    { key: 'lundi', label: 'Lundi', day: nextWeekday(1), note: 'Jeûne sunna de chaque semaine' },
    { key: 'jeudi', label: 'Jeudi', day: nextWeekday(4), note: 'Jeûne sunna de chaque semaine' },
    { key: 'jours_blancs', label: 'Jours blancs', day: white.days[0].day, note: `Les 13, 14 et 15 ${white.monthName}` },
    { key: 'arafat', label: 'Jour de Arafat', day: nextHijriDate(today, 12, 9, adjustment), note: '9 Dhou al-hijja' },
    { key: 'tasua', label: "Tasu'a", day: nextHijriDate(today, 1, 9, adjustment), note: '9 Mouharram' },
    { key: 'achoura', label: 'Achoura', day: nextHijriDate(today, 1, 10, adjustment), note: '10 Mouharram' },
  ];
  return items.map((i) => ({ ...i, daysUntil: diffDays(i.day, today) })).sort((a, b) => a.daysUntil - b.daysUntil);
}

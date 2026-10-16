// 6.8 et 6.9 — Horaires de prière, qibla, prières à accomplir après la purification.
// Source principale : API gratuite Aladhan (api.aladhan.com), sans clé.
// Repli hors connexion : bibliothèque open source « adhan » calculée localement.

import { CalculationMethod, CalculationParameters, Coordinates, HighLatitudeRule, Madhab, PrayerTimes, Qibla } from 'adhan';
import { env } from '../config/env.js';
import { localParts, timeToMinutes, zonedToDate, eachDay } from '../utils/dates.js';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PRAYER_LABELS = { fajr: 'Fajr', sunrise: 'Chourouk', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

// Méthodes proposées au comité (angles Fajr / Isha).
export const METHODS = {
  MWL: { label: 'Ligue islamique mondiale (18° / 17°)', aladhan: 3, local: () => CalculationMethod.MuslimWorldLeague() },
  UOIF: { label: 'Musulmans de France (12° / 12°)', aladhan: 12, local: () => withAngles(12, 12) },
  ISNA: { label: 'ISNA (15° / 15°)', aladhan: 2, local: () => CalculationMethod.NorthAmerica() },
  EGYPT: { label: 'Autorité égyptienne (19,5° / 17,5°)', aladhan: 5, local: () => CalculationMethod.Egyptian() },
  MAKKAH: { label: 'Umm al-Qura, La Mecque (18,5° / 90 min)', aladhan: 4, local: () => CalculationMethod.UmmAlQura() },
};

export const HIGH_LATITUDE_RULES = {
  SEVENTH: { label: 'Septième de la nuit', aladhan: 2, local: HighLatitudeRule.SeventhOfTheNight },
  MIDDLE: { label: 'Milieu de la nuit', aladhan: 1, local: HighLatitudeRule.MiddleOfTheNight },
  ANGLE: { label: 'Basée sur l’angle', aladhan: 3, local: HighLatitudeRule.TwilightAngle },
};

function withAngles(fajr, isha) {
  return new CalculationParameters('Other', fajr, isha);
}

const timingsCache = new Map();
const qiblaCache = new Map();
let aladhanDownUntil = 0;

const round = (n) => Number(n).toFixed(3);
const tuneString = (adj = {}) => [0, adj.fajr || 0, 0, adj.dhuhr || 0, adj.asr || 0, adj.maghrib || 0, 0, adj.isha || 0, 0].join(',');

function cacheKey({ lat, lng, tz, method, highLatitude, adjustments }, day) {
  return `${round(lat)},${round(lng)}|${tz}|${method}|${highLatitude}|${tuneString(adjustments)}|${day}`;
}

function remember(key, value) {
  if (timingsCache.size > 50_000) timingsCache.clear();
  timingsCache.set(key, value);
}

const clean = (t) => String(t).slice(0, 5);

function fromAladhan(day, timings) {
  return {
    day,
    fajr: clean(timings.Fajr),
    sunrise: clean(timings.Sunrise),
    dhuhr: clean(timings.Dhuhr),
    asr: clean(timings.Asr),
    maghrib: clean(timings.Maghrib),
    isha: clean(timings.Isha),
    source: 'aladhan',
  };
}

async function aladhanFetch(path, params) {
  if (Date.now() < aladhanDownUntil) throw new Error('Aladhan indisponible (pause)');
  const url = `${env.aladhanBase}${path}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Aladhan HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== 200) throw new Error(`Aladhan ${json.status}`);
    return json.data;
  } catch (err) {
    aladhanDownUntil = Date.now() + 5 * 60_000;
    throw err;
  }
}

function aladhanParams(opts) {
  return {
    latitude: opts.lat,
    longitude: opts.lng,
    method: METHODS[opts.method]?.aladhan ?? 3,
    school: 0, // Asr : méthode majoritaire (ombre = hauteur)
    latitudeAdjustmentMethod: HIGH_LATITUDE_RULES[opts.highLatitude]?.aladhan ?? 2,
    timezonestring: opts.tz,
    tune: tuneString(opts.adjustments),
  };
}

/** Calcul local avec la bibliothèque adhan (repli hors connexion). */
export function localTimings(opts, day) {
  const params = (METHODS[opts.method] || METHODS.MWL).local();
  params.madhab = Madhab.Shafi;
  params.highLatitudeRule = (HIGH_LATITUDE_RULES[opts.highLatitude] || HIGH_LATITUDE_RULES.SEVENTH).local;
  const adj = opts.adjustments || {};
  params.adjustments = { fajr: adj.fajr || 0, sunrise: 0, dhuhr: adj.dhuhr || 0, asr: adj.asr || 0, maghrib: adj.maghrib || 0, isha: adj.isha || 0 };
  const [y, m, d] = day.split('-').map(Number);
  const pt = new PrayerTimes(new Coordinates(opts.lat, opts.lng), new Date(y, m - 1, d), params);
  const fmt = (date) => localParts(date, opts.tz).time;
  return {
    day,
    fajr: fmt(pt.fajr),
    sunrise: fmt(pt.sunrise),
    dhuhr: fmt(pt.dhuhr),
    asr: fmt(pt.asr),
    maghrib: fmt(pt.maghrib),
    isha: fmt(pt.isha),
    source: 'local',
  };
}

/** Horaires d'un jour. opts = { lat, lng, tz, method, highLatitude, adjustments } */
export async function getTimings(opts, day) {
  const key = cacheKey(opts, day);
  if (timingsCache.has(key)) return timingsCache.get(key);
  let result;
  try {
    const [y, m, d] = day.split('-');
    const data = await aladhanFetch(`/timings/${d}-${m}-${y}`, aladhanParams(opts));
    result = fromAladhan(day, data.timings);
  } catch {
    result = localTimings(opts, day);
  }
  remember(key, result);
  return result;
}

/** Horaires sur une plage de jours (un appel Aladhan par mois). */
export async function getTimingsRange(opts, from, to) {
  const days = eachDay(from, to);
  const missingMonths = new Set(days.filter((d) => !timingsCache.has(cacheKey(opts, d))).map((d) => d.slice(0, 7)));
  for (const month of missingMonths) {
    const [y, m] = month.split('-');
    try {
      const data = await aladhanFetch(`/calendar/${y}/${Number(m)}`, aladhanParams(opts));
      for (const entry of data) {
        const [dd, mm, yyyy] = entry.date.gregorian.date.split('-');
        const day = `${yyyy}-${mm}-${dd}`;
        remember(cacheKey(opts, day), fromAladhan(day, entry.timings));
      }
    } catch {
      // repli local jour par jour ci-dessous
    }
  }
  return days.map((day) => {
    const key = cacheKey(opts, day);
    if (!timingsCache.has(key)) remember(key, localTimings(opts, day));
    return timingsCache.get(key);
  });
}

/** Ajoute les instants ISO de chaque prière (pour les comptes à rebours côté client). */
export function withInstants(timings, tz) {
  const instants = {};
  for (const p of [...PRAYERS, 'sunrise']) instants[p] = zonedToDate(timings.day, timings[p], tz).toISOString();
  return { ...timings, instants };
}

/** Prochaine prière à partir d'une heure locale. */
export function nextPrayer(timings, time) {
  const now = timeToMinutes(time);
  const found = PRAYERS.find((p) => timeToMinutes(timings[p]) > now);
  return found ? { key: found, label: PRAYER_LABELS[found], time: timings[found], tomorrow: false } : { key: 'fajr', label: 'Fajr', time: null, tomorrow: true };
}

/** Prière dont c'est actuellement l'heure. */
export function currentPrayer(timings, time) {
  const now = timeToMinutes(time);
  let current = null;
  for (const p of PRAYERS) if (timeToMinutes(timings[p]) <= now) current = p;
  return current;
}

// --- Qibla --------------------------------------------------------------

export const KAABA = { lat: 21.4225, lng: 39.8262 };

export function localQibla(lat, lng) {
  return Qibla(new Coordinates(lat, lng));
}

export async function getQibla(lat, lng) {
  const key = `${round(lat)},${round(lng)}`;
  if (qiblaCache.has(key)) return qiblaCache.get(key);
  let direction;
  let source = 'aladhan';
  try {
    const data = await aladhanFetch(`/qibla/${lat}/${lng}`, {});
    direction = data.direction;
  } catch {
    direction = localQibla(lat, lng);
    source = 'local';
  }
  const result = { direction: Math.round(direction * 10) / 10, source };
  qiblaCache.set(key, result);
  return result;
}

// --- RG-19 : prières à accomplir après le ghusl ---------------------------

/**
 * Règle paramétrable (à valider par le comité) :
 * - avant l'aube (avec la marge) → Maghrib et Isha ;
 * - pendant le temps de Fajr (avant le lever) → Fajr ;
 * - pendant le temps de Dhuhr → Dhuhr ;
 * - pendant le temps de Asr, avant le coucher du soleil (avec la marge) → Dhuhr et Asr ;
 * - pendant le temps de Maghrib → Maghrib ;
 * - après Isha → Maghrib et Isha.
 * La marge représente le temps du ghusl et d'une partie de la prière.
 */
export function prayersAfterPurification(time, timings, marginMinutes = 15) {
  const t = timeToMinutes(time);
  const m = (p) => timeToMinutes(timings[p]);
  const margin = marginMinutes;
  if (t < m('fajr') - margin) return { prayers: ['maghrib', 'isha'], next: 'fajr' };
  if (t < m('fajr')) return { prayers: [], next: 'fajr' };
  if (t < m('sunrise') - margin) return { prayers: ['fajr'], next: 'dhuhr' };
  if (t < m('dhuhr')) return { prayers: [], next: 'dhuhr' };
  if (t < m('asr')) return { prayers: ['dhuhr'], next: 'asr' };
  if (t < m('maghrib') - margin) return { prayers: ['dhuhr', 'asr'], next: 'maghrib' };
  if (t < m('maghrib')) return { prayers: [], next: 'maghrib' };
  if (t < m('isha')) return { prayers: ['maghrib'], next: 'isha' };
  return { prayers: ['maghrib', 'isha'], next: 'fajr' };
}

export function prayerOptionsFor(user, settings) {
  const city = user.city || {};
  return {
    lat: city.lat ?? 48.8566,
    lng: city.lng ?? 2.3522,
    tz: city.timezone || 'Europe/Paris',
    method: settings.prayerMethod || 'MWL',
    highLatitude: settings.highLatitudeRule || 'SEVENTH',
    adjustments: user.prayerSettings?.adjustments || {},
  };
}


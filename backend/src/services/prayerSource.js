// 5.7 — Horaires de l'utilisatrice selon sa source : « Ma ville » (calcul à sa position, API Aladhan)
// ou « Ma mosquée » (horaires publiés par la mosquée, sinon calcul à la mosquée — RG-16 bis).
import { Mosque } from '../models/index.js';
import { addDays, eachDay, zonedToDate } from '../utils/dates.js';
import { getTimings, getTimingsRange, prayerOptionsFor } from './prayerService.js';
import { isFriday } from './dhikr.js';

const mosqueCache = new Map();

export async function mosqueOf(user) {
  if (user?.prayerSource?.mode !== 'mosquee' || !user.prayerSource.mosque) return null;
  const id = String(user.prayerSource.mosque);
  const hit = mosqueCache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.doc;
  const doc = await Mosque.findById(id).lean();
  mosqueCache.set(id, { at: Date.now(), doc });
  return doc;
}

export const forgetMosque = (id) => mosqueCache.delete(String(id));

/** Options de calcul : la mosquée choisie (ses coordonnées) ou la position de l'utilisatrice. */
export function optionsAt(user, settings, mosque) {
  const base = prayerOptionsFor(user, settings);
  return mosque ? { ...base, lat: mosque.lat, lng: mosque.lng, tz: mosque.timezone || base.tz, adjustments: {} } : base;
}

/** Prochain vendredi (ou aujourd'hui si c'est vendredi). */
const nextFriday = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return addDays(day, (5 - new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 7) % 7);
};

/** Jumu'a de la mosquée pour le vendredi qui vient : horaires publiés ce jour-là, sinon heures habituelles. */
export function jumuaOf(mosque, day) {
  if (!mosque) return null;
  const friday = nextFriday(day);
  const row = mosque.timetable?.find((r) => r.day === friday);
  const times = [...new Set([row?.jumua || mosque.jumua, row?.jumua2 || mosque.jumua2].filter(Boolean))];
  if (!times.length) return null;
  const tz = mosque.timezone || 'Europe/Paris';
  return { day: friday, today: friday === day, times, instants: times.map((t) => zonedToDate(friday, t, tz).toISOString()), published: Boolean(row?.jumua) };
}

function metaFor(user, mosque, fallback, day) {
  if (!mosque) return { mode: 'ville', label: user.city?.name || 'Paris', fallback: false, isFriday: isFriday(day) };
  const jumua = jumuaOf(mosque, day);
  return {
    mode: 'mosquee',
    label: mosque.name,
    city: mosque.city,
    mosqueId: String(mosque._id),
    partner: Boolean(mosque.partner),
    fallback,
    isFriday: isFriday(day),
    // Jumu'a du vendredi qui vient : { day, today, times: ['13:15', '14:15'], instants, published }
    friday: jumua,
    jumua: jumua?.today ? jumua.times[0] : null,
    jumuaTime: jumua?.times[0] || null,
  };
}

function fromRow(row, computed) {
  return {
    day: row.day,
    fajr: row.fajr || computed.fajr,
    sunrise: row.sunrise || computed.sunrise,
    dhuhr: row.dhuhr || computed.dhuhr,
    asr: row.asr || computed.asr,
    maghrib: row.maghrib || computed.maghrib,
    isha: row.isha || computed.isha,
    source: 'mosquee',
  };
}

const complete = (row) => row && row.fajr && row.dhuhr && row.asr && row.maghrib && row.isha;

/** Horaires d'un jour : { timings, opts, meta }. */
export async function userTimings(user, settings, day) {
  const mosque = await mosqueOf(user);
  const opts = optionsAt(user, settings, mosque);
  const computed = await getTimings(opts, day);
  const row = mosque?.timetable?.find((r) => r.day === day);
  if (complete(row)) return { timings: fromRow(row, computed), opts, meta: metaFor(user, mosque, false, day) };
  return { timings: computed, opts, meta: metaFor(user, mosque, Boolean(mosque), day) };
}

/** Horaires sur plusieurs jours (notifications, Ramadan, jeûnes manqués). */
export async function userTimingsRange(user, settings, from, to) {
  const mosque = await mosqueOf(user);
  const opts = optionsAt(user, settings, mosque);
  const computed = await getTimingsRange(opts, from, to);
  if (!mosque) return computed;
  const rows = new Map((mosque.timetable || []).map((r) => [r.day, r]));
  return eachDay(from, to).map((day, i) => (complete(rows.get(day)) ? fromRow(rows.get(day), computed[i]) : computed[i]));
}

export async function userSourceMeta(user, day) {
  const mosque = await mosqueOf(user);
  const row = mosque?.timetable?.find((r) => r.day === day);
  return metaFor(user, mosque, Boolean(mosque) && !complete(row), day);
}

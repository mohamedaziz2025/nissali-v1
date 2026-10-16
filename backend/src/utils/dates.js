// Les jours calendaires sont manipulés sous forme de chaînes "YYYY-MM-DD"
// et les heures sous forme "HH:mm" (heure locale de l'utilisatrice).
// Cela évite tout décalage de fuseau dans les calculs de cycle et de jeûne.

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isDay = (s) => typeof s === 'string' && DAY_RE.test(s);
export const isTime = (s) => typeof s === 'string' && TIME_RE.test(s);

export function parseDay(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDay(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(day, n) {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDay(d);
}

/** Nombre de jours de b à a (a − b). */
export function diffDays(a, b) {
  return Math.round((parseDay(a) - parseDay(b)) / DAY_MS);
}

/** 0 = dimanche … 6 = samedi */
export function weekday(day) {
  return parseDay(day).getUTCDay();
}

export function minDay(a, b) {
  return a < b ? a : b;
}

export function maxDay(a, b) {
  return a > b ? a : b;
}

export function eachDay(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthBounds(month) {
  // month = "YYYY-MM"
  const start = `${month}-01`;
  const d = parseDay(start);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { start, end: formatDay(d) };
}

/** Mois calendaires écoulés entre deux jours (a ≥ b). */
export function monthsBetween(a, b) {
  const da = parseDay(a);
  const db = parseDay(b);
  let months = (da.getUTCFullYear() - db.getUTCFullYear()) * 12 + (da.getUTCMonth() - db.getUTCMonth());
  if (da.getUTCDate() < db.getUTCDate()) months -= 1;
  return months;
}

export function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Moment local comparable lexicographiquement : "YYYY-MM-DDTHH:mm". */
export const moment = (day, time) => `${day}T${time}`;

// --- Fuseaux horaires ---------------------------------------------------

const partsCache = new Map();
function formatterFor(tz) {
  if (!partsCache.has(tz)) {
    partsCache.set(
      tz,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }
  return partsCache.get(tz);
}

export function safeTimeZone(tz) {
  try {
    formatterFor(tz || 'Europe/Paris');
    return tz || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}

/** Jour et heure locale d'un instant dans un fuseau donné. */
export function localParts(date, tz) {
  const parts = Object.fromEntries(formatterFor(safeTimeZone(tz)).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    seconds: Number(parts.second),
  };
}

export function todayIn(tz, now = new Date()) {
  return localParts(now, tz).day;
}

function offsetMinutes(date, tz) {
  const p = localParts(date, tz);
  const [y, mo, d] = p.day.split('-').map(Number);
  const [h, mi] = p.time.split(':').map(Number);
  return Math.round((Date.UTC(y, mo - 1, d, h, mi, p.seconds) - date.getTime()) / 60000);
}

/** Convertit un jour + heure locale d'un fuseau en instant UTC. */
export function zonedToDate(day, time, tz) {
  const [y, mo, d] = day.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let ts = guess - offsetMinutes(new Date(guess), tz) * 60000;
  const second = guess - offsetMinutes(new Date(ts), tz) * 60000;
  if (second !== ts) ts = second;
  return new Date(ts);
}

export function yearsSince(birthYear, now = new Date()) {
  return now.getUTCFullYear() - birthYear;
}

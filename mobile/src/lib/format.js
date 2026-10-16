// Mise en forme des dates et durées en français.
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function parseDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function toDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(day, n) {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a, b) {
  return Math.round((parseDay(a) - parseDay(b)) / 86_400_000);
}

/** « Mercredi 14 octobre » */
export function longDate(day, { year = false } = {}) {
  const d = parseDay(day);
  return `${cap(DAYS[d.getUTCDay()])} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year ? ` ${d.getUTCFullYear()}` : ''}`;
}

/** « 24 octobre » */
export function dayMonth(day) {
  const d = parseDay(day);
  return `${d.getUTCDate()}${d.getUTCDate() === 1 ? 'er' : ''} ${MONTHS[d.getUTCMonth()]}`;
}

/** « lundi 19 oct. » */
export function shortDate(day) {
  const d = parseDay(day);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${cap(MONTHS[m - 1])} ${y}`;
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function inDays(n) {
  if (n === 0) return 'Aujourd’hui';
  if (n === 1) return 'Demain';
  if (n < 0) return `Il y a ${-n} jour${n < -1 ? 's' : ''}`;
  return `Dans ${n} jours`;
}

/** 7.33 → « 7 h 20 » */
export function hours(h) {
  if (h == null) return '—';
  const total = Math.round(h * 60);
  const m = total % 60;
  return `${Math.floor(total / 60)} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
}

/** Durée jusqu'à un instant : « 1 h 12 » */
export function countdown(iso, now = Date.now()) {
  const min = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60000));
  if (min < 60) return `${min}\u00A0min`;
  return `${Math.floor(min / 60)}\u00A0h\u00A0${String(min % 60).padStart(2, '0')}`;
}

export const price = (n) => (n === 0 ? 'Gratuit' : `${Number(n).toLocaleString('fr-FR')} €`);

export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const WEEKDAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

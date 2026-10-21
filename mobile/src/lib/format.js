// Mise en forme des dates et durées, dans la langue de l'appli (français, anglais, arabe).
import { language, tr } from './i18n';

const NAMES = {
  fr: {
    days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    daysShort: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    monthsShort: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    letters: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    monthLetters: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
  },
  en: {
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    letters: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    monthLetters: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
  },
  ar: {
    days: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    daysShort: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    monthsShort: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    letters: ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'],
    monthLetters: ['ين', 'فب', 'مس', 'أب', 'ما', 'يو', 'يل', 'أغ', 'سب', 'أك', 'نو', 'دي'],
  },
};
const N = NAMES[language] || NAMES.fr;

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

/** « Mercredi 14 octobre » · « Wednesday 14 October » · « الأربعاء 14 أكتوبر » */
export function longDate(day, { year = false } = {}) {
  const d = parseDay(day);
  return `${cap(N.days[d.getUTCDay()])} ${d.getUTCDate()} ${N.months[d.getUTCMonth()]}${year ? ` ${d.getUTCFullYear()}` : ''}`;
}

/** « 24 octobre » (« 1er » en français) */
export function dayMonth(day) {
  const d = parseDay(day);
  return `${d.getUTCDate()}${language === 'fr' && d.getUTCDate() === 1 ? 'er' : ''} ${N.months[d.getUTCMonth()]}`;
}

/** « lundi 19 oct. » */
export function shortDate(day) {
  const d = parseDay(day);
  return `${language === 'fr' ? N.days[d.getUTCDay()] : N.daysShort[d.getUTCDay()]} ${d.getUTCDate()} ${N.monthsShort[d.getUTCMonth()]}`;
}

/** « 2 nov. » */
export function shortDay(day) {
  const d = parseDay(day);
  return `${d.getUTCDate()} ${N.monthsShort[d.getUTCMonth()]}`;
}

/** « mer. » */
export const weekdayShort = (day) => N.daysShort[parseDay(day).getUTCDay()];
/** Nom court du mois (1 à 12). */
export const monthShort = (m) => N.monthsShort[m - 1];
/** Nom du mois (1 à 12). */
export const monthName = (m) => N.months[m - 1];

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${cap(N.months[m - 1])} ${y}`;
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function inDays(n) {
  if (n === 0) return tr('Aujourd’hui');
  if (n === 1) return tr('Demain');
  if (n < 0) return n < -1 ? tr('Il y a {0} jours', [-n]) : tr('Il y a {0} jour', [-n]);
  return tr('Dans {0} jours', [n]);
}

/** 7.33 → « 7 h 20 » */
export function hours(h) {
  if (h == null) return '—';
  const total = Math.round(h * 60);
  const m = total % 60;
  return `${Math.floor(total / 60)} ${tr('h')}${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
}

/** Durée jusqu'à un instant : « 1 h 12 » */
export function countdown(iso, now = Date.now()) {
  const min = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60000));
  if (min < 60) return `${min} ${tr('min')}`;
  return `${Math.floor(min / 60)} ${tr('h')} ${String(min % 60).padStart(2, '0')}`;
}

export const price = (n) => (n === 0 ? tr('Gratuit') : `${Number(n).toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR')} €`);

/** Initiales des jours, lundi en premier. */
export const WEEKDAYS_SHORT = N.letters;
/** Initiales des mois, janvier en premier. */
export const MONTH_LETTERS = N.monthLetters;
export const WEEKDAY_NAMES = N.days.map(cap);

/** Noms courts des jours (dimanche en premier), noms et noms courts des mois (janvier en premier). */
export const DAYS_SHORT = N.daysShort;
export const DAY_NAMES = N.days;
export const MONTHS_LONG = N.months;
export const MONTHS_SHORT = N.monthsShort;
/** Semaine, lundi en premier : { v: jour JS (0 = dimanche), l: initiale, name: nom du jour }. */
export const WEEK = [1, 2, 3, 4, 5, 6, 0].map((v, i) => ({ v, n: v, l: N.letters[i], name: N.days[v] }));

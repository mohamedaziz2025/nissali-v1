// 5.2 bis — Occurrences des notes (une fois, chaque jour, chaque semaine sur des jours choisis, chaque mois).
import { Note } from '../models/index.js';
import { open } from './secretBox.js';
import { addDays, weekday } from '../utils/dates.js';

const DAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const DAY_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const TYPE_LABELS = { medicament: 'Médicament', cours: 'Cours', rendez_vous: 'Rendez-vous', symptome: 'Symptôme', autre: 'Autre' };

/** « Une fois », « Chaque jour », « Chaque lundi », « Chaque lun., jeu. », « Chaque mois ». */
export function repeatLabel(n) {
  if (n.repeat === 'daily') return 'Chaque jour';
  if (n.repeat === 'monthly') return `Chaque mois, le ${Number(n.day.slice(8))}`;
  if (n.repeat === 'weekly') {
    const days = n.weekdays?.length ? [...n.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) : [weekday(n.day)];
    return days.length === 1 ? `Chaque ${DAY_LONG[days[0]]}` : `Chaque ${days.map((d) => DAY_SHORT[d]).join(', ')}`;
  }
  return 'Une fois';
}

const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Dates d'une note entre `from` et `to` (inclus), hors occurrences supprimées. */
export function occurrences(n, from, to) {
  const end = n.until && n.until < to ? n.until : to;
  const start = n.day > from ? n.day : from;
  if (start > end) return [];
  const skips = new Set(n.skips || []);
  const out = [];
  if (n.repeat === 'once') {
    if (n.day >= from && n.day <= end) out.push(n.day);
  } else if (n.repeat === 'monthly') {
    const dom = Number(n.day.slice(8));
    let y = Number(start.slice(0, 4));
    let m = Number(start.slice(5, 7));
    for (let i = 0; i < 400; i += 1) {
      const d = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(dom, lastDayOfMonth(y, m))).padStart(2, '0')}`;
      if (d > end) break;
      if (d >= start) out.push(d);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  } else {
    const days = n.repeat === 'weekly' ? new Set(n.weekdays?.length ? n.weekdays : [weekday(n.day)]) : null;
    for (let d = start, i = 0; d <= end && i < 800; d = addDays(d, 1), i += 1) if (!days || days.has(weekday(d))) out.push(d);
  }
  return out.filter((d) => !skips.has(d));
}

export function plainNote(n) {
  return {
    id: String(n._id),
    text: open(n.text),
    type: n.type,
    typeLabel: TYPE_LABELS[n.type],
    day: n.day,
    time: n.time || null,
    repeat: n.repeat,
    weekdays: n.weekdays || [],
    until: n.until || null,
    showInCalendar: n.showInCalendar !== false,
    remind: Boolean(n.remind),
    paused: Boolean(n.paused),
    repeatLabel: repeatLabel(n),
  };
}

/** Prochaines occurrences (accueil, liste « Mes notes à venir », rappels). */
export async function upcomingNotes(userId, from, { days = 60, limit = 50, withPaused = false } = {}) {
  const to = addDays(from, days);
  const notes = await Note.find({ user: userId, day: { $lte: to }, $or: [{ until: null }, { until: { $gte: from } }] }).lean();
  const items = [];
  for (const n of notes) {
    if (n.paused && !withPaused) continue;
    const p = plainNote(n);
    for (const day of occurrences(n, from, to)) items.push({ ...p, noteId: p.id, day, start: n.day });
  }
  items.sort((a, b) => (a.day + (a.time || '99:99') < b.day + (b.time || '99:99') ? -1 : 1));
  return items.slice(0, limit);
}

/** Jours qui portent une note « affichée dans le calendrier » (petit point). */
export async function noteDays(userId, from, to) {
  const notes = await Note.find({ user: userId, paused: false, showInCalendar: true, day: { $lte: to }, $or: [{ until: null }, { until: { $gte: from } }] }).lean();
  const days = new Set();
  for (const n of notes) for (const d of occurrences(n, from, to)) days.add(d);
  return [...days].sort();
}

// 5.8 — Jeûnes volontaires : type d'un jour (pour « J'ai jeûné » et le programme) et prochains jours prévus.
import { forbiddenFastReason, isRamadan, toHijri } from './hijri.js';
import { addDays, weekday } from '../utils/dates.js';

export const VOLUNTARY_LABELS = { lundi_jeudi: 'Lundi / jeudi', jours_blancs: 'Jour blanc', arafat: 'Arafat', achoura: 'Achoura', chawwal: '6 de Chawwal', autre: 'Autre' };

/** Jeûne du calendrier hégirien pour ce jour (jours blancs, Arafat, Achoura, Chawwal), sinon null. */
export function calendarFast(day, adj = 0, excludeDhulHijja13 = true) {
  const h = toHijri(day, adj);
  if (h.month === 12 && h.day === 9) return 'arafat';
  if (h.month === 1 && (h.day === 9 || h.day === 10)) return 'achoura';
  if (h.month === 10 && h.day >= 2 && h.day <= 7) return 'chawwal';
  if (h.day >= 13 && h.day <= 15 && !(excludeDhulHijja13 && h.month === 12 && h.day === 13)) return 'jours_blancs';
  return null;
}

/** Type proposé pour un jour jeûné : jeûne du calendrier, lundi ou jeudi, sinon « autre ». */
export function suggestType(day, adj = 0, excl = true) {
  return calendarFast(day, adj, excl) || ([1, 4].includes(weekday(day)) ? 'lundi_jeudi' : 'autre');
}

/**
 * Prochains jours programmés (RG-32 : jamais comptés tant qu'ils ne sont pas notés). RG-33 : pendant les
 * règles ou le nifas prévus ou en cours, le jour est en pause (aucune notification) et l'appli propose de le décaler.
 */
export function nextVoluntary(plan, { from, days = 60, adj = 0, excl = true, periodOn = () => null, done = new Set(), limit = 8 }) {
  const out = [];
  const weekdays = new Set(plan?.weekdays || []);
  const dates = new Set(plan?.dates || []);
  const skip = new Set(plan?.skip || []);
  for (let i = 0; i < days && out.length < limit; i += 1) {
    const day = addDays(from, i);
    // « Jusqu'à » : au-delà de la date de fin, le programme s'arrête (les dates précises restent).
    const active = !plan?.until || day <= plan.until;
    if (done.has(day) || skip.has(day) || isRamadan(day, adj) || forbiddenFastReason(day, adj)) continue;
    const cal = calendarFast(day, adj, excl);
    let type = null;
    if (active && cal && plan?.[{ jours_blancs: 'blancs', arafat: 'arafat', achoura: 'achoura', chawwal: 'chawwal' }[cal]]) type = cal;
    else if (active && weekdays.has(weekday(day))) type = [1, 4].includes(weekday(day)) ? 'lundi_jeudi' : 'autre';
    else if (dates.has(day)) type = cal || 'autre';
    if (!type) continue;
    out.push({ day, type, label: VOLUNTARY_LABELS[type], paused: Boolean(periodOn(day)) });
  }
  return out;
}

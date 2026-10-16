// 6.7 — Grossesse : SA, SG, début de grossesse, terme, mois et trimestre.

import { addDays, diffDays, monthsBetween } from '../utils/dates.js';

const TERM_DAYS = { fr: 287, naegele: 280 };

/**
 * Priorité des données : terme de l'échographie > date de début de grossesse > DDR.
 * Retourne la DDR de référence, la date de début de grossesse (DG) et le terme.
 */
export function pregnancyDates({ lmp, conceptionDate, dueDate, cycleLength = 28, termRule = 'fr' }) {
  const termDays = TERM_DAYS[termRule] || TERM_DAYS.fr;
  if (dueDate) {
    const ddr = addDays(dueDate, -termDays);
    return { ddr, conception: addDays(ddr, 14), dueDate, source: 'echographie' };
  }
  if (conceptionDate) {
    const ddr = addDays(conceptionDate, -14);
    return { ddr, conception: conceptionDate, dueDate: addDays(ddr, termDays), source: 'debut_grossesse' };
  }
  if (lmp) {
    const shift = cycleLength - 28;
    return {
      ddr: lmp,
      conception: addDays(lmp, cycleLength - 14),
      dueDate: addDays(lmp, termDays + shift),
      source: 'ddr',
    };
  }
  return null;
}

export function trimesterOf(weeks) {
  if (weeks <= 14) return 1;
  if (weeks <= 28) return 2;
  return 3;
}

export function pregnancyStatus(input, today) {
  const dates = pregnancyDates(input);
  if (!dates) return null;
  const elapsed = Math.max(0, diffDays(today, dates.ddr));
  const weeks = Math.floor(elapsed / 7);
  const days = elapsed % 7;
  const month = today >= dates.conception ? monthsBetween(today, dates.conception) + 1 : 1;
  // SG comptées depuis la conception (SA − 2 semaines pour un cycle de 28 jours, décalées sinon).
  const sinceConception = Math.max(0, diffDays(today, dates.conception));
  return {
    ...dates,
    sa: { weeks, days, label: `${weeks} SA${days ? ` + ${days} jour${days > 1 ? 's' : ''}` : ''}` },
    sg: { weeks: Math.floor(sinceConception / 7), days: sinceConception % 7 },
    trimester: trimesterOf(weeks),
    month,
    daysLeft: diffDays(dates.dueDate, today),
    progress: Math.min(1, elapsed / diffDays(dates.dueDate, dates.ddr)),
  };
}

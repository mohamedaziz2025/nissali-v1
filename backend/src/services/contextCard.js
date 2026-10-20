// 4.3 / RG-46 — Carte contextuelle de l'accueil : une seule carte, seulement quand c'est utile.
// Les cas possibles sont renvoyés par ordre de priorité ; l'appli affiche le premier qu'elle n'a pas masqué.
// D ghusl → G règles en retard → A jour de jeûne → B après Maghrib d'un jour de jeûne → E Ramadan approche
// → C veille d'un jeûne → F vendredi. Pendant les règles, A, B, C et F ne s'affichent pas (RG-33).
import { forbiddenFastReason, isRamadan } from './hijri.js';
import { calendarFast, VOLUNTARY_LABELS } from './voluntary.js';
import { addDays, timeToMinutes, weekday } from '../utils/dates.js';

const WEEKDAY_SUNNA = { 1: 'Sunna du lundi', 4: 'Sunna du jeudi' };

/** Jeûne programmé ce jour-là : rattrapage (programme) ou jeûne volontaire programmé. */
export function plannedFast(day, { fastCtx, user, adj, excl }) {
  if (isRamadan(day, adj) || forbiddenFastReason(day, adj) || fastCtx.periodOn(day)) return null;
  const plan = fastCtx.plan;
  const wd = weekday(day);
  if (plan?.active && fastCtx.counter.remaining > 0 && (plan.weekdays || []).includes(wd)) return { kind: 'rattrapage', label: 'Rattrapage' };
  const vp = user.voluntaryPlan || {};
  const cal = calendarFast(day, adj, excl);
  const calKey = { jours_blancs: 'blancs', arafat: 'arafat', achoura: 'achoura', chawwal: 'chawwal' }[cal];
  if (cal && vp[calKey]) return { kind: 'volontaire', type: cal, label: VOLUNTARY_LABELS[cal] };
  if ((vp.weekdays || []).includes(wd)) return { kind: 'volontaire', type: [1, 4].includes(wd) ? 'lundi_jeudi' : 'autre', label: WEEKDAY_SUNNA[wd] || 'Jeûne volontaire' };
  return null;
}

export function contextCards({ today, time, timings, tomorrowFajr, cycle, inPeriod, purification, ramadan, fastCtx, user, settings, fastedToday, jumua }) {
  const adj = settings.hijriAdjustment || 0;
  const excl = settings.excludeDhulHijja13 !== false;
  const m = timeToMinutes(time);
  const cards = [];

  // D · Ghusl et prières à faire (non masquable).
  if (purification && purification.done < purification.total) {
    cards.push({ key: 'ghusl', title: 'Ghusl et prières', subtitle: `${purification.done} sur ${purification.total} fait${purification.prayers.find((p) => !p.done) ? ` · ${purification.prayers.find((p) => !p.done).label} à accomplir` : ''}`, dismissable: false });
  }
  // G · Règles en retard (J+3), masquable.
  if (cycle.kind === 'prochaines' && cycle.lateDays >= 3) {
    cards.push({ key: 'retard', title: 'Tes règles sont-elles arrivées ?', subtitle: `Elles étaient prévues le ${cycle.nextDate}`, nextDate: cycle.nextDate, lateDays: cycle.lateDays, dismissable: true });
  }
  if (!inPeriod) {
    const todayFast = plannedFast(today, { fastCtx, user, adj, excl });
    // A · Jour de jeûne en cours, de Fajr à Maghrib.
    if (todayFast && !fastedToday && m >= timeToMinutes(timings.fajr) && m < timeToMinutes(timings.maghrib)) {
      const progress = (m - timeToMinutes(timings.fajr)) / Math.max(1, timeToMinutes(timings.maghrib) - timeToMinutes(timings.fajr));
      cards.push({ key: 'jeune', title: 'Tu jeûnes aujourd’hui', subtitle: `${todayFast.label} · iftar à ${timings.maghrib}`, fast: todayFast, fajr: timings.fajr, maghrib: timings.maghrib, progress: Math.min(1, Math.max(0, progress)), dismissable: false });
    }
    // B · Après Maghrib d'un jour de jeûne programmé, jusqu'à minuit.
    if (todayFast && !fastedToday && m >= timeToMinutes(timings.maghrib)) {
      cards.push({ key: 'jeune_fait', title: 'As-tu jeûné aujourd’hui ?', subtitle: todayFast.kind === 'rattrapage' ? 'On coche ton jour de rattrapage.' : 'On l’ajoute à tes jeûnes de l’année.', fast: todayFast, dismissable: false });
    }
  }
  // E · Ramadan approche (J−30, J−7, J−1).
  if (!ramadan.current && [30, 7, 1].includes(ramadan.daysUntil)) {
    const remaining = fastCtx.counter.remaining;
    cards.push({ key: 'ramadan', title: `Ramadan dans ${ramadan.daysUntil} jour${ramadan.daysUntil > 1 ? 's' : ''}`, subtitle: remaining ? `Il te reste ${remaining} jour${remaining > 1 ? 's' : ''} obligatoire${remaining > 1 ? 's' : ''} à rattraper.` : 'Tu es à jour.', dismissable: true });
  }
  if (!inPeriod) {
    // C · Veille d'un jeûne programmé, de Asr à minuit.
    const tomorrow = addDays(today, 1);
    const next = plannedFast(tomorrow, { fastCtx, user, adj, excl });
    if (next && m >= timeToMinutes(timings.asr)) {
      cards.push({ key: 'veille', title: `Demain : ${next.label.toLowerCase()}`, subtitle: `Pense à ton suhur avant Fajr${tomorrowFajr ? `, ${tomorrowFajr}` : ''}`, fast: next, dismissable: true });
    }
    // F · Vendredi, de Fajr à Maghrib.
    if (weekday(today) === 5 && m >= timeToMinutes(timings.fajr) && m < timeToMinutes(timings.maghrib)) {
      const t = jumua?.today ? `${jumua.estimated ? '≈ ' : ''}${jumua.times[0]}` : null;
      cards.push({ key: 'vendredi', title: 'Jumu’a mubaraka', subtitle: `${t ? `Jumu’a à ${t} · ` : ''}pense à la sourate Al-Kahf`, dismissable: true });
    }
  }
  return cards;
}

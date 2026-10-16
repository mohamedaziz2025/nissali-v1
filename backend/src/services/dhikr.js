// Rappels de dhikr calés sur les horaires de prière de la position de l'utilisatrice (API Aladhan) :
// adhkar du matin (après Fajr), du soir (après Asr), et le vendredi : sourate Al-Kahf et salawat
// le matin, invocations pendant la dernière heure avant le Maghrib. Textes modifiables dans le back-office.
import { minutesToTime, timeToMinutes, zonedToDate } from '../utils/dates.js';

const at = (t, delta) => minutesToTime(timeToMinutes(t) + delta);
const clamp = (t, lo, hi) => (t < lo ? lo : t > hi ? hi : t);

export const isFriday = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5;
};

/**
 * Rappels du jour : [{ kind, time: 'HH:MM', instant: ISO, title, body }].
 * prefs : user.prayerSettings ; settings : réglages du back-office ; timings : horaires du jour.
 */
export function dhikrReminders({ timings, tz, prefs = {}, settings = {} }) {
  const list = [];
  const add = (kind, time, title, body) => {
    if (!body) return;
    list.push({ kind, time, instant: zonedToDate(timings.day, time, tz).toISOString(), title, body });
  };
  // Matin : 20 min après Fajr, au plus tard 10 min avant le lever du soleil.
  if (prefs.adhkarMorning !== false) add('adhkar_matin', clamp(at(timings.fajr, 20), timings.fajr, at(timings.sunrise, -10)), 'Adhkar du matin', settings.adhkarMorningText);
  // Soir : 20 min après Asr, au plus tard 15 min avant le Maghrib.
  if (prefs.adhkarEvening !== false) add('adhkar_soir', clamp(at(timings.asr, 20), timings.asr, at(timings.maghrib, -15)), 'Adhkar du soir', settings.adhkarEveningText);
  if (prefs.jumua !== false && isFriday(timings.day)) {
    const morning = at(timings.sunrise, 30) > '09:30' ? at(timings.sunrise, 30) : '09:30';
    add('jumua', morning < timings.dhuhr ? morning : at(timings.dhuhr, -60), 'Jumu’a', settings.jumuaText);
    // Dernière heure du vendredi : entre Asr et Maghrib (Abu Dawud, 1048).
    add('jumua_derniere_heure', clamp(at(timings.maghrib, -60), timings.asr, timings.maghrib), 'Vendredi · dernière heure', settings.jumuaLastHourText);
  }
  return list.sort((a, b) => (a.time < b.time ? -1 : 1));
}

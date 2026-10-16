// Calcul local des horaires (bibliothèque open source adhan) : utilisé hors connexion (6.8, 9).
import { CalculationMethod, CalculationParameters, Coordinates, HighLatitudeRule, Madhab, PrayerTimes, Qibla } from 'adhan';

const fmt = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const METHODS = {
  MWL: () => CalculationMethod.MuslimWorldLeague(),
  UOIF: () => new CalculationParameters('Other', 12, 12),
  ISNA: () => CalculationMethod.NorthAmerica(),
  EGYPT: () => CalculationMethod.Egyptian(),
  MAKKAH: () => CalculationMethod.UmmAlQura(),
};
const HIGH_LATITUDE = { SEVENTH: HighLatitudeRule.SeventhOfTheNight, MIDDLE: HighLatitudeRule.MiddleOfTheNight, ANGLE: HighLatitudeRule.TwilightAngle };

/** method : { key, highLatitude, adjustments } envoyé par /today (réglages du comité + ajustements). */
export function localTimings(city, date = new Date(), method = {}) {
  if (!city?.lat) return null;
  const params = (METHODS[method.key] || METHODS.MWL)();
  params.madhab = Madhab.Shafi;
  params.highLatitudeRule = HIGH_LATITUDE[method.highLatitude] || HighLatitudeRule.SeventhOfTheNight;
  const adj = method.adjustments || {};
  params.adjustments = { fajr: adj.fajr || 0, sunrise: 0, dhuhr: adj.dhuhr || 0, asr: adj.asr || 0, maghrib: adj.maghrib || 0, isha: adj.isha || 0 };
  const pt = new PrayerTimes(new Coordinates(city.lat, city.lng), date, params);
  const instants = { fajr: pt.fajr, sunrise: pt.sunrise, dhuhr: pt.dhuhr, asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha };
  return {
    fajr: fmt(pt.fajr),
    sunrise: fmt(pt.sunrise),
    dhuhr: fmt(pt.dhuhr),
    asr: fmt(pt.asr),
    maghrib: fmt(pt.maghrib),
    isha: fmt(pt.isha),
    instants: Object.fromEntries(Object.entries(instants).map(([k, v]) => [k, v.toISOString()])),
    source: 'local',
  };
}

export const localQibla = (lat, lng) => Math.round(Qibla(new Coordinates(lat, lng)) * 10) / 10;

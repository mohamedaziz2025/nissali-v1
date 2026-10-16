// 6.8 — Position exacte du téléphone : les horaires de prière (API Aladhan) et la qibla sont
// calculés aux coordonnées GPS. La position est envoyée au serveur quand l'utilisatrice s'est
// déplacée (au-delà de 500 m) ou a changé de fuseau horaire ; sinon la ville enregistrée sert.
import * as Location from 'expo-location';
import { api } from './api';

export const KAABA = { lat: 21.4225, lng: 39.8262 };
const MIN_MOVE_KM = 0.5;
const THROTTLE_MS = 5 * 60_000;

let lastSync = 0;
let pending = null;

/** Distance à vol d'oiseau (haversine), en kilomètres. */
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

/** État de l'autorisation : 'granted' | 'denied' | 'undetermined'. */
export async function locationPermission() {
  try {
    return (await Location.getForegroundPermissionsAsync()).status;
  } catch {
    return 'denied';
  }
}

/**
 * Position actuelle. `ask` : demande l'autorisation si elle n'a jamais été donnée.
 * `precise` : position fraîche haute précision (qibla) plutôt que la dernière connue.
 */
export async function currentPosition({ ask = false, precise = false } = {}) {
  let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted' && ask && canAskAgain) ({ status } = await Location.requestForegroundPermissionsAsync());
  if (status !== 'granted') return null;
  let pos = null;
  if (!precise) pos = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000, requiredAccuracy: 1000 }).catch(() => null);
  if (!pos) pos = await Location.getCurrentPositionAsync({ accuracy: precise ? Location.Accuracy.High : Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
}

/**
 * Met à jour la position de l'utilisatrice côté serveur si elle a bougé.
 * Retourne la nouvelle session (à passer à setSession) ou null si rien n'a changé.
 */
export async function syncLocation(user, { ask = false, force = false } = {}) {
  if (!user || (user.prayerSettings?.followLocation === false && !force)) return null;
  if (!force && Date.now() - lastSync < THROTTLE_MS) return null;
  if (pending) return pending;
  pending = (async () => {
    try {
      const pos = await currentPosition({ ask });
      if (!pos) return null;
      lastSync = Date.now();
      const tz = deviceTimeZone();
      const near = user.city?.lat != null && distanceKm(user.city, pos) < MIN_MOVE_KM;
      if (!force && near && user.city?.source === 'gps' && (!tz || tz === user.city.timezone)) return null;
      const res = await api.put('/me/location', { lat: pos.lat, lng: pos.lng, ...(tz ? { timezone: tz } : {}), ...(force ? { force: true } : {}) });
      return res.updated ? res.session : null;
    } catch {
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

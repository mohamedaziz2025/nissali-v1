// Villes (saisie automatique) et position GPS → ville, via des API gratuites sans clé :
// Open-Meteo Geocoding, BigDataCloud (géocodage inverse) et Open-Meteo (fuseau horaire).

const cache = new Map();

async function getJson(url, ttlMs = 24 * 3600_000) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Nissali/1.0 (contact@nissali.fr)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const data = await res.json();
  if (cache.size > 5000) cache.clear();
  cache.set(url, { at: Date.now(), data });
  return data;
}

export async function searchCities(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: q, count: '8', language: 'fr', format: 'json' })}`;
  const data = await getJson(url);
  return (data.results || []).map((r) => ({
    name: r.name,
    admin: r.admin1 || '',
    country: r.country || '',
    countryCode: r.country_code || '',
    lat: r.latitude,
    lng: r.longitude,
    timezone: r.timezone || 'Europe/Paris',
  }));
}

export async function timezoneAt(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=auto&forecast_days=1&current=temperature_2m`;
  const data = await getJson(url, 30 * 24 * 3600_000);
  return data.timezone || 'Europe/Paris';
}

export async function reverseGeocode(lat, lng) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?${new URLSearchParams({ latitude: lat, longitude: lng, localityLanguage: 'fr' })}`;
  const [data, timezone] = await Promise.all([getJson(url), timezoneAt(lat, lng).catch(() => 'Europe/Paris')]);
  return {
    name: data.city || data.locality || data.principalSubdivision || 'Ma position',
    admin: data.principalSubdivision || '',
    country: data.countryName || '',
    countryCode: data.countryCode || '',
    lat: Number(lat),
    lng: Number(lng),
    timezone,
  };
}

/** Distance à vol d'oiseau (formule de haversine), en kilomètres. */
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ville la plus probable pour un nom (priorité à la France métropolitaine, puis Belgique, Suisse, Luxembourg, Canada). */
export async function bestCity(name, prefer = ['FR', 'BE', 'CH', 'LU', 'CA']) {
  const list = await searchCities(name).catch(() => []);
  for (const code of prefer) {
    const hit = list.find((c) => c.countryCode === code);
    if (hit) return hit;
  }
  return list[0] || null;
}

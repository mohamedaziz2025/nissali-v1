// 5.7 — Mosquées autour de l'utilisatrice : partenaires (base Nissali) + OpenStreetMap, gratuit et sans clé
// (Overpass, repli Photon/Komoot). Classées par distance.
import { Mosque } from '../models/index.js';
import { distanceKm } from './geo.js';

const UA = { 'User-Agent': 'Nissali/1.0 (nissali@gmail.com)' };
const cache = new Map();
const TTL = 6 * 3600_000;

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = await loader();
  if (cache.size > 2000) cache.clear();
  cache.set(key, { at: Date.now(), data });
  return data;
}

const clean = (s) => String(s || '').trim();

async function overpass(lat, lng, radius) {
  const q = `[out:json][timeout:12];nwr["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${lat},${lng});out center tags 80;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(q)}`,
    signal: AbortSignal.timeout(13000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json();
  return json.elements
    .map((e) => {
      const t = e.tags || {};
      const c = e.center || e;
      return {
        osmId: `${e.type[0].toUpperCase()}${e.id}`,
        name: clean(t.name || t['name:fr']),
        address: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
        city: clean(t['addr:city']),
        lat: c.lat,
        lng: c.lon,
      };
    })
    .filter((m) => m.name && m.lat != null);
}

async function photon(lat, lng, text = 'mosquee') {
  const params = new URLSearchParams({ q: text, lat, lon: lng, osm_tag: 'amenity:place_of_worship', limit: '50', lang: 'fr' });
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { headers: UA, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const json = await res.json();
  return (json.features || [])
    .map((f) => {
      const p = f.properties || {};
      const [lon, la] = f.geometry?.coordinates || [];
      return {
        osmId: `${String(p.osm_type || 'N')[0]}${p.osm_id}`,
        name: clean(p.name),
        address: [p.housenumber, p.street].filter(Boolean).join(' '),
        city: clean(p.city || p.town || p.village || p.county),
        lat: la,
        lng: lon,
      };
    })
    .filter((m) => m.name && m.lat != null);
}

/** Mosquées OpenStreetMap autour d'un point (rayon en mètres). */
export async function osmMosquesAround(lat, lng, radius = 12000) {
  const key = `${Number(lat).toFixed(2)},${Number(lng).toFixed(2)},${radius}`;
  return cached(key, async () => {
    try {
      return await overpass(lat, lng, radius);
    } catch {
      const list = await photon(lat, lng).catch(() => []);
      return list.filter((m) => distanceKm({ lat, lng }, m) <= radius / 1000);
    }
  });
}

/** Recherche par nom (OpenStreetMap, autour d'un point pour classer les résultats). */
export async function osmMosquesByName(text, lat, lng) {
  const key = `n:${text.toLowerCase()}:${Number(lat).toFixed(1)},${Number(lng).toFixed(1)}`;
  return cached(key, () => photon(lat, lng, `mosquée ${text}`).catch(() => []));
}

export function presentMosque(m, from) {
  return {
    id: m._id ? String(m._id) : null,
    osmId: m.osmId || null,
    name: m.name,
    address: m.address || '',
    city: m.city || '',
    lat: m.lat,
    lng: m.lng,
    partner: Boolean(m.partner),
    hasTimetable: Boolean(m.timetable?.length),
    jumua: m.jumua || null,
    jumua2: m.jumua2 || null,
    distanceKm: from?.lat != null ? Math.round(distanceKm(from, m) * 10) / 10 : null,
  };
}

/** Fusionne partenaires (prioritaires) et OpenStreetMap, sans doublon, du plus proche au plus loin. */
export function mergeMosques(partners, osm, from, limit = 30) {
  const seen = new Set(partners.map((p) => p.osmId).filter(Boolean));
  const norm = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const near = (a, b) => distanceKm(a, b) < 0.4 || (norm(a.name) === norm(b.name) && distanceKm(a, b) < 3);
  const extra = [];
  for (const o of osm) if (!seen.has(o.osmId) && !partners.some((p) => near(p, o)) && !extra.some((e) => near(e, o))) extra.push(o);
  return [...partners, ...extra]
    .map((m) => presentMosque(m, from))
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
    .slice(0, limit);
}

/** Crée (ou retrouve) la fiche d'une mosquée OpenStreetMap choisie par une utilisatrice. */
export async function ensureOsmMosque({ osmId, name, address, city, lat, lng, timezone }) {
  return Mosque.findOneAndUpdate(
    { osmId },
    { $setOnInsert: { osmId, name, address, city, lat, lng, timezone: timezone || 'Europe/Paris', partner: false } },
    { upsert: true, new: true },
  );
}

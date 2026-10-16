// 5.7 — Page Horaires de prière, mode « Ma mosquée » : mosquées autour de moi, recherche, horaires du jour.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Mosque } from '../models/index.js';
import { nowFor } from '../services/context.js';
import { distanceKm, searchCities } from '../services/geo.js';
import { mergeMosques, osmMosquesAround, osmMosquesByName, presentMosque } from '../services/mosques.js';
import { getTimings, prayerOptionsFor, withInstants } from '../services/prayerService.js';
import { jumuaOf } from '../services/prayerSource.js';
import { getSettings } from '../services/settings.js';
import { escapeRegex, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

function positionOf(req) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  const c = req.user.city;
  return { lat: c?.lat ?? 48.8566, lng: c?.lng ?? 2.3522 };
}

// Autour de moi : partenaires à moins de 60 km + OpenStreetMap à moins de 12 km.
router.get('/nearby', async (req, res) => {
  const from = positionOf(req);
  const [partners, osm] = await Promise.all([Mosque.find({ partner: true, active: true }).lean(), osmMosquesAround(from.lat, from.lng).catch(() => [])]);
  res.json({ from, items: mergeMosques(partners.filter((p) => distanceKm(from, p) <= 60), osm, from) });
});

// Recherche d'une mosquée (nom) ou d'une ville (mosquées de cette ville).
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const from = positionOf(req);
  if (q.length < 2) return res.json({ from, items: [] });
  const rx = new RegExp(escapeRegex(q), 'i');
  const [partners, cities, byName] = await Promise.all([
    Mosque.find({ partner: true, active: true, $or: [{ name: rx }, { city: rx }] }).limit(20).lean(),
    searchCities(q).catch(() => []),
    osmMosquesByName(q, from.lat, from.lng),
  ]);
  // La recherche vise une ville quand le texte correspond au nom d'une ville : mosquées autour de cette ville.
  const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const city = cities.find((c) => norm(c.name).startsWith(norm(q)) && ['FR', 'BE', 'CH', 'CA', 'LU', 'MA', 'DZ', 'TN'].includes(c.countryCode)) || null;
  const inCity = city ? await osmMosquesAround(city.lat, city.lng, 8000).catch(() => []) : [];
  const partnersInCity = city ? await Mosque.find({ partner: true, active: true }).lean().then((all) => all.filter((m) => distanceKm(city, m) <= 15)) : [];
  const origin = city ? { lat: city.lat, lng: city.lng } : from;
  res.json({ from: origin, city: city ? { name: city.name, admin: city.admin } : null, items: mergeMosques([...partners, ...partnersInCity.filter((p) => !partners.some((x) => String(x._id) === String(p._id)))], [...byName, ...inCity], origin, 40) });
});

// Horaires du jour d'une mosquée (publiés, sinon calculés à ses coordonnées).
router.get('/:id/today', async (req, res) => {
  const m = await Mosque.findById(req.params.id).lean().catch(() => null);
  if (!m) throw notFound('Mosquée introuvable');
  const settings = await getSettings();
  const { today } = nowFor(req.user);
  const opts = { ...prayerOptionsFor(req.user, settings), lat: m.lat, lng: m.lng, tz: m.timezone || 'Europe/Paris', adjustments: {} };
  const computed = await getTimings(opts, today);
  const row = m.timetable?.find((r) => r.day === today);
  const published = row && row.fajr && row.maghrib;
  const timings = published ? { ...computed, ...Object.fromEntries(Object.entries(row).filter(([, v]) => v)), source: 'mosquee' } : computed;
  res.json({ mosque: presentMosque(m, positionOf(req)), day: today, timings: withInstants(timings, opts.tz), fallback: !published, jumua: m.jumua || row?.jumua || null, friday: jumuaOf(m, today) });
});

export default router;

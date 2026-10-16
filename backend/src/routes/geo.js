import { Router } from 'express';
import { reverseGeocode, searchCities } from '../services/geo.js';
import { badRequest } from '../utils/http.js';

const router = Router();

// Saisie automatique des villes (Open-Meteo Geocoding, gratuit).
router.get('/cities', async (req, res) => {
  try {
    res.json(await searchCities(req.query.q));
  } catch {
    res.json([]);
  }
});

// Position GPS → ville + fuseau (BigDataCloud + Open-Meteo, gratuits).
router.get('/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw badRequest('Coordonnées invalides');
  res.json(await reverseGeocode(lat, lng));
});

export default router;

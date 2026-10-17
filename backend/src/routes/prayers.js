// 5.7 / 6.8 — Prières : horaires (Aladhan), qibla, prières cochées, statistiques.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PrayerLog } from '../models/index.js';
import { loadCycleContext, prayerPause } from '../services/context.js';
import { ADHANS, DEFAULT_ADHAN, adhanFor } from '../services/adhan.js';
import { dhikrReminders } from '../services/dhikr.js';
import { reverseGeocode } from '../services/geo.js';
import { nextJumua, userTimings, userTimingsRange } from '../services/prayerSource.js';
import { getQibla, getTimings, METHODS, nextPrayer, prayerOptionsFor, PRAYERS, withInstants, KAABA } from '../services/prayerService.js';
import { getSettings } from '../services/settings.js';
import { addDays, isDay, localParts, safeTimeZone } from '../utils/dates.js';
import { badRequest } from '../utils/http.js';

const router = Router();

// Horaires pour une position GPS quelconque (sans compte : utile hors domicile).
router.get('/at', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw badRequest('Coordonnées invalides');
  const settings = await getSettings();
  const place = await reverseGeocode(lat, lng).catch(() => ({ name: 'Ma position', timezone: safeTimeZone(req.query.tz) }));
  const tz = safeTimeZone(place.timezone);
  const { day, time } = localParts(new Date(), tz);
  const opts = { lat, lng, tz, method: settings.prayerMethod, highLatitude: settings.highLatitudeRule, adjustments: {} };
  const [timings, qibla] = await Promise.all([getTimings(opts, isDay(req.query.day) ? req.query.day : day), getQibla(lat, lng)]);
  res.json({ place, timings: withInstants(timings, tz), next: nextPrayer(timings, time), qibla, method: METHODS[settings.prayerMethod]?.label });
});

// Adhans disponibles (Aladhan / Islamic Network).
router.get('/adhans', (_req, res) => res.json({ items: ADHANS, default: DEFAULT_ADHAN }));

router.use(requireAuth);

router.get('/', async (req, res) => {
  const ctx = await loadCycleContext(req.user);
  const position = prayerOptionsFor(req.user, ctx.settings);
  const day = isDay(req.query.day) ? req.query.day : ctx.today;
  const [{ timings, opts, meta }, qibla, log] = await Promise.all([userTimings(req.user, ctx.settings, day), getQibla(position.lat, position.lng), PrayerLog.findOne({ user: req.user._id, day }).lean()]);
  const pause = prayerPause(ctx);
  res.json({
    day,
    city: req.user.city,
    source: meta,
    timings: withInstants(timings, opts.tz),
    next: nextPrayer(timings, ctx.time),
    checked: Object.fromEntries(PRAYERS.map((p) => [p, Boolean(log?.[p])])),
    paused: pause.paused,
    pauseReason: pause.reason,
    qibla: { ...qibla, kaaba: KAABA },
    method: METHODS[ctx.settings.prayerMethod]?.label,
    adjustments: req.user.prayerSettings?.adjustments,
    // Prochaine Jumu'a, affichée en bas de la page Horaires (mosquée choisie ou estimation à l'heure de Dhuhr).
    jumuaNext: day === ctx.today ? await nextJumua(req.user, ctx.settings, day, ctx.time) : null,
  });
});

// Horaires sur plusieurs jours (pour programmer les notifications locales de l'app mobile).
router.get('/range', async (req, res) => {
  const settings = await getSettings();
  const { optionsAt, mosqueOf, jumuaOf } = await import('../services/prayerSource.js');
  const mosque = await mosqueOf(req.user);
  const opts = optionsAt(req.user, settings, mosque);
  const from = isDay(req.query.from) ? req.query.from : localParts(new Date(), opts.tz).day;
  const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
  const list = await userTimingsRange(req.user, settings, from, addDays(from, days - 1));
  const prefs = req.user.prayerSettings || {};
  res.json({
    timezone: opts.tz,
    location: { name: req.user.city?.name || 'Paris', lat: opts.lat, lng: opts.lng, source: req.user.city?.source || 'manuel' },
    // Chaque jour : horaires (API Aladhan à la position) + rappels de dhikr (matin, soir, vendredi).
    // Le vendredi, à la mosquée choisie : Jumu'a à l'heure publiée par la mosquée.
    days: list.map((t) => {
      const jumua = mosque ? jumuaOf(mosque, t.day) : null;
      return { ...withInstants(t, opts.tz), reminders: dhikrReminders({ timings: t, tz: opts.tz, prefs, settings }), ...(jumua?.today ? { jumua: { ...jumua, mosque: mosque.name } } : {}) };
    }),
    periodDhikr: prefs.dhikrDuringPeriod ? settings.dhikrDuringPeriod : null,
    // Adhan joué à l'heure de chaque prière (fichiers Aladhan) ; null si le son est désactivé.
    adhan: adhanFor(prefs),
  });
});

// Cocher une prière (5.7). Pendant les règles, aucune prière n'est comptée comme manquée (RG-15, RG-20).
router.put('/check', validate(z.object({ day: z.string().refine(isDay), prayer: z.enum(PRAYERS), done: z.boolean() })), async (req, res) => {
  const log = await PrayerLog.findOneAndUpdate({ user: req.user._id, day: req.body.day }, { $set: { [req.body.prayer]: req.body.done } }, { upsert: true, new: true }).lean();
  res.json(Object.fromEntries(PRAYERS.map((p) => [p, Boolean(log[p])])));
});

// Statistiques de régularité sur la semaine (les jours de règles sont exclus).
router.get('/stats', async (req, res) => {
  const ctx = await loadCycleContext(req.user);
  const from = addDays(ctx.today, -6);
  const logs = await PrayerLog.find({ user: req.user._id, day: { $gte: from, $lte: ctx.today } }).lean();
  const excused = new Set();
  for (const p of ctx.periods) {
    for (let d = from; d <= ctx.today; d = addDays(d, 1)) if (d >= p.start && d <= (p.end || ctx.today)) excused.add(d);
  }
  const days = [];
  for (let d = from; d <= ctx.today; d = addDays(d, 1)) {
    const log = logs.find((l) => l.day === d);
    days.push({ day: d, excused: excused.has(d), done: PRAYERS.filter((p) => log?.[p]).length });
  }
  const counted = days.filter((d) => !d.excused);
  const total = counted.length * 5;
  const done = counted.reduce((a, d) => a + d.done, 0);
  res.json({ days, rate: total ? Math.round((done / total) * 100) : null, done, total });
});

export default router;

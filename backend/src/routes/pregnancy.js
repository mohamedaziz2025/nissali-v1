// 5.6 / 6.7 — Mode grossesse et post-partum.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireHealthConsent } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Appointment, Period, Pregnancy } from '../models/index.js';
import { FASTING_PREGNANCY_INFO, PREGNANCY_DUAS, weekContent } from '../content/pregnancy.js';
import { nowFor } from '../services/context.js';
import { pregnancyStatus } from '../services/pregnancyCalc.js';
import { getSettings } from '../services/settings.js';
import { isDay } from '../utils/dates.js';
import { badRequest, notFound } from '../utils/http.js';
import { sessionPayload } from './auth.js';

const router = Router();
router.use(requireAuth, requireHealthConsent);

const day = z.string().refine(isDay, 'Date invalide');

async function payload(user) {
  const settings = await getSettings();
  const { today } = nowFor(user);
  const p = await Pregnancy.findOne({ user: user._id, status: 'active' }).sort({ createdAt: -1 });
  if (!p) return { active: false, mode: user.mode, deliveryDate: user.deliveryDate, maxNifasDays: settings.maxNifasDays };
  const status = pregnancyStatus({ lmp: p.lmp, conceptionDate: p.conceptionDate, dueDate: p.dueDate, cycleLength: p.cycleLength, termRule: settings.termRule }, today);
  return {
    active: true,
    mode: user.mode,
    pregnancy: { id: p.id, lmp: p.lmp, conceptionDate: p.conceptionDate, dueDate: p.dueDate, echoDate: p.echoDate, cycleLength: p.cycleLength },
    status,
    week: status ? weekContent(status.sa.weeks) : null,
    duas: PREGNANCY_DUAS,
    fastingInfo: FASTING_PREGNANCY_INFO,
    appointments: await Appointment.find({ user: user._id, day: { $gte: today }, status: 'prevu' }).sort({ day: 1 }).limit(10).lean(),
  };
}

router.get('/', async (req, res) => {
  res.json(await payload(req.user));
});

const startSchema = z
  .object({ lmp: day.optional(), conceptionDate: day.optional(), dueDate: day.optional(), echoDate: day.optional(), cycleLength: z.number().int().min(20).max(45).optional() })
  .refine((v) => v.lmp || v.conceptionDate || v.dueDate, 'Indique la date des dernières règles, de début de grossesse ou du terme');

router.post('/', validate(startSchema), async (req, res) => {
  await Pregnancy.updateMany({ user: req.user._id, status: 'active' }, { $set: { status: 'arretee' } });
  await Pregnancy.create({ user: req.user._id, ...req.body, cycleLength: req.body.cycleLength || req.user.onboarding?.cycleLength || 28 });
  req.user.mode = 'grossesse';
  await req.user.save();
  res.status(201).json({ ...(await payload(req.user)), session: await sessionPayload(req.user) });
});

router.patch('/', validate(z.object({ lmp: day.nullable(), conceptionDate: day.nullable(), dueDate: day.nullable(), echoDate: day.nullable(), cycleLength: z.number().int().min(20).max(45) }).partial()), async (req, res) => {
  const p = await Pregnancy.findOne({ user: req.user._id, status: 'active' });
  if (!p) throw notFound('Aucune grossesse en cours');
  for (const [k, v] of Object.entries(req.body)) p[k] = v === null ? undefined : v;
  if (!p.lmp && !p.conceptionDate && !p.dueDate) throw badRequest('Il faut au moins une date de référence');
  await p.save();
  res.json(await payload(req.user));
});

// Fin de grossesse : naissance (→ post-partum et nifas), fausse couche (message bienveillant) ou arrêt.
router.post('/end', validate(z.object({ outcome: z.enum(['naissance', 'fausse_couche', 'arretee']), date: day.optional() })), async (req, res) => {
  const settings = await getSettings();
  const { today } = nowFor(req.user);
  const date = req.body.date || today;
  const p = await Pregnancy.findOne({ user: req.user._id, status: 'active' });
  if (p) {
    p.status = req.body.outcome;
    p.endedOn = date;
    await p.save();
  }
  let message = null;
  if (req.body.outcome === 'naissance') {
    req.user.mode = 'postpartum';
    req.user.deliveryDate = date;
    await Period.create({ user: req.user._id, kind: 'nifas', start: date, source: 'saisie' });
    message = 'Félicitations ! Le suivi du nifas commence : tes rappels de prière sont en pause et tes jours de Ramadan éventuels seront comptés.';
  } else {
    req.user.mode = 'cycle';
    if (req.body.outcome === 'fausse_couche') message = settings.miscarriageInfo;
  }
  await req.user.save();
  res.json({ message, session: await sessionPayload(req.user) });
});

// Fin du nifas (avec l'heure pour les prières à accomplir).
router.post('/nifas/end', validate(z.object({ day: day.optional(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional() })), async (req, res) => {
  const { today } = nowFor(req.user);
  const nifas = await Period.findOne({ user: req.user._id, kind: 'nifas', end: { $exists: false } }).sort({ start: -1 });
  if (!nifas) throw notFound('Aucun nifas en cours');
  nifas.end = req.body.day || today;
  nifas.endTime = req.body.time;
  await nifas.save();
  res.json({ ok: true, period: nifas.toPlain() });
});

// Retour au suivi du cycle après le post-partum.
router.post('/resume-cycle', async (req, res) => {
  req.user.mode = 'cycle';
  await req.user.save();
  res.json(await sessionPayload(req.user));
});

export default router;

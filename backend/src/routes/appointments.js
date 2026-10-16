// Rendez-vous médicaux notés par l'utilisatrice (5.6).
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Appointment } from '../models/index.js';
import { isDay, isTime } from '../utils/dates.js';
import { notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  day: z.string().refine(isDay, 'Date invalide'),
  time: z.string().refine(isTime, 'Heure invalide').optional(),
  notes: z.string().max(500).optional(),
  status: z.enum(['prevu', 'annule', 'termine']).optional(),
});

router.get('/', async (req, res) => {
  res.json(await Appointment.find({ user: req.user._id }).sort({ day: 1, time: 1 }).lean());
});

router.post('/', validate(schema), async (req, res) => {
  res.status(201).json(await Appointment.create({ ...req.body, user: req.user._id }));
});

router.patch('/:id', validate(schema.partial()), async (req, res) => {
  const a = await Appointment.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: req.body }, { new: true });
  if (!a) throw notFound();
  res.json(a);
});

router.delete('/:id', async (req, res) => {
  await Appointment.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ ok: true });
});

export default router;

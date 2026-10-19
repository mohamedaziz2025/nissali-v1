// 5.2 bis — Mes notes : n'importe quelle date, type, heure facultative, répétition, calendrier, rappel.
// Chaque note peut être modifiée, mise en pause ou supprimée (une occurrence ou toute la série).
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Note, NOTE_REPEATS, NOTE_TYPES } from '../models/index.js';
import { nowFor } from '../services/context.js';
import { noteDays, plainNote, upcomingNotes } from '../services/notes.js';
import { seal } from '../services/secretBox.js';
import { addDays } from '../utils/dates.js';
import { badRequest, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide');
const noteSchema = z
  .object({
    text: z.string().trim().min(1, 'Écris ta note').max(300),
    type: z.enum(NOTE_TYPES).default('autre'),
    day: DAY,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide').nullable().optional(),
    repeat: z.enum(NOTE_REPEATS).default('once'),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    until: DAY.nullable().optional(),
    showInCalendar: z.boolean().default(true),
    remind: z.boolean().default(false),
    paused: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.until && v.until < v.day) ctx.addIssue({ code: 'custom', path: ['until'], message: 'La date de fin est avant la première date' });
    if (v.remind && !v.time) ctx.addIssue({ code: 'custom', path: ['time'], message: 'Choisis une heure pour le rappel' });
  });

const fields = (b) => ({
  ...(b.text !== undefined ? { text: seal(b.text) } : {}),
  ...Object.fromEntries(['type', 'day', 'time', 'repeat', 'weekdays', 'until', 'showInCalendar', 'remind', 'paused'].filter((k) => b[k] !== undefined).map((k) => [k, b[k]])),
});

// Liste « Mes notes à venir » (avec les notes en pause) et toutes les séries.
router.get('/', async (req, res) => {
  const { today } = nowFor(req.user);
  const days = Math.min(Number(req.query.days) || 60, 366);
  const [upcoming, notes] = await Promise.all([upcomingNotes(req.user._id, today, { days, limit: 200, withPaused: true }), Note.find({ user: req.user._id }).sort({ day: -1 }).lean()]);
  res.json({ today, upcoming, notes: notes.map(plainNote) });
});

// Points du calendrier du Cycle.
router.get('/calendar', async (req, res) => {
  const from = DAY.safeParse(req.query.from).success ? req.query.from : addDays(nowFor(req.user).today, -40);
  const to = DAY.safeParse(req.query.to).success ? req.query.to : addDays(from, 120);
  if (to < from || to > addDays(from, 400)) throw badRequest('Période invalide');
  res.json({ days: await noteDays(req.user._id, from, to) });
});

// Occurrences à venir avec rappel (notifications programmées sur le téléphone).
router.get('/reminders', async (req, res) => {
  const { today } = nowFor(req.user);
  const items = await upcomingNotes(req.user._id, today, { days: 7, limit: 40 });
  res.json({ items: items.filter((n) => n.remind && n.time).map((n) => ({ noteId: n.noteId, day: n.day, time: n.time, text: n.text, type: n.type })) });
});

router.get('/:id', async (req, res) => {
  const n = await Note.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!n) throw notFound('Note introuvable');
  res.json(plainNote(n));
});

router.post('/', validate(noteSchema), async (req, res) => {
  if ((await Note.countDocuments({ user: req.user._id })) >= 300) throw badRequest('Tu as déjà 300 notes : supprimes-en avant d’en ajouter');
  const n = await Note.create({ user: req.user._id, ...fields(req.body) });
  res.status(201).json(plainNote(n));
});

router.patch('/:id', validate(noteSchema.innerType().partial()), async (req, res) => {
  const n = await Note.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) throw notFound('Note introuvable');
  n.set(fields(req.body));
  if (n.until && n.until < n.day) throw badRequest('La date de fin est avant la première date');
  if (n.remind && !n.time) throw badRequest('Choisis une heure pour le rappel');
  await n.save();
  res.json(plainNote(n));
});

// ?day=YYYY-MM-DD : supprime seulement cette occurrence ; sinon toute la série.
router.delete('/:id', async (req, res) => {
  const n = await Note.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) throw notFound('Note introuvable');
  if (req.query.day && n.repeat !== 'once') {
    if (!DAY.safeParse(req.query.day).success) throw badRequest('Date invalide');
    n.skips = [...new Set([...(n.skips || []), req.query.day])];
    await n.save();
    return res.json({ ok: true, note: plainNote(n) });
  }
  await n.deleteOne();
  res.json({ ok: true });
});

export default router;

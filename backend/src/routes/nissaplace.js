// 5.11 — Lifestyle › NissaPlace : promotion de nissaplace.fr (shopping pour femmes) et demande d'une sœur
// pour ouvrir sa boutique, en attente de validation par l'équipe.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ShopRequest, User } from '../models/index.js';
import { notify } from '../services/notifications.js';
import { conflict } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const requestSchema = z.object({
  shopName: z.string().trim().min(2, 'Nom de boutique trop court').max(80),
  activity: z.string().trim().max(120).optional().default(''),
  description: z.string().trim().max(2000).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  instagramUrl: z.string().trim().max(300).optional().default(''),
  websiteUrl: z.string().trim().max(300).optional().default(''),
});

const present = (r) => ({ ...r, id: String(r._id || r.id) });

// Catalogue des marques NissaPlace : fiches validées et publiées par l'équipe, chacune renvoyant vers son
// propre site (ou à défaut son Instagram) ; l'achat se fait sur nissaplace.fr, jamais dans l'appli.
router.get('/brands', async (req, res) => {
  const filter = { status: 'validee', listed: true };
  if (req.query.category) filter.category = String(req.query.category);
  const q = String(req.query.q || '').trim();
  if (q) filter.shopName = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const items = await ShopRequest.find(filter).sort({ shopName: 1 }).select('shopName activity category imageUrl websiteUrl instagramUrl').lean();
  res.json({ items: items.map((r) => ({ id: String(r._id), shopName: r.shopName, activity: r.activity, category: r.category, imageUrl: r.imageUrl, websiteUrl: r.websiteUrl || r.instagramUrl })) });
});

router.get('/mine', async (req, res) => {
  const items = await ShopRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json(items.map(present));
});

// « Rejoindre NissaPlace » (RG-47-like) : une seule demande en attente à la fois.
router.post('/', validate(requestSchema), async (req, res) => {
  const existing = await ShopRequest.findOne({ user: req.user._id, status: 'en_attente' });
  if (existing) throw conflict('Tu as déjà une demande en cours d’examen', 'REQUEST_PENDING');
  const request = await ShopRequest.create({ ...req.body, user: req.user._id });
  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  for (const a of admins) {
    await notify(
      a._id,
      { key: `nissaplace-request-${request.id}`, type: 'nissaplace', title: 'Nissali', body: 'Nouvelle demande NissaPlace', detail: `« ${request.shopName} » proposée par ${req.user.firstName}.`, link: '/admin/nissaplace' },
      { sendPush: false },
    );
  }
  res.status(201).json(present(request.toObject()));
});

export default router;

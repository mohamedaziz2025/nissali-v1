// 5.11 — Lifestyle › NissaPlace : promotion de nissaplace.fr (shopping pour femmes) et demande d'une sœur
// pour ouvrir sa boutique, en attente de validation par l'équipe.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ShopRequest, User } from '../models/index.js';
import { notify } from '../services/notifications.js';
import { nissaplaceCategories, nissaplaceShops, presentCategory, presentShop } from '../services/nissaplace.js';
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

// Catalogue des marques : récupéré en direct depuis nissaplace.fr (boutiques et catégories), jamais saisi
// à la main ; chaque fiche renvoie vers sa page sur nissaplace.fr où se fait l'achat.
router.get('/categories', async (_req, res) => {
  const cats = await nissaplaceCategories();
  res.json({ items: cats.map(presentCategory) });
});

router.get('/brands', async (req, res) => {
  const shops = await nissaplaceShops();
  const q = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || '');
  const items = shops
    .filter((sh) => sh.status === 'APPROVED')
    .filter((sh) => !category || sh.categorySlug === category || sh.categoryId?.slug === category)
    .filter((sh) => !q || sh.name.toLowerCase().includes(q))
    .map(presentShop)
    .sort((a, b) => a.shopName.localeCompare(b.shopName, 'fr'));
  res.json({ items });
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

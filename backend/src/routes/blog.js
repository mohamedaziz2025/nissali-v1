// 5.11 — Blog : catégories, recherche, article à la une, article du jour adapté à la phase.
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { Article } from '../models/index.js';
import { articleCategories, categoryLabels } from '../services/articleCategories.js';
import { loadCycleContext } from '../services/context.js';
import { escapeRegex, notFound } from '../utils/http.js';

const router = Router();

// 4.13 · 8.3 — deux étapes seulement : Brouillon → Publié (immédiat ou programmé), pas de relecture obligatoire.
const visible = () => ({ published: true, publishAt: { $lte: new Date() } });
let LABELS = {};
const card = (a) => ({
  id: String(a._id),
  slug: a.slug,
  title: a.title,
  category: a.category,
  categoryLabel: LABELS[a.category] || a.category,
  excerpt: a.excerpt,
  readMinutes: a.readMinutes,
  featured: a.featured,
  validation: a.validation,
  reviewer: a.reviewer,
  color: a.color,
  coverUrl: a.coverUrl || null,
  coverAlt: a.coverAlt || '',
  coverCredit: a.coverCredit || '',
});

// Libellés à jour avant chaque réponse (catégories modifiables dans le back-office).
router.use(async (_req, _res, next) => {
  LABELS = await categoryLabels().catch(() => LABELS);
  next();
});

router.get('/categories', async (_req, res) => {
  res.json((await articleCategories()).map((c) => ({ key: c.key, label: c.label })));
});

router.get('/', authenticate, async (req, res) => {
  const filter = visible();
  if (req.query.category && LABELS[req.query.category]) filter.category = req.query.category;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i');
    filter.$or = [{ title: rx }, { excerpt: rx }, { body: rx }];
  }
  const articles = await Article.find(filter).sort({ featured: -1, publishAt: -1 }).limit(100).lean();
  const featured = !req.query.q && !req.query.category ? articles.find((a) => a.featured) : null;

  // Article du jour adapté à la phase du cycle.
  let daily = null;
  if (req.user?.consents?.health?.accepted && !req.query.q) {
    const ctx = await loadCycleContext(req.user).catch(() => null);
    const phase = ctx?.summary?.phase;
    if (phase) {
      const forPhase = await Article.find({ ...visible(), phases: phase }).lean();
      if (forPhase.length) daily = { phase, article: card(forPhase[new Date().getUTCDate() % forPhase.length]) };
    }
  }
  res.json({ featured: featured ? card(featured) : null, daily, items: articles.filter((a) => a !== featured).map(card) });
});

router.get('/:slug', async (req, res) => {
  const a = await Article.findOneAndUpdate({ slug: req.params.slug, ...visible() }, { $inc: { views: 1 } }, { new: true }).lean();
  if (!a) throw notFound('Article introuvable');
  const related = await Article.find({ ...visible(), category: a.category, _id: { $ne: a._id } }).limit(3).lean();
  res.json({ ...card(a), body: a.body, sources: a.sources, publishAt: a.publishAt, related: related.map(card) });
});

export default router;

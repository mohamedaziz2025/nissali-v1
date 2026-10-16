// Conseil santé du jour (RG-08 ter) : un conseil de la bibliothèque, selon la phase du cycle (ou la grossesse).
import { Article, HealthTip } from '../models/index.js';
import { HEALTH_TIPS } from '../content/healthTips.js';

let cache = { at: 0, tips: null };

async function allTips() {
  if (cache.tips && Date.now() - cache.at < 5 * 60_000) return cache.tips;
  const tips = await HealthTip.find({ active: true }).sort({ createdAt: 1 }).lean();
  cache = { at: Date.now(), tips };
  return tips;
}
export const forgetTips = () => (cache = { at: 0, tips: null });

// 15 / 16 — Article lié à un conseil : uniquement celui choisi dans le back-office (ou aucun).
// Jamais d'article choisi au hasard ni « le plus proche » : sans lien, le conseil reste autonome.
const visibleArticle = { published: true, validation: { $in: ['valide_comite', 'valide_sante'] } };

async function articleFor(tip) {
  if (!tip.articleSlug) return null;
  return Article.findOne({ ...visibleArticle, slug: tip.articleSlug, publishAt: { $lte: new Date() } }).select('slug title readMinutes coverUrl coverAlt').lean();
}

const dayIndex = (day) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

export async function tipOfTheDay(phase, day) {
  const key = phase || 'folliculaire';
  const fromDb = (await allTips()).filter((t) => t.phase === key);
  const list = fromDb.length ? fromDb : (HEALTH_TIPS[key] || []).map((t) => ({ ...t, phase: key, reviewed: false }));
  if (!list.length) return null;
  const tip = list[dayIndex(day) % list.length];
  const a = await articleFor(tip);
  return {
    id: tip._id ? String(tip._id) : null,
    phase: key,
    title: tip.title,
    text: tip.text,
    theme: tip.theme,
    // « En savoir plus » : seulement si un article approfondit réellement le même sujet.
    article: a ? { slug: a.slug, title: a.title, readMinutes: a.readMinutes, coverUrl: a.coverUrl || null, coverAlt: a.coverAlt || '' } : null,
    reviewed: Boolean(tip.reviewed),
  };
}

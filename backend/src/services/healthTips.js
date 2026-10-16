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

// Article lié à un conseil (5.2 « Ouvre l'article lié dans Lifestyle ») : celui du conseil s'il est publié,
// sinon l'article de son thème, sinon le plus proche selon le thème et la phase.
const THEME = {
  alimentation: 'bien-manger-au-fil-du-cycle',
  activite: 'bouger-au-fil-du-cycle',
  hydratation: 'bien-s-hydrater-au-quotidien',
  bien_etre: 'prendre-soin-de-soi-au-fil-du-cycle',
  sommeil: 'sommeil-et-cycle',
  douleurs: 'soulager-les-douleurs-de-regles',
};
const NEAREST = {
  alimentation: { menstruelle: 'alimentation-et-fer', luteale: 'syndrome-premenstruel', grossesse: 'premier-trimestre-de-grossesse' },
  activite: { menstruelle: 'soulager-les-douleurs-de-regles', luteale: 'syndrome-premenstruel', grossesse: 'premier-trimestre-de-grossesse' },
  hydratation: { menstruelle: 'soulager-les-douleurs-de-regles', luteale: 'syndrome-premenstruel', grossesse: 'premier-trimestre-de-grossesse' },
  bien_etre: { ovulatoire: 'pertes-blanches-normales', luteale: 'syndrome-premenstruel', grossesse: 'premier-trimestre-de-grossesse' },
  douleurs: { luteale: 'syndrome-premenstruel', ovulatoire: 'mieux-comprendre-son-ovulation' },
  sommeil: {},
};
const visibleArticle = { published: true, validation: { $in: ['valide_comite', 'valide_sante'] } };

async function articleFor(tip, phase) {
  const candidates = [tip.articleSlug, THEME[tip.theme], NEAREST[tip.theme]?.[phase], phase === 'grossesse' ? 'premier-trimestre-de-grossesse' : 'les-4-phases-de-ton-cycle'].filter(Boolean);
  const found = await Article.find({ ...visibleArticle, slug: { $in: candidates }, publishAt: { $lte: new Date() } }).select('slug title readMinutes').lean();
  const bySlug = new Map(found.map((a) => [a.slug, a]));
  const slug = candidates.find((c) => bySlug.has(c));
  return slug ? bySlug.get(slug) : null;
}

const dayIndex = (day) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

export async function tipOfTheDay(phase, day) {
  const key = phase || 'folliculaire';
  const fromDb = (await allTips()).filter((t) => t.phase === key);
  const list = fromDb.length ? fromDb : (HEALTH_TIPS[key] || []).map((t) => ({ ...t, phase: key, reviewed: false }));
  if (!list.length) return null;
  const tip = list[dayIndex(day) % list.length];
  const article = await articleFor(tip, key);
  return { id: tip._id ? String(tip._id) : null, phase: key, title: tip.title, text: tip.text, theme: tip.theme, articleSlug: article?.slug || null, articleTitle: article?.title || null, articleMinutes: article?.readMinutes || null, reviewed: Boolean(tip.reviewed) };
}

// 4.13 · 8.3 — catégories du Magazine (back-office), remplies au premier lancement avec les catégories de départ.
import { Article, ArticleCategory, CATEGORIES } from '../models/index.js';

export async function articleCategories({ withHidden = false } = {}) {
  if ((await ArticleCategory.estimatedDocumentCount()) === 0) {
    await ArticleCategory.insertMany(Object.entries(CATEGORIES).map(([key, label], order) => ({ key, label, order })), { ordered: false }).catch(() => {});
  }
  const list = await ArticleCategory.find(withHidden ? {} : { hidden: false }).sort({ order: 1, createdAt: 1 }).lean();
  return list;
}

export async function categoryLabels() {
  const list = await articleCategories({ withHidden: true });
  return Object.fromEntries(list.map((c) => [c.key, c.label]));
}

/** Clé lisible et unique à partir du nom (« Bien-être » → bien-etre). */
export async function categoryKey(label) {
  const base = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'categorie';
  let key = base;
  for (let i = 2; await ArticleCategory.exists({ key }); i += 1) key = `${base}-${i}`;
  return key;
}

export const articlesIn = (key) => Article.countDocuments({ category: key });

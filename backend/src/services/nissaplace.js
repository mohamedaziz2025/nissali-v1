// Catalogue NissaPlace : récupéré en direct depuis l'API publique de nissaplace.fr (boutiques et
// catégories), avec un court cache mémoire pour éviter de solliciter le site à chaque ouverture de l'onglet.
// L'achat se fait toujours sur nissaplace.fr : l'appli ne fait que renvoyer vers la fiche boutique.
const BASE = 'https://nissaplace.fr';
const TTL = 5 * 60_000;

let shopsCache = null; // { at, data }
let categoriesCache = null;

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`NissaPlace ${path} : ${res.status}`);
  return res.json();
}

async function withCache(get, set, path) {
  const cached = get();
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  try {
    const data = await getJson(path);
    set({ at: Date.now(), data });
    return data;
  } catch (err) {
    if (cached) return cached.data; // nissaplace.fr indisponible : on sert la dernière version connue
    throw err;
  }
}

export const nissaplaceShops = () =>
  withCache(
    () => shopsCache,
    (v) => (shopsCache = v),
    '/api/shops',
  );

export const nissaplaceCategories = () =>
  withCache(
    () => categoriesCache,
    (v) => (categoriesCache = v),
    '/api/categories',
  );

const imageUrl = (p) => (p ? `${BASE}/api${p}` : '');

export const presentShop = (s) => ({
  id: s._id,
  shopName: s.name,
  description: s.description,
  imageUrl: imageUrl(s.bannerMobile || s.bannerDesktop || s.logo),
  category: s.categorySlug || s.categoryId?.slug || '',
  categoryName: s.categoryName || s.categoryId?.name || '',
  totalProducts: s.totalProducts || 0,
  websiteUrl: `${BASE}/shops/${s.slug}`,
});

export const presentCategory = (c) => ({ key: c.slug, label: c.name, color: c.color });

// 4.13 / RG-41 — Bibliothèque des dhikr (back-office), gardée en mémoire. Au premier lancement, elle est remplie
// avec les dhikr validés du contenu de départ. Les dhikr personnels (RG-48) vivent sur le compte de l'utilisatrice.
import { DEFAULT_DHIKR, DHIKR_CATALOG } from '../content/dhikr.js';
import { DhikrEntry } from '../models/index.js';

let cache = null;

export async function loadDhikrCatalog() {
  if ((await DhikrEntry.estimatedDocumentCount()) === 0) {
    await DhikrEntry.insertMany(DHIKR_CATALOG.map((d, i) => ({ ...d, order: i, isDefault: DEFAULT_DHIKR.includes(d.key), validatedBy: 'Comité (contenu de départ)' })), { ordered: false }).catch(() => {});
  }
  const all = await DhikrEntry.find().sort({ order: 1, createdAt: 1 }).lean();
  cache = {
    all,
    byKey: new Map(all.map((d) => [d.key, d])),
    published: all.filter((d) => d.published),
    defaults: all.filter((d) => d.published && d.isDefault).sort((a, b) => DEFAULT_DHIKR.indexOf(a.key) - DEFAULT_DHIKR.indexOf(b.key) || a.order - b.order),
  };
  return cache;
}

/** Catalogue en mémoire (chargé au besoin). */
export async function dhikrCatalog() {
  return cache || loadDhikrCatalog();
}

/** À appeler après une modification dans le back-office. */
export function invalidateDhikrCatalog() {
  cache = null;
}

// Migrations de démarrage, idempotentes : jouées une seule fois (repère : le métier « autre » existe).
import { Category, Practitioner } from '../models/index.js';
import { CATEGORIES_SEED, LEGACY_SPECIALTIES } from '../seed/data.js';
import { loadDhikrCatalog } from './dhikrCatalog.js';

/** 5.10 V4 — métiers non médicaux : liste à jour, anciens métiers désactivés, fiches rattachées au nouveau métier. */
export async function migrateV4Categories() {
  if (await Category.exists({ key: 'autre' })) return; // déjà faite : la liste est ensuite gérée dans le back-office
  const keys = CATEGORIES_SEED.map((c) => c.key);
  for (const c of CATEGORIES_SEED) await Category.updateOne({ key: c.key }, { $set: { ...c, active: true } }, { upsert: true });
  await Category.updateMany({ key: { $nin: keys } }, { $set: { active: false } });
  for (const [from, to] of Object.entries(LEGACY_SPECIALTIES)) {
    if (!keys.includes(from)) await Practitioner.updateMany({ specialty: from }, { $set: { specialty: to, categories: [to] } });
  }
  console.log('[migration] métiers V4 en place');
}

export async function runStartupMigrations() {
  await migrateV4Categories().catch((e) => console.error('[migration] métiers V4 :', e.message));
  await loadDhikrCatalog().catch((e) => console.error('[migration] dhikr :', e.message));
}

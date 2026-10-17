// Synchronisation des heures de Jumu'a avec Mawaqit (API partenaire : jeton MAWAQIT_API_TOKEN obligatoire).
// Sans jeton, rien n'est appelé : les heures saisies dans le back-office restent la référence.
// ⚠️ Non testé contre l'API réelle (jeton partenaire indisponible au moment de l'écriture) : les noms de
// champs lus (uuid, jumua, jumua2) suivent la documentation publique de Mawaqit et sont lus de façon tolérante.
import { env } from '../config/env.js';
import { Mosque } from '../models/index.js';
import { forgetMosque } from './prayerSource.js';

export const mawaqitEnabled = () => Boolean(env.mawaqitToken);

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hhmm = (v) => {
  const m = String(v || '').match(/^(\d{1,2})[:h](\d{2})/);
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};

async function api(path) {
  const r = await fetch(`${env.mawaqitBase}${path}`, { headers: { 'Api-Access-Token': env.mawaqitToken, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`Mawaqit ${r.status}`);
  return r.json();
}

/** Trouve la mosquée Mawaqit correspondant à une mosquée Nissali (même ville, nom proche, puis la plus proche). */
export async function findMawaqitMosque(m) {
  const list = await api(`/mosque/search?word=${encodeURIComponent(m.name)}`);
  const items = Array.isArray(list) ? list : list?.data || [];
  const city = norm(m.city);
  const name = norm(m.name);
  const scored = items
    .map((x) => ({ x, s: (norm(x.localisation || x.city || '').includes(city) ? 2 : 0) + (norm(x.name) === name ? 3 : norm(x.name).includes(name) || name.includes(norm(x.name)) ? 1 : 0) + (Number.isFinite(x.latitude) ? -Math.hypot(x.latitude - m.lat, x.longitude - m.lng) : 0) }))
    .sort((a, b) => b.s - a.s);
  return scored[0]?.s >= 2 ? scored[0].x : null;
}

/** Met à jour jumua / jumua2 d'une mosquée partenaire depuis Mawaqit. Renvoie { ok, jumua, jumua2 } ou { ok:false, reason }. */
export async function syncMosqueJumua(mosque) {
  if (!mawaqitEnabled()) return { ok: false, reason: 'MAWAQIT_API_TOKEN absent' };
  const found = await findMawaqitMosque(mosque);
  if (!found) return { ok: false, reason: 'Mosquée introuvable sur Mawaqit' };
  const jumua = hhmm(found.jumua);
  const jumua2 = hhmm(found.jumua2);
  if (!jumua) return { ok: false, reason: 'Heure de Jumu’a non publiée sur Mawaqit' };
  await Mosque.updateOne({ _id: mosque._id }, { $set: { jumua, jumua2: jumua2 || '', mawaqitId: found.uuid || found.id || '', mawaqitSyncedAt: new Date() } });
  forgetMosque(mosque._id);
  return { ok: true, jumua, jumua2 };
}

export async function syncAllJumua() {
  if (!mawaqitEnabled()) return { synced: 0, failed: 0 };
  let synced = 0;
  let failed = 0;
  for (const m of await Mosque.find({ partner: true, active: true }).lean()) {
    try {
      (await syncMosqueJumua(m)).ok ? (synced += 1) : (failed += 1);
    } catch (e) {
      failed += 1;
      console.error('[mawaqit]', m.name, e.message);
    }
  }
  console.log(`[mawaqit] Jumu'a synchronisée : ${synced} mosquée(s), ${failed} sans résultat`);
  return { synced, failed };
}

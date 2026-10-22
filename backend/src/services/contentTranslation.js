// Traduction des contenus en base, en trois langues (français, anglais, arabe), par le script
// `npm run translate:content` (et la tâche de nuit). Chaque texte est enregistré dans sa langue d'origine
// (détectée) et dans les deux autres : si la limite DeepL est atteinte, ce qui est déjà en base reste disponible.
// Sans DeepL, rien ne casse : la langue manquante reçoit le texte d'origine (en attente) puis est retraduite plus tard.
// Les données privées (notes, messages, journal de santé, fiches clientes) ne sont jamais envoyées à DeepL.
import { GHUSL_STEPS, HEALTH_ALERTS, PHASES } from '../content/phases.js';
import { env } from '../config/env.js';
import { Article, ArticleCategory, Broadcast, Category, DhikrEntry, Event, HealthTip, Notification, Plan, Practitioner, Reminder, Review, Service, Setting, Translation } from '../models/index.js';
import { deeplTranslate, hashText, isArabicOnly, LANGS, QuotaError } from './deepl.js';

// Contenus publics traduits : modèle, filtre, champs (les tableaux de textes sont acceptés).
const SOURCES = [
  { model: Article, name: 'Article', filter: { published: true }, fields: ['title', 'excerpt', 'body', 'coverAlt', 'reviewer'] },
  { model: ArticleCategory, name: 'ArticleCategory', filter: {}, fields: ['label'] },
  { model: HealthTip, name: 'HealthTip', filter: {}, fields: ['title', 'text'] },
  { model: Broadcast, name: 'Broadcast', filter: {}, fields: ['title', 'body', 'detail'] },
  { model: Event, name: 'Event', filter: { status: { $in: ['publie', 'annule'] } }, fields: ['title', 'description', 'programme', 'cancellationPolicy'] },
  { model: Category, name: 'Category', filter: {}, fields: ['label', 'description', 'disclaimer'] },
  { model: Plan, name: 'Plan', filter: {}, fields: ['name', 'tagline'] },
  { model: Practitioner, name: 'Practitioner', filter: { status: 'validee' }, fields: ['description'] },
  { model: Service, name: 'Service', filter: {}, fields: ['name', 'description'] },
  { model: Review, name: 'Review', filter: {}, fields: ['comment', 'reply'] },
  { model: DhikrEntry, name: 'DhikrEntry', filter: {}, fields: ['meaning'] },
  { model: Reminder, name: 'Reminder', filter: {}, fields: ['text'] },
  { model: Notification, name: 'Notification', filter: {}, fields: ['title', 'body', 'detail'], distinct: true },
];

const MAX_BATCH = 40;
const MAX_CHARS = 25_000;

const BRAND = new Set(['Nissali', 'NissaPlace', 'Nissali Pro']);
const worthTranslating = (t) => typeof t === 'string' && !BRAND.has(t.trim()) && t.trim().length >= 2 && /[A-Za-zÀ-ÿ؀-ۿ]{2}/.test(t) && !isArabicOnly(t) && !/^(https?:|\/)/.test(t.trim());

/** Tous les textes publics à avoir en trois langues : Map(empreinte → { text, origin }). */
export async function collectTexts() {
  const texts = new Map();
  const add = (text, origin) => {
    if (!worthTranslating(text)) return;
    const t = text.trim();
    const h = hashText(t);
    if (!texts.has(h)) texts.set(h, { text: t, origin });
  };
  for (const s of SOURCES) {
    if (s.distinct) {
      for (const f of s.fields) for (const v of await s.model.distinct(f, s.filter)) add(v, `${s.name}.${f}`);
      continue;
    }
    const docs = await s.model.find(s.filter).select(s.fields.join(' ')).lean();
    for (const d of docs) for (const f of s.fields) [].concat(d[f] ?? []).forEach((v) => add(v, `${s.name}.${f}`));
  }
  // Réglages religieux et textes affichés (back-office) : valeurs texte seulement.
  for (const st of await Setting.find().lean()) if (typeof st.value === 'string' && /\s/.test(st.value)) add(st.value, `Setting.${st.key}`);
  // Contenus livrés avec l'API : phases du cycle, alertes santé, étapes du ghusl.
  for (const p of Object.values(PHASES)) {
    add(p.label, 'phases.label');
    add(p.short, 'phases.short');
    add(p.what, 'phases.what');
    [].concat(p.tips || []).forEach((t) => add(t, 'phases.tips'));
  }
  Object.values(HEALTH_ALERTS).forEach((t) => add(t, 'HEALTH_ALERTS'));
  [].concat(GHUSL_STEPS).forEach((t) => add(typeof t === 'string' ? t : t?.text, 'GHUSL_STEPS'));
  return texts;
}

function batches(items, size = (x) => x.text.length) {
  const out = [];
  let cur = [];
  let chars = 0;
  for (const it of items) {
    if (cur.length && (cur.length >= MAX_BATCH || chars + size(it) > MAX_CHARS)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(it);
    chars += size(it);
  }
  if (cur.length) out.push(cur);
  return out;
}

async function save(rows) {
  if (!rows.length) return;
  await Translation.bulkWrite(
    rows.map((r) => ({ updateOne: { filter: { hash: r.hash, lang: r.lang }, update: { $set: { pending: false, ...r } }, upsert: true } })),
    { ordered: false },
  );
}

const ARABIC_LETTERS = /[\u0600-\u06FF]/g;
const LATIN_LETTERS = /[A-Za-zÀ-ÿ]/g;
/** Langue probable sans DeepL : arabe si l'écriture arabe domine, sinon français (langue de saisie du back-office). */
const guessLang = (text) => ((text.match(ARABIC_LETTERS) || []).length > (text.match(LATIN_LETTERS) || []).length ? 'ar' : 'fr');

/**
 * Sans DeepL, chaque langue manquante reçoit le texte d'origine, marqué `pending` : la base a toujours les
 * trois langues, et ces lignes seront retraduites au prochain passage où DeepL répond.
 */
async function fillPending(todo, texts, existing) {
  const rows = [];
  for (const h of todo) {
    const e = existing.get(h);
    const { text, origin } = texts.get(h);
    for (const lang of LANGS) {
      if (e?.langs.has(lang) || e?.pending.has(lang)) continue;
      // Langue d'origine connue (détectée par DeepL) : c'est le vrai texte, pas une copie en attente.
      const real = e?.source === lang;
      rows.push({ hash: h, lang, text, origin, pending: !real, ...(real ? { source: lang } : {}) });
    }
  }
  if (!rows.length) return 0;
  await Translation.bulkWrite(
    rows.map((r) => ({ updateOne: { filter: { hash: r.hash, lang: r.lang }, update: { $set: r }, upsert: true } })),
    { ordered: false },
  );
  return rows.length;
}

/**
 * Enregistre les traductions manquantes. Options : { dryRun, log }.
 * Ne lève pas d'erreur si DeepL manque ou ne répond pas : les langues manquantes sont alors enregistrées avec
 * le texte d'origine (en attente). Retourne { texts, done, translated, pending, characters, stopped }.
 */
export async function translateContent({ dryRun = false, log = () => {} } = {}) {
  const texts = await collectTexts();
  const hashes = [...texts.keys()];
  // Langues réellement traduites (les copies en attente ne comptent pas) et langue d'origine détectée.
  const existing = new Map();
  for (const r of await Translation.find({ hash: { $in: hashes } }).select('hash lang source pending').lean()) {
    const e = existing.get(r.hash) || { langs: new Set(), pending: new Set(), source: null };
    if (r.pending) e.pending.add(r.lang);
    else {
      e.langs.add(r.lang);
      if (r.source) e.source = r.source;
    }
    existing.set(r.hash, e);
  }
  const entry = (h) => {
    if (!existing.has(h)) existing.set(h, { langs: new Set(), pending: new Set(), source: null });
    return existing.get(h);
  };
  const todo = hashes.filter((h) => LANGS.some((l) => !existing.get(h)?.langs.has(l)));
  const characters = todo.reduce((n, h) => n + texts.get(h).text.length, 0);
  log(`${texts.size} textes, ${texts.size - todo.length} déjà en 3 langues, ${todo.length} à traduire (≈ ${characters} caractères par langue)`);
  const result = { texts: texts.size, done: texts.size - todo.length, translated: 0, pending: 0, characters, stopped: false };
  if (dryRun || !todo.length) return result;

  try {
    if (!env.deeplKey) throw new Error('DEEPL_API_KEY absente');
    // 1. Langue d'origine inconnue : la traduction vers l'anglais la détecte.
    const unknown = todo.filter((h) => !existing.get(h)?.source).map((h) => ({ hash: h, ...texts.get(h) }));
    let n = 0;
    for (const batch of batches(unknown)) {
      const res = await deeplTranslate(batch.map((b) => b.text), 'en');
      const rows = [];
      batch.forEach((b, i) => {
        // Mots isolés (« Hijama », « Premium »…) : la détection est peu fiable ; les contenus sont saisis en français.
        const source = LANGS.includes(res[i].detected) ? res[i].detected : 'fr';
        const e = entry(b.hash);
        e.source = source;
        rows.push({ hash: b.hash, lang: source, text: b.text, source, origin: b.origin });
        e.langs.add(source);
        if (source !== 'en') {
          rows.push({ hash: b.hash, lang: 'en', text: res[i].text, source, origin: b.origin });
          e.langs.add('en');
        }
      });
      await save(rows);
      n += batch.length;
      log(`  langue détectée et anglais : ${n}/${unknown.length}`);
    }
    // 2. Langues encore manquantes, groupées par langue d'origine.
    for (const lang of LANGS) {
      const groups = new Map();
      for (const h of todo) {
        const e = existing.get(h);
        if (!e || e.langs.has(lang)) continue;
        groups.set(e.source, [...(groups.get(e.source) || []), { hash: h, ...texts.get(h) }]);
      }
      for (const [source, items] of groups) {
        let done = 0;
        for (const batch of batches(items)) {
          const res = await deeplTranslate(batch.map((b) => b.text), lang, { source });
          await save(batch.map((b, i) => ({ hash: b.hash, lang, text: res[i].text, source, origin: b.origin })));
          batch.forEach((b) => existing.get(b.hash).langs.add(lang));
          done += batch.length;
          log(`  ${lang} (depuis ${source}) : ${done}/${items.length}`);
        }
      }
    }
  } catch (err) {
    // Quota atteint, clé absente ou invalide, DeepL injoignable : on ne s'arrête pas sur une erreur.
    result.stopped = true;
    log(`DeepL indisponible (${err instanceof QuotaError ? 'quota atteint' : err.message}) : les langues manquantes sont enregistrées avec le texte d'origine, en attente de traduction.`);
  }
  result.translated = todo.filter((h) => LANGS.every((l) => existing.get(h)?.langs.has(l))).length;
  result.pending = await fillPending(todo, texts, existing);
  if (result.pending) log(`${result.pending} lignes en attente de traduction (texte d'origine en attendant).`);
  return result;
}

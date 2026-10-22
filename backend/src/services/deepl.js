// Client DeepL (traduction des contenus). Utilisé seulement par le script de traduction, jamais pendant une
// requête de l'appli. Les passages en arabe (versets, dhikr, invocations) ne sont jamais traduits : ils sont
// protégés par une balise ignorée par DeepL. La marque Nissali reste écrite en lettres latines.
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

export const LANGS = ['fr', 'en', 'ar'];
const TARGET = { fr: 'FR', en: 'EN-GB', ar: 'AR' };
const CONTEXT =
  'Application Nissali pour femmes musulmanes (cycle, prière, jeûne, santé). Le texte s’adresse toujours à une femme, en la tutoyant : en arabe, utiliser le féminin (أنتِ). Garder les termes religieux usuels (dhikr, ghusl, Ramadan…).';

export class QuotaError extends Error {}

export const hashText = (text) => createHash('sha1').update(String(text).trim()).digest('hex');

// Suite de mots arabes (lettres, voyelles, ﷺ) séparés par des espaces : ni ponctuation latine ni chiffres.
const AR = '\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF';
const ARABIC_RUN = new RegExp(`[${AR}]+(?:[ \\u00A0]+[${AR}]+)*`, 'g');
const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Protège ce qui ne se traduit pas : les passages en arabe. */
export function protect(text) {
  return escapeXml(text)
    .replace(ARABIC_RUN, (m) => `<x>${m}</x>`);
}
export const unprotect = (text) => unescapeXml(text.replace(/<\/?x>/g, ''));

/** La marque reste « Nissali » / « NissaPlace », comme dans le logo, même en arabe. */
const keepBrand = (text) => text.replace(/«\s*نيسا\s?(?:بلاس|بليس)\s*»|نيسا\s?(?:بلاس|بليس)/g, 'NissaPlace').replace(/«\s*نيسالي\s*»|نيسالي/g, 'Nissali');

/** Un texte est-il entièrement en arabe (rien à traduire vers l'arabe, à garder tel quel ailleurs) ? */
export const isArabicOnly = (text) => !/[A-Za-zÀ-ÿ]/.test(text) && /[؀-ۿ]/.test(text);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Traduit une liste de textes vers `lang` (fr, en, ar). Sans `source`, DeepL détecte la langue d'origine.
 * Retourne [{ text, detected }] dans le même ordre.
 */
export async function deeplTranslate(texts, lang, { source } = {}) {
  if (!env.deeplKey) throw new Error('DEEPL_API_KEY manquante dans .env');
  const host = env.deeplKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const body = {
    text: texts.map(protect),
    target_lang: TARGET[lang],
    ...(source ? { source_lang: source.toUpperCase() } : {}),
    tag_handling: 'xml',
    ignore_tags: ['x'],
    split_sentences: '1',
    preserve_formatting: true,
    context: CONTEXT,
  };
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(`${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${env.deeplKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 456) throw new QuotaError('Quota DeepL atteint pour ce mois');
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`DeepL ${res.status} : ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.translations.map((t) => ({ text: keepBrand(unprotect(t.text)), detected: String(t.detected_source_language || '').toLowerCase() }));
  }
}

/** Caractères restants ce mois-ci. */
export async function deeplUsage() {
  const host = env.deeplKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const res = await fetch(`${host}/v2/usage`, { headers: { Authorization: `DeepL-Auth-Key ${env.deeplKey}` } });
  if (!res.ok) throw new Error(`DeepL ${res.status}`);
  return res.json();
}

// Contenus dans la langue de l'utilisatrice : les textes des réponses sont remplacés par leur traduction déjà
// enregistrée en base (collection Translation, remplie par le script `npm run translate:content`). Aucun appel à
// DeepL ici. Sans traduction en base, le texte d'origine est renvoyé tel quel.
// Seulement en lecture (GET) et sur les routes publiques de l'appli : jamais pour le back-office ni pour les
// écrans où l'on modifie ses propres textes (sinon une traduction pourrait remplacer l'original à l'enregistrement).
import { Translation } from '../models/index.js';
import { hashText } from '../services/deepl.js';

export function requestLang(req) {
  const first = String(req.headers['accept-language'] || '').split(',')[0].trim().slice(0, 2).toLowerCase();
  return ['fr', 'en', 'ar'].includes(first) ? first : null;
}

const SKIP_KEYS = new Set(['arabic', 'slug', 'key', 'id', '_id', 'link', 'url', 'imageUrl', 'photoUrl', 'coverUrl', 'ticketUrl', 'videoUrl', 'email', 'phone', 'day', 'time', 'token']);
const candidate = (s) => typeof s === 'string' && s.length >= 2 && s.length <= 20000 && /[A-Za-zÀ-ÿ]{2}/.test(s);

function collect(node, out, key) {
  if (SKIP_KEYS.has(key)) return;
  if (typeof node === 'string') {
    if (candidate(node)) out.add(node.trim());
  } else if (Array.isArray(node)) node.forEach((v) => collect(v, out, key));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) collect(v, out, k);
}

function apply(node, map, key) {
  if (SKIP_KEYS.has(key)) return node;
  if (typeof node === 'string') return map.get(node.trim()) ?? node;
  if (Array.isArray(node)) return node.map((v) => apply(v, map, key));
  if (node && typeof node === 'object' && !(node instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = apply(v, map, k);
    return out;
  }
  return node;
}

/** Remplace les textes traduits en base ; en cas de problème, la réponse d'origine part telle quelle. */
export async function localize(body, lang) {
  const strings = new Set();
  collect(body, strings);
  if (!strings.size) return body;
  const byHash = new Map([...strings].map((s) => [hashText(s), s]));
  const rows = await Translation.find({ hash: { $in: [...byHash.keys()] }, lang }).select('hash text').lean();
  if (!rows.length) return body;
  const map = new Map(rows.map((r) => [byHash.get(r.hash), r.text]));
  return apply(JSON.parse(JSON.stringify(body)), map);
}

export function translateResponse(req, res, next) {
  const lang = requestLang(req);
  if (req.method !== 'GET' || !lang) return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    localize(body, lang)
      .then((b) => json(b))
      .catch(() => json(body));
    return res;
  };
  next();
}

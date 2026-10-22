// Client de l'API Nissali.
// - Jeton Bearer (connexion persistante, RG-06)
// - Cache des lectures pour l'usage hors connexion (9 : saisie des règles, prières, calendrier)
// - File d'attente des saisies faites hors connexion, rejouée au retour du réseau
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getToken, readJson, writeJson } from './storage';

import { syncToday } from './format';
import { language, tr } from './i18n';
function detectBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  // En développement avec Expo Go : même machine que le serveur Metro, port 4000.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000/api`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000/api';
  return 'http://localhost:4000/api';
}

export const API_URL = detectBaseUrl();

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.code = data?.code;
    this.data = data;
  }
}

const OFFLINE_MSG = tr("Pas de connexion. Tes données seront synchronisées au retour du réseau.");
let unauthorizedHandler = null;
export const onUnauthorized = (fn) => {
  unauthorizedHandler = fn;
};

/**
 * Envoi multipart (fichiers du téléphone) par XMLHttpRequest : depuis le SDK 57, `fetch` (expo/fetch) ne prend
 * plus en charge les parties `{ uri, name, type }` de FormData ; XMLHttpRequest les lit nativement.
 */
function sendForm(method, url, form, headers, timeout) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.timeout = timeout;
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: async () => xhr.responseText });
    xhr.onerror = () => reject(new Error('network'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.send(form);
  });
}

export async function request(method, path, body, { timeout = 15000, raw = false } = {}) {
  const token = await getToken();
  const isUpload = Platform.OS !== 'web' && typeof FormData !== 'undefined' && body instanceof FormData;
  if (isUpload) {
    let res;
    try {
      res = await sendForm(method, `${API_URL}${path}`, body, { Accept: 'application/json', 'x-nissali-app': 'mobile', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, timeout);
    } catch (e) {
      throw new ApiError(e.message === 'timeout' ? 'L’envoi prend trop de temps. Vérifie ta connexion et réessaie.' : 'Envoi impossible pour le moment. Vérifie ta connexion et réessaie.', 0, { code: 'UPLOAD_FAILED' });
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text };
    }
    if (!res.ok) {
      if (res.status === 401 && unauthorizedHandler) unauthorizedHandler();
      throw new ApiError(tr(data?.error || 'Envoi impossible'), res.status, data);
    }
    return data;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Accept-Language': language,
        'x-nissali-app': 'mobile',
        ...(isForm ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(OFFLINE_MSG, 0, { code: 'OFFLINE' });
  } finally {
    clearTimeout(timer);
  }
  if (raw) return res;
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    if (res.status === 401 && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(tr(data?.error || 'Une erreur est survenue'), res.status, data);
  }
  if (data && typeof data.today === 'string') syncToday(data.today);
  if (method !== 'GET') notifyChange(path);
  return data;
}

// --- Écrans à rafraîchir après une saisie ------------------------------------
// Une saisie de règles (onglet Cycle, « Mes règles », feuilles début/fin…) ou de jeûne change aussi l'accueil, le
// calendrier, les jeûnes et la carte « Mes jeûnes » : les écrans encore ouverts derrière sont prévenus et rechargent leurs données aussitôt.

const changeListeners = new Set();
const CYCLE_WRITES = /^\/(cycle|pregnancy|fasts)(\/|\?|$)/;
const CYCLE_READS = /^\/(today|cycle|fasts|pregnancy|health-log)(\/|\?|$)/;

function notifyChange(path) {
  if (!CYCLE_WRITES.test(path)) return;
  for (const fn of changeListeners) fn(path);
}

/** Appelle `fn` après chaque saisie qui change le cycle, si `readPath` en dépend. Renvoie la désinscription. */
export function onDataChange(readPath, fn) {
  if (!CYCLE_READS.test(readPath || '')) return () => {};
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

const cacheKey = (path) => `nissali.cache.${path}`;

/** Lecture avec repli sur le cache si le réseau est indisponible. */
export async function getCached(path) {
  try {
    const data = await request('GET', path);
    writeJson(cacheKey(path), { at: Date.now(), data });
    return { data, offline: false };
  } catch (err) {
    if (err.status === 0) {
      const cached = await readJson(cacheKey(path));
      if (cached) return { data: cached.data, offline: true, cachedAt: cached.at };
    }
    throw err;
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body = {}) => request('PUT', path, body),
  patch: (path, body = {}) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  delete_: (path, body) => request('DELETE', path, body),
};

// --- File d'attente hors connexion -------------------------------------------

const OUTBOX = 'nissali.outbox';

/** Envoie une saisie ; si le réseau manque, elle est mise en file et rejouée plus tard. */
export async function sendOrQueue(method, path, body) {
  try {
    return { data: await request(method, path, body), queued: false };
  } catch (err) {
    if (err.status !== 0) throw err;
    const outbox = await readJson(OUTBOX, []);
    outbox.push({ method, path, body, at: Date.now() });
    await writeJson(OUTBOX, outbox);
    return { data: null, queued: true };
  }
}

export async function flushOutbox() {
  const outbox = await readJson(OUTBOX, []);
  if (!outbox.length) return 0;
  const remaining = [];
  let sent = 0;
  for (const item of outbox) {
    try {
      await request(item.method, item.path, item.body);
      sent += 1;
    } catch (err) {
      if (err.status === 0) remaining.push(item); // toujours hors ligne
      // une erreur métier (400, 409…) est abandonnée : la saisie n'est plus valable
    }
  }
  await writeJson(OUTBOX, remaining);
  return sent;
}

/** Envoi d'une photo (multipart). */
/** Envoi d'une image (photo de profil, événement, messagerie). Le sélecteur fournit du JPEG (qualité < 1). */
export async function uploadImage(path, field, uri, mimeType) {
  const form = new FormData();
  const clean = uri.split('?')[0];
  const ext = clean.split('.').pop()?.toLowerCase();
  const type = ['image/png', 'image/webp', 'image/jpeg'].includes(mimeType) ? mimeType : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const name = `photo.${type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}`;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append(field, blob, name);
  } else {
    form.append(field, { uri, name, type });
  }
  return request('POST', path, form, { timeout: 60000 });
}

export const assetUrl = (url) => (url && url.startsWith('/') ? API_URL.replace(/\/api$/, '') + url : url);

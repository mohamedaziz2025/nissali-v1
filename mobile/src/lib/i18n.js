// Langues de l'appli : français (texte source), anglais et arabe. L'appli est en français par défaut : aucun
// écran ne propose de changer de langue, mais le système de traduction est conservé (dictionnaires FR/EN/AR,
// sens de lecture, en-tête Accept-Language) et un choix déjà enregistré sur l'appareil est respecté.
// Les textes religieux en arabe (dhikr, invocations, versets) ne sont jamais traduits : ils restent en arabe.
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { DevSettings, I18nManager, Platform } from 'react-native';
import ar from '../i18n/ar.json';
import en from '../i18n/en.json';

const KEY = 'nissali.language';
const RELOADED = 'nissali.rtlReloaded';
const SUPPORTED = ['fr', 'en', 'ar'];

export const LANGUAGES = [
  { key: 'fr', label: 'Français' },
  { key: 'en', label: 'English' },
  { key: 'ar', label: 'العربية' },
];

function read(key) {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else SecureStore.setItem(key, value);
  } catch {
    // stockage indisponible : le choix vaut pour cette session seulement
  }
}

/** Première langue du téléphone prise en charge par l'appli, sinon le français. */
export function systemLanguage() {
  try {
    for (const l of getLocales()) if (SUPPORTED.includes(l.languageCode)) return l.languageCode;
  } catch {
    // pas d'information de langue
  }
  return 'fr';
}

const resolve = (pref) => (pref === 'system' || !SUPPORTED.includes(pref) ? systemLanguage() : pref);

/** 'fr' | 'en' | 'ar' — le français par défaut, sauf choix déjà enregistré sur l'appareil. */
export const preference = SUPPORTED.includes(read(KEY)) ? read(KEY) : 'fr';
export const language = resolve(preference);
export const isRTL = language === 'ar';
/** Pour Intl et l'en-tête Accept-Language de l'API. */
export const locale = { fr: 'fr-FR', en: 'en-GB', ar: 'ar' }[language];

const DICT = language === 'en' ? en : language === 'ar' ? ar : null;

/**
 * Traduit un texte français de l'appli. `params` remplace {0}, {1}… (valeur ou tableau).
 * Sans traduction connue, le texte français est gardé.
 */
export function tr(text, params) {
  let s = (DICT && typeof text === 'string' && DICT[text]) || text;
  if (params !== undefined && typeof s === 'string') {
    const list = Array.isArray(params) ? params : [params];
    s = s.replace(/\{(\d+)\}/g, (_, i) => (list[i] ?? '').toString());
  }
  return s;
}

async function reload() {
  try {
    const Updates = await import('expo-updates');
    await Updates.reloadAsync();
    return;
  } catch {
    // Expo Go / développement : rechargement du bundle
  }
  if (Platform.OS === 'web') globalThis.location?.reload();
  else DevSettings.reload();
}

/**
 * Au démarrage : aligne le sens de lecture (droite à gauche pour l'arabe) sur la langue. Un seul rechargement
 * est tenté par langue (Expo Go réinitialise le sens de lecture : on ne boucle pas).
 */
export function syncDirection() {
  if (Platform.OS === 'web') {
    if (globalThis.document) {
      globalThis.document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      globalThis.document.documentElement.lang = language;
    }
    return;
  }
  if (I18nManager.isRTL === isRTL) return;
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
  if (read(RELOADED) === language) return;
  write(RELOADED, language);
  reload();
}

/**
 * Change la langue (« system » = langue du téléphone) et recharge l'appli. Le mécanisme est conservé
 * (le système de traduction reste en place) même si aucun écran ne propose le choix pour l'instant.
 */
export async function setLanguage(pref) {
  write(KEY, pref);
  const rtl = resolve(pref) === 'ar';
  if (Platform.OS !== 'web') {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
  write(RELOADED, resolve(pref));
  await reload();
}

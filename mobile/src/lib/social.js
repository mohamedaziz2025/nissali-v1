// 3.1 / RG-01 — « Continuer avec Apple » et « Continuer avec Google ». Les modules natifs ne sont pas dans
// Expo Go : ils sont chargés à la demande et les boutons ne s'affichent que s'ils sont disponibles.
import { Platform } from 'react-native';

import { tr } from './i18n';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

function load(name) {
  try {
    return name === 'apple' ? require('expo-apple-authentication') : require('@react-native-google-signin/google-signin');
  } catch {
    return null;
  }
}

/** Méthodes disponibles sur ce téléphone : { apple, google }. */
export async function socialAvailability() {
  const apple = Platform.OS === 'ios' ? load('apple') : null;
  const google = GOOGLE_WEB_CLIENT_ID && (Platform.OS === 'android' || GOOGLE_IOS_CLIENT_ID) ? load('google') : null;
  return {
    apple: Boolean(apple && (await apple.isAvailableAsync().catch(() => false))),
    google: Boolean(google),
  };
}

/** Ouvre la feuille système et renvoie { provider, idToken, firstName }, ou null si elle a annulé. */
export async function socialSignIn(provider) {
  if (provider === 'apple') {
    const A = load('apple');
    try {
      const c = await A.signInAsync({ requestedScopes: [A.AppleAuthenticationScope.FULL_NAME, A.AppleAuthenticationScope.EMAIL] });
      if (!c.identityToken) throw new Error(tr("Apple n’a pas renvoyé d’identifiant. Réessaie."));
      // Le prénom n'est donné qu'à la première connexion : il pré-remplit l'écran Prénom (3.2).
      return { provider, idToken: c.identityToken, firstName: c.fullName?.givenName || null };
    } catch (e) {
      if (e.code === 'ERR_REQUEST_CANCELED') return null;
      throw e;
    }
  }
  const G = load('google');
  G.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}) });
  try {
    await G.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const r = await G.GoogleSignin.signIn();
    if (!G.isSuccessResponse(r)) return null;
    const idToken = r.data.idToken || (await G.GoogleSignin.getTokens()).idToken;
    if (!idToken) throw new Error(tr("Google n’a pas renvoyé d’identifiant. Réessaie."));
    return { provider, idToken, firstName: r.data.user?.givenName || null };
  } catch (e) {
    if (G.isErrorWithCode?.(e) && e.code === G.statusCodes.SIGN_IN_CANCELLED) return null;
    if (G.isErrorWithCode?.(e) && e.code === G.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error(tr("Les services Google ne sont pas disponibles sur ce téléphone."));
    throw e;
  }
}

// Inscription commencée avec Apple ou Google : gardée en mémoire pendant le parcours (le jeton expire vite,
// il n'est jamais écrit sur le téléphone).
let pending = null;
export const setPendingSocial = (v) => { pending = v; };
export const getPendingSocial = () => pending;

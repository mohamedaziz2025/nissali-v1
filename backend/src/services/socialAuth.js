// 3.1 / RG-01 / RG-02 — Connexion Apple et Google : vérification du jeton d'identité (JWT signé par Apple ou
// Google) avec leurs clés publiques. Avec Apple, l'adresse peut être une adresse relais masquée : l'appli
// demande alors une adresse e-mail de contact.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { badRequest } from '../utils/http.js';

const PROVIDERS = {
  apple: { jwks: createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')), issuer: 'https://appleid.apple.com', audience: () => env.appleAudiences },
  google: { jwks: createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')), issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: () => env.googleClientIds },
};

/** Vérifie le jeton et renvoie { provider, sub, email, emailVerified, relay, firstName }. */
export async function verifySocialToken(provider, idToken) {
  const conf = PROVIDERS[provider];
  if (!conf) throw badRequest('Méthode de connexion inconnue', 'UNKNOWN_PROVIDER');
  const audience = conf.audience();
  if (!audience.length) throw badRequest(`La connexion avec ${provider === 'apple' ? 'Apple' : 'Google'} n’est pas encore disponible.`, 'PROVIDER_DISABLED');
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, conf.jwks, { issuer: conf.issuer, audience }));
  } catch {
    throw badRequest('Connexion refusée : jeton invalide ou expiré. Réessaie.', 'BAD_SOCIAL_TOKEN');
  }
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  return {
    provider,
    sub: String(payload.sub),
    email,
    // Apple renvoie « true » ou true selon les versions.
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    relay: Boolean(email?.endsWith('@privaterelay.appleid.com')),
    firstName: typeof payload.given_name === 'string' ? payload.given_name : null,
  };
}

export const socialField = (provider) => (provider === 'apple' ? 'appleId' : 'googleId');

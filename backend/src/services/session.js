import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const secret = new TextEncoder().encode(env.jwtSecret);
const MAX_AGE_DAYS = 180; // RG-06 : connexion persistante

// Deux applications web partagent le même domaine en développement :
// l'app utilisatrice et l'espace pro (admin / praticienne) ont chacun leur cookie.
export const COOKIE_NAMES = { app: 'nissali_session', pro: 'nissali_pro' };

export const cookieNameFor = (req) => (req.get('x-nissali-app') === 'pro' ? COOKIE_NAMES.pro : COOKIE_NAMES.app);

export async function createToken(user, { days = MAX_AGE_DAYS } = {}) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user._id))
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret);
}

export async function readToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

/** L'app mobile (Expo) utilise un jeton Bearer ; les apps web un cookie httpOnly. */
export const isMobile = (req) => req.get('x-nissali-app') === 'mobile';

export async function startSession(req, res, user, options = {}) {
  const days = options.days || MAX_AGE_DAYS;
  const token = await createToken(user, { days });
  if (isMobile(req)) return token;
  res.cookie(cookieNameFor(req), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: days * 86_400_000,
    path: '/',
  });
  return null;
}

export function endSession(req, res) {
  res.clearCookie(cookieNameFor(req), { path: '/' });
}

/** Lien temporaire (5 min) vers un document privé, pour l'ouvrir dans le navigateur du téléphone. */
export async function createFileToken(recordId, fileId) {
  return new SignJWT({ r: String(recordId), f: String(fileId) }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(secret);
}

export async function readFileToken(token) {
  const payload = await readToken(token);
  return payload?.r && payload?.f ? payload : null;
}

/** Lien signé (2 h) vers une photo de la messagerie. */
export async function createChatImageToken(storedName) {
  return new SignJWT({ c: String(storedName) }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h').sign(secret);
}

export async function readChatImageToken(token) {
  const payload = await readToken(token);
  return payload?.c ? payload.c : null;
}

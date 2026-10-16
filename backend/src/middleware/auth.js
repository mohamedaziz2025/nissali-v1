import { User } from '../models/index.js';
import { cookieNameFor, readToken } from '../services/session.js';
import { forbidden, unauthorized } from '../utils/http.js';

/** Charge l'utilisatrice si une session valide existe (cookie ou en-tête Bearer). */
export async function authenticate(req, _res, next) {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.[cookieNameFor(req)];
  if (!token) return next();
  const payload = await readToken(token);
  if (!payload?.sub) return next();
  const user = await User.findById(payload.sub);
  if (!user || user.status === 'suspendue') return next();
  req.user = user;
  // Activité (statistiques DAU/MAU, purge après 3 ans d'inactivité — 8.2)
  if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > 3600_000) {
    User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } }).catch(() => {});
  }
  return next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  return next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    return next();
  };

/** RG-04 : le suivi n'est accessible qu'avec le consentement explicite aux données de santé. */
export function requireHealthConsent(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (!req.user.consents?.health?.accepted) return next(forbidden('Consentement aux données de santé requis', 'HEALTH_CONSENT_REQUIRED'));
  return next();
}

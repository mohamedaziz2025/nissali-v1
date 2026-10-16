export class HttpError extends Error {
  constructor(status, message, code, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const badRequest = (message, code, extra) => new HttpError(400, message, code, extra);
export const unauthorized = (message = 'Connexion requise', code = 'UNAUTHORIZED') => new HttpError(401, message, code);
export const forbidden = (message = 'Accès refusé', code = 'FORBIDDEN') => new HttpError(403, message, code);
export const notFound = (message = 'Introuvable') => new HttpError(404, message, 'NOT_FOUND');
export const conflict = (message, code = 'CONFLICT') => new HttpError(409, message, code);

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

import { HttpError } from '../utils/http.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route introuvable', code: 'NOT_FOUND' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...(err.extra || {}) });
  }
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(err.errors)[0]?.message || 'Données invalides', code: 'VALIDATION' });
  }
  if (err?.name === 'CastError') return res.status(400).json({ error: 'Identifiant invalide', code: 'INVALID_ID' });
  if (err?.code === 11000) return res.status(409).json({ error: 'Cette valeur est déjà utilisée', code: 'DUPLICATE', fields: Object.keys(err.keyValue || {}) });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide', code: 'BAD_JSON' });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: req.path.endsWith('/events/image') || req.originalUrl?.includes('/events/image') ? 'Image trop lourde : 1 Mo maximum pour un événement' : 'Fichier trop volumineux (5 Mo max)', code: 'FILE_TOO_LARGE' });
  console.error('[erreur]', err);
  return res.status(500).json({ error: 'Une erreur est survenue. Réessaie dans un instant.', code: 'SERVER_ERROR' });
}

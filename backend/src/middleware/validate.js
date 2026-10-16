import { badRequest } from '../utils/http.js';

/** Valide req.body (ou req.query) avec un schéma zod et remplace par la valeur nettoyée. */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join('.');
      return next(badRequest(issue.message === 'Required' ? `Champ obligatoire : ${field}` : issue.message, 'VALIDATION', { field }));
    }
    if (source === 'body') req.body = result.data;
    else req.valid = result.data;
    return next();
  };

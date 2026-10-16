// Liens des notifications (envoyés par l'API) → écrans de l'appli mobile. Au toucher d'une notification
// (push, bandeau ou centre de notifications), l'appli ouvre directement la page concernée.
import { router } from 'expo-router';
import { api } from './api';

const ALIASES = {
  '/aujourdhui': '/',
  '/accueil': '/',
  '/praticiennes/rendez-vous': '/rendez-vous',
  '/pro/abonnement': '/pro/profil',
  '/sante': '/sante',
};

/** Route de l'appli pour un lien de notification (null si le lien n'existe que sur le web). */
export function routeFor(link) {
  if (!link || typeof link !== 'string' || !link.startsWith('/')) return null;
  if (link.startsWith('/admin')) return null;
  const [path, query] = link.split('?');
  const target = ALIASES[path] || path;
  return query ? `${target}?${query}` : target;
}

/** Ouvre la page d'une notification et la marque comme lue. */
export function openNotification({ link, id, kind, conversation, as }) {
  if (id) api.post(`/notifications/${id}/read`, {}).catch(() => {});
  const route = kind === 'message' && conversation ? `/messages/${conversation}${as === 'pro' ? '?as=pro' : ''}` : routeFor(link);
  router.push(route || '/notifications');
}

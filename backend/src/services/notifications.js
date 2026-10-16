// Notifications in-app + push web/Expo. RG-17 : titres et corps discrets sur l'écran verrouillé.
import webpush from 'web-push';
import { env } from '../config/env.js';
import { Notification, PushSubscription } from '../models/index.js';

const webPushReady = Boolean(env.vapid.publicKey && env.vapid.privateKey);
if (webPushReady) webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);

export const DISCREET = { title: 'Nissali', body: 'Petit rappel du jour' };

/** Push via le service Expo (iOS/Android). image : grande image dans la notification (richContent). */
async function sendExpo(tokens, payload) {
  if (!tokens.length) return 0;
  const messages = tokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: { link: payload.link, ...(payload.image ? { image: payload.image } : {}), ...(payload.data || {}) },
    sound: 'default',
    channelId: payload.channelId || 'annonces',
    ...(payload.image ? { richContent: { image: payload.image } } : {}),
  }));
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
      signal: AbortSignal.timeout(10000),
    }).catch((err) => console.warn('[push:expo]', err.message));
    const json = await res?.json().catch(() => null);
    for (const [k, ticket] of (json?.data || []).entries()) {
      if (ticket.status === 'ok') sent += 1;
      else if (ticket.details?.error === 'DeviceNotRegistered') await PushSubscription.deleteOne({ endpoint: messages[i + k].to });
    }
  }
  return sent;
}

/** Envoie une notification push (sans la stocker). Retourne le nombre d'appareils atteints. */
export async function push(userId, payload) {
  const subs = await PushSubscription.find({ user: userId });
  const expoTokens = subs.filter((s) => s.endpoint.startsWith('ExponentPushToken')).map((s) => s.endpoint);
  let sent = await sendExpo(expoTokens, payload);
  if (!webPushReady) return sent;
  for (const sub of subs.filter((s) => s.endpoint.startsWith('http'))) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload));
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await sub.deleteOne();
    }
  }
  return sent;
}

/**
 * Crée une notification une seule fois par clé (dédoublonnage) et l'envoie en push.
 * title/body : texte discret ; detail : texte complet visible dans l'appli.
 */
export async function notify(userId, { key, type, title = DISCREET.title, body = DISCREET.body, detail, link, imageUrl }, { sendPush = true } = {}) {
  try {
    const n = await Notification.create({ user: userId, key, type, title, body, detail, link, imageUrl });
    if (sendPush) {
      const sent = await push(userId, { title, body, link, image: imageUrl, data: { notificationId: String(n._id), type } });
      n.pushed = sent > 0;
      await n.save();
    }
    return n;
  } catch (err) {
    if (err.code === 11000) return null; // déjà envoyée
    throw err;
  }
}

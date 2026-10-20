// 4.13 · 8.4 — Notifications de l'équipe. Canal « push + centre » ou « seulement dans l'appli » ; ciblage par zone,
// situation et âge, jamais par une donnée de santé (8.2). Règles appliquées par le serveur : seules les utilisatrices
// en fréquence Modérée ou Élevée, dans la limite de leur plafond (RG-36) ; jamais la nuit ni à l'heure de prière,
// jamais deux le même jour (RG-37) : l'envoi est décalé par utilisatrice ; mots sensibles bloqués (RG-17).
import { Article, Broadcast, Notification, Practitioner, User } from '../models/index.js';
import { escapeRegex } from '../utils/http.js';
import { adviceGate, notify } from './notifications.js';
import { userTimings } from './prayerSource.js';
import { getSettings } from './settings.js';

// Pages ouvertes au toucher (en plus des articles et des événements).
export const BROADCAST_PAGES = [
  { link: '/', label: 'Accueil' },
  { link: '/cycle', label: 'Onglet Cycle' },
  { link: '/jeunes', label: 'Jeûnes' },
  { link: '/dhikr', label: 'Dhikr' },
  { link: '/horaires', label: 'Horaires de prière' },
  { link: '/lifestyle', label: 'Magazine' },
  { link: '/praticiennes', label: 'Praticiennes' },
  { link: '/notifications', label: 'Centre de notifications' },
  { link: '/profil', label: 'Mon profil' },
];

const fold = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** RG-17 — mots sensibles trouvés dans le titre ou le texte (liste du back-office). */
export function sensitiveWordsIn(texts, settings) {
  const words = String(settings.sensitiveWords || '').split(',').map((w) => fold(w.trim())).filter(Boolean);
  const hay = fold(texts.join(' '));
  return words.filter((w) => new RegExp(`(^|[^a-z])${escapeRegex(w)}([^a-z]|$)`).test(hay));
}

/** Filtre MongoDB de l'audience : zone, situation, âge (jamais de santé) ; anciens types d'audience conservés. */
export async function audienceFilter(b) {
  const base = { role: 'user', status: 'active' };
  const a = b.audience || {};
  if (a.type === 'praticiennes') return { _id: { $in: (await Practitioner.find({ status: 'validee' }).select('user').lean()).map((p) => p.user) } };
  if (a.type === 'utilisatrice' && a.userId) return { _id: a.userId };
  const t = b.targeting || {};
  const f = { ...base };
  const rx = (v) => new RegExp(`^${escapeRegex(String(v).trim())}`, 'i');
  if (t.country) f.$or = [{ 'city.country': rx(t.country) }, { 'city.countryCode': rx(t.country) }];
  if (t.region) f['city.admin'] = rx(t.region);
  if (t.city || (a.type === 'ville' && a.city)) f['city.name'] = rx(t.city || a.city);
  if (t.situation || (a.type === 'situation' && a.situation)) f.situation = t.situation || a.situation;
  const year = new Date().getUTCFullYear();
  if (t.ageMin || t.ageMax) f.birthYear = { ...(t.ageMax ? { $gte: year - t.ageMax } : {}), ...(t.ageMin ? { $lte: year - t.ageMin } : {}) };
  if (a.type === 'actualites') f.$and = [{ $or: [{ 'consents.marketingEmail.accepted': true }, { 'consents.marketingSms.accepted': true }, { 'consents.marketingWhatsapp.accepted': true }] }];
  return f;
}

/** Audience estimée : fréquence Modérée ou Élevée, moins celles qui ont atteint leur plafond (canal push). */
export async function estimateAudience(b) {
  const settings = await getSettings();
  const filter = await audienceFilter(b);
  const total = await User.countDocuments(filter);
  if (b.category === 'essentiel') return { total, reachable: total, capped: 0 };
  const eligible = await User.find({ ...filter, 'notificationPrefs.frequency': { $in: ['moderee', 'elevee'] } }).select('_id notificationPrefs.frequency').lean();
  if (b.channel === 'app') return { total, reachable: eligible.length, capped: 0 };
  const since = new Date(Date.now() - 7 * 86_400_000);
  const counts = await Notification.aggregate([{ $match: { user: { $in: eligible.map((u) => u._id) }, category: 'conseil', createdAt: { $gte: since } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]);
  const byUser = new Map(counts.map((c) => [String(c._id), c.n]));
  const cap = (u) => (u.notificationPrefs?.frequency === 'elevee' ? Number(settings.notifCapElevee ?? 5) : Number(settings.notifCapModeree ?? 3));
  const capped = eligible.filter((u) => (byUser.get(String(u._id)) || 0) >= cap(u)).length;
  return { total, reachable: eligible.length - capped, capped };
}

const localDay = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Europe/Paris' }).format(new Date());

/** Moment où réessayer : 08:05 heure locale après la nuit, 20 minutes après l'heure de prière. */
function retryAt(gate, now = new Date()) {
  if (gate.reason === 'nuit') {
    const [h, m] = (gate.localTime || '00:00').split(':').map(Number);
    const mins = h * 60 + m;
    const wait = mins >= 22 * 60 ? 24 * 60 - mins + 485 : 485 - mins;
    return new Date(now.getTime() + Math.max(5, wait) * 60_000);
  }
  return new Date(now.getTime() + 20 * 60_000);
}

async function deliverTo(broadcast, user, settings) {
  const content = { key: `broadcast-${broadcast.id}`, type: 'annonce', title: broadcast.title, body: broadcast.body, detail: broadcast.detail || broadcast.body, link: broadcast.link || '/notifications', imageUrl: broadcast.imageUrl };
  if (broadcast.category === 'essentiel') return { n: await notify(user._id, { ...content, category: 'essentiel' }).catch(() => null) };
  const freq = user.notificationPrefs?.frequency || 'faible';
  if (freq === 'faible') return { skip: true };
  // « Seulement dans l'appli » : dans la cloche, sans push, hors plafond hebdomadaire.
  if (broadcast.channel === 'app') return { n: await notify(user._id, { ...content, category: 'essentiel' }, { sendPush: false }).catch(() => null) };
  let timings = null;
  try {
    timings = (await userTimings(user, settings, localDay(user.city?.timezone))).timings;
  } catch {
    // horaires indisponibles : seule la plage de nuit est vérifiée
  }
  const gate = await adviceGate(user, settings, { timings });
  if (!gate.send) return { skip: true };
  if (!gate.push) return { later: retryAt(gate) };
  return { n: await notify(user._id, { ...content, category: 'conseil' }).catch(() => null) };
}

/** Envoie (ou décale par utilisatrice) une notification de l'équipe. */
export async function deliverBroadcast(broadcast) {
  const settings = await getSettings();
  const found = sensitiveWordsIn([broadcast.title, broadcast.body], settings);
  if (found.length) {
    broadcast.status = 'annulee';
    broadcast.blockedReason = `Mot sensible : ${found.join(', ')}`;
    await broadcast.save();
    return broadcast;
  }
  broadcast.status = 'en_cours';
  await broadcast.save();
  const users = await User.find(await audienceFilter(broadcast)).select('_id city notificationPrefs prayerSettings prayerSource').lean();
  let delivered = 0;
  let pushed = 0;
  const queue = [];
  for (const u of users) {
    const r = await deliverTo(broadcast, u, settings);
    if (r.later) queue.push({ user: u._id, at: r.later, tries: 0 });
    if (r.n) delivered += 1;
    if (r.n?.pushed) pushed += 1;
  }
  broadcast.recipients = delivered;
  broadcast.pushed = pushed;
  broadcast.queue = queue;
  broadcast.status = queue.length ? 'en_cours' : 'envoyee';
  broadcast.sentAt = new Date();
  await broadcast.save();
  return broadcast;
}

/** Tâche (chaque minute) : envois programmés, articles publiés avec push, envois décalés. */
export async function broadcastJob() {
  const now = new Date();
  // 8.3 — article publié avec « Envoyer une notification push » : préparée automatiquement, envoyée à la publication.
  const articles = await Article.find({ pushOnPublish: true, published: true, publishAt: { $lte: now }, pushBroadcast: { $exists: false } }).limit(5);
  for (const a of articles) {
    const b = await Broadcast.create({ title: 'Nouvel article à lire', body: a.title.slice(0, 120), kind: 'article', channel: 'push', category: 'conseil', link: `/blog/${a.slug}`, imageUrl: a.coverUrl || undefined, article: a._id, status: 'programmee', scheduledAt: now, audience: { type: 'toutes' } });
    a.pushBroadcast = b._id;
    await a.save();
  }
  const due = await Broadcast.find({ status: 'programmee', scheduledAt: { $lte: now } }).limit(5);
  for (const b of due) await deliverBroadcast(b);

  const settings = await getSettings();
  const pending = await Broadcast.find({ status: 'en_cours', 'queue.at': { $lte: now } }).limit(5);
  for (const b of pending) {
    const keep = [];
    for (const q of b.queue) {
      if (q.at > now) {
        keep.push(q);
        continue;
      }
      const u = await User.findById(q.user).select('_id city notificationPrefs prayerSettings prayerSource').lean();
      if (!u) continue;
      const r = await deliverTo(b, u, settings);
      if (r.later && q.tries < 6) keep.push({ user: q.user, at: r.later, tries: q.tries + 1 });
      if (r.n) b.recipients += 1;
      if (r.n?.pushed) b.pushed += 1;
    }
    b.queue = keep;
    if (!keep.length) b.status = 'envoyee';
    await b.save();
  }
}

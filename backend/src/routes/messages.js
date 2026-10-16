// Messagerie utilisatrice ↔ praticienne, façon Messenger : conversations, bulles, photos, réponses citées,
// réactions, « Vu », « écrit… », non-lus, blocage et signalement. RG-27 : rappel de ne pas partager de données de santé.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Category, ClientRecord, Conversation, Message, Notification, Practitioner, User } from '../models/index.js';
import { getPractitionerFor } from '../services/marketplace.js';
import { push } from '../services/notifications.js';
import { createChatImageToken } from '../services/session.js';
import { badRequest, forbidden, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const TYPING_MS = 6000;
export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🤲'];
// N'importe quel emoji peut servir de réaction (1 à 4 pictogrammes, avec modificateurs de teinte).
const isEmoji = (v) => typeof v === 'string' && v.length <= 16 && /\p{Extended_Pictographic}/u.test(v) && !/[\p{L}\p{N}]/u.test(v.replace(/\uFE0F|\u200D/g, ''));

const chatDir = path.join(path.resolve(env.privateDir), 'chat');
fs.mkdirSync(chatDir, { recursive: true });
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: chatDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${file.mimetype === 'image/png' || /\.png$/i.test(file.originalname || '') ? '.png' : file.mimetype === 'image/webp' || /\.webp$/i.test(file.originalname || '') ? '.webp' : '.jpg'}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  // Certains téléphones envoient un type générique : on accepte aussi d'après l'extension.
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype) || /\.(jpe?g|png|webp)$/i.test(file.originalname || '')),
});

/** Message prêt à afficher : photo par lien signé, message cité, réactions. */
async function presentMessage(m, as, quoted) {
  if (m.deletedForAll) return { id: String(m._id), from: m.from, mine: m.from === as, text: '', at: m.createdAt, deleted: true, image: null, reply: null, reactions: [] };
  return {
    id: String(m._id),
    from: m.from,
    mine: m.from === as,
    text: m.text || '',
    at: m.createdAt,
    image: m.image?.storedName ? { url: `${env.publicApiUrl}/api/chat-images/${await createChatImageToken(m.image.storedName)}`, width: m.image.width || null, height: m.image.height || null } : null,
    reply: quoted ? { id: String(quoted._id), from: quoted.from, mine: quoted.from === as, text: quoted.deletedForAll ? 'Message supprimé' : quoted.text || '', hasImage: !quoted.deletedForAll && Boolean(quoted.image?.storedName) } : null,
    reactions: (m.reactions || []).map((r) => ({ emoji: r.emoji, by: r.by, mine: r.by === as })),
  };
}

async function presentMessages(list, as) {
  const ids = [...new Set(list.filter((m) => m.replyTo).map((m) => String(m.replyTo)))];
  const quoted = new Map((ids.length ? await Message.find({ _id: { $in: ids } }).lean() : []).map((q) => [String(q._id), q]));
  return Promise.all(list.map((m) => presentMessage(m, as, m.replyTo ? quoted.get(String(m.replyTo)) : null)));
}

const preview = (m) => (m.image?.storedName ? (m.text ? `📷 ${m.text}` : '📷 Photo') : m.text).slice(0, 200);
const lastPush = new Map();
const oid = /^[a-f\d]{24}$/i;

/** Côté de l'utilisatrice connectée dans la conversation : 'user' (cliente) ou 'pro' (praticienne). */
async function side(req) {
  if (req.query.as === 'pro' || req.body?.as === 'pro') {
    const p = await getPractitionerFor(req.user);
    if (!p) throw forbidden('Espace pro requis');
    return { as: 'pro', practitioner: p };
  }
  return { as: 'user' };
}

async function loadConversation(req, id) {
  if (!oid.test(id)) throw notFound('Conversation introuvable');
  const s = await side(req);
  const conv = await Conversation.findById(id);
  if (!conv) throw notFound('Conversation introuvable');
  if (s.as === 'pro' ? !conv.practitioner.equals(s.practitioner._id) : !conv.user.equals(req.user._id)) throw notFound('Conversation introuvable');
  return { conv, ...s };
}

const other = (as) => (as === 'pro' ? 'user' : 'pro');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

async function present(conv, as, labels) {
  const base = {
    id: String(conv._id),
    last: conv.lastMessage?.at ? { text: conv.lastMessage.text, from: conv.lastMessage.from, mine: conv.lastMessage.from === as, at: conv.lastMessage.at } : null,
    unread: as === 'pro' ? conv.unreadPro : conv.unreadUser,
    blocked: conv.blockedByUser || conv.blockedByPro,
    blockedByMe: as === 'pro' ? conv.blockedByPro : conv.blockedByUser,
    updatedAt: conv.updatedAt,
  };
  if (as === 'user') {
    const p = conv.practitioner;
    return {
      ...base,
      other: p ? { id: String(p._id), name: p.displayName, photoUrl: p.photoUrl || null, subtitle: labels.get(p.specialty) || cap(p.specialty), phone: p.showPhone && p.phone ? p.phone : null, kind: 'pro' } : { name: 'Praticienne' },
    };
  }
  const u = conv.user;
  return { ...base, other: u ? { id: String(u._id), name: u.firstName || 'Cliente', photoUrl: null, subtitle: u.city?.name || '', phone: null, kind: 'cliente' } : { name: 'Cliente' } };
}

async function specialtyLabels() {
  return new Map((await Category.find().lean()).map((c) => [c.key, c.label]));
}

router.get('/unread', async (req, res) => {
  const p = await getPractitionerFor(req.user);
  const [u, pro] = await Promise.all([
    Conversation.aggregate([{ $match: { user: req.user._id } }, { $group: { _id: null, n: { $sum: '$unreadUser' } } }]),
    p ? Conversation.aggregate([{ $match: { practitioner: p._id } }, { $group: { _id: null, n: { $sum: '$unreadPro' } } }]) : [],
  ]);
  res.json({ user: u[0]?.n || 0, pro: pro[0]?.n || 0 });
});

router.get('/conversations', async (req, res) => {
  const s = await side(req);
  const filter = s.as === 'pro' ? { practitioner: s.practitioner._id } : { user: req.user._id };
  await Conversation.updateMany({ ...filter, [s.as === 'pro' ? 'unreadPro' : 'unreadUser']: { $gt: 0 } }, { $set: { [s.as === 'pro' ? 'deliveredProAt' : 'deliveredUserAt']: new Date() } });
  const list = await Conversation.find({ ...filter, 'lastMessage.at': { $exists: true } })
    .sort({ 'lastMessage.at': -1 })
    .limit(100)
    .populate({ path: 'practitioner', model: Practitioner, select: 'displayName photoUrl specialty phone showPhone' })
    .populate({ path: 'user', model: User, select: 'firstName city' });
  const labels = await specialtyLabels();
  res.json(await Promise.all(list.map((c) => present(c, s.as, labels))));
});

// Ouvre (ou crée) la conversation : depuis la fiche d'une praticienne, ou depuis une fiche cliente.
router.post('/conversations', validate(z.object({ practitionerId: z.string().regex(oid).optional(), clientId: z.string().regex(oid).optional(), as: z.enum(['user', 'pro']).optional() })), async (req, res) => {
  const s = await side(req);
  let filter;
  if (s.as === 'pro') {
    if (!req.body.clientId) throw badRequest('Cliente manquante');
    if (!(await ClientRecord.exists({ practitioner: s.practitioner._id, client: req.body.clientId }))) throw forbidden('Tu ne peux écrire qu’à tes clientes');
    filter = { user: req.body.clientId, practitioner: s.practitioner._id };
  } else {
    const p = await Practitioner.findOne({ _id: req.body.practitionerId, status: 'validee' });
    if (!p) throw notFound('Praticienne introuvable');
    if (p.user.equals(req.user._id)) throw badRequest('Tu ne peux pas t’écrire à toi-même');
    filter = { user: req.user._id, practitioner: p._id };
  }
  const conv = await Conversation.findOneAndUpdate(filter, { $setOnInsert: filter }, { upsert: true, new: true });
  await conv.populate([
    { path: 'practitioner', model: Practitioner, select: 'displayName photoUrl specialty phone showPhone' },
    { path: 'user', model: User, select: 'firstName city' },
  ]);
  res.json(await present(conv, s.as, await specialtyLabels()));
});

router.get('/conversations/:id', async (req, res) => {
  const { conv, as } = await loadConversation(req, req.params.id);
  await conv.populate([
    { path: 'practitioner', model: Practitioner, select: 'displayName photoUrl specialty phone showPhone' },
    { path: 'user', model: User, select: 'firstName city' },
  ]);
  res.json(await present(conv, as, await specialtyLabels()));
});

// Messages : ?since=ISO renvoie les messages nouveaux ou modifiés (réactions) depuis ce moment ;
// ?before=ISO charge l'historique plus ancien ; sans paramètre, les 40 derniers.
router.get('/conversations/:id/messages', async (req, res) => {
  const { conv, as } = await loadConversation(req, req.params.id);
  const q = { conversation: conv._id };
  const since = req.query.since || req.query.after ? new Date(String(req.query.since || req.query.after)) : null;
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const after = since && !Number.isNaN(since.getTime()) ? since : null;
  if (after) q.updatedAt = { $gt: after };
  else if (before && !Number.isNaN(before.getTime())) q.createdAt = { $lt: before };
  if (!after) q.hiddenFor = { $ne: as };
  const found = await Message.find(q).sort(after ? { createdAt: 1 } : { createdAt: -1 }).limit(after ? 200 : 40).lean();
  if (!after) found.reverse();
  const removed = found.filter((m) => (m.hiddenFor || []).includes(as)).map((m) => String(m._id));
  const items = found.filter((m) => !(m.hiddenFor || []).includes(as));
  // Conversation ouverte = messages lus (« Vu » chez l'autre).
  const unreadField = as === 'pro' ? 'unreadPro' : 'unreadUser';
  if (conv[unreadField] > 0 || !conv[as === 'pro' ? 'readProAt' : 'readUserAt']) {
    conv[unreadField] = 0;
    conv[as === 'pro' ? 'readProAt' : 'readUserAt'] = new Date();
    conv[as === 'pro' ? 'deliveredProAt' : 'deliveredUserAt'] = new Date();
    await conv.save();
    await Notification.updateOne({ user: req.user._id, key: `msg-${conv._id}`, read: false }, { $set: { read: true } }, { timestamps: false }).catch(() => {});
  }
  const otherTyping = conv[other(as) === 'pro' ? 'typingProAt' : 'typingUserAt'];
  res.json({
    items: await presentMessages(items, as),
    removed,
    serverTime: new Date(),
    hasMore: !after && items.length === 40,
    otherReadAt: conv[other(as) === 'pro' ? 'readProAt' : 'readUserAt'] || null,
    otherDeliveredAt: conv[other(as) === 'pro' ? 'deliveredProAt' : 'deliveredUserAt'] || conv[other(as) === 'pro' ? 'readProAt' : 'readUserAt'] || null,
    otherTyping: Boolean(otherTyping && Date.now() - new Date(otherTyping).getTime() < TYPING_MS),
    blocked: conv.blockedByUser || conv.blockedByPro,
    blockedByMe: as === 'pro' ? conv.blockedByPro : conv.blockedByUser,
  });
});

// Photo : envoyée d'abord (stockage privé), puis jointe au message par son identifiant.
router.post('/conversations/:id/photos', photoUpload.single('image'), async (req, res) => {
  const { conv } = await loadConversation(req, req.params.id);
  if (!req.file) throw badRequest('Photo JPEG, PNG ou WebP attendue (8 Mo maximum)');
  if (conv.blockedByUser || conv.blockedByPro) {
    fs.rm(req.file.path, { force: true }, () => {});
    throw forbidden('Cette conversation est bloquée', 'CONVERSATION_BLOCKED');
  }
  res.status(201).json({ photo: req.file.filename });
});

const sendSchema = z
  .object({
    text: z.string().trim().max(2000).optional().default(''),
    photo: z.string().regex(/^[a-f0-9]{32}\.(jpg|png|webp)$/).optional(),
    width: z.number().nonnegative().max(20000).optional(),
    height: z.number().nonnegative().max(20000).optional(),
    replyTo: z.string().regex(oid).optional(),
    as: z.enum(['user', 'pro']).optional(),
  })
  .refine((b) => b.text || b.photo, { message: 'Message vide', path: ['text'] });

router.post('/conversations/:id/messages', validate(sendSchema), async (req, res) => {
  const { conv, as } = await loadConversation(req, req.params.id);
  if (conv.blockedByUser || conv.blockedByPro) throw forbidden('Cette conversation est bloquée', 'CONVERSATION_BLOCKED');
  const b = req.body;
  if (b.photo && !fs.existsSync(path.join(chatDir, b.photo))) throw badRequest('Photo introuvable, renvoie-la');
  const quoted = b.replyTo ? await Message.findOne({ _id: b.replyTo, conversation: conv._id }).lean() : null;
  const msg = await Message.create({ conversation: conv._id, from: as, text: b.text, ...(b.photo ? { image: { storedName: b.photo, width: b.width ? Math.round(b.width) : undefined, height: b.height ? Math.round(b.height) : undefined } } : {}), ...(quoted ? { replyTo: quoted._id } : {}) });
  conv.lastMessage = { text: preview(msg), from: as, at: msg.createdAt };
  if (as === 'pro') {
    conv.unreadUser += 1;
    conv.typingProAt = undefined;
    conv.readProAt = msg.createdAt;
  } else {
    conv.unreadPro += 1;
    conv.typingUserAt = undefined;
    conv.readUserAt = msg.createdAt;
  }
  await conv.save();

  // Notification de la destinataire : une par conversation (mise à jour à chaque message), visible dans le centre
  // de notifications avec l'expéditrice ; push discret (RG-17 / RG-27) au plus une fois par minute.
  const practitioner = await Practitioner.findById(conv.practitioner).select('user displayName').lean();
  const recipient = as === 'pro' ? conv.user : practitioner?.user;
  if (recipient) {
    const senderName = as === 'pro' ? practitioner?.displayName || 'Ta praticienne' : req.user.firstName || 'Une cliente';
    const link = `/messages/${conv._id}${as === 'pro' ? '' : '?as=pro'}`;
    const now = new Date();
    await Notification.updateOne(
      { user: recipient, key: `msg-${conv._id}` },
      { $set: { type: 'message', title: 'Nissali', body: 'Tu as un nouveau message', detail: `${senderName} : ${preview(msg)}`, link, read: false, pushed: false, createdAt: now, updatedAt: now } },
      { upsert: true, timestamps: false },
    ).catch(() => {});
    const key = `${conv._id}:${as}`;
    if (!lastPush.has(key) || Date.now() - lastPush.get(key) > 60_000) {
      lastPush.set(key, Date.now());
      push(recipient, { title: 'Nissali', body: 'Tu as un nouveau message', link, channelId: 'annonces', data: { kind: 'message', conversation: String(conv._id), as: as === 'pro' ? 'user' : 'pro' } }).catch(() => {});
    }
  }
  res.status(201).json(await presentMessage(msg.toObject(), as, quoted));
});

// Réaction (une par personne et par message) : même emoji = retirer.
router.post('/conversations/:id/messages/:messageId/react', validate(z.object({ emoji: z.string().refine(isEmoji, 'Emoji invalide'), as: z.enum(['user', 'pro']).optional() })), async (req, res) => {
  const { conv, as } = await loadConversation(req, req.params.id);
  if (!oid.test(req.params.messageId)) throw notFound('Message introuvable');
  const msg = await Message.findOne({ _id: req.params.messageId, conversation: conv._id });
  if (!msg || msg.deletedForAll) throw notFound('Message introuvable');
  const mine = msg.reactions.find((r) => r.by === as);
  msg.reactions = msg.reactions.filter((r) => r.by !== as);
  if (!mine || mine.emoji !== req.body.emoji) msg.reactions.push({ by: as, emoji: req.body.emoji });
  await msg.save();
  const quoted = msg.replyTo ? await Message.findById(msg.replyTo).lean() : null;
  res.json(await presentMessage(msg.toObject(), as, quoted));
});

// Supprimer : « pour tout le monde » (ses propres messages : contenu et photo effacés) ou « pour moi » (masqué).
router.post('/conversations/:id/messages/:messageId/delete', validate(z.object({ for: z.enum(['all', 'me']), as: z.enum(['user', 'pro']).optional() })), async (req, res) => {
  const { conv, as } = await loadConversation(req, req.params.id);
  if (!oid.test(req.params.messageId)) throw notFound('Message introuvable');
  const msg = await Message.findOne({ _id: req.params.messageId, conversation: conv._id });
  if (!msg) throw notFound('Message introuvable');
  if (req.body.for === 'all') {
    if (msg.from !== as) throw forbidden('Tu ne peux retirer que tes propres messages');
    if (msg.image?.storedName) fs.rm(path.join(chatDir, msg.image.storedName), { force: true }, () => {});
    msg.deletedForAll = true;
    msg.text = '';
    msg.image = undefined;
    msg.reactions = [];
    await msg.save();
    // Aperçu de la conversation et compteur de non-lus de l'autre côté
    if (conv.lastMessage?.at && msg.createdAt.getTime() === new Date(conv.lastMessage.at).getTime()) conv.lastMessage.text = 'Message supprimé';
    const field = as === 'pro' ? 'unreadUser' : 'unreadPro';
    const readAt = conv[as === 'pro' ? 'readUserAt' : 'readProAt'];
    if (conv[field] > 0 && (!readAt || readAt < msg.createdAt)) conv[field] -= 1;
    await conv.save();
  } else if (!msg.hiddenFor.includes(as)) {
    msg.hiddenFor.push(as);
    await msg.save();
  }
  res.json({ ok: true, id: String(msg._id), for: req.body.for });
});

router.post('/conversations/:id/typing', async (req, res) => {
  const { conv, as } = await loadConversation(req, req.params.id);
  await Conversation.updateOne({ _id: conv._id }, { $set: { [as === 'pro' ? 'typingProAt' : 'typingUserAt']: new Date() } });
  res.json({ ok: true });
});

router.post('/conversations/:id/block', validate(z.object({ blocked: z.boolean(), as: z.enum(['user', 'pro']).optional() })), async (req, res) => {
  const { conv, as } = await loadConversation(req, req.params.id);
  conv[as === 'pro' ? 'blockedByPro' : 'blockedByUser'] = req.body.blocked;
  await conv.save();
  res.json({ blocked: conv.blockedByUser || conv.blockedByPro, blockedByMe: req.body.blocked });
});

router.post('/conversations/:id/report', validate(z.object({ reason: z.string().trim().min(3).max(500), as: z.enum(['user', 'pro']).optional() })), async (req, res) => {
  const { conv, as } = await loadConversation(req, req.params.id);
  conv.reports.push({ by: as, reason: req.body.reason, at: new Date() });
  await conv.save();
  res.json({ ok: true });
});

export default router;

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Conversation, Notification, Practitioner } from '../models/index.js';

const router = Router();
router.use(requireAuth);

// L'appli ouverte interroge régulièrement ses notifications : ses messages non lus sont alors « reçus ».
async function markDelivered(user) {
  const now = new Date();
  await Conversation.updateMany({ user: user._id, unreadUser: { $gt: 0 } }, { $set: { deliveredUserAt: now } });
  const p = await Practitioner.findOne({ user: user._id }).select('_id').lean();
  if (p) await Conversation.updateMany({ practitioner: p._id, unreadPro: { $gt: 0 } }, { $set: { deliveredProAt: now } });
}

router.get('/', async (req, res) => {
  markDelivered(req.user).catch(() => {});
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ items: items.map(({ _id, ...n }) => ({ id: String(_id), ...n })), unread: items.filter((n) => !n.read).length });
});

router.post('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.json({ ok: true });
});

router.post('/:id/read', async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { read: true } });
  res.json({ ok: true });
});

export default router;

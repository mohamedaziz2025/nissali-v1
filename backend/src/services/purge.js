// Suppression complète d'un compte et de toutes ses données (RG-07, 8.2).
import {
  Appointment,
  Availability,
  Booking,
  ClientRecord,
  Conversation,
  DailyLog,
  EventRegistration,
  Message,
  FastPlan,
  Favorite,
  MadeUpFast,
  MissedFast,
  Notification,
  Period,
  Practitioner,
  PrayerLog,
  Pregnancy,
  PushSubscription,
  Review,
  Service,
  Subscription,
  TimeOff,
  User,
  Verification,
} from '../models/index.js';

import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

/** Supprime du disque les documents privés des fiches clientes concernées. */
export async function removeClientFiles(filter) {
  const records = await ClientRecord.find(filter).select('files').lean();
  for (const r of records) for (const f of r.files || []) fs.rm(path.join(path.resolve(env.privateDir), f.storedName), { force: true }, () => {});
}

/** Supprime des conversations, leurs messages et leurs photos (stockage privé). */
export async function removeConversations(filter) {
  const convs = await Conversation.find(filter).select('_id').lean();
  if (!convs.length) return;
  const ids = convs.map((c) => c._id);
  const photos = await Message.find({ conversation: { $in: ids }, 'image.storedName': { $exists: true } }).select('image').lean();
  for (const m of photos) fs.rm(path.join(path.resolve(env.privateDir), 'chat', m.image.storedName), { force: true }, () => {});
  await Message.deleteMany({ conversation: { $in: ids } });
  await Conversation.deleteMany({ _id: { $in: ids } });
}

export async function purgeUser(userId) {
  const practitioner = await Practitioner.findOne({ user: userId });
  await removeConversations({ $or: [{ user: userId }, ...(practitioner ? [{ practitioner: practitioner._id }] : [])] });
  await EventRegistration.deleteMany({ user: userId });
  if (practitioner) {
    const p = practitioner._id;
    await removeClientFiles({ practitioner: p });
    await Promise.all([
      Service.deleteMany({ practitioner: p }),
      Availability.deleteMany({ practitioner: p }),
      TimeOff.deleteMany({ practitioner: p }),
      Subscription.deleteMany({ practitioner: p }),
      ClientRecord.deleteMany({ practitioner: p }),
      Review.deleteMany({ practitioner: p }),
      Favorite.deleteMany({ practitioner: p }),
      Booking.deleteMany({ practitioner: p }),
    ]);
    await practitioner.deleteOne();
  }
  await removeClientFiles({ client: userId });
  await Promise.all([
    Period.deleteMany({ user: userId }),
    DailyLog.deleteMany({ user: userId }),
    PrayerLog.deleteMany({ user: userId }),
    MissedFast.deleteMany({ user: userId }),
    MadeUpFast.deleteMany({ user: userId }),
    FastPlan.deleteMany({ user: userId }),
    Pregnancy.deleteMany({ user: userId }),
    Appointment.deleteMany({ user: userId }),
    Notification.deleteMany({ user: userId }),
    PushSubscription.deleteMany({ user: userId }),
    Verification.deleteMany({ user: userId }),
    Booking.deleteMany({ client: userId }),
    Review.deleteMany({ client: userId }),
    Favorite.deleteMany({ client: userId }),
    ClientRecord.deleteMany({ client: userId }),
  ]);
  await User.deleteOne({ _id: userId });
}

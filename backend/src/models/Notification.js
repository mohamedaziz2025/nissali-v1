import mongoose from 'mongoose';

const { Schema } = mongoose;

// RG-17 : le titre et le corps affichés hors de l'appli restent discrets ;
// le détail n'est visible qu'une fois l'appli ouverte.
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    detail: String,
    link: String,
    imageUrl: String,
    read: { type: Boolean, default: false },
    pushed: { type: Boolean, default: false },
    // 5.12 — « conseil » : conseils et actualités, soumis à la fréquence choisie (RG-36, RG-37).
    category: { type: String, enum: ['essentiel', 'conseil'], default: 'essentiel' },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, key: 1 }, { unique: true });
notificationSchema.index({ user: 1, category: 1, createdAt: -1 });

const pushSubscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: String, auth: String },
  },
  { timestamps: true },
);

export const Notification = mongoose.model('Notification', notificationSchema);
export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

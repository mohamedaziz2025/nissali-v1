import mongoose from 'mongoose';

const { Schema } = mongoose;

// RG-08 ter — Bibliothèque de conseils santé par phase (au moins 10 par phase), relus par une sage-femme.
const healthTipSchema = new Schema(
  {
    phase: { type: String, enum: ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale', 'grossesse'], required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    text: { type: String, required: true, maxlength: 600 },
    theme: { type: String, enum: ['alimentation', 'sommeil', 'activite', 'douleurs', 'hydratation', 'bien_etre'], default: 'bien_etre' },
    articleSlug: String, // article lié dans Lifestyle › Magazine
    reviewed: { type: Boolean, default: false }, // relu par une sage-femme (coché dans le back-office)
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Notifications envoyées par l'équipe (push + centre de notifications), avec image facultative.
const broadcastSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 80 },
    body: { type: String, required: true, maxlength: 300 },
    detail: { type: String, maxlength: 2000 },
    imageUrl: String,
    link: String,
    audience: {
      type: { type: String, enum: ['toutes', 'actualites', 'praticiennes', 'ville', 'situation', 'utilisatrice'], default: 'toutes' },
      city: String,
      situation: String,
      userId: String,
    },
    category: { type: String, enum: ['conseil', 'essentiel'], default: 'conseil' }, // 5.12
    // 4.13 · 8.4 — canal (push + centre, ou seulement dans l'appli), type de message, ciblage (jamais de santé),
    // programmation, envois décalés par utilisatrice (nuit, heure de prière : RG-37).
    channel: { type: String, enum: ['push', 'app'], default: 'push' },
    kind: { type: String, enum: ['conseil', 'article', 'evenement', 'nouveaute'], default: 'conseil' },
    targeting: { country: String, region: String, city: String, situation: String, ageMin: Number, ageMax: Number },
    status: { type: String, enum: ['programmee', 'en_cours', 'envoyee', 'annulee'], default: 'envoyee' },
    scheduledAt: Date,
    sentAt: Date,
    queue: { type: [{ _id: false, user: Schema.Types.ObjectId, at: Date, tries: { type: Number, default: 0 } }], default: [] },
    article: { type: Schema.Types.ObjectId, ref: 'Article' },
    blockedReason: String,
    recipients: { type: Number, default: 0 },
    pushed: { type: Number, default: 0 },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const HealthTip = mongoose.model('HealthTip', healthTipSchema);
export const Broadcast = mongoose.model('Broadcast', broadcastSchema);

import mongoose from 'mongoose';

const { Schema } = mongoose;

// 5.11 — Lifestyle › Événements : organisés par Nissali ou proposés par une sœur (validés avant publication).
const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 4000 },
    programme: { type: String, default: '', maxlength: 4000 },
    startAt: { type: Date, required: true, index: true },
    endAt: Date,
    timezone: { type: String, default: 'Europe/Paris' },
    location: {
      name: { type: String, default: '' },
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      region: { type: String, default: '' },
      lat: Number,
      lng: Number,
      online: { type: Boolean, default: false },
    },
    imageUrl: String,
    photos: { type: [String], default: [] }, // galerie : photos de l'événement (affichées en grille)
    capacity: { type: Number, default: 30, min: 1, max: 5000 },
    price: { type: Number, default: 0, min: 0 }, // en euros ; 0 = gratuit
    // Événement payant : billets vendus sur la billetterie en ligne de l'organisatrice (HelloAsso, Weezevent…).
    ticketUrl: String,
    organizerType: { type: String, enum: ['nissali', 'soeur'], required: true },
    organizer: { type: Schema.Types.ObjectId, ref: 'User' },
    organizerName: String,
    status: { type: String, enum: ['en_attente', 'modification', 'publie', 'refuse', 'annule'], default: 'en_attente', index: true },
    moderationNote: String,
    cancellationPolicy: { type: String, default: 'Annulation gratuite jusqu’à 48 h avant l’événement. En cas d’annulation par l’organisatrice, remboursement intégral.' },
    registrationsCount: { type: Number, default: 0 },
    payoutStatus: { type: String, enum: ['non_applicable', 'a_verser', 'verse'], default: 'non_applicable' },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const eventRegistrationSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['inscrite', 'annulee'], default: 'inscrite' },
    // RG-29 / RG-30 : billet payant = prix ; commission Nissali 15 % (événements des sœurs uniquement).
    amount: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['gratuit', 'a_regler', 'paye', 'rembourse', 'billetterie'], default: 'gratuit' },
  },
  { timestamps: true },
);
eventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });

export const Event = mongoose.model('Event', eventSchema);
export const EventRegistration = mongoose.model('EventRegistration', eventRegistrationSchema);

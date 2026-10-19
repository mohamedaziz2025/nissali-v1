import mongoose from 'mongoose';

const { Schema } = mongoose;

// Jours manqués ajoutés à la main (maladie, voyage, années précédentes…).
const missedFastSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hijriYear: { type: Number, required: true },
    count: { type: Number, default: 1, min: 1, max: 30 },
    reason: { type: String, enum: ['maladie', 'voyage', 'grossesse', 'allaitement', 'regles', 'autre'], default: 'autre' },
    day: String,
    note: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);

// Jour rattrapé (coché).
const madeUpFastSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
  },
  { timestamps: true },
);
madeUpFastSchema.index({ user: 1, day: 1 }, { unique: true });

// 08 — Jours déjà rattrapés hors application (avant Nissali), rattachés à un Ramadan.
// Par nombre (dates facultatives) ou par dates : les deux modes décrivent la même saisie, ils ne s'additionnent pas.
const priorMadeUpSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hijriYear: { type: Number, required: true },
    mode: { type: String, enum: ['nombre', 'dates'], default: 'nombre' },
    count: { type: Number, required: true, min: 1, max: 60 },
    dates: { type: [String], default: [] },
    requestId: String, // évite le double envoi après deux clics
  },
  { timestamps: true },
);
priorMadeUpSchema.index({ user: 1, requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } });

// Plan de rattrapage : rythme choisi par l'utilisatrice.
const fastPlanSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    active: { type: Boolean, default: true },
    perWeek: { type: Number, min: 1, max: 7, default: 2 },
    weekdays: { type: [Number], default: [1, 4] },
    reminderTime: { type: String, default: '21:00' },
  },
  { timestamps: true },
);

// 5.8 — Jeûne volontaire (surérogatoire) noté avec « J'ai jeûné ». RG-32 : un jour seulement programmé
// n'est jamais compté ; seul ce bouton l'ajoute au récap.
export const VOLUNTARY_TYPES = ['lundi_jeudi', 'jours_blancs', 'arafat', 'achoura', 'chawwal', 'autre'];
const voluntaryFastSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
    type: { type: String, enum: VOLUNTARY_TYPES, default: 'autre' },
  },
  { timestamps: true },
);
voluntaryFastSchema.index({ user: 1, day: 1 }, { unique: true });

export const MissedFast = mongoose.model('MissedFast', missedFastSchema);
export const VoluntaryFast = mongoose.model('VoluntaryFast', voluntaryFastSchema);
export const MadeUpFast = mongoose.model('MadeUpFast', madeUpFastSchema);
export const FastPlan = mongoose.model('FastPlan', fastPlanSchema);
export const PriorMadeUp = mongoose.model('PriorMadeUp', priorMadeUpSchema);

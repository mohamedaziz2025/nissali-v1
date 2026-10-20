import mongoose from 'mongoose';

const { Schema } = mongoose;

// 5.7 bis — Compteurs de dhikr d'une journée (RG-38 : la journée commence à Fajr). L'historique garde le
// total de chaque jour et de chaque dhikr ; `reached` liste les dhikr dont l'objectif a été atteint.
const dhikrDaySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true }, // YYYY-MM-DD
    counts: { type: Map, of: Number, default: {} },
    goals: { type: Map, of: Number, default: {} },
    reached: { type: [String], default: [] },
    total: { type: Number, default: 0 },
  },
  { timestamps: true },
);
dhikrDaySchema.index({ user: 1, day: 1 }, { unique: true });

export const DhikrDay = mongoose.model('DhikrDay', dhikrDaySchema);

// 4.13 / RG-41 — Bibliothèque des dhikr proposés par l'appli (« Les plus connus »), gérée dans le back-office :
// texte arabe, phonétique, sens et objectif par défaut, validés par le comité avant publication.
const dhikrEntrySchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    arabic: { type: String, required: true },
    name: { type: String, required: true },
    meaning: { type: String, default: '' },
    source: { type: String, default: '' },
    goal: { type: Number, default: 33 },
    // Proposé au départ dans la liste du jour (les 6 plus connus).
    isDefault: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    validatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

export const DhikrEntry = mongoose.model('DhikrEntry', dhikrEntrySchema);

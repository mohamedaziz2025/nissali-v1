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

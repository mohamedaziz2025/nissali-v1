import mongoose from 'mongoose';

const { Schema } = mongoose;

export const MOODS = ['sereine', 'bien', 'fatiguee', 'irritable', 'triste'];
export const SYMPTOMS = [
  'crampes',
  'fatigue',
  'migraine',
  'ballonnements',
  'douleurs_dos',
  'seins_sensibles',
  'acne',
  'nausees',
  'fringales',
  'insomnie',
  'caillots',
  'vertiges',
];

// Santé du jour (5.9) et signes de fertilité (5.5).
const dailyLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
    mood: { type: String, enum: MOODS },
    energy: { type: Number, min: 1, max: 5 },
    symptoms: [String],
    sleepHours: { type: Number, min: 0, max: 24 },
    weight: { type: Number, min: 25, max: 300 },
    medications: [String],
    pillTaken: Boolean,
    temperature: { type: Number, min: 34, max: 42 },
    cervicalMucus: { type: String, enum: ['seche', 'collante', 'cremeuse', 'aqueuse', 'blanc_oeuf'] },
    ovulationTest: { type: String, enum: ['positif', 'negatif'] },
    spotting: Boolean, // traces hors règles (ne marquent pas un début de cycle — RG-10)
    notes: { type: String, maxlength: 1000 },
  },
  { timestamps: true },
);

dailyLogSchema.index({ user: 1, day: 1 }, { unique: true });

export const DailyLog = mongoose.model('DailyLog', dailyLogSchema);

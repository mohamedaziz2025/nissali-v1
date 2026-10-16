import mongoose from 'mongoose';

const { Schema } = mongoose;

// Petit rappel du jour (verset, hadith ou conseil), validé par le comité.
const reminderSchema = new Schema(
  {
    kind: { type: String, enum: ['verset', 'hadith', 'conseil'], default: 'hadith' },
    text: { type: String, required: true, maxlength: 500 },
    source: String,
    scheduledFor: { type: String, index: true }, // YYYY-MM-DD, facultatif
    validated: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Reminder = mongoose.model('Reminder', reminderSchema);

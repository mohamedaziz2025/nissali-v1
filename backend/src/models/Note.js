import mongoose from 'mongoose';

const { Schema } = mongoose;

export const NOTE_TYPES = ['medicament', 'cours', 'rendez_vous', 'symptome', 'autre'];
export const NOTE_REPEATS = ['once', 'daily', 'weekly', 'monthly'];

// 5.2 bis — Mes notes (créées depuis l'accueil, visibles dans le calendrier du Cycle). RG-35 : le texte est
// chiffré au repos (services/secretBox.js), jamais visible par une praticienne ni utilisé pour la publicité.
const noteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, required: true }, // chiffré
    type: { type: String, enum: NOTE_TYPES, default: 'autre' },
    day: { type: String, required: true }, // première date (passée ou future)
    time: { type: String, default: null }, // HH:mm facultatif
    repeat: { type: String, enum: NOTE_REPEATS, default: 'once' },
    weekdays: { type: [Number], default: [] }, // 0 = dimanche … 6 = samedi (répétition chaque semaine)
    until: { type: String, default: null }, // date de fin facultative
    showInCalendar: { type: Boolean, default: true },
    remind: { type: Boolean, default: false },
    paused: { type: Boolean, default: false },
    skips: { type: [String], default: [] }, // occurrences supprimées une à une
  },
  { timestamps: true },
);

export const Note = mongoose.model('Note', noteSchema);

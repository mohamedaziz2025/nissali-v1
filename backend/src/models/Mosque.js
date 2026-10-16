import mongoose from 'mongoose';

const { Schema } = mongoose;

// 5.7 / 6.8 — Mosquées : partenaires (horaires saisis dans le back-office) ou trouvées autour de
// l'utilisatrice (OpenStreetMap). Sans horaires publiés pour un jour, l'appli bascule sur le calcul (RG-16 bis).
const timetableRowSchema = new Schema(
  {
    day: { type: String, required: true }, // AAAA-MM-JJ
    fajr: String,
    sunrise: String,
    dhuhr: String,
    asr: String,
    maghrib: String,
    isha: String,
    jumua: String,
    jumua2: String,
  },
  { _id: false },
);

const mosqueSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    region: { type: String, default: '' },
    country: { type: String, default: '' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    timezone: { type: String, default: 'Europe/Paris' },
    osmId: { type: String, index: true, sparse: true },
    partner: { type: Boolean, default: false },
    jumua: { type: String, default: '' }, // heure habituelle de la Jumu'a
    jumua2: { type: String, default: '' }, // 2e Jumu'a, quand la mosquée en organise deux
    timetable: { type: [timetableRowSchema], default: [] },
    timetableNote: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
mosqueSchema.index({ partner: 1, city: 1 });

export const Mosque = mongoose.model('Mosque', mosqueSchema);

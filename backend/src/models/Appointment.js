import mongoose from 'mongoose';

const { Schema } = mongoose;

// Rendez-vous médicaux notés par l'utilisatrice (échographies, consultations — 5.6).
// Les rendez-vous pris avec une praticienne sont des réservations (Booking).
const appointmentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    day: { type: String, required: true },
    time: String,
    notes: { type: String, maxlength: 500 },
    status: { type: String, enum: ['prevu', 'annule', 'termine'], default: 'prevu' },
  },
  { timestamps: true },
);

export const Appointment = mongoose.model('Appointment', appointmentSchema);

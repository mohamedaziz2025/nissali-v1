import mongoose from 'mongoose';

const { Schema } = mongoose;

// Codes OTP à usage unique envoyés par e-mail ou SMS (inscription, connexion,
// double authentification du back-office, changement d'adresse).
const verificationSchema = new Schema(
  {
    target: { type: String, required: true, index: true }, // e-mail ou numéro normalisé
    channel: { type: String, enum: ['email', 'sms'], required: true },
    purpose: { type: String, enum: ['register', 'login', 'admin2fa', 'change', 'reset', 'link'], required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

verificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Verification = mongoose.model('Verification', verificationSchema);

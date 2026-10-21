// Compte de démonstration pour la revue App Store : ajoute un mot de passe connu à un compte existant.
// Usage : REVIEW_EMAIL=amina@nissali.app REVIEW_PASSWORD=... npm run review:account
// Le compte doit déjà exister (npm run seed) : on ne crée pas de compte vide en production.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { User } from '../models/index.js';

const email = (process.env.REVIEW_EMAIL || 'amina@nissali.app').toLowerCase();
const password = process.env.REVIEW_PASSWORD;

if (!password || password.length < 8) {
  console.error('[review] REVIEW_PASSWORD manquant ou trop court (8 caractères minimum)');
  process.exit(1);
}

await connectDb();
const user = await User.findOneAndUpdate(
  { email },
  { $set: { passwordHash: await bcrypt.hash(password, 12), passwordSet: true, emailVerified: true, status: 'active' } },
  { new: true },
);
await mongoose.disconnect();

if (!user) {
  console.error(`[review] aucun compte ${email} : lance npm run seed ou choisis un REVIEW_EMAIL existant`);
  process.exit(1);
}
console.log(`[review] mot de passe défini pour ${email}`);

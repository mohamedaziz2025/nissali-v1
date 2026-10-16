import mongoose from 'mongoose';

const { Schema } = mongoose;

const citySchema = new Schema(
  {
    name: { type: String, required: true },
    country: String,
    countryCode: String,
    admin: String,
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    timezone: { type: String, default: 'Europe/Paris' },
    // « gps » : position du téléphone (mise à jour automatique) ; « manuel » : ville choisie.
    source: { type: String, enum: ['manuel', 'gps'], default: 'manuel' },
    updatedAt: Date,
  },
  { _id: false },
);

const consentSchema = new Schema(
  {
    accepted: { type: Boolean, default: false },
    at: Date,
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    firstName: { type: String, trim: true, maxlength: 60 },
    birthYear: Number,
    city: citySchema,
    situation: { type: String, enum: ['mariee', 'celibataire'] },

    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    emailVerified: { type: Boolean, default: false },
    phone: { type: String, trim: true, unique: true, sparse: true },
    phoneVerified: { type: Boolean, default: false },
    // Connexion : par code OTP (toujours possible) ou par mot de passe si l'utilisatrice en a créé un.
    // Les administratrices ont toujours mot de passe + code (double authentification).
    passwordHash: { type: String, select: false },
    passwordSet: { type: Boolean, default: false },

    // Un seul compte : l'espace pro existe si un profil Practitioner est rattaché.
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    lastSpace: { type: String, enum: ['personnel', 'pro'], default: 'personnel' },
    status: { type: String, enum: ['active', 'suspendue'], default: 'active' },

    consents: {
      terms: { type: consentSchema, default: () => ({}) },
      health: { type: consentSchema, default: () => ({}) },
      marketingEmail: { type: consentSchema, default: () => ({}) },
      marketingSms: { type: consentSchema, default: () => ({}) },
      marketingWhatsapp: { type: consentSchema, default: () => ({}) },
    },

    onboarding: {
      completed: { type: Boolean, default: false },
      goal: { type: String, enum: ['suivre', 'enfant', 'enceinte'], default: 'suivre' },
      cycleLength: Number, // déclarée ; null = « je ne sais pas »
      periodLength: Number,
    },

    mode: { type: String, enum: ['cycle', 'grossesse', 'postpartum'], default: 'cycle' },
    deliveryDate: String, // YYYY-MM-DD, pour le post-partum
    specialProfile: {
      type: String,
      enum: ['aucun', 'adolescente', 'arret_pilule', 'post_partum', 'allaitement', 'premenopause'],
      default: 'aucun',
    },

    // 5.7 — Source des horaires : « ville » (calcul à la position) ou « mosquee » (horaires de la mosquée choisie).
    prayerSource: {
      mode: { type: String, enum: ['ville', 'mosquee'], default: 'ville' },
      mosque: { type: Schema.Types.ObjectId, ref: 'Mosque' },
    },
    prayerSettings: {
      notifications: { type: Boolean, default: true },
      adhan: { type: Boolean, default: true },
      adhanVoice: { type: String, default: 'a9' }, // voir services/adhan.js
      // À l'heure de la prière : notification seule, ou adhan joué automatiquement avec la notification.
      adhanMode: { type: String, enum: ['notification', 'adhan'], default: 'adhan' },
      // 07 — prières pour lesquelles l'adhan est joué (le son ne réactive jamais des rappels en pause).
      adhanPrayers: {
        fajr: { type: Boolean, default: true },
        dhuhr: { type: Boolean, default: true },
        asr: { type: Boolean, default: true },
        maghrib: { type: Boolean, default: true },
        isha: { type: Boolean, default: true },
      },
      dhikrDuringPeriod: { type: Boolean, default: false },
      // Rappels de dhikr calés sur les horaires de la position : matin (Fajr), soir (Asr), vendredi.
      adhkarMorning: { type: Boolean, default: true },
      adhkarEvening: { type: Boolean, default: true },
      jumua: { type: Boolean, default: true },
      // Horaires et qibla calculés à la position du téléphone (sinon : ville enregistrée).
      followLocation: { type: Boolean, default: true },
      adjustments: {
        fajr: { type: Number, default: 0, min: -30, max: 30 },
        dhuhr: { type: Number, default: 0, min: -30, max: 30 },
        asr: { type: Number, default: 0, min: -30, max: 30 },
        maghrib: { type: Number, default: 0, min: -30, max: 30 },
        isha: { type: Number, default: 0, min: -30, max: 30 },
      },
    },

    notificationPrefs: {
      periodSoon: { type: Boolean, default: true },
      fertileWindow: { type: Boolean, default: true },
      periodEndQuestion: { type: Boolean, default: true },
      fastMakeup: { type: Boolean, default: true },
      ramadan: { type: Boolean, default: true },
      whiteDays: { type: Boolean, default: true },
      dailyReminder: { type: Boolean, default: true },
    },

    contraception: {
      type: { type: String, enum: ['aucune', 'pilule', 'sterilet', 'implant', 'preservatif', 'autre'], default: 'aucune' },
      pillReminder: { type: Boolean, default: false },
      pillTime: { type: String, default: '21:00' },
    },

    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

userSchema.virtual('age').get(function age() {
  return this.birthYear ? new Date().getUTCFullYear() - this.birthYear : null;
});

userSchema.virtual('hasHealthConsent').get(function hasHealthConsent() {
  return Boolean(this.consents?.health?.accepted);
});

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this.id,
    firstName: this.firstName,
    age: this.age,
    birthYear: this.birthYear,
    city: this.city,
    situation: this.situation,
    email: this.email,
    emailVerified: this.emailVerified,
    phone: this.phone,
    phoneVerified: this.phoneVerified,
    hasPassword: Boolean(this.passwordSet),
    role: this.role,
    status: this.status,
    lastSpace: this.lastSpace,
    consents: this.consents,
    onboarding: this.onboarding,
    mode: this.mode,
    deliveryDate: this.deliveryDate,
    specialProfile: this.specialProfile,
    prayerSettings: this.prayerSettings,
    prayerSource: { mode: this.prayerSource?.mode || 'ville', mosque: this.prayerSource?.mosque ? String(this.prayerSource.mosque) : null },
    notificationPrefs: this.notificationPrefs,
    contraception: this.contraception,
    profileComplete: Boolean(this.firstName && this.birthYear && this.city?.name && this.situation),
    createdAt: this.createdAt,
  };
};

userSchema.index({ lastActiveAt: 1 });
userSchema.index({ createdAt: 1 });

export const User = mongoose.model('User', userSchema);

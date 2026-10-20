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
    // 4.7 · 6.2 — glaire et température dans le Suivi santé (sinon seulement en mode « Je veux un enfant »).
    fertilitySigns: { type: Boolean, default: false },

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
      // 4.5 · 4.2 — son de chaque prière, rappel à l'heure ou avant, réglages « Pendant mes règles ».
      prayerSound: {
        fajr: { type: String, enum: ['complet', 'court', 'bip', 'silencieux'], default: 'complet' },
        dhuhr: { type: String, enum: ['complet', 'court', 'bip', 'silencieux'], default: 'complet' },
        asr: { type: String, enum: ['complet', 'court', 'bip', 'silencieux'], default: 'complet' },
        maghrib: { type: String, enum: ['complet', 'court', 'bip', 'silencieux'], default: 'complet' },
        isha: { type: String, enum: ['complet', 'court', 'bip', 'silencieux'], default: 'complet' },
      },
      notifyOffset: { type: Number, enum: [0, 10, 15], default: 0 },
      periodHome: { type: String, enum: ['horaires', 'ligne'], default: 'horaires' },
      keepRemindersDuringPeriod: { type: Boolean, default: false },
      keepDhikrDuringPeriod: { type: Boolean, default: true },
      // 4.2 · 1.4 — rappels des prières à accomplir après le ghusl.
      purificationReminders: { type: Boolean, default: true },
      // 5.7 / 5.13 — rappel à l'heure de chaque prière, réglé prière par prière.
      notifyPrayers: {
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

    // 5.8 — Me programmer (jeûnes volontaires) : jours de la semaine et jeûnes du calendrier, rappel la veille.
    voluntaryPlan: {
      weekdays: { type: [Number], default: [] },
      blancs: { type: Boolean, default: false },
      arafat: { type: Boolean, default: false },
      achoura: { type: Boolean, default: false },
      chawwal: { type: Boolean, default: false },
      reminderTime: { type: String, default: '21:00' },
    },
    // 5.7 bis — Mes dhikr du jour (clé + objectif), vibration au comptage, rappel quotidien facultatif.
    dhikr: {
      list: { type: [{ _id: false, key: String, goal: Number }], default: undefined },
      haptics: { type: Boolean, default: true },
      reminder: { type: Boolean, default: false },
      reminderTime: { type: String, default: '20:30' },
    },
    notificationPrefs: {
      periodSoon: { type: Boolean, default: true },
      fertileWindow: { type: Boolean, default: true },
      periodEndQuestion: { type: Boolean, default: true },
      fastMakeup: { type: Boolean, default: true },
      ramadan: { type: Boolean, default: true },
      whiteDays: { type: Boolean, default: true },
      dailyReminder: { type: Boolean, default: true },
      // 5.12 — fréquence des conseils et actualités (RG-36 : « faible » par défaut). Ne touche jamais
      // aux rappels de prière ni aux rappels personnels (notes, jeûnes).
      frequency: { type: String, enum: ['faible', 'moderee', 'elevee'], default: 'faible' },
      frequencyAsked: { type: Boolean, default: false }, // proposé une fois après l'inscription
      // RG-35 — aperçu des rappels de notes masqué (« Rappel Nissali »).
      hideNotePreview: { type: Boolean, default: true }, // 4.5 · 4.3 : masquer l'aperçu, défaut oui
      fastPlanned: { type: Boolean, default: true }, // veille d'un jeûne volontaire programmé
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
    fertilitySigns: Boolean(this.fertilitySigns),
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
    dhikr: { haptics: this.dhikr?.haptics !== false, reminder: Boolean(this.dhikr?.reminder), reminderTime: this.dhikr?.reminderTime || '20:30' },
    contraception: this.contraception,
    profileComplete: Boolean(this.firstName && this.birthYear && this.city?.name && this.situation),
    createdAt: this.createdAt,
  };
};

userSchema.index({ lastActiveAt: 1 });
userSchema.index({ createdAt: 1 });

export const User = mongoose.model('User', userSchema);

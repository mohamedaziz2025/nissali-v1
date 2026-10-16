import mongoose from 'mongoose';

const { Schema } = mongoose;

// Espace praticiennes (annuaire, prestations, disponibilités, réservations, avis, fiches clientes).

const categorySchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    group: { type: String, default: 'bien_etre' }, // une des 6 catégories (content/categories.js)
    description: String,
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const practitionerSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    specialty: { type: String, required: true }, // clé de catégorie
    categories: [String],
    description: { type: String, default: '', maxlength: 2000 },
    photoUrl: String,
    location: {
      city: { type: String, default: '' },
      region: { type: String, default: '' },
      postcode: { type: String, default: '' },
      address: { type: String, default: '' },
      lat: Number,
      lng: Number,
    },
    // RG-26 : numéro professionnel affiché seulement si elle le choisit ; la messagerie reste toujours ouverte.
    phone: { type: String, default: '' },
    showPhone: { type: Boolean, default: false },
    diplomas: { type: [String], default: [] }, // diplômes ou certifications affichés sur la fiche
    professionalId: { type: String, default: '' }, // ADELI ou RPPS (RG-25), visible par l'équipe seulement
    legal: { siret: { type: String, default: '' } },
    languages: { type: [String], default: ['Français'] },
    inPerson: { type: Boolean, default: true },
    supportsVideo: { type: Boolean, default: false },
    status: { type: String, enum: ['en_attente', 'validee', 'refusee', 'suspendue'], default: 'en_attente' },
    rejectionReason: String,
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    timezone: { type: String, default: 'Europe/Paris' },
    minNoticeHours: { type: Number, default: 12 },
    autoConfirm: { type: Boolean, default: false },
  },
  { timestamps: true },
);
practitionerSchema.index({ status: 1, specialty: 1, 'location.city': 1 });

// Formules d'abonnement des praticiennes (gérées depuis le back-office).
const planSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tagline: String,
    priceMonthly: { type: Number, default: 0, min: 0 },
    priceYearly: { type: Number, default: 0, min: 0 },
    features: {
      maxServices: { type: Number, default: 1 }, // 0 = illimité
      maxBookingsPerMonth: { type: Number, default: 0 }, // 0 = illimité
      video: { type: Boolean, default: false },
      crm: { type: Boolean, default: false },
      stats: { type: Boolean, default: false },
      featured: { type: Boolean, default: false },
      verifiedBadge: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
    },
    highlights: [String],
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const subscriptionSchema = new Schema(
  {
    practitioner: { type: Schema.Types.ObjectId, ref: 'Practitioner', required: true, index: true },
    plan: { type: String, required: true }, // clé de formule
    billing: { type: String, enum: ['mensuel', 'annuel'], default: 'mensuel' },
    amount: { type: Number, default: 0 },
    // Une formule payante reste « en_attente » jusqu'à la confirmation du paiement par l'équipe.
    status: { type: String, enum: ['en_attente', 'active', 'expiree', 'annulee'], default: 'en_attente' },
    startedAt: Date,
    endsAt: Date,
    paymentReference: String,
  },
  { timestamps: true },
);

const serviceSchema = new Schema(
  {
    practitioner: { type: Schema.Types.ObjectId, ref: 'Practitioner', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 1000 },
    price: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, min: 10, max: 480 },
    mode: { type: String, enum: ['cabinet', 'visio', 'les_deux'], default: 'cabinet' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const availabilitySchema = new Schema(
  {
    practitioner: { type: Schema.Types.ObjectId, ref: 'Practitioner', required: true, index: true },
    weekday: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const timeOffSchema = new Schema(
  {
    practitioner: { type: Schema.Types.ObjectId, ref: 'Practitioner', required: true, index: true },
    from: { type: String, required: true }, // YYYY-MM-DD
    to: { type: String, required: true },
    reason: String,
  },
  { timestamps: true },
);

export const BOOKING_STATUSES = ['en_attente', 'confirmee', 'refusee', 'annulee', 'terminee', 'absente'];

const bookingSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    practitioner: { type: Schema.Types.ObjectId, ref: 'Practitioner', required: true },
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: String,
    mode: { type: String, enum: ['cabinet', 'visio'], required: true },
    day: { type: String, required: true },
    time: { type: String, required: true },
    endTime: { type: String, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: BOOKING_STATUSES, default: 'en_attente' },
    price: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['non_paye', 'paye'], default: 'non_paye' }, // réglé sur place
    videoUrl: String,
    clientNote: { type: String, maxlength: 500 },
    cancelReason: String,
    cancelledBy: { type: String, enum: ['cliente', 'praticienne', 'admin'] },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);
bookingSchema.index({ practitioner: 1, startAt: 1 });

const reviewSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    practitioner: { type: Schema.Types.ObjectId, ref: 'Practitioner', required: true, index: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 1000 },
    reply: { type: String, maxlength: 1000 },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Fiche cliente côté praticienne. Aucune donnée de cycle ou de santé Nissali n'y figure :
// seules les informations saisies par la praticienne elle-même (dossier professionnel).
const clientNoteSchema = new Schema({
  kind: { type: String, enum: ['note', 'seance'], default: 'note' },
  title: { type: String, maxlength: 120 },
  content: { type: String, required: true, maxlength: 5000 },
  booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
  at: { type: Date, default: Date.now },
});

const clientFileSchema = new Schema({
  name: { type: String, required: true, maxlength: 200 },
  storedName: { type: String, required: true },
  mime: String,
  size: Number,
  at: { type: Date, default: Date.now },
});

const clientRecordSchema = new Schema(
  {
    practitioner: { type: Schema.Types.ObjectId, ref: 'Practitioner', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['nouvelle', 'reguliere', 'fidele', 'inactive'], default: 'nouvelle' },
    tags: [String],
    profile: {
      birthDate: String,
      address: { type: String, maxlength: 300 },
      occupation: { type: String, maxlength: 120 },
      emergencyContact: { type: String, maxlength: 200 },
      referral: { type: String, enum: ['annuaire', 'bouche_a_oreille', 'reseaux', 'medecin', 'autre'] },
      preferredMode: { type: String, enum: ['cabinet', 'visio', 'indifferent'] },
      preferredTimes: { type: String, maxlength: 200 },
    },
    care: {
      reason: { type: String, maxlength: 2000 }, // motif de consultation
      history: { type: String, maxlength: 4000 }, // antécédents
      allergies: { type: String, maxlength: 1000 },
      treatments: { type: String, maxlength: 2000 },
      goals: { type: String, maxlength: 2000 },
    },
    consent: { given: { type: Boolean, default: false }, at: Date },
    notes: [clientNoteSchema],
    files: [clientFileSchema],
    bookingCount: { type: Number, default: 0 },
    lastBookingAt: Date,
  },
  { timestamps: true },
);
clientRecordSchema.index({ practitioner: 1, client: 1 }, { unique: true });

const favoriteSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    practitioner: { type: Schema.Types.ObjectId, ref: 'Practitioner', required: true },
  },
  { timestamps: true },
);
favoriteSchema.index({ client: 1, practitioner: 1 }, { unique: true });

export const Category = mongoose.model('Category', categorySchema);
export const Plan = mongoose.model('Plan', planSchema);
export const Subscription = mongoose.model('Subscription', subscriptionSchema);
export const Practitioner = mongoose.model('Practitioner', practitionerSchema);
export const Service = mongoose.model('Service', serviceSchema);
export const Availability = mongoose.model('Availability', availabilitySchema);
export const TimeOff = mongoose.model('TimeOff', timeOffSchema);
export const Booking = mongoose.model('Booking', bookingSchema);
export const Review = mongoose.model('Review', reviewSchema);
export const ClientRecord = mongoose.model('ClientRecord', clientRecordSchema);
export const Favorite = mongoose.model('Favorite', favoriteSchema);

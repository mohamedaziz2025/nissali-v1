// Données de démarrage : paramètres, contenus, formules, comptes de démonstration.
// Usage : npm run seed   (ajouter --reset pour vider la base avant)
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import {
  Article,
  Availability,
  Booking,
  Category,
  ClientRecord,
  DailyLog,
  FastPlan,
  MadeUpFast,
  MissedFast,
  Period,
  Plan,
  Practitioner,
  PrayerLog,
  Reminder,
  Review,
  Service,
  Subscription,
  User,
} from '../models/index.js';
import { addDays, localParts, minutesToTime, timeToMinutes, weekday, zonedToDate } from '../utils/dates.js';
import { ARTICLES } from './articles.js';
import { CATEGORIES_SEED, PLANS_SEED, REMINDERS } from './data.js';
import { seedV3 } from './v3.js';

const PARIS = { name: 'Paris', admin: 'Île-de-France', country: 'France', countryCode: 'FR', lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris' };
const LYON = { name: 'Lyon', admin: 'Auvergne-Rhône-Alpes', country: 'France', countryCode: 'FR', lat: 45.7485, lng: 4.8467, timezone: 'Europe/Paris' };
const CRETEIL = { name: 'Créteil', admin: 'Île-de-France', country: 'France', countryCode: 'FR', lat: 48.7904, lng: 2.4556, timezone: 'Europe/Paris' };

const allConsents = (marketing = true) => {
  const at = new Date();
  const c = (accepted) => ({ accepted, at: accepted ? at : undefined });
  return { terms: c(true), health: c(true), marketingEmail: c(marketing), marketingSms: c(false), marketingWhatsapp: c(marketing) };
};

async function upsertUser(filter, data) {
  const existing = await User.findOne(filter);
  if (existing) return existing;
  return User.create({ ...filter, ...data });
}

async function seedReference() {
  for (const c of CATEGORIES_SEED) await Category.updateOne({ key: c.key }, { $setOnInsert: c }, { upsert: true });
  for (const p of PLANS_SEED) await Plan.updateOne({ key: p.key }, { $setOnInsert: p }, { upsert: true });
  for (const a of ARTICLES) {
    await Article.updateOne({ slug: a.slug }, { $setOnInsert: { ...a, publishAt: new Date(Date.now() - 86_400_000), published: true, views: Math.floor(Math.random() * 400) } }, { upsert: true });
  }
  if (!(await Reminder.countDocuments())) await Reminder.insertMany(REMINDERS.map((r) => ({ ...r, validated: true })));
  console.log(`[seed] ${CATEGORIES_SEED.length} spécialités, ${PLANS_SEED.length} formules, ${ARTICLES.length} articles, ${REMINDERS.length} rappels`);
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@nissali.app').toLowerCase();
  // Sans SEED_ADMIN_PASSWORD : mot de passe aléatoire, affiché une seule fois à la création.
  const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(12).toString('base64url');
  const admin = await User.findOne({ email });
  if (!admin) {
    await User.create({ email, emailVerified: true, firstName: 'Équipe Nissali', role: 'admin', passwordHash: await bcrypt.hash(password, 12), passwordSet: true, consents: allConsents(false) });
    console.log(`[seed] administratrice : ${email} / ${password}`);
  }
}

/** Amina : utilisatrice de démonstration (maquettes du cahier). */
async function seedAmina(today) {
  const amina = await upsertUser(
    { email: 'amina@nissali.app' },
    {
      emailVerified: true,
      phone: '+33600000001',
      phoneVerified: true,
      firstName: 'Amina',
      birthYear: new Date().getUTCFullYear() - 27,
      city: PARIS,
      situation: 'mariee',
      consents: allConsents(true),
      onboarding: { completed: true, goal: 'suivre', cycleLength: 28, periodLength: 5 },
    },
  );
  if (await Period.exists({ user: amina._id })) return amina;

  // Règles : dernier J1 il y a 18 jours (jour 19 du cycle), cycles réguliers autour de 28 jours.
  const lengths = [28, 27, 29, 28, 28, 27, 29, 28, 28, 27];
  let start = addDays(today, -18);
  const starts = [start];
  for (const l of lengths) {
    start = addDays(start, -l);
    starts.unshift(start);
  }
  for (const [i, s] of starts.entries()) {
    const len = i % 3 === 0 ? 6 : 5;
    await Period.create({
      user: amina._id,
      start: s,
      startTime: '08:30',
      end: addDays(s, len - 1),
      endTime: '21:00',
      flows: Array.from({ length: len }, (_, k) => ({ day: addDays(s, k), level: k === 0 ? 'moyen' : k < 3 ? 'abondant' : k === len - 1 ? 'traces' : 'leger' })),
      source: 'historique',
    });
  }

  // Santé du jour sur 60 jours
  const moods = ['sereine', 'bien', 'bien', 'fatiguee', 'bien', 'sereine', 'irritable'];
  const logs = [];
  for (let i = 60; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    logs.push({
      user: amina._id,
      day,
      mood: i === 0 ? 'bien' : moods[i % moods.length],
      energy: 2 + (i % 4),
      sleepHours: i === 0 ? 7.33 : 6.5 + ((i * 7) % 20) / 10,
      weight: Math.round((61.2 + Math.sin(i / 6) * 0.6) * 10) / 10,
      symptoms: i === 0 ? ['crampes', 'fatigue'] : i % 5 === 0 ? ['ballonnements'] : [],
    });
  }
  await DailyLog.insertMany(logs);

  // Prières de la semaine
  for (let i = 6; i >= 0; i -= 1) {
    const all = i > 0;
    await PrayerLog.create({ user: amina._id, day: addDays(today, -i), fajr: true, dhuhr: true, asr: all, maghrib: all, isha: all && i % 3 !== 0 });
  }

  // Jeûnes : jours d'années précédentes + rattrapages + plan 2 jours / semaine (lundi, jeudi)
  await MissedFast.create({ user: amina._id, hijriYear: 1446, count: 3, reason: 'maladie', note: 'Grippe pendant Ramadan' });
  const madeUp = [];
  for (let i = 1; madeUp.length < 4 && i < 90; i += 1) {
    const d = addDays(today, -i - 20);
    if ([1, 4].includes(weekday(d))) madeUp.push({ user: amina._id, day: d });
  }
  await MadeUpFast.insertMany(madeUp);
  await FastPlan.create({ user: amina._id, perWeek: 2, weekdays: [1, 4], reminderTime: '21:00' });
  console.log('[seed] démo : amina@nissali.app (ou +33600000001) — utilisatrice');
  return amina;
}

const PRACTITIONERS = [
  {
    email: 'samira@nissali.app',
    phone: '+33600000002',
    firstName: 'Samira',
    city: PARIS,
    pro: { displayName: 'Samira B.', specialty: 'psychologue', city: 'Paris 11e', address: '12 rue Oberkampf, 75011 Paris', description: 'Psychologue clinicienne, j’accompagne les femmes dans les périodes de transition : mariage, maternité, deuil, anxiété. Consultations en cabinet et en visio.', supportsVideo: true, plan: 'essentiel', languages: ['Français', 'Arabe'] },
    services: [
      { name: 'Première consultation', description: 'Faire connaissance et définir ensemble tes besoins.', price: 60, durationMinutes: 60, mode: 'les_deux' },
      { name: 'Séance de suivi', description: 'Séance individuelle de suivi.', price: 50, durationMinutes: 45, mode: 'les_deux' },
    ],
  },
  {
    email: 'ines@nissali.app',
    phone: '+33600000003',
    firstName: 'Inès',
    city: CRETEIL,
    pro: { displayName: 'Inès K.', specialty: 'sage_femme', city: 'Créteil', address: '5 avenue du Général de Gaulle, 94000 Créteil', description: 'Sage-femme libérale : suivi de grossesse, préparation à la naissance, rééducation du périnée, suivi gynécologique de prévention.', supportsVideo: false, plan: 'premium', languages: ['Français'] },
    services: [
      { name: 'Consultation de suivi de grossesse', price: 30, durationMinutes: 30, mode: 'cabinet' },
      { name: 'Préparation à la naissance', price: 45, durationMinutes: 60, mode: 'cabinet' },
    ],
  },
  {
    email: 'khadija@nissali.app',
    phone: '+33600000004',
    firstName: 'Khadija',
    city: LYON,
    pro: { displayName: 'Khadija M.', specialty: 'hijama', city: 'Lyon', address: 'Lyon 7e', description: 'Praticienne en hijama certifiée, exclusivement pour les femmes, dans le respect des règles d’hygiène.', supportsVideo: false, plan: 'decouverte', languages: ['Français', 'Arabe'] },
    services: [{ name: 'Séance de hijama', price: 50, durationMinutes: 60, mode: 'cabinet' }],
  },
];

async function seedPractitioners(amina, today) {
  for (const def of PRACTITIONERS) {
    const user = await upsertUser(
      { email: def.email },
      { emailVerified: true, phone: def.phone, phoneVerified: true, firstName: def.firstName, birthYear: new Date().getUTCFullYear() - 34, city: def.city, situation: 'mariee', consents: allConsents(false), onboarding: { completed: true, goal: 'suivre' } },
    );
    if (await Practitioner.exists({ user: user._id })) continue;
    const p = await Practitioner.create({
      user: user._id,
      displayName: def.pro.displayName,
      specialty: def.pro.specialty,
      categories: [def.pro.specialty],
      description: def.pro.description,
      location: { city: def.pro.city, address: def.pro.address },
      inPerson: true,
      supportsVideo: def.pro.supportsVideo,
      languages: def.pro.languages,
      status: 'validee',
      minNoticeHours: 2,
    });
    const plan = PLANS_SEED.find((x) => x.key === def.pro.plan);
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    await Subscription.create({ practitioner: p._id, plan: plan.key, amount: plan.priceMonthly, status: 'active', startedAt: new Date(), endsAt: plan.priceMonthly ? end : undefined });
    const services = await Service.insertMany(def.services.map((s) => ({ ...s, practitioner: p._id })));
    await Availability.insertMany(
      [1, 2, 3, 4, 5].flatMap((wd) => [
        { practitioner: p._id, weekday: wd, start: '09:00', end: '12:30' },
        { practitioner: p._id, weekday: wd, start: '14:00', end: '18:30' },
      ]),
    );

    // Rendez-vous d'Amina chez Samira : un confirmé à venir (entouré dans le calendrier), un terminé avec avis.
    if (def.email === 'samira@nissali.app' && amina) {
      const s = services[1];
      const mk = async (day, time, status, mode = 'cabinet') => {
        const endTime = minutesToTime(timeToMinutes(time) + s.durationMinutes);
        return Booking.create({ client: amina._id, practitioner: p._id, service: s._id, serviceName: s.name, mode, day, time, endTime, startAt: zonedToDate(day, time, 'Europe/Paris'), endAt: zonedToDate(day, endTime, 'Europe/Paris'), status, price: s.price, videoUrl: mode === 'visio' ? 'https://meet.jit.si/Nissali-demo' : undefined });
      };
      const past = await mk(addDays(today, -20), '10:00', 'terminee');
      await mk(addDays(today, 6), '14:30', 'confirmee', 'visio');
      await Review.create({ booking: past._id, practitioner: p._id, client: amina._id, rating: 5, comment: 'Très à l’écoute, je recommande.' });
      await ClientRecord.create({ practitioner: p._id, client: amina._id, status: 'reguliere', bookingCount: 2, lastBookingAt: new Date(), tags: ['visio'], notes: [{ content: 'Préfère les créneaux de l’après-midi.' }] });
      await Practitioner.updateOne({ _id: p._id }, { $set: { rating: 5, reviewsCount: 1 } });
    }
  }
  console.log('[seed] démo praticiennes : samira@nissali.app (espace perso + pro), ines@nissali.app, khadija@nissali.app');
}

async function main() {
  await connectDb();
  if (process.argv.includes('--reset')) {
    await mongoose.connection.dropDatabase();
    console.log('[seed] base vidée');
  }
  const today = localParts(new Date(), 'Europe/Paris').day;
  await seedReference();
  await seedAdmin();
  const amina = await seedAmina(today);
  await seedPractitioners(amina, today);
  await seedV3();
  await mongoose.disconnect();
  console.log('[seed] terminé ✔');
}

main().catch(async (err) => {
  console.error('[seed] erreur :', err);
  await mongoose.disconnect();
  process.exit(1);
});

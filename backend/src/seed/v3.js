// Cahier V3 : catégories, praticiennes (coordonnées, téléphone, diplômes), conseils santé, mosquées partenaires,
// événements et conversation de démonstration. Idempotent : se lance après le seed, ou seul sur une base existante
// (node src/seed/v3.js) sans effacer les données des testeuses.
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { HEALTH_TIPS } from '../content/healthTips.js';
import { THEME_ARTICLES } from '../content/themeArticles.js';
import { Article, Category, Conversation, Event, HealthTip, Message, Mosque, Practitioner, Service, Subscription, Availability, User } from '../models/index.js';
import { bestCity } from '../services/geo.js';
import { localTimings } from '../services/prayerService.js';
import { addDays, localParts, zonedToDate } from '../utils/dates.js';
import { CATEGORIES_SEED, LEGACY_SPECIALTIES } from './data.js';

const PRO_DETAILS = {
  'samira@nissali.app': { phone: '+33 6 12 34 56 78', showPhone: true, diplomas: ['Master 2 Psychologie clinique — Université Paris Cité', 'Formation TCC (thérapies cognitives et comportementales)'], professionalId: 'ADELI 759312345' },
  'ines@nissali.app': { phone: '+33 6 98 76 54 32', showPhone: true, diplomas: ['Diplôme d’État de sage-femme', 'DU Échographie gynécologique'], professionalId: 'RPPS 10101234567' },
  'khadija@nissali.app': { phone: '', showPhone: false, diplomas: ['Certification hijama — Institut de médecine prophétique'] },
};

// Praticiennes supplémentaires pour l'annuaire (maquette : Nour H., hijama, Rueil-Malmaison).
const EXTRA_PROS = [
  { email: 'nour@nissali.app', firstName: 'Nour', displayName: 'Nour H.', specialty: 'hijama', city: 'Rueil-Malmaison', address: 'Rueil-Malmaison', description: 'Praticienne en hijama, cabinet réservé aux femmes. Hygiène stricte, matériel à usage unique.', phone: '+33 7 11 22 33 44', showPhone: true, diplomas: ['Certification hijama et hygiène'], services: [{ name: 'Séance de hijama', price: 45, durationMinutes: 60, mode: 'cabinet' }] },
  { email: 'yasmine@nissali.app', firstName: 'Yasmine', displayName: 'Yasmine D.', specialty: 'dieteticienne', city: 'Puteaux', address: 'Puteaux', description: 'Diététicienne-nutritionniste diplômée : alimentation pendant le Ramadan, grossesse, SOPK, rééquilibrage alimentaire.', phone: '+33 6 55 44 33 22', showPhone: false, diplomas: ['BTS Diététique', 'DU Nutrition et grossesse'], professionalId: 'ADELI 929512345', services: [{ name: 'Bilan nutritionnel', price: 55, durationMinutes: 60, mode: 'les_deux' }] },
  { email: 'leila@nissali.app', firstName: 'Leïla', displayName: 'Leïla A.', specialty: 'masseuse', city: 'Nanterre', address: 'Nanterre', description: 'Masseuse bien-être, exclusivement pour les femmes : massage relaxant, massage prénatal et post-partum.', phone: '+33 6 77 88 99 00', showPhone: true, diplomas: ['Certificat de praticienne en massage bien-être'], services: [{ name: 'Massage relaxant', price: 60, durationMinutes: 60, mode: 'cabinet' }] },
  { email: 'sarah@nissali.app', firstName: 'Sarah', displayName: 'Sarah L.', specialty: 'doula', city: 'Saint-Denis', address: 'Saint-Denis', description: 'Doula : accompagnement émotionnel et pratique de la grossesse à l’après-naissance.', phone: '', showPhone: false, diplomas: ['Formation doula certifiante'], services: [{ name: 'Rencontre prénatale', price: 40, durationMinutes: 60, mode: 'les_deux' }] },
  { email: 'hana@nissali.app', firstName: 'Hana', displayName: 'Hana B.', specialty: 'coach', city: 'Paris', address: 'Paris 18e', description: 'Coach sportive et bien-être : renforcement en douceur, remise en forme après la grossesse, séances entre femmes.', phone: '+33 6 31 41 59 26', showPhone: true, diplomas: ['BPJEPS Activités de la forme'], services: [{ name: 'Séance de coaching', price: 35, durationMinutes: 60, mode: 'les_deux' }] },
  { email: 'meriem@nissali.app', firstName: 'Meriem', displayName: 'Meriem T.', specialty: 'naturopathe', city: 'Argenteuil', address: 'Argenteuil', description: 'Naturopathe : hygiène de vie, alimentation, gestion du stress et du sommeil.', phone: '', showPhone: false, diplomas: ['Certification de naturopathe (FENA)'], services: [{ name: 'Bilan de vitalité', price: 50, durationMinutes: 75, mode: 'les_deux' }] },
];

const MOSQUES = [
  { name: 'Mosquée de Nanterre', city: 'Nanterre', address: 'Nanterre', jumua: '13:30' },
  { name: 'Grande Mosquée de Gennevilliers', city: 'Gennevilliers', address: 'Gennevilliers', jumua: '13:15' },
  { name: 'Mosquée de Puteaux', city: 'Puteaux', address: 'Puteaux', jumua: '13:30' },
  { name: 'Mosquée de Rueil-Malmaison', city: 'Rueil-Malmaison', address: 'Rueil-Malmaison', jumua: '13:45' },
];

async function geocode(city) {
  return bestCity(city);
}

async function categories() {
  for (const c of CATEGORIES_SEED) await Category.updateOne({ key: c.key }, { $set: { label: c.label, group: c.group, order: c.order, active: true } }, { upsert: true });
  const keys = CATEGORIES_SEED.map((c) => c.key);
  await Category.updateMany({ key: { $nin: keys } }, { $set: { active: false } });
  for (const [from, to] of Object.entries(LEGACY_SPECIALTIES)) await Practitioner.updateMany({ specialty: from }, { $set: { specialty: to, categories: [to] } });
  console.log(`[v3] ${keys.length} catégories de praticiennes`);
}

async function practitioners() {
  for (const ex of EXTRA_PROS) {
    let user = await User.findOne({ email: ex.email });
    if (!user) user = await User.create({ email: ex.email, emailVerified: true, firstName: ex.firstName, lastSpace: 'pro', consents: { terms: { accepted: true, at: new Date() }, health: { accepted: false } } });
    if (await Practitioner.exists({ user: user._id })) continue;
    const p = await Practitioner.create({ user: user._id, displayName: ex.displayName, specialty: ex.specialty, categories: [ex.specialty], description: ex.description, location: { city: ex.city, address: ex.address }, phone: ex.phone, showPhone: ex.showPhone, diplomas: ex.diplomas, professionalId: ex.professionalId || '', status: 'validee', languages: ['Français', 'Arabe'], minNoticeHours: 2 });
    await Subscription.create({ practitioner: p._id, plan: 'decouverte', amount: 0, status: 'active', startedAt: new Date() });
    await Service.insertMany(ex.services.map((s) => ({ ...s, practitioner: p._id })));
    await Availability.insertMany([2, 3, 4, 6].flatMap((wd) => [{ practitioner: p._id, weekday: wd, start: '09:30', end: '12:30' }, { practitioner: p._id, weekday: wd, start: '14:00', end: '18:00' }]));
  }
  for (const [email, details] of Object.entries(PRO_DETAILS)) {
    const user = await User.findOne({ email }).lean();
    if (user) await Practitioner.updateOne({ user: user._id, phone: { $in: [null, ''] } }, { $set: details });
  }
  // Coordonnées et région de chaque praticienne (distance et filtre Région).
  const missing = await Practitioner.find({ $or: [{ 'location.lat': null }, { 'location.region': { $in: [null, ''] } }] });
  for (const p of missing) {
    const place = await geocode(p.location.city?.replace(/\s+\d+e$/, '') || 'Paris');
    if (!place) continue;
    p.location.lat = p.location.lat ?? place.lat;
    p.location.lng = p.location.lng ?? place.lng;
    p.location.region = place.admin || '';
    await p.save();
  }
  console.log(`[v3] praticiennes : ${await Practitioner.countDocuments({ status: 'validee' })} validées, ${missing.length} géolocalisées`);
}

async function healthTips() {
  if (await HealthTip.exists({})) return;
  const docs = Object.entries(HEALTH_TIPS).flatMap(([phase, list]) => list.map((t) => ({ ...t, phase })));
  await HealthTip.insertMany(docs);
  console.log(`[v3] ${docs.length} conseils santé (à faire relire par une sage-femme dans le back-office)`);
}

async function mosques(today) {
  for (const m of MOSQUES) {
    if (await Mosque.exists({ name: m.name, partner: true })) continue;
    const place = await geocode(m.city);
    if (!place) continue;
    // Horaires de démonstration sur 90 jours (angles 12° / 12°) : à remplacer par les horaires publiés par la mosquée.
    const opts = { lat: place.lat, lng: place.lng, tz: place.timezone || 'Europe/Paris', method: 'UOIF', highLatitude: 'SEVENTH', adjustments: {} };
    const timetable = Array.from({ length: 90 }, (_, i) => {
      const t = localTimings(opts, addDays(today, i));
      return { day: t.day, fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha };
    });
    await Mosque.create({ ...m, lat: place.lat, lng: place.lng, region: place.admin || '', country: place.country || 'France', timezone: opts.tz, partner: true, timetable, timetableNote: 'Horaires de démonstration (calcul 12°) — à remplacer par les horaires de la mosquée.' });
  }
  console.log(`[v3] ${await Mosque.countDocuments({ partner: true })} mosquées partenaires`);
}

async function events(today) {
  if (await Event.exists({})) return;
  const amina = await User.findOne({ email: 'amina@nissali.app' }).lean();
  const at = (days, time) => zonedToDate(addDays(today, days), time, 'Europe/Paris');
  const place = async (city) => {
    const g = await geocode(city);
    return { city, region: g?.admin || '', lat: g?.lat, lng: g?.lng };
  };
  await Event.insertMany([
    { title: 'Initiation au lavage mortuaire', description: 'Une matinée pour apprendre, avec douceur et pudeur, les gestes du lavage mortuaire (ghusl al-mayyit) entre sœurs.', programme: '10 h : accueil\n10 h 30 : théorie et sources\n11 h 30 : démonstration\n12 h 30 : questions', startAt: at(17, '10:00'), endAt: at(17, '13:00'), location: { name: 'Salle Nissali', address: 'Centre-ville', ...(await place('Rueil-Malmaison')) }, capacity: 25, price: 25, organizerType: 'nissali', organizerName: 'Nissali', status: 'publie', payoutStatus: 'non_applicable' },
    { title: 'Brunch entre sœurs', description: 'Un brunch convivial pour rencontrer d’autres sœurs de la région, échanger et passer un bon moment.', startAt: at(24, '11:00'), endAt: at(24, '14:00'), location: { name: 'Salon de thé', ...(await place('Paris')) }, capacity: 20, price: 15, organizerType: 'soeur', organizer: amina?._id, organizerName: amina?.firstName || 'Une sœur', status: 'publie', payoutStatus: 'a_verser' },
    { title: 'Cercle de rappel : la patience', description: 'Un cercle de rappel autour de la patience (sabr), suivi d’un moment d’échange et d’un thé.', startAt: at(32, '15:00'), endAt: at(32, '17:00'), location: { name: 'Salle associative', ...(await place('Saint-Denis')) }, capacity: 40, price: 0, organizerType: 'soeur', organizerName: 'Maryam', status: 'publie' },
    { title: 'Atelier couture et papotage', description: 'Apprendre les bases de la couture en petit groupe, dans la bonne humeur.', startAt: at(40, '14:00'), location: { name: 'Atelier', ...(await place('Nanterre')) }, capacity: 10, price: 20, organizerType: 'soeur', organizer: amina?._id, organizerName: amina?.firstName || 'Une sœur', status: 'en_attente', payoutStatus: 'a_verser' },
  ]);
  console.log('[v3] 4 événements (dont 1 proposition en attente de validation)');
}

async function conversation() {
  const amina = await User.findOne({ email: 'amina@nissali.app' }).lean();
  const samiraUser = await User.findOne({ email: 'samira@nissali.app' }).lean();
  const samira = samiraUser && (await Practitioner.findOne({ user: samiraUser._id }).lean());
  if (!amina || !samira || (await Conversation.exists({ user: amina._id, practitioner: samira._id }))) return;
  const conv = await Conversation.create({ user: amina._id, practitioner: samira._id });
  const base = Date.now() - 26 * 3600_000;
  const msgs = [
    ['user', 'Salam aleykoum Samira, est-ce que vous consultez aussi en visio le samedi ?', 0],
    ['pro', 'Wa aleykoum salam Amina ! Oui, j’ai quelques créneaux le samedi matin en visio.', 40],
    ['user', 'Parfait, je vais réserver depuis l’appli. Merci beaucoup !', 55],
    ['pro', 'Avec plaisir, à bientôt in sha Allah.', 70],
  ];
  for (const [from, text, min] of msgs) await Message.create({ conversation: conv._id, from, text, createdAt: new Date(base + min * 60_000) });
  const last = msgs[msgs.length - 1];
  await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessage: { text: last[1], from: last[0], at: new Date(base + last[2] * 60_000) }, unreadUser: 1, readProAt: new Date(base + last[2] * 60_000), readUserAt: new Date(base + 55 * 60_000) } });
  console.log('[v3] conversation de démonstration Amina ↔ Samira');
}

// Détail des prestations de démonstration (fiche prestation de l'appli) ; jamais celles d'une vraie praticienne.
const SERVICE_DETAILS = {
  'Consultation de suivi de grossesse': 'Consultation de suivi avec une sage-femme : tension, poids, croissance du bébé et réponses à toutes tes questions. Apporte ton carnet de grossesse et tes derniers résultats d’analyses.',
  'Préparation à la naissance': 'Séance individuelle pour te préparer à l’accouchement : respiration, positions, déroulé du jour J et retour à la maison. La personne qui t’accompagne peut venir avec toi.',
  'Séance de hijama': 'Séance de hijama (ventouses) dans un cabinet réservé aux femmes, avec du matériel stérile à usage unique. Un court échange avant la séance permet de vérifier qu’elle te convient. Prévois un repas léger quelques heures avant.',
  'Bilan nutritionnel': 'Premier rendez-vous pour faire le point sur ton alimentation, tes habitudes et tes objectifs : Ramadan, grossesse, SOPK ou rééquilibrage. Tu repars avec des conseils concrets et un plan adapté à ton quotidien.',
  'Massage relaxant': 'Massage bien-être du corps entier aux huiles végétales, dans un espace réservé aux femmes. Il vise la détente et ne remplace pas un soin médical.',
  'Séance d’ostéopathie': 'Bilan puis techniques douces adaptées à ta situation : dos, bassin, tensions, post-partum. Viens dans une tenue confortable.',
  'Rencontre prénatale': 'Une première rencontre pour faire connaissance, parler de ton projet de naissance et de tes besoins. La doula t’accompagne sur le plan émotionnel et pratique ; elle ne remplace pas le suivi médical.',
  'Séance de coaching': 'Séance individuelle pour clarifier un objectif (organisation, confiance en soi, reprise d’activité) et repartir avec un plan d’action concret.',
  'Bilan de vitalité': 'Bilan de naturopathie : habitudes de vie, alimentation, sommeil et gestion du stress. Tu repars avec des conseils d’hygiène de vie personnalisés. Ne remplace pas un avis médical.',
};

async function serviceDetails() {
  const demoUsers = await User.find({ email: /@nissali\.app$/ }).select('_id').lean();
  const demoPros = await Practitioner.find({ user: { $in: demoUsers.map((u) => u._id) } }).select('_id').lean();
  let n = 0;
  for (const [name, description] of Object.entries(SERVICE_DETAILS)) {
    const r = await Service.updateMany({ practitioner: { $in: demoPros.map((p) => p._id) }, name, $or: [{ description: '' }, { description: { $exists: false } }] }, { $set: { description } });
    n += r.modifiedCount;
  }
  console.log(`[v3] ${n} prestations de démonstration détaillées`);
}

async function themeArticles() {
  for (const a of THEME_ARTICLES) await Article.updateOne({ slug: a.slug }, { $setOnInsert: { ...a, validation: 'a_valider', published: true, publishAt: new Date() } }, { upsert: true });
  console.log(`[v3] ${THEME_ARTICLES.length} articles thématiques liés aux conseils (à valider dans le back-office)`);
}

export async function seedV3() {
  const today = localParts(new Date(), 'Europe/Paris').day;
  await categories();
  await practitioners();
  await serviceDetails();
  await healthTips();
  await themeArticles();
  await mosques(today);
  await events(today);
  await conversation();
}

if (process.argv[1]?.endsWith('v3.js')) {
  connectDb()
    .then(seedV3)
    .then(() => mongoose.disconnect())
    .then(() => console.log('[v3] terminé ✔'))
    .catch(async (err) => {
      console.error('[v3] erreur :', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

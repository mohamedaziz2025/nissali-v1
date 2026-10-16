// Données de référence : rappels du jour, spécialités, formules d'abonnement.
export const REMINDERS = [
  { kind: 'hadith', text: 'Les actes les plus aimés d’Allah sont les plus réguliers, même s’ils sont petits.', source: 'Al-Bukhari et Muslim' },
  { kind: 'verset', text: 'Allah n’impose à aucune âme une charge supérieure à sa capacité.', source: 'Sourate Al-Baqara, 2:286' },
  { kind: 'verset', text: 'Allah veut pour vous la facilité, Il ne veut pas pour vous la difficulté.', source: 'Sourate Al-Baqara, 2:185' },
  { kind: 'verset', text: 'À côté de la difficulté est, certes, une facilité.', source: 'Sourate Ash-Sharh, 94:6' },
  { kind: 'hadith', text: 'La purification est la moitié de la foi.', source: 'Muslim' },
  { kind: 'verset', text: 'Souvenez-vous de Moi, Je Me souviendrai de vous.', source: 'Sourate Al-Baqara, 2:152' },
  { kind: 'verset', text: 'N’est-ce point par l’évocation d’Allah que se tranquillisent les cœurs ?', source: 'Sourate Ar-Ra’d, 13:28' },
  { kind: 'hadith', text: 'Le croyant fort est meilleur et plus aimé d’Allah que le croyant faible, et en chacun il y a du bien.', source: 'Muslim' },
  { kind: 'hadith', text: 'Ton corps a un droit sur toi.', source: 'Al-Bukhari' },
  { kind: 'hadith', text: 'Celui qui jeûne le Ramadan puis le fait suivre de six jours de Chawwal, c’est comme s’il avait jeûné toute l’année.', source: 'Muslim' },
  { kind: 'hadith', text: 'Cela nous arrivait, et on nous ordonnait de rattraper le jeûne, et on ne nous ordonnait pas de rattraper la prière.', source: 'Aïcha, rapporté par Muslim' },
  { kind: 'hadith', text: 'Le meilleur d’entre vous est le meilleur envers sa famille.', source: 'At-Tirmidhi' },
  { kind: 'hadith', text: 'Ton sourire à ton frère est une aumône.', source: 'At-Tirmidhi' },
  { kind: 'verset', text: 'Il a mis entre vous de l’affection et de la bonté.', source: 'Sourate Ar-Rum, 30:21' },
  { kind: 'verset', text: 'Invoquez-Moi, Je vous répondrai.', source: 'Sourate Ghafir, 40:60' },
  { kind: 'verset', text: 'Allah est avec les endurants.', source: 'Sourate Al-Baqara, 2:153' },
  { kind: 'hadith', text: 'Quiconque emprunte un chemin à la recherche d’une science, Allah lui facilite un chemin vers le Paradis.', source: 'Muslim' },
  { kind: 'conseil', text: 'Bois un grand verre d’eau au réveil : ton corps en a besoin après la nuit.', source: 'Conseil santé' },
  { kind: 'conseil', text: 'Pendant tes règles, le dhikr et les invocations restent accessibles à tout moment.', source: 'Conseil du comité' },
  { kind: 'conseil', text: 'Note tes symptômes chaque jour : au fil des cycles, tu comprendras mieux ton corps.', source: 'Conseil santé' },
];

// 5.10 — Catégories des praticiennes (liste validée par Nissali) : une catégorie = une spécialité.
export const CATEGORIES_SEED = [
  { key: 'psychologue', label: 'Psychologue', group: 'psychologue', order: 1 },
  { key: 'naturopathe', label: 'Naturopathe', group: 'naturopathe', order: 2 },
  { key: 'dieteticienne', label: 'Diététicienne / nutritionniste', group: 'dieteticienne', order: 3 },
  { key: 'hijama', label: 'Hijama', group: 'hijama', order: 4 },
  { key: 'masseuse', label: 'Masseuse', group: 'masseuse', order: 5 },
  { key: 'coach', label: 'Coach', group: 'coach', order: 6 },
  { key: 'doula', label: 'Doula', group: 'doula', order: 7 },
  { key: 'sage_femme', label: 'Sage-femme', group: 'sage_femme', order: 8 },
];
// Anciennes spécialités → catégories actuelles (migration).
export const LEGACY_SPECIALTIES = {
  gynecologue: 'sage_femme',
  sophrologue: 'psychologue',
  consultante_lactation: 'sage_femme',
  accompagnante_perinatalite: 'doula',
  massage_bien_etre: 'masseuse',
  coach_sportive: 'coach',
  kinesitherapeute: 'coach',
  osteopathe: 'masseuse',
};

export const PLANS_SEED = [
  {
    key: 'decouverte',
    name: 'Découverte',
    tagline: 'Pour commencer et se faire connaître',
    priceMonthly: 0,
    priceYearly: 0,
    order: 1,
    features: { maxServices: 1, maxBookingsPerMonth: 15, video: false, crm: false, stats: false, featured: false, verifiedBadge: false, prioritySupport: false },
    highlights: ['Profil dans l’annuaire Nissali', '1 prestation', 'Jusqu’à 15 rendez-vous par mois', 'Agenda et disponibilités'],
  },
  {
    key: 'essentiel',
    name: 'Essentiel',
    tagline: 'Pour développer sa patientèle',
    priceMonthly: 19,
    priceYearly: 190,
    order: 2,
    features: { maxServices: 5, maxBookingsPerMonth: 0, video: true, crm: true, stats: true, featured: false, verifiedBadge: true, prioritySupport: false },
    highlights: ['5 prestations', 'Rendez-vous illimités', 'Consultations en visio', 'Fiches clientes', 'Statistiques', 'Badge vérifiée'],
  },
  {
    key: 'premium',
    name: 'Premium',
    tagline: 'Pour être mise en avant',
    priceMonthly: 39,
    priceYearly: 390,
    order: 3,
    features: { maxServices: 0, maxBookingsPerMonth: 0, video: true, crm: true, stats: true, featured: true, verifiedBadge: true, prioritySupport: true },
    highlights: ['Prestations illimitées', 'Mise en avant dans l’annuaire', 'Tout Essentiel inclus', 'Support prioritaire'],
  },
];

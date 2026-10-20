// Identité visuelle Nissali — fiche technique du design (cahier V4.1, partie 4.11).
export const colors = {
  bordeaux: '#7A1E35', // boutons, blocs forts, actif, prochaine prière, compteur de dhikr
  prune: '#2A1218', // encre : textes, puces choisies
  pruneToday: '#3E1220', // jour actuel du calendrier
  rose: '#E9B9C1', // accents doux
  roseFertile: '#F6D9DF', // fenêtre fertile
  or: '#B88A55', // fait, coché, atteint, séries
  orText: '#8A5E2E', // petits titres dorés
  orClair: '#D9B07E', // progrès sur bordeaux
  blush: '#F5E6E9', // ronds d'icônes, rappel, ghusl
  sable: '#F3E8DA', // jeûne, conseil, badges
  creme: '#F8F2EC',
  ivoire: '#FBF7F4', // fond des écrans
  white: '#FFFFFF',
  muted: '#6E5A5F', // gris texte : sous-titres, aides
  line: '#F1E6E8', // bordure des cartes
  lineField: '#EADBDF', // bordure des champs et puces
  caseVide: '#D3AEB7', // cases vides
  onBordeaux: '#F0C9D2', // texte secondaire sur bordeaux
  onBordeauxSurface: 'rgba(255,255,255,0.14)',
  veil: 'rgba(42,18,24,0.48)',
  roseDeep: '#D88E9C',
  bordeauxSoft: '#A45468',
  orSoft: '#E6D3BC',
  success: '#3F7D58',
  danger: '#B3261E', // suppression uniquement
};

// Plus Jakarta Sans partout ; Fraunces seulement pour le mot « Nissali » du logo ; Amiri pour l'arabe.
export const fonts = {
  display: 'PlusJakartaSans_800ExtraBold',
  title: 'PlusJakartaSans_800ExtraBold',
  titleSemi: 'PlusJakartaSans_700Bold',
  italic: 'PlusJakartaSans_500Medium_Italic',
  body: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semi: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extra: 'PlusJakartaSans_800ExtraBold',
  logo: 'Fraunces_600SemiBold',
  arabic: 'Amiri_700Bold',
};

/** Chiffres à chasse fixe (heures, compteurs, poids) : ils ne bougent pas quand ils changent. */
export const tnum = { fontVariant: ['tabular-nums'] };

export const radius = { hero: 28, card: 24, md: 16, sm: 8, sheet: 32, pill: 999 };
export const space = { gutter: 18, gap: 16 };

export const PRAYER_LABELS = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const MOODS = [
  { key: 'sereine', label: 'Sereine' },
  { key: 'bien', label: 'Bien' },
  { key: 'fatiguee', label: 'Fatiguée' },
  { key: 'irritable', label: 'Irritable' },
  { key: 'triste', label: 'Triste' },
];

export const SYMPTOMS = {
  crampes: 'Crampes',
  fatigue: 'Fatigue',
  migraine: 'Migraine',
  ballonnements: 'Ballonnements',
  douleurs_dos: 'Mal de dos',
  seins_sensibles: 'Seins sensibles',
  acne: 'Acné',
  nausees: 'Nausées',
  fringales: 'Fringales',
  insomnie: 'Insomnie',
  caillots: 'Caillots',
  vertiges: 'Vertiges',
};

export const FLOWS = [
  { key: 'traces', label: 'Traces' },
  { key: 'leger', label: 'Léger' },
  { key: 'moyen', label: 'Moyen' },
  { key: 'abondant', label: 'Abondant' },
];

export const BOOKING_STATUS = {
  en_attente: { label: 'En attente', color: colors.or },
  confirmee: { label: 'Confirmé', color: colors.success },
  refusee: { label: 'Refusé', color: colors.muted },
  annulee: { label: 'Annulé', color: colors.muted },
  terminee: { label: 'Terminé', color: colors.bordeaux },
  absente: { label: 'Absente', color: colors.danger },
};

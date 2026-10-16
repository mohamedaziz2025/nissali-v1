// Identité visuelle Nissali (cahier des charges 1.5).
export const colors = {
  bordeaux: '#7A1F35', // couleur principale : logo, boutons, jours de règles, onglet actif
  prune: '#3E1220', // textes et titres
  rose: '#E9B9C1', // fenêtre fertile, accents doux
  or: '#C49A6C', // prières, ovulation (contour)
  blush: '#F7E8EA', // fond des cartes et des encadrés
  ivoire: '#FCF8F6', // fond des écrans
  white: '#FFFFFF',
  muted: '#7A5A62', // texte secondaire (contraste AA sur ivoire et blanc)
  line: '#EEDDE1',
  roseDeep: '#D88E9C',
  bordeauxSoft: '#A45468',
  orSoft: '#E6D3BC',
  success: '#3F7D58',
  danger: '#B3261E',
};

export const fonts = {
  display: 'Fraunces_400Regular',
  title: 'Fraunces_500Medium',
  titleSemi: 'Fraunces_600SemiBold',
  italic: 'Fraunces_400Regular_Italic',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
};

export const radius = { card: 28, md: 20, sm: 14, pill: 999 };
export const space = { gutter: 20, gap: 14 };

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

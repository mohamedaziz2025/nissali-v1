// Identité visuelle Nissali — fiche technique du design (cahier V4.1, partie 4.11).
import { language, tr } from './lib/i18n';
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

// Plus Jakarta Sans partout ; Poppins SemiBold seulement pour le mot « nissali » du logo ; Amiri pour l'arabe.
// En arabe, l'interface passe en Cairo (la police latine n'a pas de glyphes arabes) : le logo reste en Poppins
// et les textes religieux en Amiri, dans tous les cas.
const UI = language === 'ar'
  ? {
      display: 'Cairo_800ExtraBold',
      title: 'Cairo_800ExtraBold',
      titleSemi: 'Cairo_700Bold',
      italic: 'Cairo_500Medium',
      body: 'Cairo_400Regular',
      medium: 'Cairo_500Medium',
      semi: 'Cairo_600SemiBold',
      bold: 'Cairo_700Bold',
      extra: 'Cairo_800ExtraBold',
    }
  : {
      display: 'PlusJakartaSans_800ExtraBold',
      title: 'PlusJakartaSans_800ExtraBold',
      titleSemi: 'PlusJakartaSans_700Bold',
      italic: 'PlusJakartaSans_500Medium_Italic',
      body: 'PlusJakartaSans_400Regular',
      medium: 'PlusJakartaSans_500Medium',
      semi: 'PlusJakartaSans_600SemiBold',
      bold: 'PlusJakartaSans_700Bold',
      extra: 'PlusJakartaSans_800ExtraBold',
    };

export const fonts = {
  ...UI,
  logo: 'Poppins_600SemiBold',
  arabic: 'Amiri_700Bold',
};

/** Chiffres à chasse fixe (heures, compteurs, poids) : ils ne bougent pas quand ils changent. */
export const tnum = { fontVariant: ['tabular-nums'] };

export const radius = { hero: 28, card: 24, md: 16, sm: 8, sheet: 32, pill: 999 };
export const space = { gutter: 18, gap: 16 };

export const PRAYER_LABELS = { fajr: tr("Fajr"), dhuhr: tr("Dhuhr"), asr: tr("Asr"), maghrib: tr("Maghrib"), isha: tr("Isha") };
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const MOODS = [
  { key: 'sereine', label: tr("Sereine") },
  { key: 'bien', label: tr("Bien") },
  { key: 'fatiguee', label: tr("Fatiguée") },
  { key: 'irritable', label: tr("Irritable") },
  { key: 'triste', label: tr("Triste") },
];

export const SYMPTOMS = {
  crampes: tr("Crampes"),
  fatigue: tr("Fatigue"),
  migraine: tr("Migraine"),
  ballonnements: tr("Ballonnements"),
  douleurs_dos: tr("Mal de dos"),
  seins_sensibles: tr("Seins sensibles"),
  acne: tr("Acné"),
  nausees: tr("Nausées"),
  fringales: tr("Fringales"),
  insomnie: tr("Insomnie"),
  caillots: tr("Caillots"),
  vertiges: tr("Vertiges"),
};

export const FLOWS = [
  { key: 'traces', label: tr("Traces") },
  { key: 'leger', label: tr("Léger") },
  { key: 'moyen', label: tr("Moyen") },
  { key: 'abondant', label: tr("Abondant") },
];

export const BOOKING_STATUS = {
  en_attente: { label: tr("En attente"), color: colors.or },
  confirmee: { label: tr("Confirmé"), color: colors.success },
  refusee: { label: tr("Refusé"), color: colors.muted },
  annulee: { label: tr("Annulé"), color: colors.muted },
  terminee: { label: tr("Terminé"), color: colors.bordeaux },
  absente: { label: tr("Absente"), color: colors.danger },
};

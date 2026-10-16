// 5.10 — Catégories de l'annuaire des praticiennes (liste validée par Nissali).
// Chaque catégorie est aussi une spécialité (group = key) ; l'équipe peut en ajouter dans le back-office.
export const CATEGORY_GROUPS = [
  { key: 'psychologue', label: 'Psychologue' },
  { key: 'naturopathe', label: 'Naturopathe' },
  { key: 'dieteticienne', label: 'Diététicienne / nutritionniste' },
  { key: 'hijama', label: 'Hijama' },
  { key: 'masseuse', label: 'Masseuse' },
  { key: 'coach', label: 'Coach' },
  { key: 'doula', label: 'Doula' },
  { key: 'sage_femme', label: 'Sage-femme' },
];
export const GROUP_KEYS = CATEGORY_GROUPS.map((g) => g.key);
export const groupLabel = (key) => CATEGORY_GROUPS.find((g) => g.key === key)?.label || '';

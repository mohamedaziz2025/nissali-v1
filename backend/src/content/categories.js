// 5.10 — Catégories de l'annuaire des praticiennes (liste validée par Nissali).
// Chaque catégorie est aussi une spécialité (group = key) ; l'équipe peut en ajouter dans le back-office.
export const CATEGORY_GROUPS = [
  { key: 'dieteticienne', label: 'Diététicienne' },
  { key: 'nutritionniste', label: 'Nutritionniste' },
  { key: 'naturopathe', label: 'Naturopathe' },
  { key: 'hijama', label: 'Hijama' },
  { key: 'coach', label: 'Coach' },
  { key: 'doula', label: 'Doula' },
  { key: 'autre', label: 'Autre' },
];
export const GROUP_KEYS = CATEGORY_GROUPS.map((g) => g.key);
export const groupLabel = (key) => CATEGORY_GROUPS.find((g) => g.key === key)?.label || '';

// V4 : puces de l'annuaire = un métier par puce (Toutes, Diététicienne, Nutritionniste, Naturopathe, Hijama, Coach, Doula).
export const FAMILIES = [
  { key: 'dieteticienne', label: 'Diététicienne', specialties: ['dieteticienne'] },
  { key: 'nutritionniste', label: 'Nutritionniste', specialties: ['nutritionniste'] },
  { key: 'naturopathe', label: 'Naturopathe', specialties: ['naturopathe'] },
  { key: 'hijama', label: 'Hijama', specialties: ['hijama'] },
  { key: 'coach', label: 'Coach', specialties: ['coach'] },
  { key: 'doula', label: 'Doula', specialties: ['doula'] },
];

/** Spécialités d'une catégorie (celles de la liste, plus celles que l'équipe y a rangées). */
export const familySpecialties = (family, categories) => {
  const f = FAMILIES.find((x) => x.key === family);
  return categories.filter((c) => f?.specialties.includes(c.key) || c.group === family).map((c) => c.key);
};

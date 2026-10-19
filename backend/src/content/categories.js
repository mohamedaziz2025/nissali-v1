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

// 5.10 (cahier V3) — les 6 catégories qui regroupent les spécialités dans les filtres de l'annuaire.
export const FAMILIES = [
  { key: 'sante_mentale', label: 'Santé mentale', specialties: ['psychologue', 'sophrologue'] },
  { key: 'nutrition', label: 'Nutrition', specialties: ['dieteticienne', 'naturopathe'] },
  { key: 'maternite', label: 'Maternité', specialties: ['sage_femme', 'doula', 'consultante_lactation', 'accompagnante_perinatalite'] },
  { key: 'corps_mouvement', label: 'Corps & mouvement', specialties: ['coach', 'coach_sportive', 'osteopathe', 'kinesitherapeute'] },
  { key: 'bien_etre', label: 'Bien-être', specialties: ['masseuse', 'massage_bien_etre'] },
  { key: 'hijama', label: 'Hijama', specialties: ['hijama'] },
];

/** Spécialités d'une catégorie (celles de la liste, plus celles que l'équipe y a rangées). */
export const familySpecialties = (family, categories) => {
  const f = FAMILIES.find((x) => x.key === family);
  return categories.filter((c) => f?.specialties.includes(c.key) || c.group === family).map((c) => c.key);
};

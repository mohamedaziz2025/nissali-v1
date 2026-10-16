// Articles thématiques liés aux conseils santé (alimentation, activité, hydratation, bien-être).
// Créés « à valider » : ils deviennent visibles (et les conseils y renvoient) après relecture par une
// professionnelle de santé dans le back-office.
export const THEME_ARTICLES = [
  {
    slug: 'bien-manger-au-fil-du-cycle',
    title: 'Bien manger au fil de ton cycle',
    category: 'sante',
    readMinutes: 4,
    color: 'or',
    phases: ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale'],
    excerpt: 'Fer, magnésium, protéines, fibres : ce qui aide ton corps à chaque phase.',
    body: `Ton alimentation peut t’aider à traverser chaque phase de ton cycle avec plus d’énergie.

## Pendant les règles
- Du fer : lentilles, pois chiches, épinards, viande rouge maigre.
- De la vitamine C au même repas (orange, kiwi, poivron) pour mieux l’absorber.
- Du magnésium : amandes, banane, chocolat noir, céréales complètes.

## Après les règles
- Des protéines à chaque repas : œufs, poisson, légumineuses, volaille.
- Des fibres : légumes, fruits, céréales complètes.
- Des oméga-3 : sardine, maquereau, saumon, noix.

## Avant les règles
- Des glucides complets pour stabiliser l’énergie et l’humeur.
- Moins de sel et de boissons gazeuses pour limiter les ballonnements.
- Une envie de sucré ? Une poignée d’amandes ou un carré de chocolat noir.

Une alimentation variée reste la base. En cas de fatigue importante, parle-en à ta médecin.`,
  },
  {
    slug: 'bouger-au-fil-du-cycle',
    title: 'Bouger au fil de ton cycle',
    category: 'sante',
    readMinutes: 3,
    color: 'rose',
    phases: ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale'],
    excerpt: 'Marche, renforcement, étirements : adapter son activité à son énergie.',
    body: `L’activité physique fait du bien à chaque phase : il suffit d’adapter l’intensité à ton énergie.

## Pendant les règles
Marche, étirements, mouvements doux : ils améliorent la circulation et peuvent soulager les crampes.

## Après les règles et autour de l’ovulation
L’énergie remonte : c’est le bon moment pour le renforcement musculaire, la marche rapide ou le vélo. Pense à t’échauffer 5 à 10 minutes.

## Avant les règles
Privilégie une activité modérée (yoga doux, marche) pour réduire les tensions.

## Au quotidien
Si tu travailles assise, lève-toi quelques minutes chaque heure. L’objectif : environ 30 minutes d’activité par jour.`,
  },
  {
    slug: 'bien-s-hydrater-au-quotidien',
    title: 'Bien t’hydrater au quotidien',
    category: 'sante',
    readMinutes: 2,
    color: 'blush',
    phases: ['menstruelle', 'luteale'],
    excerpt: 'Eau, tisanes, bouillons : pourquoi boire régulièrement change tout.',
    body: `Une bonne hydratation limite les maux de tête, la fatigue et les ballonnements.

## Combien boire ?
Environ 1,5 litre par jour, davantage s’il fait chaud ou si tu fais du sport.

## Les bons réflexes
- Un grand verre d’eau au réveil.
- Une bouteille à portée de main la journée.
- Des tisanes ou des bouillons le soir.
- Pendant le Ramadan : bois régulièrement entre l’iftar et le suhur.

## À limiter
Les boissons très sucrées et la caféine en fin de journée.`,
  },
  {
    slug: 'prendre-soin-de-soi-au-fil-du-cycle',
    title: 'Prendre soin de toi au fil du cycle',
    category: 'sante',
    readMinutes: 3,
    color: 'blush',
    phases: ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale'],
    excerpt: 'Hygiène douce, respiration, routines : de petits gestes qui font du bien.',
    body: `Prendre soin de soi, ce sont souvent de petits gestes réguliers.

## Hygiène intime
Une toilette douce, sans savon parfumé. Pendant les règles, change ta protection toutes les 4 à 6 heures environ.

## Gérer les tensions
Essaie la respiration 4-6 : inspire 4 secondes, expire 6 secondes, pendant 3 minutes.

## Ta peau
Nettoyage doux le soir, crème solaire si tu sors en journée.

## T’écouter
Note ton humeur et tes symptômes dans Nissali : au fil des cycles, tu comprendras mieux ton corps.`,
  },
];

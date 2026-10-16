// 6.5 — Les 4 phases du cycle : explications courtes et conseils.
export const PHASES = {
  menstruelle: {
    label: 'Phase menstruelle',
    short: 'Règles',
    what: 'La muqueuse de l’utérus s’élimine, les hormones sont au plus bas. Fatigue et crampes sont possibles.',
    tips: [
      'Accorde-toi du repos : une bouillotte et une tisane peuvent soulager les crampes.',
      'Mise sur les aliments riches en fer : lentilles, épinards, dattes.',
      'Une marche douce aide souvent à détendre le bas du ventre.',
      'C’est un bon moment pour le dhikr et les invocations.',
    ],
  },
  folliculaire: {
    label: 'Phase folliculaire',
    short: 'Énergie qui remonte',
    what: 'Les œstrogènes remontent, un follicule se prépare. L’énergie et le moral remontent. C’est la phase dont la durée varie le plus.',
    tips: [
      'Ton énergie remonte : c’est le moment idéal pour reprendre une activité physique.',
      'Profite de cette phase pour avancer sur tes projets qui demandent de la concentration.',
      'Pense aux protéines et aux légumes verts pour accompagner ce regain d’énergie.',
    ],
  },
  ovulatoire: {
    label: 'Phase ovulatoire',
    short: 'Période la plus fertile',
    what: 'Pic de l’hormone LH, l’ovule est libéré. C’est la période la plus fertile du cycle.',
    tips: [
      'Tu peux remarquer des pertes plus fluides, semblables à du blanc d’œuf : c’est normal.',
      'Bois suffisamment : ton corps travaille beaucoup en ce moment.',
      'Une légère douleur d’un côté du ventre peut accompagner l’ovulation.',
    ],
  },
  luteale: {
    label: 'Phase lutéale',
    short: 'Avant les règles',
    what: 'La progestérone augmente. Des symptômes prémenstruels sont possibles : seins sensibles, irritabilité, fringales.',
    tips: [
      'Limite le sel et le sucre raffiné pour réduire les ballonnements.',
      'Le magnésium (amandes, chocolat noir, banane) peut aider en cas de syndrome prémenstruel.',
      'Sois douce avec toi-même : l’irritabilité est fréquente avant les règles.',
      'Prépare tes protections : tes règles approchent.',
    ],
  },
};

export const HEALTH_ALERTS = {
  cycles_courts: 'Plusieurs de tes cycles durent moins de 21 jours. Il peut être utile d’en parler à ta gynécologue ou ta sage-femme.',
  cycles_longs: 'Plusieurs de tes cycles durent plus de 45 jours. Il peut être utile d’en parler à ta gynécologue ou ta sage-femme.',
  amenorrhee: 'Tu n’as pas noté de règles depuis plus de 3 mois. Si tu n’es pas enceinte, nous t’invitons à consulter.',
  regles_longues: 'Tes règles ont duré plus de 8 jours. N’hésite pas à consulter une professionnelle de santé.',
  saignements_abondants: 'Tu as noté des saignements abondants plusieurs jours de suite. Si cela te gêne ou te fatigue, consulte une professionnelle de santé.',
};

export const RELIABILITY_LABELS = { eleve: 'élevée', moyen: 'moyenne', faible: 'faible' };

export const GHUSL_STEPS = [
  'Formule l’intention (niyya) de te purifier.',
  'Dis « Bismillah » et lave-toi les mains.',
  'Lave les parties intimes.',
  'Fais les petites ablutions (woudou).',
  'Verse de l’eau sur la tête trois fois en faisant pénétrer l’eau jusqu’aux racines.',
  'Lave tout le corps en commençant par le côté droit, sans oublier les plis.',
];

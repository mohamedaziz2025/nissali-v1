// Contenu semaine par semaine (à faire relire par une sage-femme avant publication).
export const PREGNANCY_WEEKS = [
  { from: 4, to: 5, size: 'une graine de pavot', baby: 'L’embryon s’implante et le cœur commence à se former.', tip: 'Commence l’acide folique si ce n’est pas déjà fait et prends rendez-vous pour ta première consultation.' },
  { from: 6, to: 7, size: 'une lentille', baby: 'Le cœur bat déjà ! Les ébauches des bras et des jambes apparaissent.', tip: 'Les nausées sont fréquentes : fractionne tes repas et garde quelques biscuits près du lit.' },
  { from: 8, to: 9, size: 'une framboise', baby: 'Tous les organes principaux se mettent en place.', tip: 'Repose-toi dès que tu le peux : la fatigue du premier trimestre est normale.' },
  { from: 10, to: 11, size: 'une fraise', baby: 'L’embryon devient fœtus. Les doigts se séparent.', tip: 'L’échographie de datation se fait entre 11 et 14 SA.' },
  { from: 12, to: 14, size: 'un citron', baby: 'Bébé bouge déjà, même si tu ne le sens pas encore.', tip: 'Fin du premier trimestre : les nausées s’atténuent souvent.' },
  { from: 15, to: 18, size: 'un avocat', baby: 'Le squelette se solidifie, bébé entend les sons.', tip: 'Tu pourrais sentir les premiers mouvements entre 18 et 22 SA.' },
  { from: 19, to: 22, size: 'une banane', baby: 'Bébé est recouvert d’un fin duvet, le lanugo.', tip: 'L’échographie morphologique a lieu vers 22 SA.' },
  { from: 23, to: 26, size: 'un épi de maïs', baby: 'Les poumons se développent, bébé réagit à ta voix.', tip: 'Récite et parle à ton bébé : il reconnaît ta voix.' },
  { from: 27, to: 30, size: 'un chou-fleur', baby: 'Bébé ouvre les yeux et prend du poids.', tip: 'Début du troisième trimestre : pense à préparer ton projet de naissance.' },
  { from: 31, to: 34, size: 'une noix de coco', baby: 'Bébé se place souvent tête en bas.', tip: 'L’échographie du troisième trimestre a lieu vers 32 SA.' },
  { from: 35, to: 38, size: 'un melon', baby: 'Bébé est presque prêt, il continue de grossir.', tip: 'Prépare ta valise de maternité.' },
  { from: 39, to: 42, size: 'une petite pastèque', baby: 'Bébé est prêt à naître.', tip: 'Repose-toi et reste attentive aux signes du travail. En France, le terme est fixé à 41 SA.' },
];

export const PREGNANCY_DUAS = [
  { text: 'Rabbi hab li min ladunka dhurriyyatan tayyibah — Seigneur, accorde-moi, venant de Toi, une descendance excellente.', source: 'Sourate Al Imran, 3:38' },
  { text: 'Rabbanā hab lanā min azwājinā wa dhurriyyātinā qurrata a‘yun — Seigneur, fais que nos épouses et nos descendants soient la joie de nos yeux.', source: 'Sourate Al-Furqan, 25:74' },
];

export const FASTING_PREGNANCY_INFO =
  'Selon l’avis retenu par notre comité, la femme enceinte ou qui allaite peut ne pas jeûner si elle craint pour sa santé ou celle de son bébé, et rattrape ensuite. Demande toujours l’avis de ton médecin ou de ta sage-femme avant de jeûner.';

export function weekContent(weeks) {
  return PREGNANCY_WEEKS.find((w) => weeks >= w.from && weeks <= w.to) || (weeks < 4 ? PREGNANCY_WEEKS[0] : PREGNANCY_WEEKS[PREGNANCY_WEEKS.length - 1]);
}

// Articles de lancement (5.11). Contenus à faire relire : santé par une professionnelle,
// fiqh par le comité, avant passage en production.
export const ARTICLES = [
  {
    slug: 'istihada-comprendre-les-saignements-hors-regles',
    title: 'Istihada : comprendre les saignements hors règles',
    category: 'fiqh',
    featured: true,
    readMinutes: 5,
    validation: 'valide_comite',
    reviewer: 'Validé par le comité religieux',
    color: 'bordeaux',
    excerpt: 'Quand un saignement n’est pas des règles, la prière et le jeûne continuent. On t’explique simplement.',
    body: `L’istihada désigne un saignement qui survient **en dehors des règles** (hayd) et du nifas. Contrairement aux règles, il n’empêche ni la prière ni le jeûne.

## Comment le reconnaître ?
Selon l’avis retenu par notre comité, on parle d’istihada lorsque :
- le saignement dépasse la durée maximale des règles (15 jours, ou ton habitude + 3 jours) ;
- il survient moins de 15 jours après la fin de tes dernières règles ;
- il dépasse la durée maximale du nifas (60 jours) après un accouchement.

## Que faire pendant l’istihada ?
- Tu pries et tu jeûnes normalement.
- Tu fais tes ablutions pour chaque prière.
- Tu peux te protéger avec une serviette pour limiter les salissures.

## Dans Nissali
Quand ta saisie dépasse la durée maximale, l’appli ne met plus tes prières en pause et t’affiche une information. Elle ne décide jamais à ta place.

> En cas de doute, rapproche-toi d’une personne de science.`,
    sources: ['Sahih al-Bukhari, Livre des menstrues', 'Al-Mudawwana'],
  },
  {
    slug: 'les-4-phases-de-ton-cycle',
    title: 'Les 4 phases de ton cycle, expliquées simplement',
    category: 'cycle',
    readMinutes: 4,
    validation: 'valide_sante',
    reviewer: 'Relu par une sage-femme',
    color: 'rose',
    phases: ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale'],
    excerpt: 'Menstruelle, folliculaire, ovulatoire, lutéale : ce qui se passe dans ton corps, phase par phase.',
    body: `Ton cycle commence le premier jour de tes règles (J1) et se termine la veille des suivantes. Il se divise en quatre phases.

## 1. La phase menstruelle
Du J1 au dernier jour de tes règles. La muqueuse de l’utérus s’élimine et les hormones sont au plus bas. Fatigue et crampes sont fréquentes : repose-toi.

## 2. La phase folliculaire
Du lendemain des règles jusqu’à quelques jours avant l’ovulation. Les œstrogènes remontent, ton énergie et ton moral aussi. C’est la phase dont la durée varie le plus d’une femme à l’autre.

## 3. La phase ovulatoire
Autour de l’ovulation. Le pic de l’hormone LH libère l’ovule : c’est la période la plus fertile.

## 4. La phase lutéale
De l’après-ovulation à la veille des règles, environ 14 jours, assez stable chez une même femme. La progestérone augmente ; des symptômes prémenstruels peuvent apparaître.

## Pourquoi c’est utile ?
Connaître ta phase t’aide à comprendre tes variations d’énergie et d’humeur. Nissali l’affiche chaque jour avec des conseils adaptés.`,
  },
  {
    slug: 'comment-faire-mes-grandes-ablutions-ghusl',
    title: 'Comment faire mes grandes ablutions (ghusl)',
    category: 'fiqh',
    readMinutes: 5,
    validation: 'valide_comite',
    reviewer: 'Validé par le comité',
    color: 'or',
    phases: ['menstruelle', 'folliculaire'],
    excerpt: 'À la fin des règles et du nifas, le ghusl te permet de reprendre la prière. Le pas-à-pas.',
    body: `Le ghusl (grandes ablutions) est obligatoire à la fin des règles et du nifas. Il permet de reprendre la prière.

## Quand le faire ?
Dès que tu constates la fin de tes règles : sécheresse complète ou pertes blanches.

## Les étapes
1. Formule l’intention (niyya) de te purifier.
2. Dis « Bismillah » et lave-toi les mains.
3. Lave les parties intimes.
4. Fais les petites ablutions (woudou).
5. Verse de l’eau sur la tête trois fois, en faisant pénétrer l’eau jusqu’aux racines des cheveux.
6. Lave tout le corps en commençant par le côté droit, sans oublier les plis.

## Et les prières ?
Selon l’heure de ta purification, une ou deux prières peuvent être à accomplir. Indique l’heure de fin de tes règles dans Nissali : l’appli te dit lesquelles, selon l’avis retenu par notre comité.`,
  },
  {
    slug: 'rattraper-ses-jours-de-jeune-guide-pratique',
    title: 'Rattraper ses jours de jeûne : le guide pratique',
    category: 'ramadan',
    readMinutes: 6,
    validation: 'valide_comite',
    reviewer: 'Validé par le comité',
    color: 'blush',
    excerpt: 'Compter, planifier, rattraper : tout ce qu’il faut savoir sur le qada.',
    body: `Aïcha (qu’Allah l’agrée) a dit : « Cela nous arrivait, et on nous ordonnait de rattraper le jeûne, et on ne nous ordonnait pas de rattraper la prière. » (Muslim)

## Combien de jours ?
Chaque jour de Ramadan où tu étais en règles ou en nifas à un moment entre l’aube et le coucher du soleil est à rattraper. Si tes règles se terminent avant l’aube, le jour n’est pas compté, même si le ghusl est fait après.

## Quand rattraper ?
Avant le Ramadan suivant, à ton rythme. Les jours de rattrapage ne peuvent pas tomber pendant Ramadan, les deux Aïd ou les jours de Tachriq.

## Le plan Nissali
Choisis un rythme (par exemple 2 jours par semaine) : l’appli place les jours en évitant tes règles prévues et te rappelle la veille. Coche « J’ai jeûné aujourd’hui » et le compteur baisse.

## Et si j’ai du retard ?
Consulte l’information sur la fidya dans l’onglet Jeûnes et, en cas de doute, rapproche-toi d’une personne de science.`,
  },
  {
    slug: 'quand-reprendre-la-priere-apres-les-regles',
    title: 'Quand reprendre la prière après les règles ?',
    category: 'fiqh',
    readMinutes: 4,
    validation: 'valide_comite',
    reviewer: 'Validé par le comité',
    color: 'or',
    phases: ['menstruelle'],
    excerpt: 'Signes de fin, ghusl, prières à accomplir : les repères pour ne plus douter.',
    body: `## Les signes de la fin des règles
Selon l’avis retenu par notre comité : la **sécheresse complète** ou l’apparition de **pertes blanches**.

## Après le ghusl
Tu reprends la prière. Si tu te purifies pendant le temps d’une prière, tu l’accomplis. Selon l’avis retenu :
- purification avant le coucher du soleil, avec assez de temps pour le ghusl et une partie de la prière : Dhuhr et Asr ;
- purification avant l’aube : Maghrib et Isha.

## Les prières de la période de règles
Elles ne se rattrapent pas. Nissali ne les compte jamais comme manquées.`,
  },
  {
    slug: 'le-nifas-ce-quil-faut-savoir',
    title: 'Le nifas : ce qu’il faut savoir après l’accouchement',
    category: 'fiqh',
    readMinutes: 5,
    validation: 'valide_comite',
    reviewer: 'Validé par le comité',
    color: 'or',
    excerpt: 'Durée maximale, prière, jeûne, ghusl : les règles du post-partum.',
    body: `Le nifas désigne les saignements qui suivent l’accouchement.

## Durée
Il n’y a pas de durée minimale. La durée maximale retenue par notre comité est de **60 jours**. Au-delà, il s’agit d’istihada : la prière et le jeûne reprennent.

## Pendant le nifas
Comme pendant les règles : pas de prière ni de jeûne. Les jours de Ramadan sont à rattraper ensuite.

## La fin du nifas
Dès que les saignements s’arrêtent, même avant 60 jours, tu fais ton ghusl et tu reprends la prière.

## Dans Nissali
Le mode post-partum met tes rappels de prière en pause, compte tes jours de jeûne et te rappelle le ghusl.`,
  },
  {
    slug: 'mieux-comprendre-son-ovulation',
    title: 'Mieux comprendre son ovulation',
    category: 'fertilite',
    readMinutes: 5,
    validation: 'valide_sante',
    reviewer: 'Relu par une sage-femme',
    color: 'rose',
    phases: ['folliculaire', 'ovulatoire'],
    excerpt: 'Pourquoi l’ovulation se calcule à partir des prochaines règles, et comment l’affiner.',
    body: `La première moitié du cycle varie beaucoup d’une femme à l’autre. La seconde (phase lutéale) est stable : environ 14 jours. C’est pourquoi Nissali calcule l’ovulation **à partir de tes prochaines règles** : prochaines règles − 14 jours.

## La fenêtre fertile
Les 5 jours avant l’ovulation et le jour de l’ovulation, soit 6 jours.

## Affiner avec tes observations
- **Température au réveil** : une hausse durable de 0,2 à 0,5 °C pendant au moins 3 jours confirme que l’ovulation a eu lieu la veille.
- **Glaire cervicale** : plus fluide et élastique (blanc d’œuf) autour de l’ovulation.
- **Tests d’ovulation** : un test positif annonce l’ovulation dans les 24 à 36 heures.

> Nissali n’est pas un moyen de contraception. Les prédictions sont des estimations.`,
  },
  {
    slug: 'je-veux-un-enfant-par-ou-commencer',
    title: 'Je veux un enfant : par où commencer ?',
    category: 'fertilite',
    readMinutes: 5,
    validation: 'valide_sante',
    reviewer: 'Relu par une sage-femme',
    color: 'rose',
    excerpt: 'Acide folique, hygiène de vie, jours fertiles et invocations : les premiers pas.',
    body: `## Avant la grossesse
- Commence l’**acide folique** (vitamine B9) idéalement trois mois avant la conception, sur avis médical.
- Fais le point avec ta gynécologue ou ta sage-femme : vaccins, bilan, traitements en cours.
- Mange varié, bouge régulièrement et dors suffisamment.

## Repérer tes jours fertiles
Active l’objectif « avoir un enfant » dans ton profil : Nissali te rappelle le premier jour de ta fenêtre fertile.

## Patience
Il faut en moyenne plusieurs cycles pour concevoir. Après 12 mois d’essais (6 mois après 35 ans), consulte.

## Invocations
« Seigneur, accorde-moi, venant de Toi, une descendance excellente. » (Sourate Al Imran, 3:38)`,
  },
  {
    slug: 'cycles-irreguliers-que-faire',
    title: 'Cycles irréguliers : faut-il s’inquiéter ?',
    category: 'cycle',
    readMinutes: 4,
    validation: 'valide_sante',
    reviewer: 'Relu par une gynécologue',
    color: 'rose',
    excerpt: 'Stress, pilule, adolescence, allaitement : les causes fréquentes et quand consulter.',
    body: `Un cycle est considéré comme irrégulier quand l’écart entre ton cycle le plus court et le plus long dépasse 7 jours.

## Les causes fréquentes
- l’adolescence (les premières années) ;
- l’arrêt de la pilule (3 à 6 mois d’ajustement) ;
- le post-partum et l’allaitement ;
- le stress, le voyage, un changement de poids ;
- la préménopause.

## Dans Nissali
Pour un cycle irrégulier, l’appli affiche une **période** plutôt qu’une date, et l’indice de fiabilité est « faible ».

## Quand consulter ?
- cycles répétés de moins de 21 jours ou de plus de 45 jours ;
- absence de règles plus de 3 mois (hors grossesse) ;
- règles de plus de 8 jours ou très abondantes.`,
  },
  {
    slug: 'soulager-les-douleurs-de-regles',
    title: 'Soulager les douleurs de règles naturellement',
    category: 'sante',
    readMinutes: 4,
    validation: 'valide_sante',
    reviewer: 'Relu par une sage-femme',
    color: 'blush',
    phases: ['menstruelle'],
    excerpt: 'Chaleur, mouvement, alimentation : des gestes simples contre les crampes.',
    body: `## La chaleur
Une bouillotte sur le bas du ventre détend les muscles de l’utérus.

## Le mouvement
Une marche douce ou quelques étirements améliorent la circulation.

## L’alimentation
- Bois suffisamment (eau, tisanes de gingembre ou de camomille).
- Privilégie les aliments riches en magnésium : amandes, banane, chocolat noir.
- Limite le sel et les produits très sucrés.

## Quand consulter ?
Si la douleur t’empêche d’aller en cours ou au travail, ou si elle ne cède pas aux antalgiques simples, parles-en à une professionnelle de santé : une endométriose doit parfois être recherchée.`,
  },
  {
    slug: 'syndrome-premenstruel',
    title: 'Le syndrome prémenstruel, on en parle ?',
    category: 'sante',
    readMinutes: 4,
    validation: 'valide_sante',
    reviewer: 'Relu par une sage-femme',
    color: 'blush',
    phases: ['luteale'],
    excerpt: 'Irritabilité, fringales, seins sensibles : comprendre et apaiser les jours avant les règles.',
    body: `Dans la phase lutéale, la progestérone augmente. Beaucoup de femmes ressentent alors :
- irritabilité ou tristesse ;
- seins sensibles, ballonnements ;
- fringales, fatigue.

## Ce qui aide
- Dormir suffisamment et garder des horaires réguliers.
- Bouger un peu chaque jour.
- Réduire le sel, le sucre raffiné et la caféine.
- Noter tes symptômes dans Nissali pour repérer ce qui revient à chaque cycle.

## Quand consulter ?
Si ces symptômes perturbent fortement ta vie, une professionnelle de santé peut t’accompagner.`,
  },
  {
    slug: 'jeuner-enceinte-ou-allaitante',
    title: 'Jeûner enceinte ou allaitante',
    category: 'grossesse',
    readMinutes: 5,
    validation: 'valide_comite',
    reviewer: 'Validé par le comité et relu par une sage-femme',
    color: 'or',
    excerpt: 'Ce que dit l’avis retenu par notre comité, et pourquoi l’avis médical compte.',
    body: `Selon l’avis retenu par notre comité, la femme enceinte ou qui allaite peut ne pas jeûner si elle craint pour sa santé ou celle de son bébé. Les jours sont rattrapés ensuite.

## Avant de jeûner
Demande toujours l’avis de ton médecin ou de ta sage-femme, surtout en cas de diabète gestationnel, d’anémie ou de grossesse à risque.

## Si tu jeûnes
- Hydrate-toi bien entre l’iftar et le suhur.
- Ne saute pas le suhur.
- Romps le jeûne en cas de malaise, vertiges ou contractions.

## Les jours manqués
Ajoute-les dans l’onglet Jeûnes avec la raison « grossesse » ou « allaitement ».`,
  },
  {
    slug: 'premier-trimestre-de-grossesse',
    title: 'Premier trimestre : ce qui t’attend',
    category: 'grossesse',
    readMinutes: 5,
    validation: 'valide_sante',
    reviewer: 'Relu par une sage-femme',
    color: 'rose',
    excerpt: 'Fatigue, nausées, premiers rendez-vous : les 14 premières semaines.',
    body: `Le premier trimestre va jusqu’à 14 SA + 6 jours.

## Ce que tu peux ressentir
Fatigue, nausées, seins sensibles, envies fréquentes d’uriner : c’est normal.

## Les rendez-vous
- Première consultation avant 15 SA (déclaration de grossesse).
- Échographie de datation entre 11 et 14 SA : elle fixe la date du terme. Saisis-la dans Nissali, tous les calculs seront recalés.

## Les bons réflexes
- Acide folique jusqu’à 12 SA (sur avis médical).
- Pas d’alcool, viande bien cuite, lavage soigneux des fruits et légumes.`,
  },
  {
    slug: 'sa-ou-sg-comment-compter',
    title: 'SA ou SG : comment compter les semaines de grossesse ?',
    category: 'grossesse',
    readMinutes: 3,
    validation: 'valide_sante',
    reviewer: 'Relu par une sage-femme',
    color: 'blush',
    excerpt: 'Semaines d’aménorrhée, semaines de grossesse, terme : on démêle tout.',
    body: `## SA : semaines d’aménorrhée
Comptées depuis le premier jour des dernières règles (DDR). C’est la référence des médecins en France.

## SG : semaines de grossesse
Comptées depuis la conception. SG = SA − 2 semaines pour un cycle de 28 jours.

## Le terme
En France, il est fixé à **41 SA** (DDR + 287 jours). La règle internationale de Naegele le place à 40 SA.

## Dans Nissali
L’appli affiche les SA, le mois, le trimestre et un compte à rebours. La date du terme donnée par l’échographie est prioritaire.`,
  },
  {
    slug: 'preparer-son-ramadan',
    title: 'Préparer son Ramadan en douceur',
    category: 'ramadan',
    readMinutes: 4,
    validation: 'valide_comite',
    reviewer: 'Validé par le comité',
    color: 'or',
    excerpt: 'Rattrapage, sommeil, alimentation : se préparer dès Chaabane.',
    body: `## Solder ses jours
Profite des mois précédents pour rattraper tes jours manqués : le plan de rattrapage Nissali t’y aide.

## Préparer son corps
- Avance progressivement l’heure de ton réveil.
- Réduis la caféine pour éviter les maux de tête.
- Jeûne quelques lundis et jeudis.

## Pendant tes règles
Le compteur se remplit tout seul : tu n’as rien à noter de plus. Le dhikr, les invocations et l’écoute du Coran restent accessibles.`,
  },
  {
    slug: 'les-jours-blancs',
    title: 'Les jours blancs : pourquoi les jeûner ?',
    category: 'ramadan',
    readMinutes: 3,
    validation: 'valide_comite',
    reviewer: 'Validé par le comité',
    color: 'blush',
    excerpt: 'Les 13, 14 et 15 de chaque mois hégirien, une sunna facile à adopter.',
    body: `Les jours blancs sont les 13, 14 et 15 de chaque mois hégirien, quand la lune est pleine.

## Leur mérite
Jeûner trois jours par mois équivaut, par la récompense, à jeûner toute l’année (rapporté par al-Bukhari et Muslim).

## Exception
Le 13 Dhou al-hijja fait partie des jours de Tachriq, où le jeûne n’est pas recommandé.

## Dans Nissali
L’écran d’accueil affiche le compte à rebours et l’appli te prévient la veille.`,
  },
  {
    slug: 'pertes-blanches-normales',
    title: 'Pertes blanches : ce qui est normal (ou pas)',
    category: 'sante',
    readMinutes: 4,
    validation: 'valide_sante',
    reviewer: 'Relu par une sage-femme',
    color: 'rose',
    phases: ['folliculaire', 'ovulatoire'],
    excerpt: 'Elles changent au fil du cycle. Quand faut-il consulter ?',
    body: `Les pertes blanches sont normales : elles protègent et nettoient le vagin.

## Au fil du cycle
- après les règles : peu abondantes, plutôt sèches ;
- avant l’ovulation : crémeuses puis fluides ;
- à l’ovulation : transparentes et élastiques (blanc d’œuf) ;
- après l’ovulation : plus épaisses.

## Quand consulter ?
Odeur forte, couleur verte ou grise, démangeaisons, brûlures ou douleurs : parles-en à une professionnelle de santé.`,
  },
  {
    slug: 'arret-de-la-pilule',
    title: 'Arrêt de la pilule : à quoi s’attendre ?',
    category: 'cycle',
    readMinutes: 4,
    validation: 'valide_sante',
    reviewer: 'Relu par une gynécologue',
    color: 'blush',
    excerpt: 'Cycles qui se cherchent, peau, humeur : les premiers mois après l’arrêt.',
    body: `Après l’arrêt de la pilule, ton cycle naturel reprend progressivement. Il faut souvent **3 à 6 mois** pour qu’il se régularise.

## Ce que tu peux observer
- des cycles plus longs ou plus courts ;
- des changements de peau ;
- des variations d’humeur.

## Dans Nissali
Choisis le profil « arrêt de la pilule » : l’appli affiche des périodes plutôt que des dates et réduit l’indice de fiabilité le temps que tes cycles se stabilisent.

## Quand consulter ?
Si tes règles ne reviennent pas après 3 mois (hors grossesse).`,
  },
  {
    slug: 'sommeil-et-cycle',
    title: 'Sommeil et cycle : le lien que l’on oublie',
    category: 'sante',
    readMinutes: 3,
    validation: 'valide_sante',
    reviewer: 'Relu par une professionnelle de santé',
    color: 'rose',
    phases: ['luteale', 'menstruelle'],
    excerpt: 'Pourquoi tu dors moins bien avant tes règles, et comment y remédier.',
    body: `Avant les règles, la baisse de la progestérone peut perturber le sommeil, et la température du corps augmente légèrement.

## Les bons gestes
- Une chambre fraîche et sombre.
- Pas d’écran dans l’heure qui précède le coucher.
- Un dîner léger et pas de caféine après 16 h.
- Les invocations du soir pour apaiser l’esprit.

Note ton sommeil dans Nissali : les graphiques de ton profil te montrent son évolution au fil des cycles.`,
  },
  {
    slug: 'alimentation-et-fer',
    title: 'Fer et règles : bien recharger ses réserves',
    category: 'sante',
    readMinutes: 3,
    validation: 'valide_sante',
    reviewer: 'Relu par une diététicienne',
    color: 'or',
    phases: ['menstruelle'],
    excerpt: 'Fatigue, essoufflement ? Les règles font perdre du fer : voici où le trouver.',
    body: `Chaque mois, les règles entraînent une perte de fer. Si elles sont abondantes, une anémie peut s’installer.

## Où trouver du fer ?
- viandes rouges, abats, poissons ;
- lentilles, pois chiches, haricots ;
- épinards, persil ;
- dattes et fruits secs.

## L’astuce
La vitamine C (agrumes, kiwi, poivron) aide à absorber le fer végétal. Évite le thé pendant les repas.

Si tu te sens très fatiguée, demande un bilan sanguin à ton médecin.`,
  },
  {
    slug: 'endometriose-les-signes',
    title: 'Endométriose : les signes qui doivent alerter',
    category: 'sante',
    readMinutes: 4,
    validation: 'valide_sante',
    reviewer: 'Relu par une gynécologue',
    color: 'blush',
    excerpt: 'Une femme sur dix est concernée. Les douleurs ne sont pas une fatalité.',
    body: `L’endométriose touche environ une femme sur dix. Le diagnostic arrive souvent tard.

## Les signes
- règles très douloureuses, qui résistent aux antalgiques ;
- douleurs pendant les rapports ;
- douleurs en allant aux toilettes pendant les règles ;
- fatigue importante ;
- difficultés à concevoir.

## Que faire ?
Note tes symptômes dans Nissali et parles-en à ta gynécologue. Avoir mal n’est pas normal.`,
  },
  {
    slug: 'premieres-regles-guide-pour-les-adolescentes',
    title: 'Premières règles : le guide pour les adolescentes',
    category: 'fiqh',
    readMinutes: 5,
    validation: 'valide_comite',
    reviewer: 'Validé par le comité et relu par une sage-femme',
    color: 'rose',
    excerpt: 'Ce qui change dans ton corps et dans ta pratique, expliqué sans gêne.',
    body: `Les premières règles arrivent en général entre 10 et 15 ans. Elles marquent la puberté et le début de la responsabilité religieuse.

## Ce qui change
- Pendant tes règles, tu ne pries pas et tu ne jeûnes pas.
- Les jours de Ramadan manqués se rattrapent, pas les prières.
- À la fin, tu fais ton ghusl et tu reprends la prière.

## Les premières années
Les cycles sont souvent irréguliers : c’est normal. Choisis le profil « adolescente » dans Nissali.

## Pour la durée
Selon l’avis retenu par notre comité, la durée maximale des premières règles est de 15 jours.

> En cas de doute, rapproche-toi d’une personne de science ou d’une femme de confiance.`,
  },
  {
    slug: 'post-partum-prendre-soin-de-soi',
    title: 'Post-partum : prendre soin de soi',
    category: 'grossesse',
    readMinutes: 4,
    validation: 'valide_sante',
    reviewer: 'Relu par une sage-femme',
    color: 'blush',
    excerpt: 'Repos, alimentation, moral : les semaines qui suivent l’accouchement.',
    body: `Les semaines qui suivent la naissance sont intenses.

## Ton corps
- Les saignements (lochies) durent souvent plusieurs semaines.
- Le retour des règles est imprévisible, surtout si tu allaites.
- La rééducation du périnée est prescrite après la visite post-natale.

## Ton moral
Le « baby blues » est fréquent les premiers jours. Si la tristesse dure plus de deux semaines, parles-en : la dépression post-partum se soigne.

## Dans Nissali
Le mode post-partum suit ton nifas, met tes rappels de prière en pause et te rappelle le ghusl.`,
  },
  {
    slug: 'comprendre-les-contraceptions',
    title: 'Comprendre les différentes contraceptions',
    category: 'sante',
    readMinutes: 5,
    validation: 'valide_sante',
    reviewer: 'Relu par une sage-femme',
    color: 'rose',
    excerpt: 'Pilule, stérilet, implant : un panorama pour en parler avec ta soignante.',
    body: `Il existe plusieurs méthodes de contraception. Leur choix se fait avec une professionnelle de santé.

## Les méthodes hormonales
Pilule, implant, stérilet hormonal, anneau, patch.

## Les méthodes non hormonales
Stérilet au cuivre, préservatifs.

## Important
Nissali n’est **pas** un moyen de contraception : ses prédictions sont des estimations. Tu peux noter ta contraception dans ton profil et activer un rappel de prise de pilule.`,
  },
];

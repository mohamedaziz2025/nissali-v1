# Nissali

> Ton cycle, ta foi, ta santé. Au même endroit.

Implémentation du cahier des charges V2.0 (octobre 2026) : suivi du cycle, ovulation, grossesse et post-partum,
prières et qibla, jeûnes à rattraper, santé du jour, blog validé, praticiennes, back-office.

| Dossier | Rôle | Techno |
|---|---|---|
| `backend/` | API unique pour les deux applications | Node.js, Express 5, MongoDB (Mongoose) |
| `mobile/` | App des utilisatrices (5 onglets des maquettes) + espace pro mobile | React Native, Expo SDK 57, Expo Router |
| `web/` | Web app de l’équipe (back-office) et des praticiennes | Next.js 16 |

Un seul compte par personne : une praticienne passe de son **espace personnel** (cycle, prières, jeûnes) à son
**espace pro** (rendez-vous, prestations, clientes, abonnement) sans se déconnecter, sur mobile comme sur le web.

---

## Démarrage rapide

Prérequis : Node.js 20.12 ou plus récent, et l’app **Expo Go** (SDK 57) sur ton téléphone.

```bash
npm run install:all        # installe les 3 projets
cp backend/.env.example backend/.env
```

Puis, dans 4 terminaux :

```bash
npm run db       # MongoDB local sans installation (données conservées dans backend/.data)
npm run seed     # données de démo (à lancer une fois, la base est vidée)
npm run api      # API sur http://localhost:4000
npm run web      # back-office et espace pro sur http://localhost:3001
npm run mobile   # Expo : scanne le QR code avec Expo Go (iPhone : appareil photo)
```

- Si tu as déjà MongoDB (local ou Atlas en UE), renseigne `MONGODB_URI` dans `backend/.env` et saute `npm run db`.
- Le téléphone et l’ordinateur doivent être sur le **même Wi-Fi**. L’app trouve l’API toute seule
  (`http://<IP de l’ordinateur>:4000`). Sinon, crée `mobile/.env` avec `EXPO_PUBLIC_API_URL=http://192.168.x.x:4000/api`.
  Autorise Node dans le pare-feu macOS si une alerte apparaît.

### Comptes de démo

En développement, les codes OTP s’affichent dans la console de l’API **et** directement dans l’app.

| Compte | Connexion | Pour tester |
|---|---|---|
| Amina | `amina@nissali.app` ou `06 00 00 00 01` | App mobile : écrans des maquettes (règles dans 10 jours, 6 jeûnes à rattraper…) |
| Samira | `samira@nissali.app` | Espace perso **et** espace pro (formule Essentiel, rendez-vous, fiche cliente) |
| Inès, Khadija | `ines@nissali.app`, `khadija@nissali.app` | Praticiennes Premium et Découverte |
| Équipe | `admin@nissali.app` / mot de passe de `SEED_ADMIN_PASSWORD` (sinon généré et affiché par le seed) puis code | Back-office web (double authentification) |

L’onglet Praticiennes s’ouvre **automatiquement dès qu’au moins une praticienne est validée** par l’équipe ; tant qu’il
n’y en a aucune, il reste flouté « Bientôt disponible » comme sur la maquette. Le back-office (Paramètres → Application)
permet de forcer l’ouverture ou la fermeture.

---

## Inscription et connexion (OTP)

Inscription par **e-mail ou numéro de téléphone**, vérifié par un code à 6 chiffres (10 min, 5 essais, anti-abus).
Ordre des écrans du RG-05 bis : prénom, âge (15 ans minimum), ville, situation, puis e-mail ou téléphone.
Consentements séparés et non cochés (CGU, données de santé, communications).

Après l’inscription, chacune choisit : **garder la connexion par code** (rien à retenir) ou **créer un mot de passe**
(8 caractères minimum). Le code reste toujours disponible. « Mot de passe oublié » envoie un code puis enregistre
le nouveau mot de passe. Tout se gère dans « Connexion et sécurité » (profil mobile, espace pro web).

`DEV_EXPOSE_CODES=auto` (serveur) : le code n’est renvoyé à l’app que pour les comptes de démo ou quand il ne peut pas
être livré (SMTP en panne ou bloqué, pas de fournisseur SMS). L’API revérifie la connexion SMTP toutes les 10 minutes.

Envoi des codes, à configurer dans `backend/.env` :

- **E-mail** : n’importe quel SMTP (Brevo, OVH, Gmail…) via `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`.
- **SMS** : `SMS_PROVIDER=twilio` (`TWILIO_*`) ou `SMS_PROVIDER=brevo` (`BREVO_API_KEY`).
- Sans configuration : `console` (codes affichés dans le terminal de l’API).

Back-office : mot de passe + code OTP par e-mail, session de 24 h, actions tracées dans le journal d’audit.

## API gratuites utilisées (sans clé)

| Besoin | API | Repli hors connexion |
|---|---|---|
| Horaires des 5 prières à la position GPS exacte | [Aladhan](https://aladhan.com/prayer-times-api) | bibliothèque `adhan` calculée localement (serveur et téléphone) |
| Direction de la qibla à la position GPS exacte | Aladhan `/qibla` | formule locale (`adhan`) + boussole du téléphone |
| Adhan (audio) à l’heure de la prière | Enregistrements Aladhan `cdn.aladhan.com/audio/adhans` (Alafasy, Al-Zahrani, al-Nafees, Özcan) | — |
| Recherche de ville | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | — |
| Position GPS → ville | [BigDataCloud](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) + fuseau Open-Meteo | — |
| Conseil santé (chaleur, UV, froid) | [Open-Meteo Forecast](https://open-meteo.com/en/docs) | conseils selon la phase du cycle |
| Qualité de l’air et pollens | [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | — |
| Visio praticienne | [Jitsi Meet](https://meet.jit.si) (lien créé à la confirmation) | — |
| Calendrier hégirien | Umm al-Qura via ICU (intégré à Node), ajustement ± 1 jour depuis le back-office | — |

---

## Ce qui est couvert

**App mobile (utilisatrices)** : les 5 onglets du cahier aux couleurs et typographies Nissali (Fraunces, DM Sans),
profil et réglages, santé détaillée avec graphiques, grossesse et post-partum, qibla, notifications.

- *Aujourd’hui* : prochaines règles avec anneau, prières du jour cochables + qibla, jours blancs, jeûnes à rattraper,
  santé du jour (humeur, symptômes, sommeil), conseil santé météo, petit rappel. Carte adaptée en règles, grossesse, nifas.
- *Cycle* : carte « Prochaines règles dans X jours », calendrier (règles pleines, prévues en pointillé, fertile,
  ovulation cerclée d’or, rendez-vous entourés), phase du jour, historique et cycles aberrants, règles passées.
- *Jeûnes* : compteur automatique pendant Ramadan (RG-21/22), ajouts manuels par année, « J’ai jeûné aujourd’hui »,
  plan de rattrapage qui évite règles prévues, Ramadan, Aïd et Tachriq (RG-24), suhur/iftar, jeûnes surérogatoires, fidya.
- *Praticiennes* : maquette floutée + inscription pro avec choix de formule ; annuaire, créneaux, réservation,
  visio, avis et favoris quand l’annuaire est ouvert.
- *Blog* : à la une, catégories, recherche, article du jour selon la phase, 24 articles de lancement.
- Position exacte : à l’ouverture et au retour dans l’app, la position GPS est envoyée (`PUT /api/me/location`) dès
  que l’utilisatrice a bougé de plus de 500 m ou changé de fuseau ; horaires, qibla, météo, jeûnes et notifications
  suivent. Option « ville fixe » dans le profil (pour suivre sa mosquée).
- Adhan : à l’heure de chaque prière, notification « C’est l’heure de Asr · touche pour écouter l’adhan ». Appli ouverte :
  l’adhan choisi (profil › Voix de l’adhan) se lance tout seul ; notification touchée : l’appli s’ouvre et le joue.
  Expo Go ne permet pas de son personnalisé dans la notification elle-même (son par défaut) : avec un build EAS,
  ajouter un extrait de 30 s via le plugin `expo-notifications` (`sounds`).
- Profil › Espace professionnel : vérification en direct du profil praticienne ; si le profil pro a été créé avec une
  autre adresse (compte pro seul, sans suivi personnel), un code envoyé à cette adresse permet de le rattacher au compte
  (`POST /api/me/pro-link/check` puis `/verify`) pour basculer entre les deux espaces sans se déconnecter.
- Rappels de dhikr aux horaires de la position : adhkar du matin (Fajr + 20 min), du soir (Asr + 20 min), vendredi
  (sourate Al-Kahf et salawat à 9 h 30, du’a à la dernière heure avant Maghrib), dhikr pendant les règles. Textes
  modifiables dans le back-office (Paramètres › Religieux), chaque rappel désactivable dans le profil.
- Pause des rappels de prière pendant les règles et le nifas (RG-15/18), prières à accomplir après le ghusl (RG-19),
  notifications locales discrètes (« Petit rappel du jour », RG-17), saisies hors connexion synchronisées ensuite.

**Espace pro (mobile et web)** : tableau de bord (indicateurs et tendances, complétude du profil, agenda du jour, semaine,
chiffre d’affaires), demandes à accepter, agenda, prestations (quota selon la formule), disponibilités et congés,
réponses aux avis, profil public avec photo, formules Découverte / Essentiel / Premium.
Fiches clientes : statistiques (séances, facturé / réglé, absences, prochain rendez-vous, fréquence), informations
(date de naissance, adresse, profession, contact d’urgence, provenance, préférences), suivi (motif, antécédents,
allergies, traitements, objectifs), consentement, notes et comptes rendus de séance, documents privés (jamais servis
publiquement, ouverts sur mobile via un lien signé de 5 minutes), impression.
Bascule perso ↔ pro depuis l’avatar (sélecteur de compte, pastille des demandes en attente, transition instantanée).

**Back-office (web)** : statistiques de la partie 13, utilisatrices et export CSV des contacts consentants
(aucune donnée de santé), validation des praticiennes, abonnements à activer après paiement, formules, spécialités,
réservations, modération des avis, blog avec statut de validation et programmation, petit rappel du jour,
paramètres religieux de la partie 7.2 avec historique, ajustement hégirien, journal d’audit.

**RGPD** : consentements modifiables, export JSON des données, suppression du compte en un geste, purge après
3 ans d’inactivité, données de santé jamais exposées au back-office ni aux praticiennes.

## Déploiement (serveur Docker)

Le dossier [deploy/](deploy/) contient un `docker-compose.yml` autonome (projet `nissali`) :

| Service | Port public | Rôle |
|---|---|---|
| `web` | 8100 | back-office et espace pro (Next.js, relaie `/api` vers l’API) |
| `api` | 8101 | API Express |
| `expo` | 8102 | Metro pour Expo Go : `exp://<IP>:8102` + tunnel HTTPS `*.exp.direct` |
| `mongo` | aucun | base MongoDB 7, accessible seulement depuis le réseau Docker du projet |

```bash
# sur le serveur, dans /opt/nissali
cp deploy/.env.example deploy/.env && chmod 600 deploy/.env   # JWT_SECRET, EXPO_TOKEN…
cd deploy
docker compose up -d --build mongo api
docker compose exec api node src/seed/seed.js --reset      # données de démo
docker compose up -d --build web expo
```

Mise à jour : envoyer le code (rsync sans `node_modules`, `.env`, `.data`), puis `docker compose build <service>` et `docker compose up -d --no-deps <service>`.
Le premier bundle Expo prend environ 4 minutes sur 2 vCPU ; il est ensuite en cache.

### Paiement des abonnements praticiennes (Stripe)

Le règlement en ligne est facultatif : sans clés Stripe, l’équipe confirme les paiements depuis le
back-office (`/admin/abonnements`), comme avant. Pour l’activer, renseigner dans `deploy/.env` :

```bash
STRIPE_SECRET_KEY=sk_live_…          # ou sk_test_… pour les essais
STRIPE_WEBHOOK_SECRET=whsec_…        # « Ajouter un endpoint », événements checkout.session.completed,
                                     # customer.subscription.updated/deleted, invoice.payment_failed
STRIPE_CURRENCY=eur
```

Le webhook pointe vers `http://<IP>:8101/api/stripe/webhook` (domaine en HTTPS recommandé en production :
Stripe n’accepte pas un endpoint HTTP avec IP). La formule s’active automatiquement après le paiement ;
les prix restent gérés dans le back-office (formules).

## Tests

```bash
npm test
```

Les tests reprennent les exemples chiffrés de la partie 6 (moyenne pondérée, prédictions, ovulation,
cycles irréguliers, grossesse, Ramadan, plan de rattrapage, purification, qibla, calendrier hégirien)
et la vérification de signature des webhooks Stripe.

## Points à trancher

1. **Incohérence dans le cahier (6.4 / 6.5).** La règle « ovulation = prochaines règles − 14 jours » et son exemple daté
   (ovulation le 28 octobre) placent l’ovulation à J15 d’un cycle de 28 jours. Le tableau 6.4 et l’exemple 6.5
   (ovulatoire J12–J15) la placent à J14. L’app applique la règle 6.4. Pour obtenir les bornes de 6.5, passer la
   « phase lutéale » à 15 jours dans le back-office (l’exemple daté donnerait alors le 27 octobre).
2. **Connexion Apple / Google (RG-01, RG-02)** : remplacée par l’OTP e-mail ou SMS comme demandé.
3. **Paiement des formules praticiennes** : Stripe Checkout (abonnement récurrent) activé dès que les clés sont renseignées,
   avec repli sur référence de paiement + activation manuelle par l’équipe quand il est coupé.
4. **Méthode de prière** : Ligue islamique mondiale (18° / 17°) et règle du septième de la nuit par défaut, modifiables dans le back-office.
   Vérification (octobre 2026) : Fajr, lever, Dhuhr, Maghrib et Isha d’Aladhan concordent à la minute avec le calcul
   astronomique ; l’Asr d’Aladhan arrive 2 à 5 min plus tard en automne (Paris 16 h 30 contre 16 h 28 calculé par la
   longueur d’ombre). Les ajustements ± minutes du profil permettent de s’aligner sur la mosquée.
5. **Production** : hébergement en UE (HDS recommandé), chiffrement au repos assuré par l’hébergeur MongoDB, `JWT_SECRET` obligatoire,
   build EAS pour publier sur les stores et activer les notifications push distantes (Expo Go ne gère que les notifications locales).
6. **Hors périmètre de cette version** (V2 du cahier) : Apple Santé / Health Connect, export PDF pour la gynécologue, versions anglaise et arabe.

## Cahier des charges V3 (octobre 2026)

- **Inscription par e-mail uniquement** (code OTP) ; le numéro de téléphone est facultatif et s’ajoute ensuite dans le profil.
- **Accueil** dans l’ordre de la maquette : prières (prochaine prière, mosquée ou ville, Qibla, pause « Prières en pause » pendant les règles avec accès au dhikr), carte Règles (frise des 4 phases, « Modifier »), jeûnes à rattraper et jours blancs (lien direct vers la section), « Comment tu te sens ? » avec le bouton bordeaux « Suivi santé », conseil santé (bibliothèque par phase, RG-08 ter), petit rappel.
- **Horaires de prière** (façon Mawaqit) : « Ma ville » (position GPS ou ville, API Aladhan) ou « Ma mosquée » (mosquées partenaires avec leurs horaires saisis dans le back-office, ou mosquées OpenStreetMap autour de soi — horaires calculés à leur adresse, RG-16 bis). Jumu’a affichée.
- **Mes règles** : début et fin modifiables, flux jour par jour, prochaines règles et fiabilité, historique des cycles et moyenne, règles passées.
- **Jeûnes** : « X jours à rattraper avant Ramadan », date estimée et jours restants (RG-24 bis), conseil de rythme (RG-24 ter), cases à cocher datées, « Jeûné aujourd’hui », « + Jour manqué », section Jours blancs.
- **Praticiennes** : catégories gérées dans le back-office (Psychologue, Naturopathe, Diététicienne/nutritionniste, Hijama, Masseuse, Coach, Doula, Sage-femme), recherche par nom ou spécialité, filtres Ville et Région, tri du plus proche au plus loin (distance affichée), A→Z ou nouvelles inscrites, boutons Message et Appeler (si la praticienne affiche son numéro, RG-26). Pas de paiement des rendez-vous sur Nissali : tarifs indicatifs (seuls les abonnements des praticiennes sont payants).
- **Messagerie façon Messenger** : conversations, bulles, photos (stockage privé, liens signés 2 h), réponses citées, réactions, « Vu », « écrit… », blocage et signalement (back-office › Signalements). Push discret « Tu as un nouveau message » (jamais le contenu).
- **Fiche cliente** : historique complet (prises de contact, rendez-vous, séances, documents, avis, messages).
- **Lifestyle** (ex-Blog) : onglets Magazine et Événements (Nissali ou proposés par une sœur, validés avant publication, commission 15 % sur les billets payants). La billetterie en ligne (Stripe Connect, RG-30) reste à brancher : les places payantes sont réservées et suivies dans le back-office.
- **Notifications push de l’équipe** (back-office › Notifications push) : titre, message, image, page ouverte au toucher, audience ciblée. Push via Expo (projet EAS lié) ; dans Expo Go sur Android, les notifications distantes ne sont plus disponibles depuis le SDK 53 : elles arrivent dans le centre de notifications et s’affichent à l’ouverture de l’appli. Un build EAS (APK / TestFlight) active le push partout.
- Migration d’une base existante sans perte : `docker compose exec api node src/seed/v3.js`.

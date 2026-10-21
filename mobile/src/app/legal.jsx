import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Card, Screen, T } from '../components/ui';

import { tr } from '../lib/i18n';
const DOCS = {
  cgu: {
    title: tr("Conditions d’utilisation"),
    sections: [
      [tr("Objet"), tr("Nissali est une application gratuite de suivi féminin (cycle, ovulation, grossesse, prières, jeûnes) destinée aux femmes musulmanes à partir de 15 ans.")],
      [tr("Compte"), tr("Un compte vérifié par e-mail ou par téléphone est nécessaire pour sauvegarder et synchroniser tes données entre tes appareils. Tu peux le supprimer à tout moment depuis ton profil.")],
      [tr("Pas de dispositif médical"), tr("Nissali n’est pas un moyen de contraception et ne pose aucun diagnostic. Les prédictions sont des estimations. En cas de doute sur ta santé, consulte une professionnelle de santé.")],
      [tr("Référentiel religieux"), tr("Les règles présentées sont l’avis retenu par notre comité, avec leurs sources. L’appli informe, elle ne délivre jamais de fatwa. En cas de doute, rapproche-toi d’une personne de science.")],
      [tr("Praticiennes"), tr("Les praticiennes de l’annuaire sont des professionnelles indépendantes. Les prestations sont réglées directement auprès d’elles.")],
    ],
  },
  confidentialite: {
    title: tr("Politique de confidentialité"),
    sections: [
      [tr("Données collectées"), tr("Prénom, e-mail ou téléphone, âge, ville, situation ; données de cycle, de grossesse et de santé si tu utilises le suivi.")],
      [tr("Données de santé"), tr("Elles ne sont jamais utilisées pour la publicité, jamais vendues, jamais partagées. Elles sont chiffrées pendant le transfert et hébergées dans l’Union européenne.")],
      [tr("Communication"), tr("Tes coordonnées ne servent à t’envoyer des actualités que si tu l’as accepté. Lien de désinscription dans chaque e-mail, « STOP » pour les SMS.")],
      [tr("Tes droits"), tr("Export et suppression de tes données à tout moment depuis ton profil. Consentements modifiables à tout moment.")],
      [tr("Conservation"), tr("Tant que ton compte est actif ; suppression sous 30 jours après la fermeture du compte, et après 3 ans d’inactivité.")],
      ['Contact', 'contact@nissali.fr'],
    ],
  },
  charte: {
    title: tr("Charte des praticiennes"),
    sections: [
      [tr("Un seul compte"), tr("Ton profil praticienne s’ajoute à ton compte personnel. Tes données personnelles (cycle, notes, prières, jeûnes) ne sont jamais visibles par tes clientes ni côté pro.")],
      [tr("Métiers non médicaux"), tr("L’annuaire réunit des métiers du bien-être et de l’accompagnement. Tu ne poses aucun diagnostic et tu orientes vers une professionnelle de santé quand c’est nécessaire.")],
      [tr("Vérification"), tr("Ta pièce d’identité est vérifiée par l’équipe avant la mise en ligne. Le badge « Diplômée » n’est attribué qu’après vérification de ton diplôme. Les diététiciennes indiquent leur numéro RPPS.")],
      [tr("Hijama"), tr("Matériel stérile à usage unique et information sur les contre-indications obligatoires. La mention « Ne remplace pas un avis médical » figure sur ta fiche.")],
      [tr("Respect et bienveillance"), tr("Échanges courtois, tarifs affichés honnêtement, aucune donnée de santé demandée par message. Tout manquement peut entraîner la suspension du profil.")],
      [tr("Tes données pro"), tr("Tu peux mettre ton profil en pause ou le supprimer à tout moment depuis « Mon espace praticienne » ; ton compte personnel reste intact.")],
    ],
  },
};

export default function Legal() {
  const { doc } = useLocalSearchParams();
  const d = DOCS[doc] || DOCS.cgu;
  return (
    <Screen back title={d.title}>
      <View style={{ gap: 14 }}>
        {d.sections.map(([title, text]) => (
          <Card key={title} style={{ gap: 6 }}>
            <T variant="h3">{title}</T>
            <T>{text}</T>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

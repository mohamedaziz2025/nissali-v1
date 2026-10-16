import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Card, Screen, T } from '../components/ui';

const DOCS = {
  cgu: {
    title: 'Conditions d’utilisation',
    sections: [
      ['Objet', 'Nissali est une application gratuite de suivi féminin (cycle, ovulation, grossesse, prières, jeûnes) destinée aux femmes musulmanes à partir de 15 ans.'],
      ['Compte', 'Un compte vérifié par e-mail ou par téléphone est nécessaire pour sauvegarder et synchroniser tes données entre tes appareils. Tu peux le supprimer à tout moment depuis ton profil.'],
      ['Pas de dispositif médical', 'Nissali n’est pas un moyen de contraception et ne pose aucun diagnostic. Les prédictions sont des estimations. En cas de doute sur ta santé, consulte une professionnelle de santé.'],
      ['Référentiel religieux', 'Les règles présentées sont l’avis retenu par notre comité, avec leurs sources. L’appli informe, elle ne délivre jamais de fatwa. En cas de doute, rapproche-toi d’une personne de science.'],
      ['Praticiennes', 'Les praticiennes de l’annuaire sont des professionnelles indépendantes. Les prestations sont réglées directement auprès d’elles.'],
    ],
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    sections: [
      ['Données collectées', 'Prénom, e-mail ou téléphone, âge, ville, situation ; données de cycle, de grossesse et de santé si tu utilises le suivi.'],
      ['Données de santé', 'Elles ne sont jamais utilisées pour la publicité, jamais vendues, jamais partagées. Elles sont chiffrées pendant le transfert et hébergées dans l’Union européenne.'],
      ['Communication', 'Tes coordonnées ne servent à t’envoyer des actualités que si tu l’as accepté. Lien de désinscription dans chaque e-mail, « STOP » pour les SMS.'],
      ['Tes droits', 'Export et suppression de tes données à tout moment depuis ton profil. Consentements modifiables à tout moment.'],
      ['Conservation', 'Tant que ton compte est actif ; suppression sous 30 jours après la fermeture du compte, et après 3 ans d’inactivité.'],
      ['Contact', 'nissali@gmail.com'],
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

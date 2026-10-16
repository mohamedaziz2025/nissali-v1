// Aiguillage au lancement : compte obligatoire (5.1), profil, consentement santé (RG-04),
// questionnaire d'accueil (RG-05), puis espace personnel ou espace pro.
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Loader } from '../components/ui';
import { useAuth } from '../lib/auth';
import { colors } from '../theme';

export default function Index() {
  const { status, user, practitioner } = useAuth();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ivoire, justifyContent: 'center' }}>
        <Loader label="Nissali" />
      </View>
    );
  }
  if (status === 'anon' || !user) return <Redirect href="/bienvenue" />;
  if (user.lastSpace === 'pro' && practitioner) return <Redirect href="/pro" />;
  if (!user.profileComplete) return <Redirect href="/completer-profil" />;
  if (!user.consents?.health?.accepted) return <Redirect href="/consentement" />;
  if (!user.onboarding?.completed) return <Redirect href="/accueil" />;
  return <Redirect href="/(tabs)" />;
}

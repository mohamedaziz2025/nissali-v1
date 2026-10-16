import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T } from '../components/ui';
import { colors } from '../theme';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.center}>
        <Image source={require('../../assets/logo.png')} style={s.logo} accessibilityIgnoresInvertColors accessibilityLabel="Logo Nissali" />
        <T variant="h1" style={s.brand}>Nissali</T>
        <T variant="h3" style={s.tagline}>Ton cycle, ta foi, ta santé.{'\n'}Au même endroit.</T>
        <T variant="muted" style={{ textAlign: 'center', marginTop: 16, paddingHorizontal: 12 }}>
          Règles, ovulation, grossesse, prières, jeûnes à rattraper et conseils validés. 100 % gratuite.
        </T>
      </View>
      <View style={{ gap: 12 }}>
        <Button title="Créer mon compte" onPress={() => router.push('/inscription')} />
        <Button title="J’ai déjà un compte" variant="outline" onPress={() => router.push('/connexion')} />
        <T variant="small" style={{ textAlign: 'center', marginTop: 6 }}>
          Tes données de santé ne sont jamais vendues ni partagées.
        </T>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.ivoire, paddingHorizontal: 24, justifyContent: 'space-between' },
  center: { alignItems: 'center', marginTop: 20 },
  logo: { width: 120, height: 120 },
  brand: { fontSize: 52, lineHeight: 60, color: colors.bordeaux, marginTop: 8 },
  tagline: { textAlign: 'center', marginTop: 10 },
});

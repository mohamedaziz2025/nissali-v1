import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Fraunces_400Regular, Fraunces_400Regular_Italic, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AdhanBar from '../components/AdhanBar';
import InAppNotifier from '../components/InAppNotifier';
import AnimatedSplash from '../components/AnimatedSplash';
import SpaceTransition from '../components/SpaceTransition';
import { ToastProvider } from '../components/ui';
import { AuthProvider } from '../lib/auth';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const [splash, setSplash] = useState(true);
  const endSplash = useCallback(() => setSplash(false), []);

  // L'écran natif (fond ivoire) laisse la place à l'animation du logo dès que les polices sont prêtes.
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ivoire }, animation: 'slide_from_right' }}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="pro" options={{ animation: 'fade' }} />
            <Stack.Screen name="bienvenue" options={{ animation: 'fade' }} />
          </Stack>
          <AdhanBar />
          <InAppNotifier />
          <SpaceTransition />
          {splash ? <AnimatedSplash onDone={endSplash} /> : null}
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

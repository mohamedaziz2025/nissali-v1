// 4.4 · 3.1 — Bienvenue : Apple, Google, e-mail, « Me connecter ». Avec Apple ou Google, l'inscription saute
// l'écran mot de passe ; si Apple donne une adresse relais, l'appli demande un e-mail de contact (RG-02).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { setPendingSocial, socialAvailability, socialSignIn } from '../lib/social';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
let AppleAuthentication = null;
if (Platform.OS === 'ios') {
  try {
    AppleAuthentication = require('expo-apple-authentication');
  } catch {}
}

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { signIn } = useAuth();
  const [available, setAvailable] = useState({ apple: false, google: false });
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    socialAvailability().then(setAvailable).catch(() => {});
  }, []);

  const continueWith = async (provider) => {
    setBusy(provider);
    try {
      const cred = await socialSignIn(provider);
      if (!cred) return;
      const r = await api.post('/auth/social', { provider, idToken: cred.idToken });
      if (r.needsSignup) {
        setPendingSocial({ provider, idToken: cred.idToken, email: r.email, relay: r.relay, firstName: cred.firstName || r.firstName });
        router.push('/inscription');
        return;
      }
      await signIn(r);
      router.replace('/');
    } catch (e) {
      toast(e.message || tr("Connexion impossible. Réessaie."), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.center}>
        <Image source={require('../../assets/logo.png')} style={s.logo} accessibilityIgnoresInvertColors accessibilityLabel={tr("Logo Nissali")} />
        <T variant="h1" style={s.brand}>nissali</T>
        <T variant="h3" style={s.tagline}>{tr("Ton cycle, ta foi, ta santé.")}{'\n'}{tr("Au même endroit.")}</T>
        <T variant="muted" style={{ textAlign: 'center', marginTop: 16, paddingHorizontal: 12 }}>
          {tr("Prières, dhikr, cycle et jeûnes, pensés pour toi. 100 % gratuite, et tes données de santé ne sont jamais vendues.")}
        </T>
      </View>
      <View style={{ gap: 12 }}>
        {available.apple && AppleAuthentication ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={28}
            style={s.apple}
            onPress={() => !busy && continueWith('apple')}
          />
        ) : null}
        {available.google ? <Button title={tr("Continuer avec Google")} variant="outline" loading={busy === 'google'} disabled={Boolean(busy)} onPress={() => continueWith('google')} /> : null}
        <Button title={tr("Créer mon compte avec mon e-mail")} icon="mail" disabled={Boolean(busy)} onPress={() => { setPendingSocial(null); router.push('/inscription'); }} />
        <Button title={tr("J’ai déjà un compte · Me connecter")} variant="ghost" disabled={Boolean(busy)} onPress={() => router.push('/connexion')} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.ivoire, paddingHorizontal: 24, justifyContent: 'space-between' },
  center: { alignItems: 'center', marginTop: 20 },
  logo: { width: 120, height: 120 },
  brand: { fontFamily: fonts.logo, fontSize: 52, lineHeight: 60, color: colors.bordeaux, marginTop: 8 },
  tagline: { textAlign: 'center', marginTop: 10 },
  apple: { width: '100%', height: 54 },
});

// 4.4 · 3.1 — Bienvenue : Apple, Google, e-mail, « Me connecter ». Avec Apple ou Google, l'inscription saute
// l'écran mot de passe ; si Apple donne une adresse relais, l'appli demande un e-mail de contact (RG-02).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { setPendingSocial, socialAvailability, socialSignIn } from '../lib/social';
import { colors, fonts, radius } from '../theme';

import { tr } from '../lib/i18n';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const ring = useWindowDimensions().width * 0.78;
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
    <View style={[s.wrap, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 18 }]}>
      <StatusBar style="light" />
      {/* Anneau décoratif en haut à droite */}
      <View pointerEvents="none" style={[s.ring, { width: ring, height: ring, borderRadius: ring / 2, borderWidth: ring * 0.19, top: -ring * 0.1, right: -ring * 0.26 }]} />

      <View style={s.head}>
        <Svg width={58} height={61} viewBox="25.75 24.75 48.5 51" accessibilityRole="image" accessibilityLabel={tr("Logo Nissali")}>
          <Path d="M30 71.5V49a20 20 0 0 1 40 0v22.5" stroke={colors.onBordeaux} strokeWidth={8.5} strokeLinecap="round" fill="none" />
          <Path d="M50 52V71.5" stroke={colors.onBordeaux} strokeWidth={8.5} strokeLinecap="round" />
        </Svg>
        <Text style={s.brand}>Nissali</Text>
        <Text style={s.tagline}>{tr("Ton cycle, ta foi, ta santé.")}{'\n'}{tr("Au même endroit.")}</Text>
        <Text style={s.pitch}>
          {tr("Prières, dhikr, cycle et jeûnes, pensés pour toi. 100 % gratuite, et tes données de santé ne sont jamais vendues.")}
        </Text>
      </View>

      <View style={s.actions}>
        {available.apple ? (
          <AuthButton kind="apple" label={tr("Continuer avec Apple")} logo={<AppleLogo />} loading={busy === 'apple'} disabled={Boolean(busy)} onPress={() => continueWith('apple')} />
        ) : null}
        {available.google ? (
          <AuthButton kind="google" label={tr("Continuer avec Google")} logo={<GoogleLogo />} loading={busy === 'google'} disabled={Boolean(busy)} onPress={() => continueWith('google')} />
        ) : null}
        <AuthButton kind="email" label={tr("Créer mon compte avec mon e-mail")} disabled={Boolean(busy)} onPress={() => { setPendingSocial(null); router.push('/inscription'); }} />
        <Pressable accessibilityRole="button" accessibilityLabel={tr("Me connecter")} disabled={Boolean(busy)} onPress={() => router.push('/connexion')} hitSlop={10} style={({ pressed }) => [s.login, pressed && { opacity: 0.6 }]}>
          <Text style={s.loginText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{tr("J’ai déjà un compte · Me connecter")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const KINDS = {
  apple: { bg: colors.white, border: colors.white, fg: colors.prune },
  google: { bg: 'rgba(255,255,255,0.16)', border: 'transparent', fg: colors.white },
  email: { bg: 'transparent', border: 'rgba(255,255,255,0.4)', fg: colors.white },
};

/** Bouton de connexion : logo et texte centrés, texte sur une seule ligne. */
function AuthButton({ kind, label, logo, onPress, loading, disabled }) {
  const k = KINDS[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: k.bg, borderColor: k.border }, disabled && !loading && { opacity: 0.5 }, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
    >
      {loading ? <ActivityIndicator color={k.fg} /> : logo}
      <Text style={[s.btnText, { color: k.fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Text>
    </Pressable>
  );
}

function AppleLogo() {
  return (
    <Svg width={16} height={19} viewBox="0 0 384 470">
      <Path fill="#000000" d="M318.7 236.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 109.2 4 152.8 4 241.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </Svg>
  );
}

/** « G » de Google, posé sur une pastille blanche pour rester lisible sur le bordeaux. */
function GoogleLogo() {
  return (
    <View style={s.gBadge}>
      <Svg width={15} height={15} viewBox="0 0 48 48">
        <Path fill="#FBBC05" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
        <Path fill="#EA4335" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
        <Path fill="#34A853" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <Path fill="#4285F4" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bordeaux, paddingHorizontal: 28, justifyContent: 'space-between', overflow: 'hidden' },
  ring: { position: 'absolute', borderColor: 'rgba(255,255,255,0.08)' },
  head: { alignItems: 'flex-start' },
  brand: { fontFamily: fonts.serif, fontSize: 52, lineHeight: 62, color: colors.white, marginTop: 26, letterSpacing: -0.5, writingDirection: 'ltr' },
  tagline: { fontFamily: fonts.extra, fontSize: 23, lineHeight: 30, color: colors.white, letterSpacing: -0.5, marginTop: 14, textAlign: 'left' },
  pitch: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.onBordeaux, marginTop: 14, maxWidth: 340, textAlign: 'left' },
  actions: { gap: 12, width: '100%', maxWidth: 420, alignSelf: 'center' },
  btn: { height: 56, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 22 },
  btnText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 16.5 },
  gBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  login: { alignSelf: 'center', paddingVertical: 10, marginTop: 2 },
  loginText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white, textAlign: 'center' },
});

// 13 — En-tête des écrans principaux : logo Nissali en haut à gauche, notifications et profil à droite.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../theme';
import AccountButton from './AccountSwitcher';
import Icon from './Icon';

import { tr } from '../lib/i18n';
/** Symbole Nissali : arche de mihrab et ligne centrale. */
export function BrandSymbol({ size = 30, color = colors.bordeaux }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M30 71.5V49a20 20 0 0 1 40 0v22.5" stroke={color} strokeWidth={8.5} strokeLinecap="round" fill="none" />
      <Path d="M50 52V71.5" stroke={color} strokeWidth={8.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Logo : le symbole suivi du nom. */
export function Logo({ size = 30 }) {
  return (
    <View style={s.logo} accessibilityRole="image" accessibilityLabel={'Nissali'}>
      <BrandSymbol size={size * 1.3} />
      <Text style={[s.word, { fontSize: size * 0.82 }]}>nissali</Text>
    </View>
  );
}

export function BrandBar({ unread, right }) {
  return (
    <View style={s.bar}>
      <Logo />
      <View style={s.right}>
        {right}
        <Pressable accessibilityRole="button" accessibilityLabel={tr("Notifications{0}", [(unread ? tr(", {0} non lues", [unread]) : '')])} onPress={() => router.push('/notifications')} hitSlop={6} style={s.round}>
          <Icon name="bell" size={21} color={colors.bordeaux} />
          {unread ? <View style={s.badge} /> : null}
        </Pressable>
        <AccountButton size={42} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 14 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 0, marginLeft: -9, direction: 'ltr' },
  word: { writingDirection: 'ltr', fontFamily: fonts.logo, color: colors.bordeaux, letterSpacing: 0.2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.bordeaux, borderWidth: 2, borderColor: colors.blush },
});

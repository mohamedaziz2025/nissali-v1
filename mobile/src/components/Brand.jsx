// 13 — En-tête des écrans principaux : logo Nissali en haut à gauche, notifications et profil à droite.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts } from '../theme';
import AccountButton from './AccountSwitcher';
import Icon from './Icon';

/** Logo : l'arche Nissali et son point, suivis du nom. */
export function Logo({ size = 30 }) {
  return (
    <View style={s.logo} accessibilityRole="image" accessibilityLabel="Nissali">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M31 78V50a19 19 0 0 1 38 0v28" stroke={colors.bordeaux} strokeWidth={9} strokeLinecap="round" fill="none" />
        <Circle cx="50" cy="51" r="6" fill={colors.bordeaux} />
      </Svg>
      <Text style={[s.word, { fontSize: size * 0.82 }]}>Nissali</Text>
    </View>
  );
}

export function BrandBar({ unread, right }) {
  return (
    <View style={s.bar}>
      <Logo />
      <View style={s.right}>
        {right}
        <Pressable accessibilityRole="button" accessibilityLabel={`Notifications${unread ? `, ${unread} non lues` : ''}`} onPress={() => router.push('/notifications')} hitSlop={6} style={s.round}>
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
  logo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -4 },
  word: { fontFamily: fonts.title, color: colors.bordeaux, letterSpacing: 0.2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.bordeaux, borderWidth: 2, borderColor: colors.blush },
});

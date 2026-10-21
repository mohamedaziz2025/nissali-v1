// Transition plein écran lors de la bascule espace personnel ↔ espace pro.
import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text } from 'react-native';
import { useAuth } from '../lib/auth';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
export default function SpaceTransition() {
  const { transition } = useAuth();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  useEffect(() => {
    if (!transition) return;
    opacity.setValue(0);
    scale.setValue(0.92);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.delay(380),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }),
    ]).start();
  }, [transition, opacity, scale]);
  if (!transition) return null;
  const pro = transition === 'pro';
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.wrap, { backgroundColor: pro ? colors.prune : colors.bordeaux, opacity }]} accessibilityLiveRegion="assertive">
      <Animated.View style={{ alignItems: 'center', gap: 14, transform: [{ scale }] }}>
        <Image source={require('../../assets/android-icon-foreground.png')} style={s.logo} />
        <Text style={s.title}>{pro ? tr("Espace pro") : tr("Espace personnel")}</Text>
        <Text style={s.sub}>{pro ? tr("Rendez-vous, clientes, prestations") : tr("Cycle, prières, jeûnes")}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  logo: { width: 120, height: 120 },
  title: { fontFamily: fonts.title, fontSize: 32, color: colors.white },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.rose },
});

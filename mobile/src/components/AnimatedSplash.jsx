// Écran de démarrage animé : l'arche du symbole se dessine, puis la ligne centrale monte depuis le bas.
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Symbole (viewBox 100) : deux jambages de 22,5 + demi-cercle de rayon 20, ligne centrale de 19,5.
const ARCH = 'M30 71.5V49a20 20 0 0 1 40 0v22.5';
const ARCH_LENGTH = 22.5 * 2 + Math.PI * 20;
const LINE = 'M50 71.5V52';
const LINE_LENGTH = 19.5;
const SIZE = 168;

export default function AnimatedSplash({ onDone }) {
  const draw = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    const finish = () => !cancelled && onDone?.();
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          draw.setValue(1);
          line.setValue(1);
          text.setValue(1);
          Animated.timing(fade, { toValue: 0, duration: 300, delay: 500, useNativeDriver: true }).start(finish);
          return;
        }
        Animated.sequence([
          // 1. L'arche se dessine
          Animated.timing(draw, { toValue: 1, duration: 1000, easing: Easing.bezier(0.65, 0, 0.35, 1), useNativeDriver: false }),
          // 2. La ligne centrale monte depuis le bas ; 3. le nom apparaît pendant ce temps
          Animated.parallel([
            Animated.timing(line, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
            Animated.sequence([Animated.delay(220), Animated.timing(text, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true })]),
          ]),
          Animated.delay(380),
          // 4. L'écran s'efface sur l'appli
          Animated.timing(fade, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]).start(finish);
      });
    return () => {
      cancelled = true;
    };
  }, [draw, line, text, fade, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.wrap, { opacity: fade }]} accessibilityLabel={tr("Nissali")} accessible>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
          <AnimatedPath
            d={ARCH}
            fill="none"
            stroke={colors.bordeaux}
            strokeWidth={8.5}
            strokeLinecap="round"
            strokeDasharray={`${ARCH_LENGTH} ${ARCH_LENGTH}`}
            strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [ARCH_LENGTH, 0] })}
          />
          <AnimatedPath
            d={LINE}
            stroke={colors.bordeaux}
            strokeWidth={8.5}
            strokeLinecap="round"
            strokeOpacity={line.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 1, 1] })}
            strokeDasharray={`${LINE_LENGTH} ${LINE_LENGTH}`}
            strokeDashoffset={line.interpolate({ inputRange: [0, 1], outputRange: [LINE_LENGTH, 0] })}
          />
        </Svg>
      </View>
      <Animated.Text style={[s.brand, { opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>{tr("nissali")}</Animated.Text>
      <Animated.Text style={[s.tagline, { opacity: text }]}>{tr("Ton cycle, ta foi, ta santé.")}</Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: colors.ivoire, alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  brand: { fontFamily: fonts.logo, fontSize: 40, color: colors.bordeaux, marginTop: 6 },
  tagline: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, marginTop: 4 },
});

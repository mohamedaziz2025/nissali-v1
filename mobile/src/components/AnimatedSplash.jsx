// Écran de démarrage animé : l'arche du monogramme se dessine, puis le point se pose à l'intérieur.
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Monogramme (viewBox 1024) : deux jambages de 260 + demi-cercle de rayon 220.
const ARCH = 'M292 772 V512 a220 220 0 0 1 440 0 V772';
const ARCH_LENGTH = 260 * 2 + Math.PI * 220;
const SIZE = 168;

export default function AnimatedSplash({ onDone }) {
  const draw = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(0)).current;
  const dotSize = useRef(new Animated.Value(0)).current;
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
          drop.setValue(1);
          dotSize.setValue(1);
          text.setValue(1);
          Animated.timing(fade, { toValue: 0, duration: 300, delay: 500, useNativeDriver: true }).start(finish);
          return;
        }
        Animated.sequence([
          // 1. L'arche se dessine
          Animated.timing(draw, { toValue: 1, duration: 1000, easing: Easing.bezier(0.65, 0, 0.35, 1), useNativeDriver: false }),
          // 2. Le point tombe dans l'arche et rebondit légèrement ; 3. le nom apparaît pendant ce temps
          Animated.parallel([
            Animated.timing(dotSize, { toValue: 1, duration: 160, useNativeDriver: false }),
            Animated.spring(drop, { toValue: 1, friction: 4.5, tension: 70, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.05, useNativeDriver: false }),
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
  }, [draw, drop, dotSize, text, fade, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.wrap, { opacity: fade }]} accessibilityLabel="Nissali" accessible>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 1024 1024">
          <AnimatedPath
            d={ARCH}
            fill="none"
            stroke={colors.bordeaux}
            strokeWidth={96}
            strokeLinecap="round"
            strokeDasharray={`${ARCH_LENGTH} ${ARCH_LENGTH}`}
            strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [ARCH_LENGTH, 0] })}
          />
          <AnimatedCircle
            cx={512}
            cy={drop.interpolate({ inputRange: [0, 1], outputRange: [180, 520] })}
            r={dotSize.interpolate({ inputRange: [0, 1], outputRange: [0, 64] })}
            fill={colors.bordeaux}
          />
        </Svg>
      </View>
      <Animated.Text style={[s.brand, { opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>Nissali</Animated.Text>
      <Animated.Text style={[s.tagline, { opacity: text }]}>Ton cycle, ta foi, ta santé.</Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: colors.ivoire, alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  brand: { fontFamily: fonts.title, fontSize: 40, color: colors.bordeaux, marginTop: 6 },
  tagline: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, marginTop: 4 },
});

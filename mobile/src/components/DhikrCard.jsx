// Mise à jour Accueil (page 7) — carte Dhikr simplifiée : titre + série, le rond avec le total du jour (anneau
// selon l'objectif quotidien global, défaut 250 ; plein = or), « Continue ton dhikr », liste courte des dhikr
// et un bouton « Choisir ». Le rond et « Choisir » ouvrent l'écran Dhikr animé (compteur).
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { plural, useDhikrData } from '../lib/dhikr';
import { colors, fonts, tnum } from '../theme';
import Icon from './Icon';

import { tr } from '../lib/i18n';
const SIZE = 92;
const STROKE = 8;

function CounterRing({ progress, reached, children }) {
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke="#F3E4E7" strokeWidth={STROKE} fill="none" />
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={reached ? colors.or : colors.bordeaux} strokeWidth={STROKE} fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))} strokeLinecap="round" transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

export default function DhikrCard({ afterPrayer = false }) {
  const { data, counts } = useDhikrData();
  if (!data) return null;

  const total = Object.values(counts || {}).reduce((n, c) => n + c, 0);
  const goal = data.dailyGoal || 250;
  const reached = total >= goal;
  const names = (data.list || []).map((d) => d.name).join(', ');

  const open = () => router.push(afterPrayer ? '/dhikr/animation?mode=apres' : '/dhikr/animation');

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>
          {tr("Dhikr")} <Text style={s.titleToday}>{tr("Aujourd’hui")}</Text>
        </Text>
        {data.streak ? (
          <View style={s.streak}>
            <Icon name="sparkle" size={12} color={colors.orText} />
            <Text style={s.streakText}>{plural(data.streak, 'jour')} {tr("d’affilée")}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.body}>
        <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={tr("{0} dhikr aujourd’hui. Ouvrir le compteur", [total])} style={({ pressed }) => pressed && { transform: [{ scale: 0.97 }] }}>
          <CounterRing progress={total / goal} reached={reached}>
            <View style={s.disc}>
              <Text style={[s.count, tnum]} adjustsFontSizeToFit numberOfLines={1}>{total}</Text>
            </View>
          </CounterRing>
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.continue}>{tr("Continue ton dhikr")}</Text>
          {names ? <Text style={s.names} numberOfLines={2}>{names}</Text> : null}
          <Pressable onPress={open} accessibilityRole="button" style={({ pressed }) => [s.choose, pressed && { opacity: 0.85 }]}>
            <Text style={s.chooseText}>{tr("Choisir")}</Text>
            <Icon name="chevronRight" size={14} color={colors.bordeaux} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.extra, fontSize: 19, letterSpacing: -0.4, color: colors.prune },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.sable, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  streakText: { fontFamily: fonts.bold, fontSize: 12, color: colors.orText },
  body: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  disc: { width: SIZE - 22, height: SIZE - 22, borderRadius: (SIZE - 22) / 2, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: fonts.extra, fontSize: 26, color: colors.white, letterSpacing: -0.5 },
  titleToday: { fontFamily: fonts.semi, fontSize: 15, letterSpacing: 0, color: colors.muted },
  continue: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
  names: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  choose: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginTop: 4, backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chooseText: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux },
});

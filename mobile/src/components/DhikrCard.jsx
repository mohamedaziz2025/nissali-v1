// 4.1 / RG-42 — Carte Dhikr de l'accueil : puces des dhikr du jour, gros bouton rond qui compte +1 sans quitter
// l'accueil (vibration légère), anneau doré à l'objectif puis passage au premier dhikr non terminé.
// Mêmes compteurs que la page Dhikr (RG-38 à RG-40), comptage hors connexion.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../lib/auth';
import { plural, saveCount, useDhikrData } from '../lib/dhikr';
import { colors, fonts, tnum } from '../theme';
import Icon from './Icon';

const SIZE = 136;
const STROKE = 9;

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

export default function DhikrCard() {
  const { user } = useAuth();
  const { data, counts } = useDhikrData();
  const [local, setLocal] = useState({});
  const [active, setActive] = useState(null);
  const chips = useRef(null);
  const offsets = useRef({});
  useEffect(() => setLocal({}), [data]);

  const list = useMemo(() => data?.list || [], [data]);
  const all = { ...counts, ...local };
  const firstOpen = list.find((d) => (all[d.key] || 0) < d.goal) || list[0];
  const current = list.find((d) => d.key === active) || firstOpen;

  // La puce active est centrée à l'ouverture.
  useEffect(() => {
    if (!current || !chips.current) return;
    const x = offsets.current[current.key];
    if (x != null) chips.current.scrollTo({ x: Math.max(0, x - 90), animated: true });
  }, [current?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !current) return null;
  const haptics = user?.dhikr?.haptics !== false && Platform.OS !== 'web';
  const count = all[current.key] || 0;
  const reached = count >= current.goal;
  const total = Object.values(all).reduce((n, c) => n + c, 0);
  const done = list.filter((d) => (all[d.key] || 0) >= d.goal).length;

  const tap = () => {
    const n = count + 1;
    setLocal((l) => ({ ...l, [current.key]: n }));
    saveCount(data.day, current.key, n).catch(() => {});
    if (n === current.goal) {
      if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // L'anneau devient doré, puis la carte passe au premier dhikr pas encore terminé.
      const next = list.find((d) => d.key !== current.key && ((d.key === current.key ? n : all[d.key]) || 0) < d.goal);
      if (next) setTimeout(() => setActive(next.key), 700);
    } else if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>Dhikr</Text>
        {data.streak ? (
          <View style={s.streak}>
            <Icon name="sparkle" size={12} color={colors.orText} />
            <Text style={s.streakText}>{plural(data.streak, 'jour')} d’affilée</Text>
          </View>
        ) : null}
      </View>
      <ScrollView ref={chips} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ marginHorizontal: -16 }}>
        {list.map((d) => {
          const c = all[d.key] || 0;
          const ok = c >= d.goal;
          const on = d.key === current.key;
          return (
            <Pressable
              key={d.key}
              onLayout={(e) => (offsets.current[d.key] = e.nativeEvent.layout.x)}
              onPress={() => setActive(d.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${d.name}, ${c} sur ${d.goal}${ok ? ', objectif atteint' : ''}`}
              style={[s.chip, ok && s.chipDone, on && !ok && s.chipOn, on && ok && { borderColor: colors.or }]}
            >
              {ok ? <Icon name="check" size={13} color={colors.orText} strokeWidth={2.6} /> : null}
              <Text style={[s.chipText, ok && { color: colors.orText }, on && !ok && { color: colors.white }]} numberOfLines={1}>{d.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={s.body}>
        <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={`Compter ${current.name} : ${count} sur ${current.goal}`} style={({ pressed }) => pressed && { transform: [{ scale: 0.97 }] }}>
          <CounterRing progress={count / current.goal} reached={reached}>
            <View style={s.disc}>
              <Text style={[s.count, tnum]} adjustsFontSizeToFit numberOfLines={1}>{count}</Text>
              <Text style={s.of}>/{current.goal}</Text>
            </View>
          </CounterRing>
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.arabic} numberOfLines={2}>{current.arabic}</Text>
          <Text style={s.name} numberOfLines={2}>{current.name}</Text>
          <Text style={s.meaning} numberOfLines={3}>{current.meaning}</Text>
        </View>
      </View>
      <Pressable onPress={() => router.push('/dhikr')} accessibilityRole="link" style={s.foot}>
        <Text style={s.footText}>
          <Text style={[s.footStrong, tnum]}>{total}</Text> dhikr aujourd’hui · {done} / {list.length} objectifs
        </Text>
        <Icon name="chevronRight" size={15} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.extra, fontSize: 19, letterSpacing: -0.4, color: colors.prune },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.sable, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  streakText: { fontFamily: fonts.bold, fontSize: 12, color: colors.orText },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.lineField, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  chipDone: { backgroundColor: colors.sable, borderColor: colors.sable },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.prune },
  body: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  disc: { width: SIZE - 30, height: SIZE - 30, borderRadius: (SIZE - 30) / 2, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center', shadowColor: '#7A1E35', shadowOpacity: 0.28, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  count: { fontFamily: fonts.extra, fontSize: 38, color: colors.white, letterSpacing: -1 },
  of: { fontFamily: fonts.semi, fontSize: 12, color: colors.onBordeaux },
  arabic: { fontFamily: fonts.arabic, fontSize: 24, lineHeight: 38, color: colors.bordeaux, writingDirection: 'rtl', textAlign: 'left' },
  name: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
  meaning: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  footText: { fontFamily: fonts.semi, fontSize: 13, color: colors.prune },
  footStrong: { fontFamily: fonts.extra, color: colors.bordeaux },
});

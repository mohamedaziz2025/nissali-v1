// 4.6 · 5.2 bis — Tasbih libre : aucun objectif, aucune limite, un grand bouton rond qui compte. Puces en haut pour
// choisir la formule (sa liste, dhikr personnels compris) ; chaque formule garde son compte pendant la session.
// Chaque toucher s'ajoute au total du jour et au dhikr correspondant (objectifs et série). Hors connexion OK (RG-40).
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { ErrorState, Loader } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { flushDhikr, saveCount, useDhikrData } from '../../lib/dhikr';
import { colors, fonts, tnum } from '../../theme';

export default function FreeTasbih() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  const { data, error, loading, counts } = useDhikrData();
  const [key, setKey] = useState(null);
  const [session, setSession] = useState({}); // compte de la session, par formule
  const [local, setLocal] = useState({}); // totaux du jour modifiés ici

  if (loading && !data) return <View style={[s.screen, { paddingTop: insets.top }]}><Loader /></View>;
  if (error && !data) return <View style={[s.screen, { paddingTop: insets.top }]}><ErrorState error={error} /></View>;

  const list = data.list;
  const current = list.find((d) => d.key === key) || list[0];
  const all = { ...counts, ...local };
  const haptics = (user?.dhikr || data.settings || {}).haptics !== false && Platform.OS !== 'web';
  const n = session[current.key] || 0;
  const sessionTotal = Object.values(session).reduce((a, b) => a + b, 0);
  const dayTotal = Object.values(all).reduce((a, b) => a + b, 0);
  const size = Math.min(width - 80, height * 0.38, 300);

  const tap = () => {
    const day = (all[current.key] || 0) + 1;
    setSession((x) => ({ ...x, [current.key]: (x[current.key] || 0) + 1 }));
    setLocal((l) => ({ ...l, [current.key]: day }));
    saveCount(data.day, current.key, day).catch(() => {});
    if (haptics) {
      if (day === current.goal) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };
  const finish = () => {
    flushDhikr().catch(() => {});
    router.replace('/dhikr');
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 14 }]}>
      <View style={s.top}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/dhikr'))} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={12}>
          <Icon name="chevronLeft" size={26} />
        </Pressable>
        <Text style={s.topTitle}>Tasbih libre</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ flexGrow: 0, marginHorizontal: -20 }}>
        {list.map((d) => {
          const on = d.key === current.key;
          return (
            <Pressable key={d.key} onPress={() => setKey(d.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[s.chip, on && s.chipOn]}>
              <Text style={[s.chipText, on && { color: colors.white }]} numberOfLines={1}>{d.name}</Text>
              {session[d.key] ? <Text style={[s.chipCount, on && { color: colors.onBordeaux }]}>{session[d.key]}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={`${current.name} : ${n}. Touche pour compter`} style={s.zone}>
        {current.arabic ? <Text style={s.arabic}>{current.arabic}</Text> : null}
        <Text style={s.name}>{current.name}</Text>
        <View style={[s.button, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[s.count, tnum]} adjustsFontSizeToFit numberOfLines={1}>{n}</Text>
          <Text style={s.touch}>TOUCHE POUR COMPTER</Text>
        </View>
        <Text style={s.hint}>Sans objectif · touche n’importe où sur l’écran</Text>
      </Pressable>

      <View style={s.foot}>
        <View style={{ flex: 1 }}>
          <Text style={s.footSmall}>Cette session : <Text style={[s.footStrong, tnum]}>{sessionTotal}</Text></Text>
          <Text style={s.footSmall}>Aujourd’hui : <Text style={[s.footStrong, tnum]}>{dayTotal}</Text> dhikr</Text>
        </View>
        <Pressable onPress={finish} accessibilityRole="button" style={s.finish}>
          <Text style={s.finishText}>Terminer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivoire, paddingHorizontal: 20 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  topTitle: { fontFamily: fonts.extra, fontSize: 17, color: colors.prune },
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.lineField, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  chipText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.prune, maxWidth: 180 },
  chipCount: { fontFamily: fonts.extra, fontSize: 12, color: colors.orText },
  zone: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  arabic: { fontSize: 34, lineHeight: 56, color: colors.bordeaux, textAlign: 'center', writingDirection: 'rtl', fontFamily: fonts.arabic },
  name: { fontFamily: fonts.extra, fontSize: 20, color: colors.prune, textAlign: 'center', marginBottom: 14 },
  button: { backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, shadowColor: '#7A1E35', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  count: { fontFamily: fonts.extra, fontSize: 84, lineHeight: 94, letterSpacing: -2, color: colors.white },
  touch: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, color: colors.onBordeaux, marginTop: 4 },
  hint: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 16 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.line },
  footSmall: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  footStrong: { fontFamily: fonts.extra, color: colors.prune },
  finish: { minHeight: 46, paddingHorizontal: 22, borderRadius: 999, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  finishText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});

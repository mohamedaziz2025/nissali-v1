// Mise à jour Accueil (page 7) — Écran Dhikr animé, ouvert depuis le rond ou « Choisir » de la carte Dhikr
// de l'accueil. Deux modes : Après la prière (33/33/33/1 automatique) et Temps libre (formules par défaut +
// mes phrases). Grand rond (260 px) : +1 à chaque toucher, animations, objectif, vibration.
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import Icon from '../../components/Icon';
import { Button, Chip, ErrorState, Field, Label, Loader, Row, Sheet, T } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { saveCount, useDhikrData } from '../../lib/dhikr';
import { colors, fonts, tnum } from '../../theme';

import { tr } from '../../lib/i18n';
const TASBIH_LABELS = { 1: tr("Étape 1 sur 4"), 2: tr("Étape 2 sur 4"), 3: tr("Étape 3 sur 4"), 4: tr("Étape 4 sur 4") };
const GOAL_PRESETS = [33, 99, 100, 1000];

function BigRing({ progress, size, reached, children, scale, pulse }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
      {pulse ? <Animated.View style={[StyleSheet.absoluteFill, s.halo, { opacity: pulse, borderRadius: size / 2 }]} /> : null}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#F3E3E6" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={reached ? colors.or : colors.bordeaux} strokeWidth={stroke} fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </Animated.View>
  );
}

export default function DhikrAnimation() {
  useKeepAwake();
  const { mode: modeParam } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, setSession } = useAuth();
  const { data, error, loading, counts, reload } = useDhikrData();
  const [mode, setMode] = useState(modeParam === 'apres' ? 'apres' : 'libre');
  const [step, setStep] = useState(0); // étape du tasbih « Après la prière »
  const [activeKey, setActiveKey] = useState(null); // dhikr sélectionné en « Temps libre »
  const [local, setLocal] = useState({});
  const [goalOverride, setGoalOverride] = useState({}); // « Sans objectif » : préférence locale, non envoyée au serveur
  const [goalSheet, setGoalSheet] = useState(false);
  const [addSheet, setAddSheet] = useState(false);
  const [create, setCreate] = useState({ name: '', arabic: '', meaning: '', goal: 33 });
  const [busy, setBusy] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;
  const plusOne = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const phraseShift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const all = { ...counts, ...local };
  const list = data?.list || [];
  const steps = data?.tasbih || [];
  const haptics = (user?.dhikr || data?.settings || {}).haptics !== false && Platform.OS !== 'web';

  const current = mode === 'apres' ? steps[step] : list.find((d) => d.key === activeKey) || list[0];
  const curKey = current?.key;
  const count = curKey ? all[curKey] || 0 : 0;
  const goal = curKey && goalOverride[curKey] ? goalOverride[curKey] : current?.goal;
  const endless = goal === Infinity;
  const target = endless ? 0 : goal || 33;
  const reached = !endless && count >= target;
  const total = Object.values(all).reduce((n, c) => n + c, 0);

  if (loading && !data) return <View style={[s.screen, { paddingTop: insets.top }]}><Loader /></View>;
  if (error && !data) return <View style={[s.screen, { paddingTop: insets.top }]}><ErrorState error={error} /></View>;

  const setCountFor = (k, n) => {
    setLocal((l) => ({ ...l, [k]: n }));
    saveCount(data.day, k, n).catch(() => {});
  };

  const bounce = () => {
    if (reduceMotion) return;
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
    ripple.setValue(0);
    Animated.timing(ripple, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    plusOne.setValue(0);
    Animated.timing(plusOne, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const celebrate = () => {
    if (reduceMotion) return;
    halo.setValue(0);
    Animated.sequence([
      Animated.timing(halo, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(halo, { toValue: 0.5, duration: 900, useNativeDriver: true }),
    ]).start();
  };

  const tap = () => {
    const n = count + 1;
    setCountFor(curKey, n);
    bounce();
    if (!endless && n >= target) {
      if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      celebrate();
      if (mode === 'apres' && step < steps.length - 1) {
        setTimeout(() => setStep((s2) => s2 + 1), 600);
      }
    } else if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const finished = mode === 'apres' && step === steps.length - 1 && reached;

  const recommencer = () => setCountFor(curKey, 0);
  const toggleHaptics = async () => {
    try {
      const r = await api.patch('/dhikr/settings', { haptics: !haptics });
      await setSession({ user: r.user });
    } catch {
      // ignoré : préférence visuelle seulement
    }
  };
  const saveGoal = async (g) => {
    setGoalSheet(false);
    if (g === Infinity) {
      setGoalOverride((o) => ({ ...o, [curKey]: Infinity }));
      return;
    }
    setGoalOverride((o) => { const n = { ...o }; delete n[curKey]; return n; });
    if (!current?.personal) {
      await api.put('/dhikr/list', { list: list.map((d) => (d.key === curKey ? { key: d.key, goal: g } : { key: d.key, goal: d.goal })) }).catch(() => {});
    } else {
      await api.patch(`/dhikr/custom/${curKey}`, { goal: g }).catch(() => {});
    }
    reload();
  };
  const createPhrase = async () => {
    setBusy(true);
    const endlessGoal = create.goal === Infinity;
    try {
      const r = await api.post('/dhikr/custom', { name: create.name.trim(), arabic: create.arabic.trim() || null, goal: endlessGoal ? 1000 : create.goal });
      if (endlessGoal) setGoalOverride((o) => ({ ...o, [r.key]: Infinity }));
      setCreate({ name: '', arabic: '', meaning: '', goal: 33 });
      setAddSheet(false);
      await reload();
      setActiveKey(r.key);
    } finally {
      setBusy(false);
    }
  };

  const selectPastille = (key) => {
    if (key === current?.key) return;
    if (!reduceMotion) {
      phraseShift.setValue(8);
      Animated.timing(phraseShift, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    setActiveKey(key);
  };

  const ringSize = Math.min(width - 70, 260);
  const plusOneStyle = {
    opacity: plusOne.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
    transform: [{ translateY: plusOne.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }],
  };
  const rippleStyle = { opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] }), transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] };

  return (
    <View style={[s.screen, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 16 }]}>
      <Row justify="space-between" style={s.top}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel={tr("Retour")} hitSlop={12}>
          <Icon name="chevronLeft" size={26} color={colors.prune} />
        </Pressable>
        <Text style={s.topTitle}>{tr("Dhikr")}</Text>
        <View style={s.totalBadge}>
          <Text style={[s.totalBadgeText, tnum]}>{total} {tr("aujourd’hui")}</Text>
        </View>
      </Row>

      <View style={s.tabs}>
        <Pressable onPress={() => setMode('apres')} accessibilityRole="tab" accessibilityState={{ selected: mode === 'apres' }} style={[s.tab, mode === 'apres' && s.tabOn]}>
          <Text style={[s.tabText, mode === 'apres' && s.tabTextOn]}>{tr("Après la prière")}</Text>
        </Pressable>
        <Pressable onPress={() => setMode('libre')} accessibilityRole="tab" accessibilityState={{ selected: mode === 'libre' }} style={[s.tab, mode === 'libre' && s.tabOn]}>
          <Text style={[s.tabText, mode === 'libre' && s.tabTextOn]}>{tr("Temps libre")}</Text>
        </Pressable>
      </View>

      {mode === 'apres' ? (
        <View style={s.steps}>
          {steps.map((st, i) => (
            <View key={st.key} style={[s.stepBar, i < step && s.stepDone, i === step && s.stepOn]} />
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pastilles} style={{ marginHorizontal: -20 }}>
          {list.map((d) => {
            const c = all[d.key] || 0;
            const ok = c >= d.goal;
            const on = d.key === (current?.key);
            return (
              <Pressable key={d.key} onPress={() => selectPastille(d.key)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.pastille, on && s.pastilleOn, ok && !on && s.pastilleDone]}>
                {ok ? <Icon name="check" size={13} color={on ? colors.white : colors.orText} strokeWidth={2.6} /> : null}
                <Text style={[s.pastilleText, on && { color: colors.white }, ok && !on && { color: colors.orText }]} numberOfLines={1}>{d.name} {ok ? '' : `${c}/${d.goal}`}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setAddSheet(true)} accessibilityRole="button" accessibilityLabel={tr("Ma phrase")} style={s.pastilleAdd}>
            <Icon name="plus" size={14} color={colors.bordeaux} />
            <Text style={s.pastilleAddText}>{tr("Ma phrase")}</Text>
          </Pressable>
        </ScrollView>
      )}

      {current ? (
        <Animated.View style={[s.tapZone, { transform: [{ translateY: phraseShift }], opacity: phraseShift.interpolate({ inputRange: [0, 8], outputRange: [1, 0.4] }) }]}>
          {finished ? (
            <View style={s.doneWrap}>
              <Icon name="check" size={40} color={colors.or} />
              <Text style={s.doneTitle}>{tr("Tasbih terminé, qu’Allah l’accepte")}</Text>
            </View>
          ) : (
            <>
              <Text style={s.arabic}>{current.arabic}</Text>
              <Text style={s.name}>{current.name}</Text>
              {current.meaning ? <Text style={s.meaning}>{current.meaning}</Text> : null}
            </>
          )}
          <Pressable onPress={tap} disabled={finished} accessibilityRole="button" accessibilityLabel={tr("{0} : {1} sur {2}. Touche pour compter", [current.name, count, endless ? 'libre' : target])} style={{ marginTop: 18 }}>
            <View>
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.ripple, { borderRadius: ringSize / 2 }, rippleStyle]} />
              <BigRing progress={endless ? 0 : count / target} reached={reached} size={ringSize} scale={scale} pulse={halo}>
                <View style={[s.disc, { width: ringSize - 56, height: ringSize - 56, borderRadius: (ringSize - 56) / 2 }]}>
                  <Text style={s.count} adjustsFontSizeToFit numberOfLines={1}>{count}</Text>
                  {endless ? <Text style={s.of}>{tr("sans objectif")}</Text> : <Text style={s.of}>/ {target}</Text>}
                </View>
              </BigRing>
              <Animated.Text pointerEvents="none" style={[s.plusOne, plusOneStyle]}>+1</Animated.Text>
            </View>
          </Pressable>
          <Text style={s.hint}>{mode === 'apres' ? (TASBIH_LABELS[step + 1] + ' · on passe tout seul à la suivante') : tr("Touche le rond pour compter")}</Text>
        </Animated.View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <T variant="muted">{tr("Ajoute un dhikr pour commencer.")}</T>
        </View>
      )}

      <Row gap={10} style={{ marginTop: 10 }}>
        <Pressable onPress={recommencer} accessibilityRole="button" style={s.footBtn}>
          <Icon name="reset" size={17} color={colors.bordeaux} />
          <Text style={s.footBtnText}>{tr("Recommencer")}</Text>
        </Pressable>
        {mode === 'libre' ? (
          <Pressable onPress={() => setGoalSheet(true)} accessibilityRole="button" style={s.footBtn}>
            <Icon name="sliders" size={17} color={colors.bordeaux} />
            <Text style={s.footBtnText}>{tr("Objectif")}</Text>
          </Pressable>
        ) : null}
        {Platform.OS !== 'web' ? (
          <Pressable onPress={toggleHaptics} accessibilityRole="switch" accessibilityState={{ checked: haptics }} accessibilityLabel={tr("Vibration")} style={[s.footIcon, haptics && s.footIconOn]}>
            <Icon name="vibrate" size={18} color={haptics ? colors.white : colors.bordeaux} />
          </Pressable>
        ) : null}
      </Row>

      <Sheet visible={goalSheet} onClose={() => setGoalSheet(false)} title={tr("Objectif pour {0}", [current?.name || ''])}>
        <T variant="small">{tr("Remis à zéro chaque jour.")}</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {GOAL_PRESETS.map((g) => (
            <Chip key={g} label={String(g)} selected={target === g} onPress={() => saveGoal(g)} />
          ))}
          <Chip label={tr("Sans objectif")} selected={endless} onPress={() => saveGoal(Infinity)} />
        </Row>
      </Sheet>

      <Sheet
        visible={addSheet}
        onClose={() => setAddSheet(false)}
        title={tr("Ajouter ma phrase")}
        footer={<Button title={tr("Ajouter et commencer")} loading={busy} disabled={busy || create.name.trim().length < 2} onPress={createPhrase} />}
      >
        <T variant="muted">{tr("Une invocation, un verset, une phrase qui te fait du bien.")}</T>
        <Field label={tr("Ma phrase")} value={create.name} onChangeText={(v) => setCreate((c2) => ({ ...c2, name: v.slice(0, 80) }))} />
        <Field label={tr("En arabe (facultatif)")} value={create.arabic} onChangeText={(v) => setCreate((c2) => ({ ...c2, arabic: v }))} />
        <Label>{tr("Objectif")}</Label>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {GOAL_PRESETS.map((g) => (
            <Chip key={g} label={String(g)} selected={create.goal === g} onPress={() => setCreate((c2) => ({ ...c2, goal: g }))} />
          ))}
          <Chip label={tr("Sans objectif")} selected={create.goal === Infinity} onPress={() => setCreate((c2) => ({ ...c2, goal: Infinity }))} />
        </Row>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivoire, paddingHorizontal: 20 },
  top: { minHeight: 44 },
  topTitle: { fontFamily: fonts.extra, fontSize: 19, color: colors.prune },
  totalBadge: { backgroundColor: colors.sable, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  totalBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.orText },
  tabs: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 999, padding: 4, marginTop: 14, borderWidth: 1, borderColor: colors.line },
  tab: { flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.bordeaux },
  tabText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted },
  tabTextOn: { color: colors.white },
  steps: { flexDirection: 'row', gap: 6, marginTop: 14 },
  stepBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.line },
  stepDone: { backgroundColor: colors.or },
  stepOn: { backgroundColor: colors.bordeaux },
  pastilles: { gap: 8, paddingHorizontal: 20, marginTop: 14 },
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.lineField, backgroundColor: colors.white },
  pastilleOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  pastilleDone: { backgroundColor: colors.sable, borderColor: colors.sable },
  pastilleText: { fontFamily: fonts.bold, fontSize: 13, color: colors.prune },
  pastilleAdd: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.bordeaux },
  pastilleAddText: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux },
  tapZone: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  arabic: { fontSize: 36, lineHeight: 56, color: colors.bordeaux, textAlign: 'center', writingDirection: 'rtl', fontFamily: fonts.arabic },
  name: { fontFamily: fonts.title, fontSize: 22, color: colors.prune, textAlign: 'center' },
  meaning: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', paddingHorizontal: 10 },
  doneWrap: { alignItems: 'center', gap: 10, marginBottom: 10 },
  doneTitle: { fontFamily: fonts.extra, fontSize: 20, color: colors.prune, textAlign: 'center', paddingHorizontal: 20 },
  disc: { backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  count: { fontFamily: fonts.title, fontSize: 60, lineHeight: 68, color: colors.white },
  of: { fontFamily: fonts.medium, fontSize: 14, color: colors.rose, marginTop: 4 },
  ripple: { backgroundColor: colors.bordeaux },
  halo: { backgroundColor: colors.or },
  plusOne: { position: 'absolute', alignSelf: 'center', top: '42%', fontFamily: fonts.extra, fontSize: 24, color: colors.or },
  hint: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 14, textAlign: 'center' },
  footBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  footBtnText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  footIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  footIconOn: { backgroundColor: colors.prune, borderColor: colors.prune },
});

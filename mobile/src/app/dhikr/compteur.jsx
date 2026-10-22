// 5.7 bis · 4 et 5 — Compteur : texte arabe en grand, phonétique et sens ; on touche n'importe où pour
// compter (petite vibration désactivable), l'anneau avance jusqu'à l'objectif ; l'écran reste allumé.
// Tasbih après la prière : barre d'étapes et passage automatique au dhikr suivant.
// Objectif : 33 / 99 / 100 / Libre (Libre = pas de fin, pas d'anneau, juste le nombre). L'anneau devient doré.
// 4.6 · 5.3 — Objectif atteint (plein écran bordeaux) : vibration longue, rang de l'objectif dans la journée, série,
// puis continuer sur le prochain dhikr non terminé, encore 33, ou terminer (retour à la page Dhikr).
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Icon from '../../components/Icon';
import { ErrorState, Loader, Row, T, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { isReached, plural, saveCount, useDhikrData } from '../../lib/dhikr';
import { colors, fonts } from '../../theme';

import { tr } from '../../lib/i18n';
const GOALS = [33, 99, 100];

function BigRing({ progress, size, reached, children }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.bordeaux} />
            <Stop offset="1" stopColor="#5A1426" />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#F3E3E6" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={reached ? colors.or : 'url(#ring)'} strokeWidth={stroke} fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

export default function Counter() {
  useKeepAwake();
  const { key: keyParam, mode } = useLocalSearchParams();
  const tasbihMode = mode === 'tasbih';
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, setSession } = useAuth();
  const { data, error, loading, counts } = useDhikrData();
  const [step, setStep] = useState(0);
  const [key, setKey] = useState(keyParam);
  const [local, setLocal] = useState({}); // totaux du jour modifiés ici
  const [base, setBase] = useState(null); // total au début du tour en cours
  const [goal, setGoal] = useState(null);
  const [done, setDone] = useState(null); // écran « Objectif atteint »
  const streakBase = useRef(null);

  const haptics = (user?.dhikr || data?.settings || {}).haptics !== false && Platform.OS !== 'web';
  const steps = data?.tasbih || [];
  const current = tasbihMode ? steps[step] : data?.list.find((d) => d.key === key) || data?.catalog.find((d) => d.key === key);
  const curKey = current?.key;
  const all = { ...counts, ...local };
  const count = curKey ? all[curKey] || 0 : 0;

  // Début d'un tour : en mode liste, l'anneau montre le total du jour ; en tasbih, chaque étape repart de 0.
  useEffect(() => {
    if (!current || !data) return;
    setGoal((g) => (tasbihMode ? current.goal : g ?? current.goal));
    // Objectif déjà atteint aujourd'hui : un nouveau tour commence (l'anneau repart de 0).
    const already = counts[current.key] || 0;
    setBase((b) => (b !== null ? b : tasbihMode || isReached(already, current.goal) ? already : 0));
    if (streakBase.current === null) streakBase.current = { streak: data.streak, reachedToday: data.list.some((d) => isReached(counts[d.key] || 0, d.goal)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curKey, data]);

  if (loading && !data) return <View style={[s.screen, { paddingTop: insets.top }]}><Loader /></View>;
  if (error && !data) return <View style={[s.screen, { paddingTop: insets.top }]}><ErrorState error={error} /></View>;
  if (!current) return <View style={[s.screen, { paddingTop: insets.top }]}><ErrorState error={{ message: 'Dhikr introuvable' }} /></View>;

  // Objectif 0 (« Sans objectif » enregistré) : compteur libre, comme Infinity.
  const chosen = goal ?? current.goal;
  const target = chosen > 0 ? chosen : Infinity;
  const endless = target === Infinity;
  const inRound = Math.max(0, count - (base || 0));
  const left = Math.max(0, target - inRound);
  const dayTotal = Object.values(all).reduce((n, c) => n + c, 0);

  const setCountFor = (k, n) => {
    setLocal((l) => ({ ...l, [k]: n }));
    saveCount(data.day, k, n).catch(() => {});
  };

  const reachedCountWith = (k, n) => data.list.filter((d) => isReached((d.key === k ? n : all[d.key]) || 0, d.goal)).length;

  const tap = () => {
    if (done) return;
    const n = count + 1;
    setCountFor(curKey, n);
    if (endless || n - (base || 0) < target) {
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }
    // Objectif du tour atteint.
    if (tasbihMode && step < steps.length - 1) {
      if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const nextStep = steps[step + 1];
      setStep(step + 1);
      setBase(all[nextStep.key] || 0);
      setGoal(nextStep.goal);
      return;
    }
    if (haptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 220);
    }
    const sb = streakBase.current || { streak: data.streak, reachedToday: true };
    const reached = reachedCountWith(curKey, n);
    if (haptics) setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 500);
    setDone({ count: n - (base || 0), reached, streak: sb.reachedToday || !reached ? sb.streak : sb.streak + 1 });
  };

  const undo = () => {
    if (count <= 0) return;
    setCountFor(curKey, count - 1);
  };
  const reset = () =>
    Alert.alert(tr("Remettre à zéro ?"), tr("Le compteur de {0} repart de 0 pour aujourd’hui.", [current.name]), [
      { text: tr("Annuler"), style: 'cancel' },
      { text: tr("Remettre à zéro"), style: 'destructive', onPress: () => { setCountFor(curKey, 0); setBase(0); } },
    ]);
  const toggleHaptics = async () => {
    try {
      const r = await api.patch('/dhikr/settings', { haptics: !haptics });
      await setSession({ user: r.user });
      toast(haptics ? tr("Vibration désactivée") : tr("Vibration activée"));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  // Suite proposée : le prochain dhikr du jour dont l'objectif n'est pas atteint.
  const next = !tasbihMode ? data.list.find((d) => d.key !== curKey && (all[d.key] || 0) < d.goal) : null;
  const finish = () => router.replace('/dhikr');
  const again = () => {
    setBase(count);
    setGoal(33);
    if (tasbihMode) {
      setStep(0);
      setBase(all[steps[0].key] || 0);
      setGoal(steps[0].goal);
    }
    setDone(null);
  };
  const goNext = () => {
    setKey(next.key);
    setGoal(next.goal);
    setBase(0);
    setDone(null);
  };

  const ringSize = Math.min(width - 72, 300);
  const title = tasbihMode ? tr("Tasbih après la prière · {0}/{1}", [step + 1, steps.length]) : current.name;

  return (
    <View style={[s.screen, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 12 }]}>
      {done ? null : (
      <Row justify="space-between" style={s.top}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/dhikr'))} accessibilityRole="button" accessibilityLabel={tr("Retour")} hitSlop={12}>
          <Icon name="chevronLeft" size={26} />
        </Pressable>
        <Text style={s.topTitle} numberOfLines={1}>{done ? current.name : title}</Text>
        {Platform.OS !== 'web' ? (
          <Pressable onPress={toggleHaptics} accessibilityRole="switch" accessibilityState={{ checked: haptics }} accessibilityLabel={tr("Vibration au comptage")} hitSlop={12}>
            <Icon name="vibrate" size={22} color={haptics ? colors.bordeaux : colors.subtle} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </Row>
      )}
      {tasbihMode && !done ? (
        <View style={s.steps}>
          {steps.map((st, i) => (
            <View key={st.key} style={[s.stepBar, i < step && { backgroundColor: colors.or }, i === step && { backgroundColor: colors.bordeaux }]} />
          ))}
        </View>
      ) : null}

      {done ? (
        <View style={[s.done, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <View style={s.doneRing}>
              <Icon name="check" size={56} color={colors.white} strokeWidth={2.4} />
            </View>
            <Text style={s.doneTitle}>{tasbihMode ? tr("Tasbih terminé") : tr("Objectif atteint")}</Text>
            <Text style={s.doneArabic}>بَارَكَ ٱللَّٰهُ فِيكِ</Text>
            <Text style={s.doneSub}>{tr("Barak Allahu fiki")}</Text>
            <Text style={[s.doneSub, { marginTop: 6 }]}>
              {tasbihMode ? tr("{0} dhikr aujourd’hui", [dayTotal]) : `${done.count} ${current.name}${done.reached ? tr(" · ton {0} objectif du jour", [done.reached === 1 ? '1er' : `${done.reached}e`]) : ''}`}
            </Text>
            {done.streak ? (
              <View style={s.streak}>
                <Icon name="sparkle" size={13} color={colors.orClair} />
                <Text style={s.streakText}>{plural(done.streak, 'jour')} {tr("d’affilée")}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 10 }}>
            {next ? (
              <Pressable onPress={goNext} accessibilityRole="button" style={s.doneMain}>
                <Text style={s.doneMainText} numberOfLines={1}>{tr("Continuer :")} {next.name}</Text>
              </Pressable>
            ) : null}
            <Row gap={10}>
              <Pressable onPress={again} accessibilityRole="button" style={s.doneGhost}>
                <Text style={s.doneGhostText}>{tasbihMode ? tr("Encore un tour") : tr("Encore 33")}</Text>
              </Pressable>
              <Pressable onPress={finish} accessibilityRole="button" style={s.doneGhost}>
                <Text style={s.doneGhostText}>{tr("Terminer")}</Text>
              </Pressable>
            </Row>
          </View>
        </View>
      ) : (
        <>
          <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={tr("{0} : {1} sur {2}. Touche pour compter", [current.name, inRound, target])} style={s.tapZone}>
            <Text style={s.arabic}>{current.arabic}</Text>
            <Text style={s.name}>{current.name}</Text>
            {current.meaning ? <Text style={s.meaning}>{current.meaning}</Text> : null}
            <View style={{ marginTop: 18 }}>
              <BigRing progress={endless ? 0 : inRound / target} reached={!endless && inRound >= target} size={ringSize}>
                <View style={[s.disc, { width: ringSize - 56, height: ringSize - 56, borderRadius: (ringSize - 56) / 2 }]}>
                  <Text style={s.count} adjustsFontSizeToFit numberOfLines={1}>{inRound}</Text>
                  {endless ? null : <Text style={s.of}>{tr("sur")} {target}</Text>}
                  <Text style={s.touch}>{tr("TOUCHE POUR COMPTER")}</Text>
                </View>
              </BigRing>
            </View>
            <Text style={s.left}>{endless ? tr("Libre : sans fin") : left ? tr("Encore {0}", [left]) : tr("Objectif atteint")} {tr("· touche n’importe où sur l’écran")}</Text>
          </Pressable>
          {!tasbihMode ? (
            <Row gap={8} style={{ justifyContent: 'center' }}>
              {GOALS.map((g) => (
                <Pressable key={g} onPress={() => setGoal(g)} accessibilityRole="radio" accessibilityState={{ selected: target === g }} style={[s.goal, target === g && s.goalOn]}>
                  <Text style={[s.goalText, target === g && { color: colors.white }]}>{g}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setGoal(Infinity)} accessibilityRole="radio" accessibilityState={{ selected: endless }} style={[s.goal, endless && s.goalOn]}>
                <Text style={[s.goalText, endless && { color: colors.white }]}>{tr("Libre")}</Text>
              </Pressable>
            </Row>
          ) : null}
          <View style={s.totals}>
            <View style={{ flex: 1 }}>
              <T variant="small">{tr("Aujourd’hui")}</T>
              <Text style={s.totalText}>{dayTotal} {tr("dhikr au total")}</Text>
            </View>
            <Pressable onPress={undo} accessibilityRole="button" accessibilityLabel={tr("Annuler le dernier")} hitSlop={6} style={s.roundBtn}>
              <Icon name="undo" size={18} color={colors.bordeaux} />
            </Pressable>
            <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel={tr("Remettre à zéro")} hitSlop={6} style={s.roundBtn}>
              <Icon name="reset" size={18} color={colors.bordeaux} />
            </Pressable>
          </View>
        </>
      )}

    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivoire, paddingHorizontal: 20 },
  top: { minHeight: 44 },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 14.5, color: colors.prune, marginHorizontal: 10 },
  steps: { flexDirection: 'row', gap: 6, marginTop: 6 },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line },
  tapZone: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  arabic: { fontSize: 38, lineHeight: 60, color: colors.bordeaux, textAlign: 'center', writingDirection: 'rtl', fontFamily: fonts.arabic },
  name: { fontFamily: fonts.title, fontSize: 22, color: colors.prune, textAlign: 'center' },
  meaning: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', paddingHorizontal: 10 },
  disc: { backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  count: { fontFamily: fonts.title, fontSize: 76, lineHeight: 86, color: colors.white },
  of: { fontFamily: fonts.medium, fontSize: 15, color: colors.rose },
  touch: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, color: colors.rose, marginTop: 8 },
  left: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted, marginTop: 16, textAlign: 'center' },
  goal: { minWidth: 64, minHeight: 44, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  goalOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  goalText: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  totals: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 20, padding: 14, marginTop: 14, borderWidth: 1, borderColor: colors.line },
  totalText: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  done: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bordeaux, paddingHorizontal: 20, zIndex: 10 },
  doneRing: { width: 150, height: 150, borderRadius: 75, borderWidth: 10, borderColor: colors.or, backgroundColor: colors.onBordeauxSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  doneTitle: { fontFamily: fonts.extra, fontSize: 32, letterSpacing: -1, color: colors.white },
  doneArabic: { fontSize: 30, lineHeight: 48, color: colors.orClair, writingDirection: 'rtl', fontFamily: fonts.arabic },
  doneSub: { fontFamily: fonts.medium, fontSize: 15, color: colors.onBordeaux, textAlign: 'center' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.onBordeauxSurface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 6 },
  streakText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  doneMain: { minHeight: 54, borderRadius: 999, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  doneMainText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.bordeaux },
  doneGhost: { flex: 1, minHeight: 50, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  doneGhostText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});

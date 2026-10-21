// Mise à jour Cycle · 6.5 — Modifier mes règles (inspiré de Flo), plein écran : « Annuler » / « Mes règles » /
// « Enregistrer », phrase d'aide, jours de la semaine fixés en haut ; mois les uns sous les autres (12 mois en
// arrière), ouvert centré sur aujourd'hui. Sous chaque date un rond : vide = rien ; bordeaux avec coche = règles
// notées ; pointillés avec coche = règles prévues. Toucher coche ou décoche (jours passés et aujourd'hui) ; les
// jours futurs ne se cochent pas. « Enregistrer » recalcule toutes les prévisions ; « Annuler » ne change rien.
import { router, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { monthGrid, PREDICTED } from '../components/Calendar';
import Icon from '../components/Icon';
import { ErrorState, Loader, useToast } from '../components/ui';
import { api } from '../lib/api';
import { addDays, monthLabel, shiftMonth, WEEKDAYS_SHORT as FMT_WEEKDAYS_SHORT } from '../lib/format';
import { useApi } from '../lib/useApi';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
const LETTERS = FMT_WEEKDAYS_SHORT;

function ask(title, text, okLabel, onOk) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${text}`)) onOk();
    return;
  }
  Alert.alert(title, text, [{ text: tr("Rester"), style: 'cancel' }, { text: okLabel, style: 'destructive', onPress: onOk }]);
}

/** Jours d'une plage (bornes incluses). */
function daysBetween(a, b) {
  const out = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
}

export default function EditPeriods() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const { data, loading, error, reload } = useApi('/cycle');
  const [edited, setChecked] = useState(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const todayY = useRef(null);
  const centered = useRef(false);
  const leaving = useRef(false);

  const today = data?.today;
  const fromMonth = today ? shiftMonth(today.slice(0, 7), -12) : null;
  const from = fromMonth ? `${fromMonth}-01` : null;

  // Jours de règles notées (hors nifas), et jours verrouillés : nifas et règles commencées avant la fenêtre.
  const { initial, locked } = useMemo(() => {
    const init = new Set();
    const lock = new Set();
    for (const p of data?.periods || []) {
      const days = daysBetween(p.start, p.end || today);
      if (p.kind === 'nifas' || p.start < from) days.forEach((d) => lock.add(d));
      else days.forEach((d) => init.add(d));
    }
    return { initial: init, locked: lock };
  }, [data, today, from]);

  const current = edited || initial;

  // Règles prévues : fin des règles en cours, puis les prochaines prévisions.
  const predicted = useMemo(() => {
    const set = new Set();
    if (!data) return set;
    if (data.inPeriod) {
      const end = addDays(data.inPeriod.start, (data.averages?.periodLength || 5) - 1);
      for (const d of daysBetween(addDays(today, 1), end)) set.add(d);
    }
    for (const p of data.predictions || []) for (const d of daysBetween(p.start, p.end)) set.add(d);
    return set;
  }, [data, today]);

  const dirty = useMemo(() => {
    if (!edited) return false;
    if (edited.size !== initial.size) return true;
    for (const d of edited) if (!initial.has(d)) return true;
    return false;
  }, [edited, initial]);

  // Quitter avec des jours modifiés : confirmation.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirty || leaving.current) return;
        e.preventDefault();
        ask(tr("Annuler les changements ?"), tr("Les jours que tu as modifiés ne seront pas enregistrés."), 'Annuler', () => {
          leaving.current = true;
          navigation.dispatch(e.data.action);
        });
      }),
    [navigation, dirty],
  );

  if (loading && !data) return <View style={[s.screen, { paddingTop: insets.top }]}><Loader /></View>;
  if (error && !data) return <View style={[s.screen, { paddingTop: insets.top }]}><ErrorState error={error} onRetry={reload} /></View>;

  // Mois affichés : 12 mois en arrière jusqu'au mois des prochaines règles prévues.
  const lastPredicted = [...predicted].sort().pop();
  const lastMonth = lastPredicted && lastPredicted.slice(0, 7) > today.slice(0, 7) ? lastPredicted.slice(0, 7) : shiftMonth(today.slice(0, 7), 1);
  const months = [];
  for (let m = fromMonth; m <= lastMonth; m = shiftMonth(m, 1)) months.push(m);
  const cell = Math.floor((Math.min(width, 640) - 32) / 7);

  const toggle = (d) => {
    setChecked((prev) => {
      const next = new Set(prev || initial);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const cancel = () => (router.canGoBack() ? router.back() : router.replace('/cycle'));
  const save = async () => {
    setBusy(true);
    try {
      await api.put('/cycle/periods/days', { from, days: [...current].filter((d) => d >= from && d <= today && !locked.has(d)) });
      toast(tr("Règles enregistrées, prévisions recalculées"));
      leaving.current = true;
      cancel();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top + 4 }]}>
      <View style={s.head}>
        <Pressable onPress={cancel} accessibilityRole="button" hitSlop={10}>
          <Text style={s.cancel}>{tr("Annuler")}</Text>
        </Pressable>
        <Text style={s.title}>{tr("Mes règles")}</Text>
        <Pressable onPress={save} disabled={busy} accessibilityRole="button" hitSlop={10}>
          <Text style={[s.save, busy && { opacity: 0.5 }]}>{tr("Enregistrer")}</Text>
        </Pressable>
      </View>
      <Text style={s.help}>{tr("Touche les jours où tu as eu tes règles.")}</Text>
      <View style={s.letters}>
        {LETTERS.map((l, i) => (
          <Text key={i} style={[s.letter, { width: cell }]}>{l}</Text>
        ))}
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 70 }}
        onContentSizeChange={() => {
          if (todayY.current != null && !centered.current) {
            scrollRef.current?.scrollTo({ y: Math.max(0, todayY.current - 160), animated: false });
            centered.current = true;
          }
        }}
      >
        {months.map((m) => (
          <View key={m} onLayout={(e) => { if (m === today.slice(0, 7)) todayY.current = e.nativeEvent.layout.y; }}>
            <Text style={s.month}>{monthLabel(m).split(' ')[0]}{m.slice(0, 4) !== today.slice(0, 4) ? ` ${m.slice(0, 4)}` : ''}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {monthGrid(m).map((d, i) => {
                if (!d) return <View key={`e${m}${i}`} style={{ width: cell, height: cell + 18 }} />;
                const future = d > today;
                const isLocked = locked.has(d);
                const on = current.has(d) || isLocked;
                const pred = future && predicted.has(d);
                const disabled = future || isLocked || d < from;
                return (
                  <Pressable
                    key={d}
                    disabled={disabled}
                    onPress={() => toggle(d)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled }}
                    accessibilityLabel={`${Number(d.slice(8))} ${monthLabel(m)}${(pred ? tr(", règles prévues") : '')}`}
                    style={{ width: cell, height: cell + 18, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}
                  >
                    {d === today ? <Text style={s.today}>{tr("AUJ.")}</Text> : null}
                    <Text style={[s.num, on && { color: colors.bordeaux, fontFamily: fonts.extra }, pred && { color: PREDICTED, fontFamily: fonts.bold }, future && !pred && { color: colors.caseVide }]}>{Number(d.slice(8))}</Text>
                    <View style={[s.circle, on && s.circleOn, isLocked && { backgroundColor: colors.bordeauxSoft, borderColor: colors.bordeauxSoft }, pred && s.circlePred, future && !pred && { borderColor: colors.line }]}>
                      {on ? <Icon name="check" size={13} color={colors.white} strokeWidth={3} /> : pred ? <Icon name="check" size={13} color={PREDICTED} strokeWidth={2.6} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={[s.legendBar, { paddingBottom: insets.bottom + 10 }]}>
        <View style={[s.legendDot, { backgroundColor: colors.bordeaux }]} />
        <Text style={s.legend}>{tr("Règles notées")}</Text>
        <View style={[s.legendDot, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: PREDICTED, marginLeft: 14 }]} />
        <Text style={s.legend}>{tr("Prévues")}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, minHeight: 44 },
  cancel: { fontFamily: fonts.semi, fontSize: 15, color: colors.muted },
  title: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
  save: { fontFamily: fonts.extra, fontSize: 15, color: colors.bordeaux },
  help: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 2 },
  letters: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  letter: { textAlign: 'center', fontFamily: fonts.semi, fontSize: 11.5, color: colors.muted },
  month: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune, textAlign: 'center', textTransform: 'capitalize', marginTop: 18, marginBottom: 4 },
  today: { fontFamily: fonts.extra, fontSize: 8.5, color: colors.prune, marginBottom: 1 },
  num: { fontFamily: fonts.semi, fontSize: 14.5, color: colors.prune, marginBottom: 4 },
  circle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.caseVide, alignItems: 'center', justifyContent: 'center' },
  circleOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  circlePred: { borderStyle: 'dashed', borderColor: PREDICTED },
  legendBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 10, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legend: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
});

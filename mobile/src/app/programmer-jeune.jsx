// Mise à jour Jeûnes — Programmer un jeûne : Lundi et jeudi (jours au choix), Jours blancs, 6 jours de Chawwal,
// Arafat, Achoura (dates hégiriennes estimées), Dates précises (calendrier, règles prévues en rose : déconseillées
// mais pas bloquées). « Jusqu'à » : Toujours / 3 mois / Une date. Rappel la veille (activé par défaut), réveil pour
// le suhoor (désactivé par défaut). Aperçu « Tes prochains jeûnes » en direct ; les jours de règles prévues sont
// sautés. « Programmer » enregistre et ajoute les jours dans « À venir » et dans le calendrier du Cycle.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { monthGrid } from '../components/Calendar';
import { DateField } from '../components/forms';
import Icon from '../components/Icon';
import { Button, ErrorState, Gap, Loader, Row, Screen, Segmented, T, Toggle, useToast } from '../components/ui';
import { api } from '../lib/api';
import { addDays, monthLabel, shiftMonth, DAYS_SHORT as FMT_DAYS_SHORT, MONTHS_SHORT as FMT_MONTHS_SHORT, WEEK as FMT_WEEK } from '../lib/format';
import { useApi } from '../lib/useApi';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
const KINDS = [
  { key: 'lundi_jeudi', title: tr("Lundi et jeudi"), sub: tr("Chaque semaine") },
  { key: 'blancs', title: tr("Jours blancs"), sub: tr("13, 14, 15 de chaque mois") },
  { key: 'chawwal', title: tr("6 jours de Chawwal"), sub: tr("Après le Ramadan") },
  { key: 'arafat', title: tr("Arafat"), sub: tr("9 Dhul-Hijja") },
  { key: 'achoura', title: tr("Achoura"), sub: tr("9 et 10 Muharram") },
  { key: 'dates', title: tr("Dates précises"), sub: tr("Je choisis les jours") },
];
const EXPLAIN = {
  blancs: tr("Les 13, 14 et 15 de chaque mois hégirien. Dates calculées automatiquement (estimées, ajustement de ton profil)."),
  chawwal: tr("Six jours pendant le mois de Chawwal, après l’Aïd. Dates estimées."),
  arafat: tr("Le 9 Dhul-Hijja, la veille de l’Aïd al-Adha. Date estimée."),
  achoura: tr("Les 9 et 10 Muharram. Dates estimées."),
};
// L M M J V S D → numéros de jour (0 = dimanche).
const WEEK = FMT_WEEK;
const DAYS_SHORT = FMT_DAYS_SHORT;
const MONTHS_SHORT = FMT_MONTHS_SHORT;
const chipDay = (d, withWd) => {
  const x = new Date(`${d}T12:00:00Z`);
  return `${withWd ? `${DAYS_SHORT[x.getUTCDay()]} ` : ''}${x.getUTCDate()} ${MONTHS_SHORT[x.getUTCMonth()]}`;
};

/** Calendrier à choix multiple pour « Dates précises » : règles prévues en rose. */
function MultiCalendar({ today, value, onChange }) {
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState(addDays(today, 1).slice(0, 7));
  const cycle = useApi(`/cycle?month=${month}`);
  const byDay = new Map((cycle.data?.calendar || []).map((d) => [d.day, d]));
  const cell = Math.floor((Math.min(width, 640) - 40 - 32) / 7);
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <View style={{ gap: 6 }}>
      <Row justify="space-between">
        <Pressable onPress={() => month > today.slice(0, 7) && setMonth(shiftMonth(month, -1))} accessibilityRole="button" accessibilityLabel={tr("Mois précédent")} hitSlop={8} style={[s.arrow, month <= today.slice(0, 7) && { opacity: 0.35 }]}>
          <Icon name="chevronLeft" size={15} color={colors.prune} />
        </Pressable>
        <Text style={s.monthTitle}>{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} accessibilityRole="button" accessibilityLabel={tr("Mois suivant")} hitSlop={8} style={s.arrow}>
          <Icon name="chevronRight" size={15} color={colors.prune} />
        </Pressable>
      </Row>
      <T variant="small" style={{ textAlign: 'right' }}>{tr("Touche un ou plusieurs jours")}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {WEEK.map((w, i) => (
          <Text key={i} style={[s.letter, { width: cell }]}>{w.l}</Text>
        ))}
        {monthGrid(month).map((d, i) => {
          if (!d) return <View key={`e${i}`} style={{ width: cell, height: cell }} />;
          const past = d <= today;
          const on = value.includes(d);
          const info = byDay.get(d);
          const period = info?.period === 'prevue' || info?.period === 'reelle';
          return (
            <Pressable key={d} disabled={past} onPress={() => toggle(d)} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: past }} accessibilityLabel={`${chipDay(d, true)}${period ? tr(", règles prévues") : ''}`} style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}>
              <View style={[s.day, { width: cell - 8, height: cell - 8, borderRadius: cell }, period && !on && { backgroundColor: colors.blush }, on && { backgroundColor: colors.or }]}>
                <Text style={[s.dayNum, past && { color: colors.caseVide }, period && !on && { color: colors.bordeaux }, on && { color: colors.white, fontFamily: fonts.extra }]}>{Number(d.slice(8))}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <T variant="small">{tr("Rose : tes règles prévues, à éviter.")}</T>
    </View>
  );
}

export default function ProgramFast() {
  const params = useLocalSearchParams();
  const toast = useToast();
  const v = useApi('/fasts/voluntary');
  const [kind, setKind] = useState(KINDS.some((k) => k.key === params.type) ? params.type : 'lundi_jeudi');
  const [weekdays, setWeekdays] = useState(null);
  const [dates, setDates] = useState([]);
  const [untilMode, setUntilMode] = useState(null);
  const [untilDay, setUntilDay] = useState(null);
  const [reminder, setReminder] = useState(true);
  const [suhoor, setSuhoor] = useState(null);
  const [suhoorMinutes, setSuhoorMinutes] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const d = v.data;
  const plan = d?.plan;
  const today = d?.today;
  // Valeurs du programme existant, tant qu'elles n'ont pas été touchées.
  const days = weekdays ?? (plan?.weekdays?.length ? plan.weekdays : [1, 4]);
  const mode = untilMode ?? (plan?.until ? 'date' : 'toujours');
  const until = mode === 'toujours' ? null : mode === '3mois' ? (today ? addDays(today, 91) : null) : untilDay || plan?.until || (today ? addDays(today, 30) : null);
  const wantsSuhoor = suhoor ?? Boolean(plan?.suhoor);
  const minutes = suhoorMinutes ?? plan?.suhoorMinutes ?? 30;

  // Programme de cet écran seul (pour l'aperçu) ; il est fusionné au programme existant à l'enregistrement.
  const draft = { weekdays: kind === 'lundi_jeudi' ? days : [], blancs: kind === 'blancs', arafat: kind === 'arafat', achoura: kind === 'achoura', chawwal: kind === 'chawwal', dates: kind === 'dates' ? dates : [], until };
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    if (!today) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      api
        .post('/fasts/voluntary/preview', JSON.parse(draftKey))
        .then((r) => alive && setPreview(r.next))
        .catch(() => alive && setPreview([]));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [draftKey, today]);

  if (v.loading && !d) return <Screen back title={tr("Programmer un jeûne")}><Loader /></Screen>;
  if (v.error && !d) return <Screen back title={tr("Programmer un jeûne")}><ErrorState error={v.error} onRetry={v.reload} /></Screen>;

  const save = async () => {
    if (kind === 'dates' && !dates.length) return toast(tr("Choisis au moins un jour"), 'error');
    if (kind === 'lundi_jeudi' && !days.length) return toast(tr("Choisis au moins un jour de la semaine"), 'error');
    setBusy(true);
    try {
      const patch = { until, reminder, suhoor: wantsSuhoor, suhoorMinutes: minutes, reminderTime: plan?.reminderTime || '21:00' };
      if (kind === 'lundi_jeudi') patch.weekdays = days;
      else if (kind === 'dates') patch.dates = [...new Set([...(plan?.dates || []), ...dates])];
      else patch[kind] = true;
      await api.put('/fasts/voluntary/plan', patch);
      toast(tr("Jeûne programmé"));
      router.back();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title={tr("Programmer un jeûne")} footer={<Button title={tr("Programmer")} onPress={save} loading={busy} disabled={busy} />}>
      <Text style={s.section}>{tr("QUEL JEÛNE ?")}</Text>
      <View style={s.kinds}>
        {KINDS.map((k) => {
          const on = kind === k.key;
          return (
            <Pressable key={k.key} onPress={() => setKind(k.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[s.kind, on && s.kindOn]}>
              <Text style={[s.kindTitle, on && { color: colors.bordeaux }]}>{k.title}</Text>
              <Text style={[s.kindSub, on && { color: colors.bordeauxSoft }]}>{k.sub}</Text>
            </Pressable>
          );
        })}
      </View>
      <Gap h={12} />

      <View style={s.card}>
        {kind === 'lundi_jeudi' ? (
          <>
            <Text style={s.cardTitle}>{tr("Quels jours de la semaine ?")}</Text>
            <Row gap={6}>
              {WEEK.map((w) => {
                const on = days.includes(w.n);
                return (
                  <Pressable key={w.n} onPress={() => setWeekdays(on ? days.filter((x) => x !== w.n) : [...days, w.n])} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[s.wd, on && s.wdOn]}>
                    <Text style={[s.wdText, on && { color: colors.white }]}>{w.l}</Text>
                  </Pressable>
                );
              })}
            </Row>
            <T variant="small">{tr("Sunna : lundi et jeudi. Tu peux choisir d’autres jours.")}</T>
          </>
        ) : kind === 'dates' ? (
          <MultiCalendar today={today} value={dates} onChange={setDates} />
        ) : (
          <>
            <Text style={s.cardTitle}>{KINDS.find((k) => k.key === kind)?.title}</Text>
            <T variant="muted">{EXPLAIN[kind]}</T>
          </>
        )}
      </View>
      <Gap h={12} />

      <View style={s.card}>
        <Row justify="space-between">
          <Text style={s.cardTitle}>{tr("Jusqu’à")}</Text>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Segmented
              items={[
                { key: 'toujours', label: tr("Toujours") },
                { key: '3mois', label: tr("3 mois") },
                { key: 'date', label: tr("Une date") },
              ]}
              value={mode}
              onChange={setUntilMode}
            />
          </View>
        </Row>
        {mode === 'date' ? <DateField label={tr("Date de fin")} value={until} onChange={setUntilDay} minDay={addDays(today, 1)} maxDay={addDays(today, 400)} /> : null}
        <View style={s.sep} />
        <Toggle label={tr("Rappel la veille")} hint={tr("À {0} · « Demain, jeûne »", [plan?.reminderTime || '21:00'])} value={reminder} onChange={setReminder} />
        <View style={s.sep} />
        <Toggle label={tr("Réveil pour le suhoor")} hint={tr("{0} min avant Fajr", [minutes])} value={wantsSuhoor} onChange={setSuhoor} />
        {wantsSuhoor ? (
          <Row gap={10} justify="flex-end">
            <Pressable onPress={() => setSuhoorMinutes(Math.max(10, minutes - 5))} accessibilityRole="button" accessibilityLabel={tr("5 minutes de moins")} style={s.step}>
              <Text style={s.stepText}>−</Text>
            </Pressable>
            <Text style={s.minutes}>{minutes} {tr("min")}</Text>
            <Pressable onPress={() => setSuhoorMinutes(Math.min(120, minutes + 5))} accessibilityRole="button" accessibilityLabel={tr("5 minutes de plus")} style={s.step}>
              <Text style={s.stepText}>+</Text>
            </Pressable>
          </Row>
        ) : null}
      </View>
      <Gap h={12} />

      <View style={s.preview}>
        <Text style={s.previewTitle}>{tr("Tes prochains jeûnes")}</Text>
        {preview == null ? (
          <Loader />
        ) : preview.length ? (
          <View style={s.chips}>
            {preview.map((p) => (
              <View key={p.day} style={[s.chip, p.paused && s.chipPaused]}>
                <Text style={[s.chipText, p.paused && { color: colors.muted, textDecorationLine: 'line-through' }]}>{chipDay(p.day, kind === 'lundi_jeudi')}</Text>
              </View>
            ))}
          </View>
        ) : (
          <T variant="small">{tr("Aucun jour à venir avec ce choix.")}</T>
        )}
        <T variant="small">{tr("Si tes règles tombent un jour programmé, on te le signale et le jour est sauté.")}</T>
      </View>
      <Gap h={12} />
    </Screen>
  );
}

const s = StyleSheet.create({
  section: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.orText, marginBottom: 8 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { width: '48.5%', backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line, gap: 2 },
  kindOn: { borderColor: colors.bordeaux, borderWidth: 1.5 },
  kindTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.prune },
  kindSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.line },
  cardTitle: { fontFamily: fonts.extra, fontSize: 15, color: colors.prune },
  wd: { flex: 1, height: 40, borderRadius: 12, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  wdOn: { backgroundColor: colors.bordeaux },
  wdText: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
  arrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune, textTransform: 'capitalize' },
  letter: { textAlign: 'center', fontFamily: fonts.semi, fontSize: 11, color: colors.muted, paddingVertical: 4 },
  day: { alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontFamily: fonts.semi, fontSize: 14, color: colors.prune },
  sep: { height: 1, backgroundColor: colors.line },
  step: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.extra, fontSize: 18, color: colors.bordeaux },
  minutes: { fontFamily: fonts.extra, fontSize: 15, color: colors.prune, minWidth: 60, textAlign: 'center' },
  preview: { backgroundColor: colors.sable, borderRadius: 20, padding: 14, gap: 10 },
  previewTitle: { fontFamily: fonts.extra, fontSize: 14, color: colors.orText },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipPaused: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  chipText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.prune },
});

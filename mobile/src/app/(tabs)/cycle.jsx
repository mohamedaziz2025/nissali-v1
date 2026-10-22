// Mise à jour Cycle · 6.1 — Accueil court de l'onglet Cycle : bande de la semaine (glisser pour changer de
// semaine), grand texte du jour touché, « Modifier mes règles », 4 actions, « Comment tu te sens ? », tuiles
// Poids et Sommeil, carte « Suivre ma santé ». Rien d'autre ici : graphiques, conseil et Mon cycle sont en 6.1 bis.
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { cycleDayOf } from '../../components/CycleDay';
import { MoodFace } from '../../components/HealthCards';
import { hm } from '../../components/HealthEditSheets';
import Icon from '../../components/Icon';
import { ErrorState, Gap, Loader, OfflineBanner, Row, Screen, useToast } from '../../components/ui';
import { kg } from '../../components/Weight';
import { sendOrQueue } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { addDays, cap, dayMonth, diffDays, longDate, WEEKDAYS_SHORT as FMT_WEEKDAYS_SHORT } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, fonts, MOODS, space, tnum } from '../../theme';

import { tr } from '../../lib/i18n';
const LETTERS = FMT_WEEKDAYS_SHORT;
const PREDICTED = '#B9566E';

const mondayOf = (day) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
const plural = (n, w) => `${n} ${w}${Math.abs(n) > 1 ? 's' : ''}`;

/** Rond d'un jour, aux couleurs communes à tous les calendriers. */
function DayDot({ info, day, selected, size = 36, onPress }) {
  const real = info?.period === 'reelle' || info?.period === 'nifas';
  const predicted = info?.period === 'prevue';
  const ovulation = !real && info?.ovulation;
  const fertile = !real && !predicted && !ovulation && info?.fertile;
  const note = Boolean(info?.notes?.length || info?.fast);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={longDate(day)} style={[s.dotWrap, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }, selected && s.dotSelected]}>
      <View
        style={[
          { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
          real && { backgroundColor: colors.bordeaux },
          predicted && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: PREDICTED },
          fertile && { backgroundColor: colors.roseFertile },
          ovulation && { backgroundColor: colors.creme, borderWidth: 1.5, borderColor: colors.or },
          info?.today && !real && { borderWidth: 2, borderColor: colors.prune },
        ]}
      >
        <Text style={[s.dotNum, real && { color: colors.white }, predicted && { color: PREDICTED }]}>{Number(day.slice(8))}</Text>
      </View>
      {note ? <View style={[s.noteDot, real && { backgroundColor: colors.white }]} /> : null}
    </Pressable>
  );
}

/** Grand texte du jour touché (6.1). */
function dayText({ day, info, data, wantsOvulation }) {
  const n = cycleDayOf(day, data.periods);
  const real = info?.period === 'reelle' || info?.period === 'nifas';
  if (real) {
    const period = (data.periods || []).find((p) => day >= p.start && (!p.end || day <= p.end));
    const end = period?.end || (period ? addDays(period.start, (data.averages?.periodLength || 5) - 1) : null);
    return { label: info.period === 'nifas' ? tr("Nifas") : tr("Règles"), big: tr("Jour {0}", [n || 1]), sub: period?.end ? tr("Terminées le {0}", [dayMonth(period.end)]) : end ? tr("Fin prévue vers le {0}", [dayMonth(end)]) : '' };
  }
  if (!data.next) {
    return { label: tr("Mon cycle"), big: data.noPrediction ? tr("Imprévisible") : tr("Note tes règles"), sub: tr("Ta phase apparaît dès ta première saisie.") };
  }
  const untilNext = diffDays(data.next.date, day);
  if (info?.period === 'prevue' || untilNext <= 0) {
    return { label: tr("Règles prévues"), big: untilNext > 0 ? tr("Dans {0}", [plural(untilNext, 'jour')]) : tr("Prévues"), sub: tr("Vers le {0} · estimation", [dayMonth(data.next.date)]) };
  }
  const ov = data.ovulation?.day;
  if (ov && day < ov) {
    const untilOv = diffDays(ov, day);
    if (wantsOvulation) return { label: tr("Ovulation"), big: tr("Dans {0}", [plural(untilOv, 'jour')]), sub: tr("Estimée le {0}", [dayMonth(ov)]) };
    return { label: tr("Phase folliculaire"), big: tr("Jour {0}", [n || '—']), sub: tr("Prochaines règles vers le {0}", [dayMonth(data.next.date)]) };
  }
  if (ov && day === ov) {
    return { label: wantsOvulation ? tr("Ovulation") : tr("Mon cycle"), big: wantsOvulation ? tr("Aujourd’hui") : tr("Jour {0}", [n || '—']), sub: wantsOvulation ? tr("Estimation") : tr("Prochaines règles vers le {0}", [dayMonth(data.next.date)]) };
  }
  return { label: tr("Prochaines règles"), big: tr("Dans {0}", [plural(untilNext, 'jour')]), sub: tr("Vers le {0}{1}", [dayMonth(data.next.date), (data.isDefault ? tr(" · estimation") : '')]) };
}

/** Mini-courbe (tuile Poids). */
function Sparkline({ values, width = 120, height = 28 }) {
  const pts = values.filter((v) => v != null);
  if (pts.length < 2) return <View style={{ height }} />;
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = hi - lo || 1;
  const step = width / (values.length - 1);
  let d = '';
  values.forEach((v, i) => {
    if (v == null) return;
    d += `${d ? 'L' : 'M'}${(i * step).toFixed(1)} ${(height - 3 - ((v - lo) / span) * (height - 6)).toFixed(1)}`;
  });
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={colors.or} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** Mini-barres (tuile Sommeil). */
function MiniBars({ values, height = 28 }) {
  const max = Math.max(9, ...values.filter((v) => v != null));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height }}>
      {values.map((v, i) => (
        <View key={i} style={{ flex: 1, height: v == null ? 4 : Math.max(4, (v / max) * height), borderRadius: 3, backgroundColor: v == null ? colors.line : colors.bordeaux }} />
      ))}
    </View>
  );
}

export default function Cycle() {
  const toast = useToast();
  const { user } = useAuth();
  const base = useApi('/cycle');
  const today = base.data?.today;
  const [weekStart, setWeekStart] = useState(null);
  const monday = weekStart || (today ? mondayOf(today) : null);
  const sunday = monday ? addDays(monday, 6) : null;
  // Semaine affichée : elle peut couvrir deux mois.
  const m1 = monday?.slice(0, 7);
  const m2 = sunday?.slice(0, 7);
  const a = useApi(weekStart && m1 !== today?.slice(0, 7) ? `/cycle?month=${m1}` : null);
  const b = useApi(weekStart && m2 !== m1 ? `/cycle?month=${m2}` : null);
  const entries = useApi('/health-log/entries?days=7');
  const [selected, setSelected] = useState(null);
  const [mood, setMood] = useState(undefined);
  const touchX = useRef(null);

  const data = base.data;
  if (base.loading && !data) return <Screen><Loader /></Screen>;
  if (base.error && !data) return <Screen><ErrorState error={base.error} onRetry={base.reload} /></Screen>;

  const reload = () => {
    base.reload();
    entries.reload();
    setMood(undefined);
  };

  const calendarDays = [...(data.calendar || []), ...(data.week || []), ...(a.data?.calendar || []), ...(b.data?.calendar || [])];
  const byDay = new Map(calendarDays.map((d) => [d.day, d]));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const day = selected && week.includes(selected) ? selected : week.includes(today) ? today : monday;
  const info = byDay.get(day);
  const wantsOvulation = user?.situation === 'mariee' && user?.onboarding?.goal === 'enfant';
  const text = dayText({ day, info, data, wantsOvulation });

  const shiftWeek = (n) => {
    const next = addDays(monday, 7 * n);
    if (diffDays(next, mondayOf(today)) > 7 * 52) return;
    setWeekStart(next === mondayOf(today) ? null : next);
    setSelected(null);
  };

  const currentMood = mood !== undefined ? mood : data.journal?.mood || null;
  const pickMood = async (key) => {
    const next = currentMood === key ? null : key;
    setMood(next);
    try {
      await sendOrQueue('PUT', `/health-log/day/${today}`, { mood: next });
      if (next) toast(tr("Humeur enregistrée"));
    } catch (e) {
      setMood(undefined);
      toast(e.message, 'error');
    }
  };

  // Tuiles : 7 derniers jours.
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const byEntry = new Map((entries.data?.items || []).map((e) => [e.day, e]));
  const weights = last7.map((d) => byEntry.get(d)?.weight ?? null);
  const sleeps = last7.map((d) => byEntry.get(d)?.sleepHours ?? null);
  const knownW = weights.filter((w) => w != null);
  const lastWeight = knownW.length ? knownW[knownW.length - 1] : data.lastWeight?.weight ?? null;
  const weekDiff = knownW.length >= 2 ? Math.round((knownW[knownW.length - 1] - knownW[0]) * 10) / 10 : null;
  const knownS = sleeps.filter((v) => v != null);
  const avgSleep = knownS.length ? knownS.reduce((x, y) => x + y, 0) / knownS.length : null;

  const action = (icon, label, onPress, strong) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s.action}>
      <View style={[s.actionIcon, strong && { backgroundColor: colors.bordeaux }]}>
        <Icon name={icon} size={20} color={strong ? colors.white : colors.bordeaux} />
      </View>
      <Text style={s.actionLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );

  return (
    <Screen onRefresh={reload} topColor={colors.blush}>
      <OfflineBanner visible={base.offline} />
      <View
        style={s.hero}
        onTouchStart={(e) => (touchX.current = e.nativeEvent.pageX)}
        onTouchEnd={(e) => {
          const dx = e.nativeEvent.pageX - (touchX.current ?? e.nativeEvent.pageX);
          if (Math.abs(dx) > 60) shiftWeek(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {/* Ronds décoratifs de l'en-tête rose (maquette 6.1) */}
        <View pointerEvents="none" style={[s.deco, { width: 260, height: 260, borderRadius: 130, top: -70, right: -110 }]} />
        <View pointerEvents="none" style={[s.deco, { width: 220, height: 220, borderRadius: 110, top: 150, left: -120 }]} />
        <Row justify="space-between">
          <View style={{ width: 40 }} />
          <Text style={s.heroDate}>{day === today ? tr("Aujourd’hui · {0}", [dayMonth(today)]) : cap(longDate(day))}</Text>
          <Pressable onPress={() => router.push('/calendrier')} accessibilityRole="button" accessibilityLabel={tr("Mon calendrier")} hitSlop={6} style={s.calBtn}>
            <Icon name="calendar" size={19} color={colors.prune} />
          </Pressable>
        </Row>
        <View style={s.week}>
          {week.map((d, i) => (
            <View key={d} style={s.weekCol}>
              <Text style={[s.weekLetter, d === today && { color: colors.prune, fontFamily: fonts.extra }]}>{d === today ? tr("AUJ.") : LETTERS[i]}</Text>
              <DayDot day={d} info={byDay.get(d)} selected={d === day && d !== today} onPress={() => setSelected(d)} />
            </View>
          ))}
        </View>
        <View style={s.bigWrap}>
          <Text style={s.bigLabel}>{text.label}</Text>
          <Text style={s.big} adjustsFontSizeToFit numberOfLines={1}>{text.big}</Text>
          {text.sub ? <Text style={s.bigSub}>{text.sub}</Text> : null}
          <Pressable onPress={() => router.push('/mes-regles')} accessibilityRole="button" style={({ pressed }) => [s.modify, pressed && { opacity: 0.85 }]}>
            <Text style={s.modifyText}>{tr("Modifier mes règles")}</Text>
          </Pressable>
        </View>
        <View style={s.actions}>
          {action('drop', tr("Mes règles"), () => router.push('/mes-regles'), true)}
          {action('plus', tr("Symptômes"), () => router.push(`/sante?day=${day > today ? today : day}`))}
          {action('smile', tr("Humeur"), () => router.push(`/sante?day=${day > today ? today : day}`))}
          {action('edit', tr("Note"), () => router.push(`/notes/nouvelle?day=${day}`))}
        </View>
      </View>
      <Gap />

      {data.mode === 'grossesse' ? (
        <>
          <Pressable onPress={() => router.push('/grossesse')} accessibilityRole="button" style={s.card}>
            <Row gap={10}>
              <Icon name="baby" size={20} color={colors.bordeaux} />
              <Text style={[s.cardTitle, { flex: 1 }]}>{tr("Mon suivi de grossesse")}</Text>
              <Icon name="chevronRight" size={16} color={colors.muted} />
            </Row>
          </Pressable>
          <Gap />
        </>
      ) : null}

      <View style={s.card}>
        <Row justify="space-between">
          <Text style={s.cardTitle}>{tr("Comment tu te sens ?")}</Text>
          <Pressable onPress={() => router.push('/sante')} accessibilityRole="button" hitSlop={8}>
            <Text style={s.link}>{tr("Tout noter")}</Text>
          </Pressable>
        </Row>
        <Row gap={2} justify="space-between">
          {MOODS.map((m) => {
            const on = currentMood === m.key;
            return (
              <Pressable key={m.key} onPress={() => pickMood(m.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={m.label} style={s.mood}>
                <MoodFace mood={m.key} on={on} size={42} />
                <Text style={[s.moodLabel, on && { color: colors.bordeaux, fontFamily: fonts.bold }]} numberOfLines={1}>{m.label}</Text>
              </Pressable>
            );
          })}
        </Row>
      </View>
      <Gap />

      <Row gap={12} align="stretch">
        <Pressable onPress={() => (lastWeight == null ? router.push('/sante') : router.push('/suivi?section=poids'))} accessibilityRole="button" style={[s.card, s.tile]}>
          <Row justify="space-between">
            <Row gap={6}>
              <View style={s.tileIcon}><Icon name="scale" size={15} color={colors.bordeaux} /></View>
              <Text style={s.tileTitle}>{tr("Poids")}</Text>
            </Row>
            <Icon name="chevronRight" size={14} color={colors.muted} />
          </Row>
          <Text style={[s.tileValue, tnum]}>{lastWeight != null ? `${kg(lastWeight)} kg` : '—'}</Text>
          {lastWeight != null ? (
            <>
              <Sparkline values={weights} />
              <Text style={s.tileSub}>{weekDiff != null ? tr("{0}{1} kg cette semaine", [weekDiff > 0 ? '+' : weekDiff < 0 ? '−' : '', kg(Math.abs(weekDiff))]) : tr("Dernière pesée")}</Text>
            </>
          ) : (
            <Text style={s.tileAdd}>{tr("Ajoute ton poids")}</Text>
          )}
        </Pressable>
        <Pressable onPress={() => (avgSleep == null ? router.push('/sante') : router.push('/suivi?section=sommeil'))} accessibilityRole="button" style={[s.card, s.tile]}>
          <Row justify="space-between">
            <Row gap={6}>
              <View style={s.tileIcon}><Icon name="moon" size={15} color={colors.bordeaux} /></View>
              <Text style={s.tileTitle}>{tr("Sommeil")}</Text>
            </Row>
            <Icon name="chevronRight" size={14} color={colors.muted} />
          </Row>
          <Text style={[s.tileValue, tnum]}>{avgSleep != null ? hm(Math.round(avgSleep * 4) / 4).replace(' h ', ' h') : '—'}</Text>
          {avgSleep != null ? (
            <>
              <MiniBars values={sleeps} />
              <Text style={s.tileSub}>{tr("moyenne par nuit")}</Text>
            </>
          ) : (
            <Text style={s.tileAdd}>{tr("Ajoute ton sommeil")}</Text>
          )}
        </Pressable>
      </Row>
      <Gap />

      <Pressable onPress={() => router.push('/suivi')} accessibilityRole="button" style={({ pressed }) => [s.follow, pressed && { opacity: 0.92 }]}>
        <View style={s.followIcon}>
          <Icon name="chart" size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.followTitle}>{tr("Suivre ma santé")}</Text>
          <Text style={s.followSub}>{tr("Humeur, poids, sommeil, symptômes et cycles en graphiques")}</Text>
        </View>
        <Icon name="chevronRight" size={18} color={colors.white} />
      </Pressable>
      <Gap h={8} />
    </Screen>
  );
}

const s = StyleSheet.create({
  // En-tête rose d'un bord à l'autre de l'écran, coins arrondis en bas seulement.
  hero: { backgroundColor: colors.blush, marginHorizontal: -space.gutter, marginTop: -12, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingHorizontal: space.gutter + 2, paddingTop: 14, paddingBottom: 20, gap: 12, overflow: 'hidden' },
  deco: { position: 'absolute', backgroundColor: 'rgba(233,185,193,0.22)' },
  heroDate: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  calBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCol: { alignItems: 'center', gap: 4, flex: 1 },
  weekLetter: { fontFamily: fonts.semi, fontSize: 11, color: colors.muted },
  dotWrap: { alignItems: 'center', justifyContent: 'center' },
  dotSelected: { borderWidth: 1.5, borderColor: colors.prune },
  dotNum: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
  noteDot: { position: 'absolute', bottom: 1, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.or },
  bigWrap: { alignItems: 'center', gap: 2, paddingVertical: 8 },
  bigLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  big: { fontFamily: fonts.extra, fontSize: 52, lineHeight: 60, letterSpacing: -1.5, color: colors.bordeaux },
  bigSub: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted, textAlign: 'center' },
  modify: { marginTop: 12, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 20, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  modifyText: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  action: { alignItems: 'center', gap: 6, flex: 1 },
  actionIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.prune },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.line },
  cardTitle: { fontFamily: fonts.extra, fontSize: 17, color: colors.prune },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  mood: { alignItems: 'center', gap: 6, flex: 1 },
  moodLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
  tile: { flex: 1, gap: 8, padding: 14 },
  tileIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.prune },
  tileValue: { fontFamily: fonts.extra, fontSize: 24, letterSpacing: -0.5, color: colors.prune },
  tileSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  tileAdd: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.bordeaux },
  follow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bordeaux, borderRadius: 24, padding: 16 },
  followIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.onBordeauxSurface, alignItems: 'center', justifyContent: 'center' },
  followTitle: { fontFamily: fonts.extra, fontSize: 16, color: colors.white },
  followSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.onBordeaux, marginTop: 2 },
});

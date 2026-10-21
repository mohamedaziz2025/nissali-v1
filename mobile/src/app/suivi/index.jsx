// Mise à jour Cycle · 6.1 bis — Suivre ma santé : Mon évolution (graphiques Semaine / Mois / 6 mois : humeur,
// poids, sommeil, symptômes), Mon cycle (frise, 3 chiffres, durée des cycles) et Conseils du jour.
// Remplace l'onglet « Évolution » de l'ancien Suivi santé. Ouvert par la carte « Suivre ma santé » et les
// tuiles Poids / Sommeil (directement sur la bonne section).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CycleBars, GoldCurve, moodSummary, MoodBars, MoodLine, NotEnough, PERIODS, RankBars, rangeDays, series, shortDay, SleepBars, SUFFIX, WeightDiff } from '../../components/HealthCharts';
import { hm } from '../../components/HealthEditSheets';
import Icon from '../../components/Icon';
import { Button, ErrorState, Gap, Loader, Row, Screen, Segmented, T, useToast } from '../../components/ui';
import { kg } from '../../components/Weight';
import { api } from '../../lib/api';
import { dayMonth } from '../../lib/format';
import { useHealthRange } from '../../lib/healthRange';
import { useApi } from '../../lib/useApi';
import { colors, fonts, SYMPTOMS, tnum } from '../../theme';

import { tr } from '../../lib/i18n';
const PHASES = [
  { key: 'menstruelle', label: tr("Règles"), color: colors.bordeaux },
  { key: 'folliculaire', label: tr("Folliculaire"), color: colors.roseFertile },
  { key: 'ovulatoire', label: tr("Fertile"), color: colors.creme, border: colors.or },
  { key: 'luteale', label: tr("Lutéale"), color: colors.sable },
];

function SectionHead({ title, onDetails }) {
  return (
    <Row justify="space-between">
      <Text style={s.sectionTitle}>{title}</Text>
      <Pressable onPress={onDetails} accessibilityRole="link" hitSlop={8}>
        <Text style={s.details}>{tr("Détails ›")}</Text>
      </Pressable>
    </Row>
  );
}

export default function FollowHealth() {
  const { section } = useLocalSearchParams();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState('semaine');
  const h = useHealthRange(period);
  const tips = useApi('/health-log/tips');
  const scrollRef = useRef(null);
  const offsets = useRef({});
  const [scrolled, setScrolled] = useState(false);

  const ready = !h.loading && h.cycle;
  useEffect(() => {
    if (!ready || scrolled || !section) return;
    const t = setTimeout(() => {
      const y = offsets.current[section];
      if (y != null) scrollRef.current?.scrollTo?.({ y: Math.max(0, y - 12), animated: true });
      setScrolled(true);
    }, 250);
    return () => clearTimeout(t);
  }, [ready, scrolled, section]);

  const right = (
    <Pressable onPress={() => router.push('/sante')} accessibilityRole="button" style={s.note}>
      <Text style={s.noteText}>{tr("Noter")}</Text>
    </Pressable>
  );
  if (h.loading) return <Screen back title={tr("Suivre ma santé")} right={right}><Loader /></Screen>;
  if (h.error) return <Screen back title={tr("Suivre ma santé")} right={right}><ErrorState error={h.error} onRetry={h.reload} /></Screen>;

  const c = h.cycle;
  const chartW = Math.min(width, 640) - 40 - 32;
  const days = rangeDays(h.today, period);
  const entry = (d) => h.byDay.get(d);
  const mark = (key, inEvo = true) => (e) => (offsets.current[key] = e.nativeEvent.layout.y + (inEvo ? offsets.current._evo || 0 : 0));

  // Humeur
  const moodCounts = {};
  for (const d of days) if (entry(d)?.mood) moodCounts[entry(d).mood] = (moodCounts[entry(d).mood] || 0) + 1;
  const moodValues = days.filter((d) => entry(d)?.mood).length;
  // Poids
  const weightPoints = series(days, (d) => entry(d)?.weight ?? null, period);
  const knownW = days.map((d) => entry(d)?.weight).filter((v) => v != null);
  const lastW = knownW.length ? knownW[knownW.length - 1] : null;
  const diffW = knownW.length >= 2 ? Math.round((knownW[knownW.length - 1] - knownW[0]) * 10) / 10 : null;
  // Sommeil
  const sleepPoints = series(days, (d) => entry(d)?.sleepHours ?? null, period);
  const knownS = days.map((d) => entry(d)?.sleepHours).filter((v) => v != null);
  const avgS = knownS.length ? knownS.reduce((a, b) => a + b, 0) / knownS.length : null;
  // Symptômes
  const symCounts = {};
  for (const d of days) for (const k of entry(d)?.symptoms || []) symCounts[k] = (symCounts[k] || 0) + 1;
  const topSymptoms = Object.entries(symCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => ({ key, count, label: SYMPTOMS[key] || key }));

  // Mon cycle
  const history = (c.history || []).filter((x) => !x.excluded).slice(0, 11).reverse();
  const lengths = history.map((x) => x.length);
  const currentDay = c.inPeriod?.day || c.next?.cycleDay || null;
  const bounds = c.phase?.bounds || c.frieze?.bounds;
  const cycleLength = c.frieze?.cycleLength || c.averages?.cycleLength;
  const exclude = async (periodId, value) => {
    await api.post(`/cycle/cycles/${periodId}/exclude`, { exclude: value }).catch((e) => toast(e.message, 'error'));
    h.reload();
  };

  const tip = c.healthTip;
  const weather = tips.data?.weather;

  return (
    <Screen back title={tr("Suivre ma santé")} right={right} onRefresh={h.reload} scrollRef={scrollRef}>
      <View style={s.card} onLayout={(e) => (offsets.current._evo = e.nativeEvent.layout.y)}>
        <Text style={s.cardTitle}>{tr("Mon évolution")}</Text>
        <Segmented items={PERIODS} value={period} onChange={setPeriod} />

        <View style={s.section} onLayout={mark('humeur')}>
          <SectionHead title={tr("HUMEUR")} onDetails={() => router.push('/suivi/humeur')} />
          {moodValues >= 3 ? (
            <>
              <Text style={s.summary}>{moodSummary(moodCounts)}</Text>
              {period === 'six' ? <MoodBars counts={moodCounts} /> : <MoodLine days={days} moodOf={(d) => entry(d)?.mood} inPeriod={h.inPeriod} width={chartW} keyName={period} />}
              {period !== 'six' ? (
                <Row gap={6}>
                  <View style={s.legendRose} />
                  <Text style={s.legend}>{tr("Jours de règles")}</Text>
                </Row>
              ) : null}
            </>
          ) : (
            <NotEnough what={tr("ton humeur")} />
          )}
        </View>

        <View style={s.section} onLayout={mark('poids')}>
          <SectionHead title={tr("POIDS")} onDetails={() => router.push('/suivi/poids')} />
          {knownW.length ? (
            <Row gap={8} align="flex-end">
              <Text style={[s.big, tnum]}>{kg(lastW)} {tr("kg")}</Text>
              <WeightDiff diff={diffW} suffix={SUFFIX[period]} />
            </Row>
          ) : null}
          {knownW.length >= 3 ? <GoldCurve points={weightPoints} width={chartW} keyName={period} /> : <NotEnough what={tr("ton poids")} />}
        </View>

        <View style={s.section} onLayout={mark('sommeil')}>
          <SectionHead title={tr("SOMMEIL")} onDetails={() => router.push('/suivi/sommeil')} />
          {avgS != null ? (
            <Row gap={8} align="flex-end">
              <Text style={[s.big, tnum]}>{hm(Math.round(avgS * 4) / 4).replace(' h ', ' h')}</Text>
              <Text style={s.unit}>{tr("en moyenne par nuit")}</Text>
            </Row>
          ) : null}
          {knownS.length >= 3 ? <SleepBars points={sleepPoints} width={chartW} keyName={period} /> : <NotEnough what={tr("ton sommeil")} />}
        </View>

        <View style={[s.section, { borderBottomWidth: 0, paddingBottom: 0 }]} onLayout={mark('symptomes')}>
          <SectionHead title={tr("SYMPTÔMES LES PLUS FRÉQUENTS")} onDetails={() => router.push('/suivi/symptomes')} />
          {topSymptoms.length ? <RankBars items={topSymptoms} /> : <T variant="small">{tr("Aucun symptôme noté sur cette période.")}</T>}
        </View>
      </View>
      <Gap />

      <View style={s.card} onLayout={mark('cycle', false)}>
        <Row justify="space-between">
          <Text style={s.cardTitle}>{tr("Mon cycle")}</Text>
          <Pressable onPress={() => router.push('/calendrier')} accessibilityRole="link" hitSlop={8}>
            <Text style={s.details}>{tr("Calendrier ›")}</Text>
          </Pressable>
        </Row>
        {bounds && cycleLength ? (
          <View>
            <View style={s.phaseBar}>
              {PHASES.filter((p) => bounds[p.key]).map((p) => {
                const [a, b] = bounds[p.key];
                return <View key={p.key} style={[s.phaseSeg, { flex: Math.max(1, b - a + 1), backgroundColor: p.color }, p.border && { borderWidth: 1.5, borderColor: p.border }, c.phase?.key === p.key && s.phaseOn]} />;
              })}
            </View>
            <Row style={{ marginTop: 6 }}>
              {PHASES.filter((p) => bounds[p.key]).map((p) => {
                const [a, b] = bounds[p.key];
                return (
                  <Text key={p.key} style={[s.phaseLabel, { flex: Math.max(1, b - a + 1) }, c.phase?.key === p.key && { color: colors.bordeaux, fontFamily: fonts.bold }]} numberOfLines={1}>{p.label}</Text>
                );
              })}
            </Row>
          </View>
        ) : null}
        <Row gap={8}>
          <View style={s.stat}>
            <Text style={[s.statValue, tnum]}>{c.averages?.cycleLength ? `${c.averages.cycleLength} j` : '—'}</Text>
            <Text style={s.statLabel}>{tr("cycle moyen")}</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statValue, tnum]}>{c.averages?.periodLength ? `${c.averages.periodLength} j` : '—'}</Text>
            <Text style={s.statLabel}>{tr("règles")}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue} numberOfLines={1}>{c.ovulation?.day ? shortDay(c.ovulation.day) : '—'}</Text>
            <Text style={s.statLabel}>{tr("ovulation")}</Text>
          </View>
        </Row>
        {lengths.length ? (
          <View style={{ gap: 6 }}>
            <Row justify="space-between">
              <Text style={s.sectionTitle}>{tr("DURÉE DE TES CYCLES")}</Text>
              <Text style={s.legend}>{lengths.length} {tr("dernier")}{lengths.length > 1 ? 's' : ''} {tr("cycle")}{lengths.length > 1 ? 's' : ''}</Text>
            </Row>
            <CycleBars lengths={lengths} current={currentDay} />
            <Row justify="space-between">
              <Text style={s.legend}>{shortDay(history[0].start).split(' ')[1]}</Text>
              <Text style={s.legend}>{tr("Entre")} {Math.min(...lengths)} {tr("et")} {Math.max(...lengths)} {tr("jours")}</Text>
              <Text style={[s.legend, { color: colors.bordeaux, fontFamily: fonts.bold }]}>{tr("en cours")}</Text>
            </Row>
          </View>
        ) : (
          <T variant="small">{tr("La durée de tes cycles apparaîtra après ton premier cycle complet.")}</T>
        )}
        {(c.alerts || []).map((a) => (
          <View key={a.key} style={s.alert}>
            <Text style={s.alertText}>{a.text}</Text>
          </View>
        ))}
        {(c.aberrantPending || []).map((x) => (
          <View key={x.periodId} style={[s.alert, { gap: 8 }]}>
            <Text style={s.alertText}>{tr("Le cycle du")} {dayMonth(x.start)} {tr("a duré")} {x.length} {tr("jours, ce qui est inhabituel (oubli de saisie ?). L’écarter des calculs ?")}</Text>
            <Row gap={8}>
              <Button title={tr("L’écarter")} small onPress={() => exclude(x.periodId, true)} style={{ flex: 1 }} />
              <Button title={tr("Le garder")} small variant="outline" onPress={() => exclude(x.periodId, false)} style={{ flex: 1 }} />
            </Row>
          </View>
        ))}
        <Pressable onPress={() => router.push('/suivi/cycles')} accessibilityRole="button" style={s.historyRow}>
          <Text style={s.historyText}>{tr("Historique de mes cycles")}</Text>
          <Icon name="chevronRight" size={16} color={colors.muted} />
        </Pressable>
      </View>
      <Gap />

      {tip || weather ? (
        <View style={s.card}>
          <Row gap={8}>
            <View style={s.tipIcon}>
              <Icon name="bulb" size={16} color={colors.or} />
            </View>
            <Text style={s.tipLabel}>{tr("CONSEILS DU JOUR")}{c.phase ? ` · ${c.phase.label.toUpperCase()}` : ''}</Text>
          </Row>
          {weather ? (
            <Text style={s.legend}>
              {tr("Météo :")} {Math.round(weather.min)}° / {Math.round(weather.max)}{tr("° · UV")} {Math.round(weather.uv ?? 0)}{weather.aqi != null ? tr(" · qualité de l’air {0}", [weather.aqi]) : ''}
            </Text>
          ) : null}
          {tip ? (
            <>
              <Text style={s.tipTitle}>{tip.title}</Text>
              <T style={{ lineHeight: 21 }}>{tip.text}</T>
              {tip.article?.slug ? (
                <Pressable onPress={() => router.push(`/blog/${tip.article.slug}`)} accessibilityRole="link" hitSlop={6}>
                  <Text style={s.details}>{tr("Lire l’article")}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            (tips.data?.tips || []).slice(0, 2).map((t, i) => <T key={i}>{t.text}</T>)
          )}
        </View>
      ) : null}
      <Gap h={8} />
    </Screen>
  );
}

const s = StyleSheet.create({
  note: { backgroundColor: colors.bordeaux, borderRadius: 999, paddingHorizontal: 16, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  noteText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 14, borderWidth: 1, borderColor: colors.line },
  cardTitle: { fontFamily: fonts.extra, fontSize: 17, color: colors.prune },
  section: { gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1, color: colors.bordeaux },
  details: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux },
  summary: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  big: { fontFamily: fonts.extra, fontSize: 24, letterSpacing: -0.5, color: colors.bordeaux },
  unit: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginBottom: 4 },
  diff: { fontFamily: fonts.bold, fontSize: 12, marginBottom: 4 },
  legend: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  legendRose: { width: 12, height: 10, borderRadius: 3, backgroundColor: colors.blush },
  phaseBar: { flexDirection: 'row', gap: 3, height: 10 },
  phaseSeg: { height: 10, borderRadius: 5 },
  phaseOn: { height: 12, marginTop: -1 },
  phaseLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  stat: { flex: 1, backgroundColor: colors.creme, borderRadius: 14, padding: 10, gap: 2 },
  statValue: { fontFamily: fonts.extra, fontSize: 17, color: colors.prune },
  statLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  alert: { backgroundColor: colors.blush, borderRadius: 14, padding: 12 },
  alertText: { fontFamily: fonts.medium, fontSize: 13, color: colors.prune },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  historyText: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
  tipIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.sable, alignItems: 'center', justifyContent: 'center' },
  tipLabel: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.8, color: colors.orText },
  tipTitle: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
});

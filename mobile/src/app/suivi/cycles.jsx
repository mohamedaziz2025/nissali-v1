// Mise à jour Cycle · 6.6 — Mes cycles : cycle moyen et durée moyenne des règles sur les 6 derniers cycles,
// régularité (≤ 2 jours : réguliers ; 3 à 7 : un peu irréguliers ; > 7 : irréguliers, avec le conseil d'en
// parler à un professionnel de santé, sans diagnostic), historique (règles en bordeaux, ovulation estimée en or).
import { StyleSheet, Text, View } from 'react-native';
import { shortDay } from '../../components/HealthCharts';
import Icon from '../../components/Icon';
import { Button, ErrorState, Gap, Loader, Row, Screen, T } from '../../components/ui';
import { diffDays } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, fonts, tnum } from '../../theme';

import { tr } from '../../lib/i18n';
const LUTEAL = 14;

function regularity(lengths) {
  if (lengths.length < 2) return null;
  const spread = Math.max(...lengths) - Math.min(...lengths);
  if (spread <= 2) return { title: tr("Cycles réguliers"), text: tr("Écart de {0} sur tes {1} derniers cycles.", [(spread <= 1 ? tr("moins de 2 jours") : tr("2 jours")), lengths.length]), tone: 'ok' };
  if (spread <= 7) return { title: tr("Un peu irréguliers"), text: tr("Écart de {0} jours sur tes {1} derniers cycles : c’est courant.", [spread, lengths.length]), tone: 'mid' };
  return { title: tr("Irréguliers"), text: tr("Écart de {0} jours sur tes {1} derniers cycles. Tu peux en parler à un professionnel de santé si cela t’inquiète.", [spread, lengths.length]), tone: 'warn' };
}

function CycleRow({ title, dates, length, periodLength, ovulation, current, last }) {
  const total = Math.max(length, 1);
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Row justify="space-between">
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowDates}>{dates}</Text>
      </Row>
      <View style={s.track}>
        {current ? (
          <View style={[s.period, s.currentPeriod, { width: `${Math.min(100, (Math.max(1, periodLength) / total) * 100)}%` }]} />
        ) : (
          <View style={[s.period, { width: `${Math.min(100, (periodLength / total) * 100)}%` }]} />
        )}
        {ovulation != null && !current ? <View style={[s.ovulation, { left: `${(ovulation / total) * 100}%` }]} /> : null}
      </View>
      {!current && periodLength ? (
        <Row gap={5}>
          <Icon name="drop" size={11} color={colors.bordeaux} />
          <Text style={s.rowSub}>{tr("Règles :")} {periodLength} {tr("jour")}{periodLength > 1 ? 's' : ''}</Text>
        </Row>
      ) : null}
    </View>
  );
}

export default function MyCycles() {
  const { data, loading, error, reload } = useApi('/cycle');
  if (loading && !data) return <Screen back title={tr("Mes cycles")}><Loader /></Screen>;
  if (error && !data) return <Screen back title={tr("Mes cycles")}><ErrorState error={error} onRetry={reload} /></Screen>;

  const done = (data.history || []).filter((c) => !c.excluded);
  const last6 = done.slice(0, 6);
  const avg = (k) => (last6.length ? Math.round(last6.reduce((a, c) => a + (c[k] || 0), 0) / last6.filter((c) => c[k]).length || 0) : null);
  const cycleAvg = avg('length') || data.averages?.cycleLength;
  const periodAvg = avg('periodLength') || data.averages?.periodLength;
  const reg = regularity(last6.map((c) => c.length));
  const current = (data.periods || []).find((p) => p.kind !== 'nifas');
  const currentDay = current ? diffDays(data.today, current.start) + 1 : null;

  return (
    <Screen back title={tr("Mes cycles")} onRefresh={reload}>
      <Row gap={10} align="stretch">
        <View style={[s.stat, { backgroundColor: colors.bordeaux }]}>
          <Text style={[s.statLabel, { color: colors.onBordeaux }]}>{tr("Cycle moyen")}</Text>
          <Text style={[s.statValue, { color: colors.white }, tnum]}>{cycleAvg ? `${cycleAvg} jours` : '—'}</Text>
        </View>
        <View style={[s.stat, { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }]}>
          <Text style={s.statLabel}>{tr("Règles en moyenne")}</Text>
          <Text style={[s.statValue, tnum]}>{periodAvg ? `${periodAvg} jours` : '—'}</Text>
        </View>
      </Row>
      <Gap h={12} />
      {reg ? (
        <View style={s.reg}>
          <View style={[s.regIcon, reg.tone === 'warn' && { backgroundColor: colors.blush }, reg.tone === 'mid' && { backgroundColor: colors.sable }]}>
            <Icon name={reg.tone === 'ok' ? 'check' : 'info'} size={16} color={reg.tone === 'ok' ? colors.success : reg.tone === 'mid' ? colors.orText : colors.bordeaux} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.regTitle}>{reg.title}</Text>
            <Text style={s.regText}>{reg.text}</Text>
          </View>
        </View>
      ) : null}
      <Gap h={18} />
      <Row justify="space-between">
        <Text style={s.h2}>{tr("Historique")}</Text>
        <Row gap={10}>
          <Row gap={4}><View style={[s.legendDot, { backgroundColor: colors.bordeaux }]} /><Text style={s.legend}>{tr("Règles")}</Text></Row>
          <Row gap={4}><View style={[s.legendDot, { backgroundColor: colors.or }]} /><Text style={s.legend}>{tr("Ovulation")}</Text></Row>
        </Row>
      </Row>
      <Gap h={8} />
      <View style={s.list}>
        {current ? (
          <CycleRow title={tr("Cycle en cours")} dates={`depuis le ${shortDay(current.start)} · Jour ${currentDay}`} length={cycleAvg || 28} periodLength={current.end ? diffDays(current.end, current.start) + 1 : currentDay} current last={!done.length} />
        ) : null}
        {done.map((c, i) => (
          <CycleRow
            key={c.start}
            title={`${c.length} jours`}
            dates={`${shortDay(c.start)} – ${shortDay(c.end)}`}
            length={c.length}
            periodLength={c.periodLength || 0}
            ovulation={c.length > LUTEAL ? c.length - LUTEAL : null}
            last={i === done.length - 1}
          />
        ))}
        {!current && !done.length ? <T variant="small" style={{ paddingVertical: 14 }}>{tr("Ton historique apparaîtra après tes premières règles notées.")}</T> : null}
      </View>
      <Gap h={14} />
      <Button title={tr("Exporter en PDF pour un rendez-vous · bientôt")} variant="outline" disabled onPress={() => {}} />
      <Gap h={8} />
    </Screen>
  );
}

const s = StyleSheet.create({
  stat: { flex: 1, borderRadius: 20, padding: 14, gap: 4 },
  statLabel: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.muted },
  statValue: { fontFamily: fonts.extra, fontSize: 24, letterSpacing: -0.6, color: colors.prune },
  reg: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.white, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.line },
  regIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#E4F1E8', alignItems: 'center', justifyContent: 'center' },
  regTitle: { fontFamily: fonts.extra, fontSize: 14.5, color: colors.prune },
  regText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  h2: { fontFamily: fonts.extra, fontSize: 17, color: colors.prune },
  legend: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  list: { backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line },
  row: { gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowTitle: { fontFamily: fonts.extra, fontSize: 14, color: colors.prune },
  rowDates: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  rowSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'visible' },
  period: { position: 'absolute', left: 0, top: 0, height: 8, borderRadius: 4, backgroundColor: colors.bordeaux },
  currentPeriod: { borderWidth: 1, borderColor: colors.bordeaux },
  ovulation: { position: 'absolute', top: -2, width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: colors.or },
});

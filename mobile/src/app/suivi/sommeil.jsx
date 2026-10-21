// Mise à jour Cycle · 6.9 — Sommeil : moyenne par nuit + nombre de nuits à 8 h ou plus, barres, ligne 8 h,
// « Mes nuits » ; feuille − / + par 15 min (0 à 16 h). Nuit = date du réveil.
import { useState } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { NotEnough, rangeDays, series, SleepBars } from '../../components/HealthCharts';
import { detailStyles as d, HealthDetailScreen, LastDays, SummaryCard } from '../../components/HealthDetail';
import { hm, SleepSheet } from '../../components/HealthEditSheets';
import { Row } from '../../components/ui';
import { useHealthRange } from '../../lib/healthRange';
import { colors, fonts, tnum } from '../../theme';

import { tr } from '../../lib/i18n';
const LABELS = { semaine: tr("Moyenne par nuit cette semaine"), mois: tr("Moyenne par nuit ce mois-ci"), six: tr("Moyenne par nuit sur 6 mois") };

export default function SleepDetail() {
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState('semaine');
  const [edit, setEdit] = useState(null);
  const h = useHealthRange(period);
  const days = h.today ? rangeDays(h.today, period) : [];
  const v = (day) => h.byDay.get(day)?.sleepHours ?? null;
  const known = days.map(v).filter((x) => x != null);
  const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
  const good = known.filter((x) => x >= 8).length;

  return (
    <HealthDetailScreen title={tr("Sommeil")} onAdd={() => setEdit(h.today)} period={period} onPeriod={setPeriod} loading={h.loading} error={h.error} onRetry={h.reload} onRefresh={h.reload}>
      <SummaryCard>
        <Text style={d.label}>{LABELS[period]}</Text>
        <Row gap={8} align="flex-end">
          <Text style={[d.big, tnum]}>{avg != null ? hm(Math.round(avg * 4) / 4).replace(' h ', ' h') : '—'}</Text>
          {known.length ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.prune, marginBottom: 6 }}>{good} {tr("nuit")}{good > 1 ? 's' : ''} {tr("à 8 h ou plus")}</Text> : null}
        </Row>
        {known.length >= 3 ? <SleepBars points={series(days, v, period)} width={Math.min(width, 640) - 40 - 32} keyName={period} /> : <NotEnough what={tr("ton sommeil")} />}
      </SummaryCard>
      {h.today ? (
        <LastDays title={tr("Mes nuits")} today={h.today} onPress={setEdit} render={(day) => <Text style={v(day) != null ? [d.value, tnum] : d.empty}>{v(day) != null ? hm(v(day)).replace(' h ', ' h') : tr("Ajouter")}</Text>} />
      ) : null}
      <SleepSheet visible={Boolean(edit)} day={edit} value={edit ? v(edit) : null} onClose={() => setEdit(null)} onSaved={h.reload} />
    </HealthDetailScreen>
  );
}

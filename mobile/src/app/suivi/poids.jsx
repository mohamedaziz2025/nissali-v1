// Mise à jour Cycle · 6.8 — Poids : dernière pesée + écart sur la période (vert si baisse ou stable, gris
// sinon), courbe avec points (semaine), « Mes pesées » ; feuille − / + par 0,1 kg, Supprimer, et « Tu
// confirmes ? » si l'écart avec la pesée précédente dépasse 5 kg.
import { useState } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { GoldCurve, NotEnough, rangeDays, series, SUFFIX, WeightDiff } from '../../components/HealthCharts';
import { detailStyles as d, HealthDetailScreen, LastDays, SummaryCard } from '../../components/HealthDetail';
import { Row } from '../../components/ui';
import { kg, WeightSheet } from '../../components/Weight';
import { useHealthRange } from '../../lib/healthRange';
import { tnum } from '../../theme';

import { tr } from '../../lib/i18n';
export default function WeightDetail() {
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState('semaine');
  const [edit, setEdit] = useState(null); // jour
  const h = useHealthRange(period);
  const days = h.today ? rangeDays(h.today, period) : [];
  const w = (day) => h.byDay.get(day)?.weight ?? null;
  const known = days.map(w).filter((v) => v != null);
  const last = known.length ? known[known.length - 1] : null;
  const diff = known.length >= 2 ? Math.round((known[known.length - 1] - known[0]) * 10) / 10 : null;
  // Pesée précédente (pour l'écart de plus de 5 kg) : la dernière connue avant le jour modifié.
  const previousOf = (day) => {
    const before = h.items.filter((e) => e.day < day && e.weight != null);
    return before.length ? before[before.length - 1].weight : null;
  };

  return (
    <HealthDetailScreen title={tr("Poids")} onAdd={() => setEdit(h.today)} period={period} onPeriod={setPeriod} loading={h.loading} error={h.error} onRetry={h.reload} onRefresh={h.reload}>
      <SummaryCard>
        <Text style={d.label}>{tr("Dernière pesée")}</Text>
        <Row gap={8} align="flex-end">
          <Text style={[d.big, tnum]}>{last != null ? `${kg(last)} kg` : '—'}</Text>
          <WeightDiff diff={diff} suffix={SUFFIX[period]} />
        </Row>
        {known.length >= 3 ? <GoldCurve points={series(days, w, period)} width={Math.min(width, 640) - 40 - 32} keyName={period} /> : <NotEnough what={tr("ton poids")} />}
      </SummaryCard>
      {h.today ? (
        <LastDays
          title={tr("Mes pesées")}
          today={h.today}
          onPress={setEdit}
          render={(day) => <Text style={w(day) != null ? [d.value, tnum] : d.empty}>{w(day) != null ? `${kg(w(day))} kg` : tr("Ajouter")}</Text>}
        />
      ) : null}
      <WeightSheet
        visible={Boolean(edit)}
        day={edit}
        entry={edit && w(edit) != null ? { day: edit, weight: w(edit) } : null}
        lastWeight={edit ? previousOf(edit) : null}
        onClose={() => setEdit(null)}
        onSaved={h.reload}
      />
    </HealthDetailScreen>
  );
}

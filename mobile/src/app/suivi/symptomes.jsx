// Mise à jour Cycle · 6.11 — Symptômes : liste des symptômes de la période avec le nombre de fois ; toucher un
// symptôme déplie les dates (toucher une date la modifie). « + » : « Mes symptômes aujourd'hui ». Encart
// d'analyse (lien avec la phase du cycle) seulement à partir de 3 cycles de données ; jamais de diagnostic.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rangeDays, shortDay } from '../../components/HealthCharts';
import { HealthDetailScreen, SummaryCard } from '../../components/HealthDetail';
import { SymptomsSheet } from '../../components/HealthEditSheets';
import { T } from '../../components/ui';
import { diffDays } from '../../lib/format';
import { useHealthRange } from '../../lib/healthRange';
import { colors, fonts, SYMPTOMS } from '../../theme';

import { tr } from '../../lib/i18n';
/** Phrase prudente : un symptôme qui revient surtout dans les jours qui précèdent les règles, ou pendant. */
function analysis(items, periods) {
  const starts = periods.filter((p) => p.kind !== 'nifas').map((p) => p.start).sort();
  if (starts.length < 3) return null;
  const firstLog = items.find((e) => e.symptoms?.length)?.day;
  if (!firstLog || starts.filter((s) => s >= firstLog).length < 3) return null;
  const counts = {};
  for (const e of items) {
    for (const k of e.symptoms || []) {
      const next = starts.find((s) => s > e.day);
      const inPeriod = periods.some((p) => p.kind !== 'nifas' && e.day >= p.start && e.day <= (p.end || e.day));
      const c = (counts[k] = counts[k] || { total: 0, before: 0, during: 0 });
      c.total += 1;
      if (inPeriod) c.during += 1;
      else if (next && diffDays(next, e.day) <= 5) c.before += 1;
    }
  }
  const top = Object.entries(counts)
    .filter(([, c]) => c.total >= 4)
    .sort((a, b) => b[1].total - a[1].total)[0];
  if (!top) return null;
  const [key, c] = top;
  const name = (SYMPTOMS[key] || key).toLowerCase();
  if (c.before / c.total >= 0.6) return tr("Les symptômes semblent liés à ton cycle : sur 6 mois, « {0} » revient surtout les jours avant tes règles.", [name]);
  if (c.during / c.total >= 0.6) return tr("Les symptômes semblent liés à ton cycle : sur 6 mois, « {0} » revient surtout pendant tes règles.", [name]);
  return null;
}

export default function SymptomsDetail() {
  const [period, setPeriod] = useState('mois');
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const h = useHealthRange(period);
  const six = useHealthRange('six');
  const days = h.today ? rangeDays(h.today, period) : [];
  const byKey = {};
  for (const day of [...days].reverse()) for (const k of h.byDay.get(day)?.symptoms || []) (byKey[k] = byKey[k] || []).push(day);
  const list = Object.entries(byKey).sort((a, b) => b[1].length - a[1].length);
  const max = Math.max(1, ...list.map(([, ds]) => ds.length));
  const note = six.cycle ? analysis(six.items, six.cycle.periods || []) : null;

  return (
    <HealthDetailScreen title={tr("Symptômes")} onAdd={() => setEdit(h.today)} period={period} onPeriod={setPeriod} loading={h.loading} error={h.error} onRetry={h.reload} onRefresh={() => { h.reload(); six.reload(); }}>
      <T variant="small" style={{ marginBottom: 8 }}>{tr("Touche un symptôme pour voir les jours.")}</T>
      <SummaryCard>
        {list.length ? (
          list.map(([k, ds], i) => (
            <View key={k} style={[s.item, i === list.length - 1 && { borderBottomWidth: 0 }]}>
              <Pressable onPress={() => setOpen(open === k ? null : k)} accessibilityRole="button" accessibilityState={{ expanded: open === k }} style={s.itemHead}>
                <Text style={s.name} numberOfLines={1}>{SYMPTOMS[k] || k}</Text>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${(ds.length / max) * 100}%` }]} />
                </View>
                <Text style={s.count}>{ds.length} {tr("fois")}</Text>
              </Pressable>
              {open === k ? (
                <View style={s.dates}>
                  {ds.map((day) => (
                    <Pressable key={day} onPress={() => setEdit(day)} accessibilityRole="button" accessibilityLabel={tr("{0}, modifier", [shortDay(day)])} style={s.date}>
                      <Text style={s.dateText}>{shortDay(day)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <T variant="small">{tr("Aucun symptôme noté sur cette période.")}</T>
        )}
      </SummaryCard>
      {note ? (
        <View style={s.note}>
          <Text style={s.noteText}>{note}</Text>
          <Text style={[s.noteText, { color: colors.muted, marginTop: 4, fontSize: 11.5 }]}>{tr("Simple observation de tes notes, pas un diagnostic.")}</Text>
        </View>
      ) : null}
      <SymptomsSheet visible={Boolean(edit)} day={edit} value={edit ? h.byDay.get(edit)?.symptoms || six.byDay.get(edit)?.symptoms || [] : []} onClose={() => setEdit(null)} onSaved={() => { h.reload(); six.reload(); }} />
    </HealthDetailScreen>
  );
}

const s = StyleSheet.create({
  item: { gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.prune },
  track: { width: '34%', height: 6, borderRadius: 3, backgroundColor: colors.line },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.or },
  count: { width: 46, textAlign: 'right', fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  date: { backgroundColor: colors.creme, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  dateText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.prune },
  note: { backgroundColor: colors.sable, borderRadius: 18, padding: 14, marginTop: 14 },
  noteText: { fontFamily: fonts.medium, fontSize: 13, color: colors.prune },
});

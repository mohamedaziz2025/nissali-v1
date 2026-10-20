// 5.4 — Page « Mes règles » (maquette V3, page 9) : dates de début et de fin modifiables d'un toucher,
// flux jour par jour, prochaines règles et ovulation avec l'indice de fiabilité, historique des cycles et moyenne,
// « Ajouter des règles passées ». Toute modification recalcule les prédictions (RG-13 bis).
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { DatePickerSheet } from '../components/Calendar';
import { DateField } from '../components/forms';
import Icon from '../components/Icon';
import { usePeriodActions } from '../components/PeriodSheets';
import { Button, Card, ErrorState, Gap, Loader, Row, Screen, Sheet, T, useToast } from '../components/ui';
import { api, sendOrQueue } from '../lib/api';
import { addDays, dayMonth, toDay } from '../lib/format';
import { useApi } from '../lib/useApi';
import { colors, fonts } from '../theme';

const LEVELS = [
  { key: 'traces', label: 'Traces', drops: 0 },
  { key: 'leger', label: 'Léger', drops: 1 },
  { key: 'moyen', label: 'Moyen', drops: 2 },
  { key: 'abondant', label: 'Abond.', drops: 3 },
];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const short = (day) => `${Number(day.slice(8))} ${MONTHS_SHORT[Number(day.slice(5, 7)) - 1]}`;
const RELIABILITY = { eleve: 'Fiabilité élevée', moyen: 'Fiabilité moyenne', faible: 'Fiabilité faible' };

function DateTile({ label, value, onPress, placeholder }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} : ${value ? dayMonth(value) : placeholder}. Modifier`} style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Row justify="space-between">
        <Text style={s.tileValue}>{value ? short(value) : placeholder}</Text>
        <Icon name="edit" size={16} color={colors.bordeaux} />
      </Row>
    </Pressable>
  );
}

export default function MyPeriods() {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { data, loading, error, reload } = useApi('/cycle');
  const { openStart, openEnd, sheets } = usePeriodActions(reload);
  const [editing, setEditing] = useState(null); // { field: 'start'|'end', period }
  const [flowDay, setFlowDay] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [past, setPast] = useState({ start: null, end: null });
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Screen back title="Mes règles"><Loader /></Screen>;
  if (error && !data) return <Screen back title="Mes règles"><ErrorState error={error} onRetry={reload} /></Screen>;

  const period = data.periods.find((p) => p.kind !== 'nifas');
  const flows = new Map((period?.flows || []).map((f) => [f.day, f.level]));
  const lastDay = period ? period.end || data.today : null;
  const days = [];
  if (period) for (let d = period.start; d <= lastDay && days.length < 12; d = addDays(d, 1)) days.push(d);

  const saveDate = async (value) => {
    const { field, period: p } = editing;
    setEditing(null);
    try {
      await api.patch(`/cycle/periods/${p.id}`, { [field]: value });
      toast('Dates mises à jour, prédictions recalculées');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const saveFlow = async (level) => {
    const d = flowDay;
    setFlowDay(null);
    try {
      await sendOrQueue('PUT', '/cycle/flow', { day: d, level });
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const addPast = async () => {
    setBusy(true);
    try {
      await api.post('/cycle/periods/past', { periods: [{ start: past.start, end: past.end }] });
      toast('Règles ajoutées, prédictions recalculées');
      setPastOpen(false);
      setPast({ start: null, end: null });
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const next = data.next;
  const cycles = data.history.filter((c) => !c.excluded).slice(0, 8);

  return (
    <Screen back title="Mes règles" subtitle="Touche une date pour la modifier" onRefresh={reload}>
      {period ? (
        <Card tone="soft" style={{ gap: 14 }}>
          <Text style={s.cardTitle}>{data.inPeriod ? 'Règles en cours' : 'Dernières règles'}</Text>
          <Row gap={10}>
            <DateTile label="Début" value={period.start} onPress={() => setEditing({ field: 'start', period })} />
            <DateTile label="Fin" value={period.end} placeholder="En cours" onPress={() => (period.end ? setEditing({ field: 'end', period }) : openEnd(period.id, 'hayd', period.start))} />
          </Row>
          <Text style={s.subTitle}>Flux par jour</Text>
          <View style={s.flowRow}>
            {days.map((d) => {
              const level = LEVELS.find((l) => l.key === flows.get(d));
              return (
                <Pressable key={d} onPress={() => setFlowDay(d)} accessibilityRole="button" accessibilityLabel={`${dayMonth(d)} : ${level?.label || 'flux non noté'}. Modifier`} style={s.flowDay}>
                  <Text style={s.flowDate}>{short(d)}</Text>
                  <Text style={s.drops}>{level ? (level.drops ? '💧'.repeat(level.drops) : '·') : '+'}</Text>
                  <Text style={[s.flowLevel, !level && { color: colors.muted }]}>{level?.label || 'Noter'}</Text>
                </Pressable>
              );
            })}
          </View>
          {data.inPeriod ? <Button title="Mes règles sont terminées" small onPress={() => openEnd(period.id, 'hayd', period.start)} /> : null}
        </Card>
      ) : (
        <Card tone="soft" style={{ gap: 10 }}>
          <T variant="h3">Aucune règle enregistrée</T>
          <T variant="small">Note tes dernières règles pour démarrer les prédictions.</T>
          <Button title="Mes règles ont commencé" small onPress={openStart} />
        </Card>
      )}
      <Gap />

      {next && !data.noPrediction ? (
        <Card style={{ gap: 4 }}>
          <Row justify="space-between">
            <Text style={s.cardTitle}>Prochaines règles prévues</Text>
            <Text style={[s.reliability, data.reliability.key === 'faible' && { color: colors.muted }]}>{RELIABILITY[data.reliability.key] || data.reliability.label}</Text>
          </Row>
          <T variant="h2" style={{ fontSize: 24 }}>
            {next.rangeStart ? `Entre le ${dayMonth(next.rangeStart)} et le ${dayMonth(next.rangeEnd)}` : `Vers le ${dayMonth(next.date)}`}
          </T>
          {data.ovulation?.day ? <T variant="small">Ovulation estimée le {dayMonth(data.ovulation.day)} · fenêtre fertile du {dayMonth(data.ovulation.fertileStart)} au {dayMonth(data.ovulation.fertileEnd)}</T> : null}
          {data.isDefault ? <T variant="small" color={colors.bordeaux}>Tes prédictions s’affineront au fil des cycles.</T> : null}
        </Card>
      ) : null}
      <Gap />

      <Card style={{ gap: 2 }}>
        <Row justify="space-between" style={{ marginBottom: 6 }}>
          <Text style={s.cardTitle}>Mes cycles précédents</Text>
          <Text style={s.reliability}>Moyenne {data.averages.cycleLength} j</Text>
        </Row>
        {cycles.length ? (
          cycles.map((c) => (
            <Row key={c.start} justify="space-between" style={s.cycleRow}>
              <T style={{ flex: 1 }}>
                {short(c.start)} → {short(c.end)}
              </T>
              <T variant="small" style={{ marginRight: 14 }}>{c.periodLength ? `règles ${c.periodLength} j` : ''}</T>
              <Text style={[s.cycleLen, c.aberrant && { color: colors.muted }]}>{c.length} j</Text>
            </Row>
          ))
        ) : (
          <T variant="small">Tes cycles apparaîtront ici dès deux règles enregistrées. Ajoute tes règles passées pour des prédictions plus précises.</T>
        )}
        {data.averages.irregular ? <T variant="small" style={{ marginTop: 8 }}>Cycles irréguliers (écart de {data.averages.spread} jours) : la date est donnée sous forme de période.</T> : null}
      </Card>
      <Gap />
      <Pressable onPress={() => setPastOpen(true)} accessibilityRole="button" style={s.addPast}>
        <Icon name="plus" size={18} color={colors.bordeaux} />
        <Text style={s.addPastText}>Ajouter des règles passées</Text>
      </Pressable>
      <Gap h={24} />

      {editing ? (
        <DatePickerSheet
          visible
          onClose={() => setEditing(null)}
          onPick={saveDate}
          value={editing.period[editing.field]}
          maxDay={data.today}
          minDay={editing.field === 'end' ? editing.period.start : undefined}
          title={editing.field === 'start' ? 'Début des règles' : 'Fin des règles'}
          width={width - 40}
        />
      ) : null}

      <Sheet visible={Boolean(flowDay)} onClose={() => setFlowDay(null)} title={flowDay ? `Flux du ${dayMonth(flowDay)}` : ''}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {LEVELS.map((l) => (
            <Pressable key={l.key} onPress={() => saveFlow(l.key)} accessibilityRole="button" style={[s.levelBtn, flows.get(flowDay) === l.key && s.levelOn]}>
              <Text style={{ fontSize: 18 }}>{l.drops ? '💧'.repeat(l.drops) : '·'}</Text>
              <Text style={[s.levelText, flows.get(flowDay) === l.key && { color: colors.white }]}>{l.key === 'abondant' ? 'Abondant' : l.label}</Text>
            </Pressable>
          ))}
        </Row>
        <T variant="small">Les traces seules ne marquent pas le début d’un cycle.</T>
      </Sheet>

      <Sheet visible={pastOpen} onClose={() => setPastOpen(false)} title="Ajouter des règles passées" footer={<Button title="Ajouter" onPress={addPast} loading={busy} disabled={!past.start || !past.end || past.end < past.start} />}>
        <T variant="small">Ajoute au moins tes 3 derniers cycles pour des prédictions plus précises dès maintenant.</T>
        <DateField label="Premier jour" value={past.start} onChange={(v) => setPast((p) => ({ ...p, start: v, end: p.end && p.end < v ? null : p.end }))} maxDay={toDay(new Date())} />
        <DateField label="Dernier jour" value={past.end} onChange={(v) => setPast((p) => ({ ...p, end: v }))} minDay={past.start || undefined} maxDay={toDay(new Date())} />
      </Sheet>
      {sheets}
    </Screen>
  );
}

const s = StyleSheet.create({
  cardTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
  subTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.prune },
  tile: { flex: 1, backgroundColor: colors.white, borderRadius: 18, padding: 14, gap: 4 },
  tileLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
  tileValue: { fontFamily: fonts.title, fontSize: 22, color: colors.prune },
  flowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flowDay: { width: 58, alignItems: 'center', gap: 3, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.white },
  flowDate: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
  drops: { fontSize: 11, minHeight: 16 },
  flowLevel: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.bordeaux },
  reliability: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux },
  cycleRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  cycleLen: { fontFamily: fonts.title, fontSize: 18, color: colors.prune, minWidth: 40, textAlign: 'right' },
  addPast: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 999, borderWidth: 1.5, borderColor: colors.bordeaux },
  addPastText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.bordeaux },
  levelBtn: { flex: 1, minWidth: 70, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.blush },
  levelOn: { backgroundColor: colors.bordeaux },
  levelText: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux },
});

// 5.4 — Onglet Cycle : prochaines règles (dans X jours), calendrier, phase, ovulation,
// rendez-vous entourés, historique des cycles (maquette du cahier, page 8).
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { CalendarGrid, Legend, MonthNav } from '../../components/Calendar';
import { DateField, TimeField } from '../../components/forms';
import Icon from '../../components/Icon';
import { usePeriodActions } from '../../components/PeriodSheets';
import { Button, Card, Chips, ErrorState, Field, Gap, Label, ListItem, Loader, Notice, OfflineBanner, Ring, Row, Screen, Sheet, T, useToast } from '../../components/ui';
import { api, sendOrQueue } from '../../lib/api';
import { addDays, dayMonth, longDate, shortDate, toDay } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, FLOWS } from '../../theme';

const PHASE_COLORS = { menstruelle: colors.bordeaux, folliculaire: colors.blush, ovulatoire: colors.rose, luteale: colors.orSoft };
const PHASE_KEYS = ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale'];
const PHASE_SHORT = { menstruelle: 'Règles', folliculaire: 'Folliculaire', ovulatoire: 'Ovulation', luteale: 'Lutéale' };

function NextPeriodCard({ data, onStart, onEnd }) {
  if (data.inPeriod) {
    return (
      <Card tone="hero" style={{ gap: 6 }}>
        <Label color={colors.rose}>Règles en cours</Label>
        <T variant="hero">Jour {data.inPeriod.day}</T>
        <T color={colors.white}>Commencées le {dayMonth(data.inPeriod.start)}</T>
        <Button title="Mes règles sont terminées" variant="light" small onPress={() => onEnd(data.inPeriod.id)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      </Card>
    );
  }
  if (!data.next) {
    return (
      <Card tone="hero" style={{ gap: 8 }}>
        <Label color={colors.rose}>Prochaines règles</Label>
        <T variant="h2" color={colors.white}>{data.noPrediction ? 'Retour des règles imprévisible' : 'Pas encore de prédiction'}</T>
        <Button title="Mes règles ont commencé" variant="light" small icon="drop" onPress={onStart} style={{ alignSelf: 'flex-start' }} />
      </Card>
    );
  }
  const n = data.next;
  const late = n.lateDays > 0;
  return (
    <Card tone="hero" style={{ gap: 4 }}>
      <Row justify="space-between">
        <View style={{ flex: 1, gap: 4 }}>
          <Label color={colors.rose}>Prochaines règles</Label>
          <T variant="hero" fit>
            {late ? `${n.lateDays} j de retard` : n.daysUntil === 0 ? 'Aujourd’hui' : `Dans ${n.daysUntil} jour${n.daysUntil > 1 ? 's' : ''}`}
          </T>
          <T color={colors.white}>{n.rangeStart ? `Entre le ${dayMonth(n.rangeStart)} et le ${dayMonth(n.rangeEnd)}` : `Prévues le ${longDate(n.date).toLowerCase()}`}</T>
          <T variant="small" color={colors.rose}>Jour {n.cycleDay} sur {n.cycleLength} · fiabilité {data.reliability.label}</T>
        </View>
        <Ring progress={Math.min(1, n.cycleDay / n.cycleLength)} size={80}>
          <T variant="h3" color={colors.white}>{Math.max(0, n.daysUntil)}</T>
          <T variant="small" color={colors.rose}>jours</T>
        </Ring>
      </Row>
      <Button title="Mes règles ont commencé" variant="light" small icon="drop" onPress={onStart} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
    </Card>
  );
}

function PhaseCard({ phase, cycleDay, cycleLength }) {
  if (!phase) return null;
  const b = phase.bounds;
  const total = cycleLength || b.luteale[1];
  return (
    <Card style={{ gap: 10 }}>
      <Label>{phase.label}</Label>
      <T>{phase.what}</T>
      <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 4 }}>
        {PHASE_KEYS.filter((k) => b[k]).map((k) => {
          const len = Math.max(0, b[k][1] - b[k][0] + 1);
          return <View key={k} style={{ flex: len, backgroundColor: PHASE_COLORS[k], opacity: phase.key === k ? 1 : 0.55 }} />;
        })}
      </View>
      {cycleDay ? <View style={{ position: 'relative', height: 8 }}><View style={{ position: 'absolute', left: `${Math.min(98, ((cycleDay - 0.5) / total) * 100)}%`, top: -4, width: 3, height: 12, borderRadius: 2, backgroundColor: colors.prune }} /></View> : null}
      <Row justify="space-between">
        {PHASE_KEYS.filter((k) => b[k]).map((k) => (
          <T key={k} variant="small" style={phase.key === k ? { color: colors.bordeaux, fontWeight: '700' } : null}>
            {PHASE_SHORT[k]} J{b[k][0]}–{b[k][1]}
          </T>
        ))}
      </Row>
      <Card tone="soft" style={{ padding: 14 }}>
        <T>{phase.tips[new Date().getDate() % phase.tips.length]}</T>
      </Card>
    </Card>
  );
}

export default function Cycle() {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState(null);
  const { data, loading, error, offline, reload } = useApi(`/cycle${month ? `?month=${month}` : ''}`);
  const { openStart, openEnd, sheets } = usePeriodActions(reload);
  const [dayInfo, setDayInfo] = useState(null);
  const [apptOpen, setApptOpen] = useState(false);
  const [appt, setAppt] = useState({ title: '', day: toDay(new Date()), time: null });
  const [pastOpen, setPastOpen] = useState(false);
  const [past, setPast] = useState({ start: null, end: null });
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Screen title="Cycle"><Loader /></Screen>;
  if (error && !data) return <Screen title="Cycle"><ErrorState error={error} onRetry={reload} /></Screen>;

  const calWidth = width - 40 - 32;
  const period = dayInfo ? data.periods.find((p) => dayInfo.day >= p.start && dayInfo.day <= (p.end || data.today)) : null;

  const saveAppointment = async () => {
    setBusy(true);
    try {
      await api.post('/appointments', { title: appt.title.trim(), day: appt.day, ...(appt.time ? { time: appt.time } : {}) });
      setApptOpen(false);
      setAppt({ title: '', day: toDay(new Date()), time: null });
      toast('Rendez-vous ajouté');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const savePast = async () => {
    setBusy(true);
    try {
      await api.post('/cycle/periods/past', { periods: [past] });
      setPastOpen(false);
      setPast({ start: null, end: null });
      toast('Règles ajoutées : prédictions recalculées');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const setFlow = async (level) => {
    try {
      await sendOrQueue('PUT', '/cycle/flow', { day: dayInfo.day, level });
      toast('Flux enregistré');
      setDayInfo(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const deletePeriod = async (id) => {
    try {
      await api.delete(`/cycle/periods/${id}`);
      toast('Règles supprimées');
      setDayInfo(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const exclude = async (periodId, value) => {
    await api.post(`/cycle/cycles/${periodId}/exclude`, { exclude: value }).catch(() => {});
    reload();
  };

  return (
    <Screen title="Cycle" onRefresh={reload}>
      <OfflineBanner visible={offline} />
      <NextPeriodCard data={data} onStart={openStart} onEnd={openEnd} />
      <Gap />

      <Card style={{ paddingHorizontal: 16 }}>
        <MonthNav month={data.month} onChange={setMonth} style={{ marginBottom: 8 }} />
        <CalendarGrid month={data.month} days={data.calendar} width={calWidth} onDayPress={(day, info) => setDayInfo(info || { day })} />
      </Card>
      <Gap h={16} />
      <Legend />
      <Gap h={20} />

      {data.mode === 'grossesse' ? (
        <>
          <Card tone="soft" onPress={() => router.push('/grossesse')} style={{ gap: 6 }}>
            <Label>Mode grossesse</Label>
            <T>Ton suivi de grossesse semaine par semaine →</T>
          </Card>
          <Gap />
        </>
      ) : null}

      <PhaseCard phase={data.phase} cycleDay={data.next?.cycleDay} cycleLength={data.averages.cycleLength} />
      <Gap />

      {data.ovulation && !data.inPeriod ? (
        <>
          <Card style={{ gap: 8 }}>
            <Label color={colors.or}>Ovulation et fertilité</Label>
            <T>
              Ovulation {data.ovulation.source === 'estimation' ? 'estimée' : 'détectée'} le <T variant="bold">{dayMonth(data.ovulation.day)}</T> · fenêtre fertile du {dayMonth(data.ovulation.fertileStart)} au {dayMonth(data.ovulation.fertileEnd)}.
            </T>
            {data.fertileToday ? <T color={colors.bordeaux}>Tu es dans ta fenêtre fertile.</T> : null}
            <Pressable onPress={() => router.push('/sante')}>
              <T variant="medium" color={colors.bordeaux}>Affiner avec ma température ou un test →</T>
            </Pressable>
            <T variant="small">Nissali n’est pas un moyen de contraception : ces dates sont des estimations.</T>
          </Card>
          <Gap />
        </>
      ) : null}

      <Card tone="soft" style={{ gap: 10 }}>
        <Row align="flex-start" gap={14}>
          <Icon name="calendar" size={26} color={colors.or} />
          <View style={{ flex: 1, gap: 6 }}>
            <Label>Mes rendez-vous</Label>
            {data.appointments.length ? (
              data.appointments.map((a) => (
                <Pressable key={a.id} onPress={() => a.type === 'praticienne' && router.push('/rendez-vous')}>
                  <T variant="medium">{a.title}</T>
                  <T variant="small">
                    {longDate(a.day)}
                    {a.time ? ` à ${a.time}` : ''}
                    {a.status === 'en_attente' ? ' · en attente' : ''}
                  </T>
                </Pressable>
              ))
            ) : (
              <T>Tes rendez-vous pris avec une praticienne s’afficheront ici et seront entourés dans le calendrier.</T>
            )}
          </View>
        </Row>
        <Button title="Noter un rendez-vous médical" variant="outline" small icon="plus" onPress={() => setApptOpen(true)} />
      </Card>
      <Gap />

      <Card style={{ gap: 8 }}>
        <Label>Historique</Label>
        <Row justify="space-between">
          <View>
            <T variant="h3">{data.averages.cycleLength} j</T>
            <T variant="small">cycle moyen</T>
          </View>
          <View>
            <T variant="h3">{data.averages.periodLength} j</T>
            <T variant="small">règles</T>
          </View>
          <View>
            <T variant="h3">{data.averages.spread != null ? `± ${data.averages.spread}` : '—'}</T>
            <T variant="small">{data.averages.irregular ? 'irrégulier' : 'régularité'}</T>
          </View>
        </Row>
        {data.isDefault ? <T variant="small">Tes prédictions s’affineront au fil des cycles.</T> : null}
        {data.aberrantPending.map((c) => (
          <Card key={c.periodId} tone="soft" style={{ gap: 8, padding: 14 }}>
            <T>Le cycle du {dayMonth(c.start)} a duré {c.length} jours, ce qui est inhabituel (oubli de saisie ?). L’écarter des calculs ?</T>
            <Row>
              <Button title="L’écarter" small onPress={() => exclude(c.periodId, true)} style={{ flex: 1 }} />
              <Button title="Le garder" small variant="outline" onPress={() => exclude(c.periodId, false)} style={{ flex: 1 }} />
            </Row>
          </Card>
        ))}
        {data.history.slice(0, 8).map((c, i, arr) => (
          <ListItem key={c.start} title={`${shortDate(c.start)} → ${shortDate(c.end)}`} subtitle={`${c.length} jours${c.periodLength ? ` · règles ${c.periodLength} j` : ''}${c.excluded ? ' · écarté' : ''}`} last={i === arr.length - 1} />
        ))}
        <Button title="Ajouter des règles passées" variant="ghost" icon="plus" onPress={() => setPastOpen(true)} />
      </Card>

      {data.alerts.map((a) => (
        <View key={a.key} style={{ marginTop: 14 }}>
          <Notice title="Ta santé">{a.text}</Notice>
        </View>
      ))}

      <Sheet visible={Boolean(dayInfo)} onClose={() => setDayInfo(null)} title={dayInfo ? longDate(dayInfo.day) : ''}>
        {dayInfo ? (
          <>
            <T>
              {[
                dayInfo.period === 'reelle' && 'Jour de règles',
                dayInfo.period === 'prevue' && 'Règles prévues',
                dayInfo.ovulation && 'Ovulation estimée',
                dayInfo.fertile && !dayInfo.ovulation && 'Fenêtre fertile',
                dayInfo.today && 'Aujourd’hui',
              ]
                .filter(Boolean)
                .join(' · ') || 'Aucun évènement'}
            </T>
            {(dayInfo.appointments || []).map((a) => (
              <Card key={a.id} tone="soft" style={{ padding: 14 }}>
                <T variant="medium">{a.title}</T>
                {a.time ? <T variant="small">à {a.time}</T> : null}
              </Card>
            ))}
            {period && dayInfo.day <= data.today ? (
              <>
                <Label>Flux de ce jour</Label>
                <Chips items={FLOWS} value={dayInfo.flow} onChange={setFlow} />
                <Button title="Supprimer ces règles" variant="danger" small icon="trash" onPress={() => deletePeriod(period.id)} />
              </>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet visible={apptOpen} onClose={() => setApptOpen(false)} title="Rendez-vous médical" footer={<Button title="Ajouter" onPress={saveAppointment} loading={busy} disabled={!appt.title.trim()} />}>
        <Field label="Intitulé" value={appt.title} onChangeText={(v) => setAppt((a) => ({ ...a, title: v }))} placeholder="Échographie, gynécologue…" />
        <DateField label="Date" value={appt.day} onChange={(v) => setAppt((a) => ({ ...a, day: v }))} maxDay={addDays(toDay(new Date()), 365)} />
        <TimeField label="Heure" value={appt.time} onChange={(v) => setAppt((a) => ({ ...a, time: v }))} allowUnknown={false} />
      </Sheet>

      <Sheet visible={pastOpen} onClose={() => setPastOpen(false)} title="Règles passées" footer={<Button title="Ajouter" onPress={savePast} loading={busy} disabled={!past.start || !past.end} />}>
        <T variant="muted">Ajoute au moins tes 3 dernières règles pour améliorer tout de suite tes prédictions.</T>
        <DateField label="Premier jour" value={past.start} onChange={(v) => setPast((p) => ({ ...p, start: v }))} />
        <DateField label="Dernier jour" value={past.end} onChange={(v) => setPast((p) => ({ ...p, end: v }))} minDay={past.start || undefined} />
      </Sheet>
      {sheets}
    </Screen>
  );
}

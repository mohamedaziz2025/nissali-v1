// 11 — Mon cycle (structure des références Flo, identité Nissali) : semaine en haut, résumé du cycle,
// raccourcis (Mes règles, Symptômes, Mon poids), journal du jour, comprendre mon cycle ; calendrier mois/année.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BrandBar } from '../../components/Brand';
import { DayPanel, HistorySheet, JournalSheet } from '../../components/CycleDay';
import { DateField, TimeField } from '../../components/forms';
import { FlowSheet } from '../../components/Flow';
import Icon from '../../components/Icon';
import { usePeriodActions } from '../../components/PeriodSheets';
import { Button, Card, ErrorState, Field, Gap, Label, ListItem, Loader, Notice, OfflineBanner, Row, Screen, Segmented, Sheet, T, useToast } from '../../components/ui';
import { kg, WeightSheet } from '../../components/Weight';
import { api } from '../../lib/api';
import { addDays, dayMonth, longDate, toDay } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const TEAL = '#2E7D7A'; // fenêtre fertile estimée (contraste AA sur ivoire)

/** Semaine en cours : règles notées pleines, prévues en pointillé, fertile en vert d'eau, aujourd'hui en bordeaux. */
function WeekStrip({ week = [], onPress }) {
  return (
    <View style={s.week}>
      {week.map((d, i) => {
        const real = d.period === 'reelle' || d.period === 'nifas';
        const predicted = d.period === 'prevue';
        const fertile = (d.fertile || d.ovulation) && !real;
        return (
          <Pressable key={d.day} onPress={() => onPress(d)} accessibilityRole="button" accessibilityLabel={`${longDate(d.day)}${real ? ', règles notées' : predicted ? ', règles prévues' : fertile ? ', fertile (estimation)' : ''}`} style={s.weekCol}>
            <Text style={[s.weekLetter, d.today && { color: colors.bordeaux, fontFamily: fonts.bold }]}>{LETTERS[i]}</Text>
            <View style={[s.weekDay, real && { backgroundColor: colors.rose }, predicted && s.weekPredicted, d.today && { backgroundColor: colors.bordeaux, borderWidth: 0 }]}>
              <Text style={[s.weekNum, real && { color: colors.bordeaux, fontFamily: fonts.bold }, fertile && { color: TEAL, fontFamily: fonts.bold }, predicted && { color: colors.bordeaux }, d.today && { color: colors.white, fontFamily: fonts.bold }]}>{Number(d.day.slice(8))}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Shortcut({ icon, label, value, onPress, accessibilityLabel }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} style={({ pressed }) => [s.shortcut, pressed && { opacity: 0.8 }]}>
      <View style={s.shortcutCircle}>
        {value ? <Text style={s.shortcutValue}>{value}</Text> : <Icon name={icon} size={24} color={colors.bordeaux} />}
      </View>
      <Row gap={3}>
        <Text style={s.shortcutLabel}>{label}</Text>
        {value ? <Icon name="edit" size={12} color={colors.bordeaux} /> : null}
      </Row>
    </Pressable>
  );
}

/** Résumé central : jour du cycle et prochaines règles (estimation indicative). */
function Summary({ data, onStart, onEnd, onFlow }) {
  if (data.inPeriod) {
    return (
      <View style={s.summary}>
        <Text style={s.big}>Jour {data.inPeriod.day} des règles</Text>
        <View style={s.rule} />
        <T variant="muted">Commencées le {dayMonth(data.inPeriod.start)}</T>
        <Row gap={10} style={{ marginTop: 12 }}>
          <Button title="Flux du jour" small icon="drop" onPress={onFlow} />
          <Button title="Terminées" small variant="outline" onPress={() => onEnd(data.inPeriod.id)} />
        </Row>
      </View>
    );
  }
  if (!data.next) {
    return (
      <View style={s.summary}>
        <Text style={s.big}>{data.noPrediction ? 'Retour des règles imprévisible' : 'Note tes règles'}</Text>
        <View style={s.rule} />
        <T variant="muted">Les prévisions démarrent dès ta première saisie.</T>
        <Button title="Mes règles ont commencé" small icon="drop" onPress={onStart} style={{ marginTop: 12 }} />
      </View>
    );
  }
  const n = data.next;
  const late = n.lateDays > 0;
  return (
    <View style={s.summary}>
      <Text style={s.big}>Jour {n.cycleDay} du cycle</Text>
      <View style={s.rule} />
      <T variant="muted">{late ? 'Règles en retard' : 'Prochaines règles'}</T>
      <Text style={s.when}>{late ? `${n.lateDays} jour${n.lateDays > 1 ? 's' : ''} de retard` : n.rangeStart ? `Entre le ${dayMonth(n.rangeStart)} et le ${dayMonth(n.rangeEnd)}` : `Autour du ${dayMonth(n.date)}`}</Text>
      <Row gap={5} style={{ marginTop: 4 }}>
        <Icon name="info" size={14} color={colors.muted} />
        <T variant="small">Estimation indicative · fiabilité {data.reliability.label}</T>
      </Row>
      <Button title="Mes règles ont commencé" small variant="outline" icon="drop" onPress={onStart} style={{ marginTop: 12 }} />
    </View>
  );
}

function Leaves() {
  return (
    <Svg width={92} height={92} viewBox="0 0 92 92">
      <Path d="M46 88C44 60 40 36 28 14" stroke="#C26A7E" strokeWidth={2} fill="none" />
      <Path d="M30 20c-12 2-18 12-16 22 10-1 18-9 16-22zM38 40c-12 0-20 9-20 19 10 1 19-6 20-19zM42 30c10-8 22-6 28 2-8 7-20 7-28-2zM45 54c11-6 22-2 26 7-9 5-20 3-26-7z" fill="#E9B9C1" />
    </Svg>
  );
}

export default function Cycle() {
  const toast = useToast();
  const [tab, setTab] = useState('regles');
  const { data, loading, error, offline, reload } = useApi('/cycle');
  const { openStart, openEnd, sheets } = usePeriodActions(reload);
  const [sheet, setSheet] = useState(null); // 'flow' | 'weight' | 'journal' | 'history' | 'day' | 'past' | 'appt'
  const [focus, setFocus] = useState(null);
  const [dayInfo, setDayInfo] = useState(null);
  const [appt, setAppt] = useState({ title: '', day: toDay(new Date()), time: null });
  const [past, setPast] = useState({ start: null, end: null });
  const [busy, setBusy] = useState(false);

  const top = (
    <BrandBar
      right={
        <Pressable onPress={() => router.push('/calendrier')} accessibilityRole="button" accessibilityLabel="Mon calendrier" hitSlop={6} style={s.calBtn}>
          <Icon name="calendar" size={21} color={colors.bordeaux} />
        </Pressable>
      }
    />
  );
  if (loading && !data) return <Screen top={top}><Loader /></Screen>;
  if (error && !data) return <Screen top={top}><ErrorState error={error} onRetry={reload} /></Screen>;

  const saveAppointment = async () => {
    setBusy(true);
    try {
      await api.post('/appointments', { title: appt.title.trim(), day: appt.day, ...(appt.time ? { time: appt.time } : {}) });
      setSheet(null);
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
      setSheet(null);
      setPast({ start: null, end: null });
      toast('Règles ajoutées : prévisions recalculées');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const exclude = async (periodId, value) => {
    await api.post(`/cycle/cycles/${periodId}/exclude`, { exclude: value }).catch(() => {});
    reload();
  };
  const journalDay = dayInfo?.day || data.today;

  return (
    <Screen top={top} onRefresh={reload}>
      <OfflineBanner visible={offline} />
      <Segmented
        items={[
          { key: 'regles', label: 'Règles' },
          { key: 'ovulation', label: 'Ovulation' },
          { key: 'grossesse', label: 'Grossesse' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Gap h={14} />
      <WeekStrip week={data.week} onPress={(d) => { setDayInfo(d); setSheet('day'); }} />

      {tab === 'regles' ? (
        <>
          <Summary data={data} onStart={openStart} onEnd={openEnd} onFlow={() => { setDayInfo(null); setSheet('flow'); }} />
          <Row justify="space-around" style={{ marginTop: 6 }}>
            <Shortcut icon="drop" label="Mes règles" onPress={() => (data.inPeriod ? (setDayInfo(null), setSheet('flow')) : router.push('/mes-regles'))} />
            <Shortcut icon="plus" label="Symptômes" onPress={() => { setDayInfo(null); setFocus('symptomes'); setSheet('journal'); }} />
            <Shortcut icon="scale" label="Mon poids" value={data.lastWeight ? `${kg(data.lastWeight.weight)} kg` : null} accessibilityLabel={data.lastWeight ? `Mon poids : ${kg(data.lastWeight.weight)} kilos` : 'Mon poids, ajouter'} onPress={() => router.push('/poids')} />
          </Row>
          <Gap h={18} />
          <Card style={{ gap: 10 }}>
            <View>
              <Text style={s.cardTitle}>Mon journal</Text>
              <T variant="small">Aujourd’hui, {dayMonth(data.today)}</T>
            </View>
            {data.journal?.notes ? <T numberOfLines={3}>{data.journal.notes}</T> : null}
            <Pressable onPress={() => { setDayInfo(null); setFocus('note'); setSheet('journal'); }} accessibilityRole="button" style={s.addNote}>
              <Icon name="plus" size={17} color={colors.bordeaux} />
              <Text style={s.addNoteText}>{data.journal?.notes ? 'Modifier ma note' : 'Ajouter une note'}</Text>
              <Icon name="chevronRight" size={16} color={colors.muted} />
            </Pressable>
          </Card>
          <Gap />
          <Pressable onPress={() => router.push('/blog/les-4-phases-de-ton-cycle')} accessibilityRole="link" style={({ pressed }) => [s.learn, pressed && { opacity: 0.88 }]}>
            <View style={s.learnArt}>
              <Leaves />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.cardTitle}>Comprendre mon cycle</Text>
              <T variant="small">Découvre les différentes phases de ton cycle{data.phase ? ` · tu es en ${data.phase.label.toLowerCase()}` : ''}</T>
            </View>
            <Icon name="chevronRight" size={18} color={colors.muted} />
          </Pressable>
          <Gap />

          {data.aberrantPending.map((c) => (
            <Card key={c.periodId} tone="soft" style={{ gap: 8, marginBottom: 12 }}>
              <T>Le cycle du {dayMonth(c.start)} a duré {c.length} jours, ce qui est inhabituel (oubli de saisie ?). L’écarter des calculs ?</T>
              <Row>
                <Button title="L’écarter" small onPress={() => exclude(c.periodId, true)} style={{ flex: 1 }} />
                <Button title="Le garder" small variant="outline" onPress={() => exclude(c.periodId, false)} style={{ flex: 1 }} />
              </Row>
            </Card>
          ))}
          <Card style={{ paddingVertical: 4 }}>
            <ListItem icon="calendar" title="Mon calendrier" subtitle="Mois ou année, détail de chaque jour" onPress={() => router.push('/calendrier')} />
            <ListItem icon="chart" title="Historique de mes cycles" subtitle={`Cycle moyen ${data.averages.cycleLength} j · règles ${data.averages.periodLength} j`} onPress={() => setSheet('history')} />
            <ListItem icon="plus" title="Ajouter des règles passées" subtitle="Pour améliorer tout de suite tes prévisions" onPress={() => setSheet('past')} />
            <ListItem icon="clock" title="Noter un rendez-vous médical" subtitle={data.appointments.length ? `Prochain : ${data.appointments[0].title}, ${longDate(data.appointments[0].day)}` : 'Échographie, gynécologue…'} onPress={() => setSheet('appt')} last />
          </Card>
          {data.alerts.map((a) => (
            <View key={a.key} style={{ marginTop: 14 }}>
              <Notice title="Ta santé">{a.text}</Notice>
            </View>
          ))}
        </>
      ) : null}

      {tab === 'ovulation' ? (
        <>
          <Gap h={6} />
          {data.ovulation && !data.inPeriod ? (
            <Card style={{ gap: 8 }}>
              <Label color={colors.or}>Ovulation et fertilité · estimation</Label>
              <Text style={s.big}>{dayMonth(data.ovulation.day)}</Text>
              <T>
                Ovulation {data.ovulation.source === 'estimation' ? 'estimée' : 'détectée'} · fenêtre fertile du {dayMonth(data.ovulation.fertileStart)} au {dayMonth(data.ovulation.fertileEnd)}.
              </T>
              {data.fertileToday ? <T color={colors.bordeaux}>Tu es dans ta fenêtre fertile.</T> : null}
              <Pressable onPress={() => router.push('/sante')}>
                <T variant="medium" color={colors.bordeaux}>Affiner avec ma température ou un test →</T>
              </Pressable>
            </Card>
          ) : (
            <Card tone="soft">
              <T>{data.inPeriod ? 'Pendant tes règles, l’ovulation du prochain cycle sera estimée à la fin de tes règles.' : 'Ton ovulation sera estimée dès que ton cycle sera connu.'}</T>
            </Card>
          )}
          {data.phase ? (
            <>
              <Gap />
              <Card style={{ gap: 8 }}>
                <Label>{data.phase.label}</Label>
                <T>{data.phase.what}</T>
              </Card>
            </>
          ) : null}
          <Gap />
          <T variant="small">Nissali n’est pas un moyen de contraception : ces dates sont des estimations.</T>
        </>
      ) : null}

      {tab === 'grossesse' ? (
        <>
          <Gap h={6} />
          <Card tone="soft" style={{ gap: 10 }}>
            <Label>Grossesse</Label>
            <T>{data.mode === 'grossesse' ? 'Ton suivi de grossesse semaine par semaine : terme, trimestre, rendez-vous.' : 'Tu es enceinte ? Active le suivi de grossesse : semaines, terme et conseils adaptés.'}</T>
            <Button title={data.mode === 'grossesse' ? 'Ouvrir mon suivi' : 'Activer le suivi de grossesse'} onPress={() => router.push('/grossesse')} />
          </Card>
        </>
      ) : null}

      <Sheet visible={sheet === 'day' && Boolean(dayInfo)} onClose={() => setSheet(null)} title="Ma journée">
        {dayInfo ? (
          <DayPanel
            day={dayInfo.day}
            info={dayInfo}
            periods={data.periods}
            weight={data.lastWeight?.day === dayInfo.day ? data.lastWeight.weight : null}
            today={data.today}
            onJournal={(f) => { setFocus(f); setSheet('journal'); }}
            onFlow={() => setSheet('flow')}
            onWeight={() => router.push('/poids')}
            onHistory={() => setSheet('history')}
          />
        ) : null}
      </Sheet>
      <FlowSheet visible={sheet === 'flow'} day={dayInfo?.day || data.today} onClose={() => setSheet(null)} onSaved={reload} />
      <JournalSheet visible={sheet === 'journal'} day={journalDay} focus={focus} onClose={() => setSheet(null)} onSaved={reload} />
      <WeightSheet visible={sheet === 'weight'} entry={null} lastWeight={data.lastWeight?.weight} onClose={() => setSheet(null)} onSaved={reload} />
      <HistorySheet visible={sheet === 'history'} onClose={() => setSheet(null)} history={data.history} averages={data.averages} />
      <Sheet visible={sheet === 'appt'} onClose={() => setSheet(null)} title="Rendez-vous médical" footer={<Button title="Ajouter" onPress={saveAppointment} loading={busy} disabled={!appt.title.trim()} />}>
        <Field label="Intitulé" value={appt.title} onChangeText={(v) => setAppt((a) => ({ ...a, title: v }))} placeholder="Échographie, gynécologue…" />
        <DateField label="Date" value={appt.day} onChange={(v) => setAppt((a) => ({ ...a, day: v }))} maxDay={addDays(toDay(new Date()), 365)} />
        <TimeField label="Heure" value={appt.time} onChange={(v) => setAppt((a) => ({ ...a, time: v }))} allowUnknown={false} />
      </Sheet>
      <Sheet visible={sheet === 'past'} onClose={() => setSheet(null)} title="Règles passées" footer={<Button title="Ajouter" onPress={savePast} loading={busy} disabled={!past.start || !past.end} />}>
        <T variant="muted">Ajoute au moins tes 3 dernières règles pour améliorer tout de suite tes prévisions.</T>
        <DateField label="Premier jour" value={past.start} onChange={(v) => setPast((p) => ({ ...p, start: v }))} />
        <DateField label="Dernier jour" value={past.end} onChange={(v) => setPast((p) => ({ ...p, end: v }))} minDay={past.start || undefined} />
      </Sheet>
      {sheets}
    </Screen>
  );
}

const s = StyleSheet.create({
  calBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCol: { alignItems: 'center', gap: 6, flex: 1 },
  weekLetter: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  weekDay: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  weekPredicted: { borderWidth: 1.5, borderColor: colors.bordeaux, borderStyle: 'dashed' },
  weekNum: { fontFamily: fonts.medium, fontSize: 15, color: colors.prune },
  summary: { alignItems: 'center', paddingTop: 26, paddingBottom: 18, gap: 4 },
  big: { fontFamily: fonts.title, fontSize: 34, lineHeight: 40, color: colors.prune, textAlign: 'center' },
  rule: { width: 46, height: 2, borderRadius: 1, backgroundColor: colors.rose, marginVertical: 10 },
  when: { fontFamily: fonts.title, fontSize: 21, color: colors.prune, textAlign: 'center' },
  shortcut: { alignItems: 'center', gap: 8, width: 100 },
  shortcutCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, shadowColor: '#3E1220', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  shortcutValue: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.prune },
  shortcutLabel: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.prune },
  cardTitle: { fontFamily: fonts.title, fontSize: 19, color: colors.prune },
  addNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.blush, borderRadius: 16, paddingHorizontal: 14, minHeight: 48 },
  addNoteText: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.bordeaux },
  learn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: 24, padding: 12, paddingRight: 16, borderWidth: 1, borderColor: colors.line },
  learnArt: { width: 92, height: 92, borderRadius: 18, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

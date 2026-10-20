// 4.7 · 6.1 — Onglet Cycle, de haut en bas : carte Ma phase (bordeaux), bandeau santé éventuel, calendrier mensuel
// glissable, « Comment tu te sens ? » (enregistré au toucher), conseil santé de la phase. Toucher un jour → 6.3.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BrandBar } from '../../components/Brand';
import { CalendarGrid, Legend, MonthNav } from '../../components/Calendar';
import { HistorySheet } from '../../components/CycleDay';
import DaySheet from '../../components/DaySheet';
import { DateField, TimeField } from '../../components/forms';
import { FeelCard, Frieze, TipCard, TipSheet } from '../../components/HealthCards';
import Icon from '../../components/Icon';
import { usePeriodActions } from '../../components/PeriodSheets';
import { Button, Card, ErrorState, Field, Gap, ListItem, Loader, Notice, OfflineBanner, Row, Screen, Sheet, T, useToast } from '../../components/ui';
import { WeightSheet } from '../../components/Weight';
import { api, sendOrQueue } from '../../lib/api';
import { addDays, dayMonth, longDate, shiftMonth, toDay } from '../../lib/format';
import { readJson, writeJson } from '../../lib/storage';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

const PHASE_TITLES = { menstruelle: 'Menstruelle', folliculaire: 'Folliculaire', ovulatoire: 'Ovulatoire', luteale: 'Lutéale' };

/** Carte Ma phase : jour du cycle, phase en 32 px, explication, frise (phase en cours en doré). */
function PhaseCard({ data, onStart, onEnd }) {
  const p = data.inPeriod;
  const btn = (title, onPress) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.whiteBtn, pressed && { opacity: 0.9 }]}>
      <Text style={s.whiteBtnText}>{title}</Text>
    </Pressable>
  );
  const head = (label) => (
    <Row justify="space-between">
      <Text style={s.phaseLabel}>{label}</Text>
      <Pressable onPress={() => router.push('/mes-regles')} accessibilityRole="link" hitSlop={8} style={s.pill}>
        <Text style={s.pillText}>Mes règles</Text>
        <Icon name="chevronRight" size={12} color={colors.white} />
      </Pressable>
    </Row>
  );
  if (p) {
    return (
      <View style={s.phase}>
        {head('Ma phase')}
        <Text style={s.phaseBig}>Règles · jour {p.day}</Text>
        <Text style={s.phaseText}>Commencées le {dayMonth(p.start)}. {data.phase?.what || ''}</Text>
        <Frieze frieze={data.frieze} phase="menstruelle" />
        {btn('Mes règles sont terminées', () => onEnd(p.id, 'hayd', p.start))}
      </View>
    );
  }
  if (!data.next || !data.phase) {
    return (
      <View style={s.phase}>
        {head('Ma phase')}
        <Text style={[s.phaseBig, { fontSize: 28, lineHeight: 34 }]}>{data.noPrediction ? 'Retour des règles imprévisible' : 'Note tes règles'}</Text>
        <Text style={s.phaseText}>Ta phase et ton calendrier apparaissent dès ta première saisie.</Text>
        {btn('Mes règles ont commencé', onStart)}
      </View>
    );
  }
  const n = data.next;
  return (
    <View style={s.phase}>
      {head(`Ma phase · jour ${n.cycleDay}`)}
      <Text style={s.phaseBig}>{PHASE_TITLES[data.phase.key] || data.phase.label}</Text>
      <Text style={s.phaseText}>{data.phase.what}</Text>
      <Frieze frieze={data.frieze} phase={data.phase.key} />
      <Text style={[s.phaseText, { marginTop: 10 }]}>
        {n.lateDays > 0 ? `Règles en retard de ${n.lateDays} jour${n.lateDays > 1 ? 's' : ''}` : `Prochaines règles vers le ${dayMonth(n.date)}`} · fiabilité {data.reliability.label}
      </Text>
      {btn('Mes règles ont commencé', onStart)}
    </View>
  );
}

export default function Cycle() {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState(toDay(new Date()).slice(0, 7));
  const { data, setData, loading, error, offline, reload } = useApi(`/cycle?month=${month}`);
  const { openStart, openEnd, sheets } = usePeriodActions(reload);
  const [sheet, setSheet] = useState(null); // 'weight' | 'history' | 'past' | 'appt' | 'tip'
  const [day, setDay] = useState(null);
  const [hiddenAlerts, setHiddenAlerts] = useState(null);
  const [appt, setAppt] = useState({ title: '', day: toDay(new Date()), time: null });
  const [past, setPast] = useState({ start: null, end: null });
  const [busy, setBusy] = useState(false);
  const touchX = useRef(null);
  useEffect(() => {
    readJson('nissali.hiddenHealthAlerts', []).then(setHiddenAlerts).catch(() => setHiddenAlerts([]));
  }, []);

  const top = (
    <BrandBar
      right={
        <Pressable onPress={() => router.push('/calendrier')} accessibilityRole="button" accessibilityLabel="Mon calendrier, vue année" hitSlop={6} style={s.calBtn}>
          <Icon name="calendar" size={21} color={colors.bordeaux} />
        </Pressable>
      }
    />
  );
  if (loading && !data) return <Screen top={top}><Loader /></Screen>;
  if (error && !data) return <Screen top={top}><ErrorState error={error} onRetry={reload} /></Screen>;

  const j = data.journal || {};
  const health = { mood: j.mood, symptoms: j.symptoms || [], lastWeight: data.lastWeight };
  const saveDay = async (patch) => {
    setData((d) => ({ ...d, journal: { ...d.journal, ...patch } }));
    await sendOrQueue('PUT', `/health-log/day/${data.today}`, patch).catch((e) => toast(e.message, 'error'));
  };
  const saveSymptom = (k, on) => saveDay({ symptoms: on ? [...new Set([...(j.symptoms || []), k])] : (j.symptoms || []).filter((x) => x !== k) });
  const openTip = () => (data.healthTip?.article?.slug ? router.push(`/blog/${data.healthTip.article.slug}`) : setSheet('tip'));

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
  const hideAlert = (key) => {
    const next = [...(hiddenAlerts || []), key];
    setHiddenAlerts(next);
    writeJson('nissali.hiddenHealthAlerts', next).catch(() => {});
  };
  const alerts = (data.alerts || []).filter((a) => !(hiddenAlerts || []).includes(a.key));
  const gridWidth = Math.min(width, 520) - 36 - 28;

  return (
    <Screen top={top} onRefresh={reload}>
      <OfflineBanner visible={offline} />
      <PhaseCard data={data} onStart={() => openStart()} onEnd={openEnd} />
      <Gap />

      {/* Bandeau santé (partie 6.6) : au-dessus du calendrier, jamais sur l'accueil ; on peut le fermer. */}
      {alerts.map((a) => (
        <View key={a.key} style={{ marginBottom: 12 }}>
          <Notice title="Ta santé">{a.text}</Notice>
          <Pressable onPress={() => hideAlert(a.key)} accessibilityRole="button" hitSlop={6} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
            <Text style={s.link}>Masquer</Text>
          </Pressable>
        </View>
      ))}
      {data.aberrantPending.map((c) => (
        <Card key={c.periodId} tone="soft" style={{ gap: 8, marginBottom: 12 }}>
          <T>Le cycle du {dayMonth(c.start)} a duré {c.length} jours, ce qui est inhabituel (oubli de saisie ?). L’écarter des calculs ?</T>
          <Row>
            <Button title="L’écarter" small onPress={() => exclude(c.periodId, true)} style={{ flex: 1 }} />
            <Button title="Le garder" small variant="outline" onPress={() => exclude(c.periodId, false)} style={{ flex: 1 }} />
          </Row>
        </Card>
      ))}

      {/* Calendrier : glisser à gauche ou à droite pour changer de mois */}
      <View
        style={s.card}
        onTouchStart={(e) => (touchX.current = e.nativeEvent.pageX)}
        onTouchEnd={(e) => {
          const dx = e.nativeEvent.pageX - (touchX.current ?? e.nativeEvent.pageX);
          if (Math.abs(dx) > 60) setMonth((m) => shiftMonth(m, dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
      >
        <MonthNav month={month} onChange={setMonth} />
        <CalendarGrid month={month} days={data.month === month ? data.calendar : []} width={gridWidth} onDayPress={(d) => setDay(d)} />
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
          <Legend />
        </View>
      </View>
      <Gap />

      <FeelCard health={health} onMood={(mood) => saveDay({ mood })} onSymptom={saveSymptom} onWeight={() => setSheet('weight')} />
      <Gap />
      {data.healthTip ? (
        <>
          <TipCard tip={data.healthTip} onOpen={openTip} />
          <Gap />
        </>
      ) : null}

      <Card style={{ paddingVertical: 4 }}>
        <ListItem icon="drop" title="Mes règles" subtitle="Dates, flux, prévisions" onPress={() => router.push('/mes-regles')} />
        <ListItem icon="chart" title="Historique de mes cycles" subtitle={`Cycle moyen ${data.averages.cycleLength} j · règles ${data.averages.periodLength} j`} onPress={() => setSheet('history')} />
        <ListItem icon="plus" title="Ajouter des règles passées" subtitle="Pour améliorer tout de suite tes prévisions" onPress={() => setSheet('past')} />
        <ListItem icon="clock" title="Noter un rendez-vous médical" subtitle={data.appointments.length ? `Prochain : ${data.appointments[0].title}, ${longDate(data.appointments[0].day)}` : 'Échographie, gynécologue…'} onPress={() => setSheet('appt')} />
        <ListItem icon="baby" title={data.mode === 'grossesse' ? 'Mon suivi de grossesse' : 'Grossesse'} subtitle={data.mode === 'grossesse' ? 'Semaines, terme, rendez-vous' : 'Active le suivi si tu es enceinte'} onPress={() => router.push('/grossesse')} last />
      </Card>
      {data.ovulation && !data.inPeriod ? (
        <T variant="small" style={{ marginTop: 12 }}>
          Ovulation estimée le {dayMonth(data.ovulation.day)} · fenêtre fertile du {dayMonth(data.ovulation.fertileStart)} au {dayMonth(data.ovulation.fertileEnd)}. Nissali n’est pas un moyen de contraception.
        </T>
      ) : null}

      <DaySheet day={day} onClose={() => setDay(null)} onStartPeriod={(d) => openStart(d)} />
      <TipSheet tip={data.healthTip} visible={sheet === 'tip'} onClose={() => setSheet(null)} />
      <WeightSheet
        visible={sheet === 'weight'}
        entry={data.lastWeight?.day === data.today ? data.lastWeight : null}
        lastWeight={data.lastWeight?.weight}
        onClose={() => setSheet(null)}
        onSaved={reload}
      />
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
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.line },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux },
  phase: { backgroundColor: colors.bordeaux, borderRadius: 28, padding: 20, gap: 6 },
  phaseLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.onBordeaux, textTransform: 'uppercase' },
  phaseBig: { fontFamily: fonts.extra, fontSize: 32, lineHeight: 38, letterSpacing: -1, color: colors.white, marginTop: 4 },
  phaseText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.onBordeaux },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.onBordeauxSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  whiteBtn: { marginTop: 14, borderRadius: 999, minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  whiteBtnText: { fontFamily: fonts.bold, fontSize: 15, color: colors.bordeaux },
});

// 4.7 · 6.2 — Suivi santé du jour : bande des 7 jours (jours futurs grisés), humeur, énergie (barre dorée),
// symptômes, sommeil (pas de 15 min), poids (0,1 kg), médicaments repris des notes « Médicament » (case = pris),
// glaire et température (mode « Je veux un enfant » ou option du profil). « Enregistrer » sauvegarde tout ;
// quitter avec des changements demande confirmation. Données de santé : jamais dans les notifications.
// Onglet Évolution : graphiques sur plusieurs cycles (5.9).
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ColumnChart, LineChart } from '../components/Charts';
import { MoodFace } from '../components/HealthCards';
import Icon from '../components/Icon';
import { Button, Card, Chips, Field, Gap, Label, Loader, Row, Screen, Segmented, T, Toggle, useToast } from '../components/ui';
import { api, sendOrQueue } from '../lib/api';
import { useAuth } from '../lib/auth';
import { addDays, longDate, toDay } from '../lib/format';
import { useApi } from '../lib/useApi';
import { colors, fonts, MOODS, SYMPTOMS, tnum } from '../theme';

const MUCUS = [
  { key: 'seche', label: 'Sèche' },
  { key: 'collante', label: 'Collante' },
  { key: 'cremeuse', label: 'Crémeuse' },
  { key: 'aqueuse', label: 'Aqueuse' },
  { key: 'blanc_oeuf', label: 'Blanc d’œuf' },
];
const ENERGY = ['Très basse', 'Basse', 'Moyenne', 'Bonne', 'Au top'];
const LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const FIELDS = ['mood', 'energy', 'symptoms', 'sleepHours', 'weight', 'medications', 'pillTaken', 'temperature', 'cervicalMucus', 'ovulationTest', 'notes'];

const hm = (h) => (h == null ? '—' : `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`);
const snapshot = (l) => JSON.stringify(FIELDS.map((k) => l?.[k] ?? null));

/** Bande des 7 jours de la semaine : on remplit aujourd'hui et les jours passés, pas les jours futurs. */
function WeekStrip({ day, today, onPick }) {
  const monday = addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <View style={s.strip}>
      <Pressable onPress={() => onPick(addDays(day, -7))} accessibilityRole="button" accessibilityLabel="Semaine précédente" hitSlop={8} style={s.stripNav}>
        <Icon name="chevronLeft" size={18} color={colors.muted} />
      </Pressable>
      {days.map((d) => {
        const future = d > today;
        const on = d === day;
        return (
          <Pressable key={d} disabled={future} onPress={() => onPick(d)} accessibilityRole="button" accessibilityState={{ selected: on, disabled: future }} accessibilityLabel={longDate(d)} style={[s.stripDay, on && s.stripOn]}>
            <Text style={[s.stripLetter, on && { color: colors.onBordeaux }, future && { color: colors.caseVide }]}>{LETTERS[new Date(`${d}T12:00:00Z`).getUTCDay()]}</Text>
            <Text style={[s.stripNum, on && { color: colors.white }, future && { color: colors.caseVide }, d === today && !on && { color: colors.bordeaux }]}>{Number(d.slice(8))}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={() => addDays(monday, 7) <= today && onPick(addDays(day, 7) > today ? today : addDays(day, 7))} disabled={addDays(monday, 7) > today} accessibilityRole="button" accessibilityLabel="Semaine suivante" hitSlop={8} style={[s.stripNav, addDays(monday, 7) > today && { opacity: 0.3 }]}>
        <Icon name="chevronRight" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function Stepper({ label, icon, value, display, onMinus, onPlus }) {
  return (
    <View style={s.stepRow}>
      <Icon name={icon} size={18} color={colors.bordeaux} />
      <Text style={s.stepLabel}>{label}</Text>
      <Pressable onPress={onMinus} accessibilityRole="button" accessibilityLabel={`${label} : diminuer`} hitSlop={6} style={s.stepBtn}>
        <Text style={s.stepSign}>−</Text>
      </Pressable>
      <Text style={[s.stepValue, tnum, value == null && { color: colors.muted }]}>{display}</Text>
      <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel={`${label} : augmenter`} hitSlop={6} style={s.stepBtn}>
        <Text style={s.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

function DailyLog({ day, onDirty }) {
  const toast = useToast();
  const { user } = useAuth();
  const [log, setLog] = useState(null);
  const [busy, setBusy] = useState(false);
  const initial = useRef(null);
  useEffect(() => {
    setLog(null);
    api
      .get(`/health-log/day/${day}`)
      .then((l) => ({ symptoms: [], medications: [], medicationNotes: [], ...l }))
      .catch(() => ({ symptoms: [], medications: [], medicationNotes: [] }))
      .then((l) => {
        initial.current = snapshot(l);
        setLog(l);
      });
  }, [day]);
  const dirty = Boolean(log && initial.current !== null && snapshot(log) !== initial.current);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!log) return <Loader />;
  const set = (k) => (v) => setLog((l) => ({ ...l, [k]: v }));
  const fertility = user?.onboarding?.goal === 'enfant' || user?.fertilitySigns;
  const meds = log.medications || [];
  const toggleMed = (name) => set('medications')(meds.includes(name) ? meds.filter((m) => m !== name) : [...meds, name]);
  const extraMeds = meds.filter((m) => !log.medicationNotes.some((n) => n.text === m));

  const save = async () => {
    setBusy(true);
    try {
      const temperature = log.temperatureText != null && log.temperatureText !== '' ? Math.round(Number(String(log.temperatureText).replace(',', '.')) * 20) / 20 : (log.temperature ?? null);
      if (temperature != null && !(temperature >= 34 && temperature <= 42)) throw new Error('Température entre 34 et 42 °C');
      const body = Object.fromEntries(FIELDS.map((k) => [k, k === 'temperature' ? temperature : k === 'symptoms' || k === 'medications' ? log[k] || [] : (log[k] ?? null)]));
      const r = await sendOrQueue('PUT', `/health-log/day/${day}`, body);
      const next = { ...log, temperature, temperatureText: undefined };
      initial.current = snapshot(next);
      setLog(next);
      toast(r.queued ? 'Enregistré hors connexion' : 'Enregistré');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 14 }}>
        <Text style={s.title}>Humeur</Text>
        <Row gap={2} justify="space-between">
          {MOODS.map((m) => {
            const on = log.mood === m.key;
            return (
              <Pressable key={m.key} onPress={() => set('mood')(on ? null : m.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={m.label} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                <MoodFace mood={m.key} on={on} size={42} />
                <Text style={[s.small, on && { color: colors.bordeaux, fontFamily: fonts.bold }]} numberOfLines={1}>{m.label}</Text>
              </Pressable>
            );
          })}
        </Row>
        <Row justify="space-between">
          <Text style={s.title}>Énergie</Text>
          <Text style={s.small}>{log.energy ? ENERGY[log.energy - 1] : 'Non renseignée'}</Text>
        </Row>
        <View style={s.energy}>
          {[1, 2, 3, 4, 5].map((k) => (
            <Pressable key={k} onPress={() => set('energy')(log.energy === k ? null : k)} accessibilityRole="radio" accessibilityState={{ selected: log.energy === k }} accessibilityLabel={`Énergie ${ENERGY[k - 1]}`} style={[s.energyBar, (log.energy || 0) >= k && s.energyOn]} />
          ))}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={s.title}>Symptômes</Text>
        <Chips items={Object.entries(SYMPTOMS).map(([key, label]) => ({ key, label }))} value={log.symptoms} onChange={set('symptoms')} multi />
      </Card>

      <Card style={{ gap: 4, paddingVertical: 8 }}>
        <Stepper label="Sommeil" icon="moon" value={log.sleepHours} display={hm(log.sleepHours)} onMinus={() => set('sleepHours')(Math.max(0, (log.sleepHours ?? 7.25) - 0.25))} onPlus={() => set('sleepHours')(Math.min(24, (log.sleepHours ?? 6.75) + 0.25))} />
        <View style={s.sep} />
        <Stepper label="Poids" icon="scale" value={log.weight} display={log.weight != null ? `${log.weight.toFixed(1).replace('.', ',')} kg` : '—'} onMinus={() => set('weight')(Math.round(((log.weight ?? 60.1) - 0.1) * 10) / 10)} onPlus={() => set('weight')(Math.round(((log.weight ?? 59.9) + 0.1) * 10) / 10)} />
        {user?.contraception?.type === 'pilule' ? (
          <>
            <View style={s.sep} />
            <Toggle label="Pilule prise" value={log.pillTaken} onChange={set('pillTaken')} />
          </>
        ) : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <Row justify="space-between">
          <Text style={s.title}>Médicaments et compléments</Text>
          <Pressable onPress={() => router.push(`/notes/nouvelle?day=${day}&type=medicament`)} accessibilityRole="button" hitSlop={6}>
            <Text style={s.link}>+ Ajouter</Text>
          </Pressable>
        </Row>
        {log.medicationNotes.length || extraMeds.length ? (
          [...log.medicationNotes.map((n) => ({ key: n.id, text: n.text, time: n.time })), ...extraMeds.map((m) => ({ key: m, text: m }))].map((m) => {
            const on = meds.includes(m.text);
            return (
              <Pressable key={m.key} onPress={() => toggleMed(m.text)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={s.med}>
                <View style={[s.box, on && s.boxOn]}>{on ? <Icon name="check" size={12} color={colors.white} strokeWidth={3} /> : null}</View>
                <Text style={s.medText} numberOfLines={1}>{m.text}</Text>
                {m.time ? <Text style={s.small}>{m.time}</Text> : null}
              </Pressable>
            );
          })
        ) : (
          <T variant="small">Les notes « Médicament » de ce jour apparaissent ici, à cocher quand c’est pris.</T>
        )}
      </Card>

      {fertility ? (
        <Card style={{ gap: 12 }}>
          <Text style={s.title}>Glaire et température</Text>
          <Chips items={MUCUS} value={log.cervicalMucus} onChange={(v) => set('cervicalMucus')(log.cervicalMucus === v ? null : v)} />
          <View style={s.stepRow}>
            <Icon name="sun" size={18} color={colors.bordeaux} />
            <Text style={s.stepLabel}>Température au réveil</Text>
            <TextInput
              value={log.temperatureText ?? (log.temperature != null ? String(log.temperature).replace('.', ',') : '')}
              onChangeText={set('temperatureText')}
              placeholder="36,50"
              placeholderTextColor={colors.caseVide}
              keyboardType="decimal-pad"
              style={s.tempInput}
              accessibilityLabel="Température au réveil en degrés"
            />
            <Text style={s.small}>°C</Text>
          </View>
          <T variant="fieldLabel">Test d’ovulation</T>
          <Chips items={[{ key: 'positif', label: 'Positif' }, { key: 'negatif', label: 'Négatif' }]} value={log.ovulationTest} onChange={(v) => set('ovulationTest')(log.ovulationTest === v ? null : v)} />
          <T variant="small">Arrondie à 0,05 °C. Une hausse durable ou un test positif affine l’estimation de ton ovulation.</T>
        </Card>
      ) : null}

      <Field label="Notes" value={log.notes || ''} onChangeText={set('notes')} multiline placeholder="Ce que tu veux retenir de ta journée" />
      <Button title="Enregistrer" onPress={save} loading={busy} disabled={!dirty || busy} />
      <T variant="small" style={{ textAlign: 'center' }}>Données de santé chiffrées, jamais affichées dans les notifications.</T>
    </View>
  );
}

function Evolution() {
  const { width } = useWindowDimensions();
  const { data, loading } = useApi('/health-log/stats?days=180');
  const tips = useApi('/health-log/tips');
  if (loading && !data) return <Loader />;
  if (!data) return null;
  const chartW = width - 40 - 40;
  const moodTotal = Object.values(data.moods).reduce((a, b) => a + b, 0) || 1;
  const topSymptoms = Object.entries(data.symptoms)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return (
    <View style={{ gap: 14 }}>
      {tips.data?.tips?.length ? (
        <Card tone="soft" style={{ gap: 8 }}>
          <Label color={colors.or}>Conseils du jour</Label>
          {tips.data.weather ? (
            <T variant="small">
              Météo : {Math.round(tips.data.weather.min)}° / {Math.round(tips.data.weather.max)}° · UV {Math.round(tips.data.weather.uv ?? 0)} · qualité de l’air {tips.data.weather.aqi ?? '—'}
            </T>
          ) : null}
          {tips.data.tips.map((t, i) => (
            <T key={i}>• {t.text}</T>
          ))}
        </Card>
      ) : null}
      <Card style={{ gap: 10 }}>
        <Label>Durée de tes cycles</Label>
        <ColumnChart data={data.cycleLengths} width={chartW} label="Durée des cycles" />
      </Card>
      <Card style={{ gap: 10 }}>
        <Label>Poids (kg)</Label>
        <LineChart data={data.weight} width={chartW} unit=" kg" minSpan={2} label="Poids" />
      </Card>
      <Card style={{ gap: 10 }}>
        <Label>Sommeil (heures)</Label>
        <LineChart data={data.sleep} width={chartW} unit=" h" minSpan={2} label="Sommeil" />
      </Card>
      {data.temperature.length > 1 ? (
        <Card style={{ gap: 10 }}>
          <Label>Température au réveil (°C)</Label>
          <LineChart data={data.temperature} width={chartW} unit=" °C" digits={2} minSpan={0.6} label="Température" />
        </Card>
      ) : null}
      <Card style={{ gap: 10 }}>
        <Label>Humeurs sur 6 mois</Label>
        {MOODS.map((m) => {
          const n = data.moods[m.key] || 0;
          return (
            <View key={m.key} style={{ gap: 4 }}>
              <Row justify="space-between">
                <T>{m.label}</T>
                <T variant="small">{n} jour{n > 1 ? 's' : ''}</T>
              </Row>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.blush }}>
                <View style={{ height: 8, borderRadius: 4, width: `${(n / moodTotal) * 100}%`, backgroundColor: colors.bordeaux }} />
              </View>
            </View>
          );
        })}
      </Card>
      {topSymptoms.length ? (
        <Card style={{ gap: 6 }}>
          <Label>Symptômes les plus fréquents</Label>
          {topSymptoms.map(([k, n]) => (
            <Row key={k} justify="space-between">
              <T>{SYMPTOMS[k] || k}</T>
              <T variant="small">{n} fois</T>
            </Row>
          ))}
        </Card>
      ) : null}
      <T variant="small">Export PDF pour ta gynécologue et connexion à Apple Santé / Health Connect : prochainement.</T>
    </View>
  );
}

export default function Health() {
  const today = toDay(new Date());
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const [day, setDay] = useState(typeof params.day === 'string' && params.day <= today ? params.day : today);
  const [tab, setTab] = useState('jour');
  const dirty = useRef(false);

  // Quitter sans enregistrer : confirmation si quelque chose a changé.
  const confirmLeave = (onLeave) => {
    if (!dirty.current) return onLeave();
    if (Platform.OS === 'web') {
      if (window.confirm('Quitter sans enregistrer ? Tes changements seront perdus.')) onLeave(); // eslint-disable-line no-alert
      return;
    }
    Alert.alert('Quitter sans enregistrer ?', 'Tes changements seront perdus.', [
      { text: 'Rester', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: onLeave },
    ]);
  };
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirty.current) return;
        e.preventDefault();
        confirmLeave(() => {
          dirty.current = false;
          navigation.dispatch(e.data.action);
        });
      }),
    [navigation], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const pick = (d) => confirmLeave(() => {
    dirty.current = false;
    setDay(d);
  });

  return (
    <Screen back title="Suivi santé">
      <Segmented items={[{ key: 'jour', label: 'Ma journée' }, { key: 'evolution', label: 'Évolution' }]} value={tab} onChange={setTab} />
      <Gap h={16} />
      {tab === 'jour' ? (
        <>
          <WeekStrip day={day} today={today} onPick={pick} />
          <Text style={[s.dayTitle]}>{day === today ? 'Aujourd’hui' : longDate(day)}</Text>
          <DailyLog key={day} day={day} onDirty={(v) => {
            dirty.current = v;
          }} />
        </>
      ) : (
        <Evolution />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.extra, fontSize: 17, color: colors.prune },
  small: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  dayTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune, marginVertical: 12 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stripNav: { width: 24, alignItems: 'center' },
  stripDay: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  stripOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  stripLetter: { fontFamily: fonts.semi, fontSize: 11, color: colors.muted },
  stripNum: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
  energy: { flexDirection: 'row', gap: 6 },
  energyBar: { flex: 1, height: 14, borderRadius: 7, backgroundColor: colors.sable },
  energyOn: { backgroundColor: colors.or },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  stepLabel: { flex: 1, fontFamily: fonts.semi, fontSize: 15, color: colors.prune },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontFamily: fonts.extra, fontSize: 18, color: colors.bordeaux, lineHeight: 20 },
  stepValue: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune, minWidth: 74, textAlign: 'center' },
  sep: { height: 1, backgroundColor: colors.line },
  med: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.caseVide, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.or, borderColor: colors.or },
  medText: { flex: 1, fontFamily: fonts.semi, fontSize: 15, color: colors.prune },
  tempInput: { minWidth: 70, textAlign: 'center', fontFamily: fonts.extra, fontSize: 16, color: colors.prune, borderBottomWidth: 1.5, borderBottomColor: colors.lineField, paddingVertical: 4 },
});

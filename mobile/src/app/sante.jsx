// 5.5 / 5.9 — Santé du jour détaillée, signes de fertilité, graphiques d'évolution sur plusieurs cycles.
import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { ColumnChart, LineChart } from '../components/Charts';
import Icon from '../components/Icon';
import { Button, Card, Chips, Field, Gap, IconButton, Label, Loader, Row, Screen, Segmented, Stepper, T, Toggle, useToast } from '../components/ui';
import { api, sendOrQueue } from '../lib/api';
import { useAuth } from '../lib/auth';
import { addDays, longDate, toDay } from '../lib/format';
import { useApi } from '../lib/useApi';
import { colors, MOODS, SYMPTOMS } from '../theme';

const MUCUS = [
  { key: 'seche', label: 'Sèche' },
  { key: 'collante', label: 'Collante' },
  { key: 'cremeuse', label: 'Crémeuse' },
  { key: 'aqueuse', label: 'Aqueuse' },
  { key: 'blanc_oeuf', label: 'Blanc d’œuf' },
];

function DailyLog({ day, onSaved }) {
  const toast = useToast();
  const { user } = useAuth();
  const [log, setLog] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setLog(null);
    api
      .get(`/health-log/day/${day}`)
      .then((l) => setLog({ symptoms: [], medications: [], ...l }))
      .catch(() => setLog({ symptoms: [], medications: [] }));
  }, [day]);
  if (!log) return <Loader />;
  const set = (k) => (v) => setLog((l) => ({ ...l, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        mood: log.mood ?? null,
        energy: log.energy ?? null,
        symptoms: log.symptoms || [],
        sleepHours: log.sleepHours ?? null,
        weight: log.weight ?? null,
        medications: (log.medicationsText ?? (log.medications || []).join(', '))
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
        pillTaken: log.pillTaken ?? null,
        temperature: log.temperatureText ? Number(String(log.temperatureText).replace(',', '.')) : (log.temperature ?? null),
        cervicalMucus: log.cervicalMucus ?? null,
        ovulationTest: log.ovulationTest ?? null,
        notes: log.notes || null,
      };
      if (body.temperature != null && !(body.temperature >= 34 && body.temperature <= 42)) throw new Error('Température entre 34 et 42 °C');
      const r = await sendOrQueue('PUT', `/health-log/day/${day}`, body);
      toast(r.queued ? 'Enregistré hors connexion' : 'Enregistré');
      onSaved?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 12 }}>
        <Label>Humeur</Label>
        <Chips items={MOODS} value={log.mood} onChange={(v) => set('mood')(log.mood === v ? null : v)} />
        <Label>Énergie</Label>
        <Chips items={[1, 2, 3, 4, 5].map((k) => ({ key: k, label: ['Très basse', 'Basse', 'Moyenne', 'Bonne', 'Top'][k - 1] }))} value={log.energy} onChange={set('energy')} />
        <Label>Symptômes</Label>
        <Chips items={Object.entries(SYMPTOMS).map(([key, label]) => ({ key, label }))} value={log.symptoms} onChange={set('symptoms')} multi />
      </Card>
      <Card style={{ gap: 6 }}>
        <Stepper label="Sommeil" value={log.sleepHours ?? 7} onChange={set('sleepHours')} min={0} max={14} step={0.5} suffix=" h" />
        <Stepper label="Poids" value={log.weight ?? 60} onChange={set('weight')} min={30} max={200} step={0.1} suffix=" kg" />
        {user?.contraception?.type === 'pilule' ? <Toggle label="Pilule prise" value={log.pillTaken} onChange={set('pillTaken')} /> : null}
        <Field label="Médicaments ou compléments" value={log.medicationsText ?? (log.medications || []).join(', ')} onChangeText={set('medicationsText')} placeholder="Fer, magnésium…" />
      </Card>
      <Card style={{ gap: 12 }}>
        <Label color={colors.or}>Signes de fertilité (facultatif)</Label>
        <Field label="Température au réveil (°C)" value={log.temperatureText ?? (log.temperature != null ? String(log.temperature) : '')} onChangeText={set('temperatureText')} placeholder="36,5" keyboardType="decimal-pad" />
        <T variant="fieldLabel">Glaire cervicale</T>
        <Chips items={MUCUS} value={log.cervicalMucus} onChange={(v) => set('cervicalMucus')(log.cervicalMucus === v ? null : v)} />
        <T variant="fieldLabel">Test d’ovulation</T>
        <Chips items={[{ key: 'positif', label: 'Positif' }, { key: 'negatif', label: 'Négatif' }]} value={log.ovulationTest} onChange={(v) => set('ovulationTest')(log.ovulationTest === v ? null : v)} />
        <T variant="small">Une hausse durable de température ou un test positif affine l’estimation de ton ovulation.</T>
      </Card>
      <Field label="Notes" value={log.notes || ''} onChangeText={set('notes')} multiline placeholder="Ce que tu veux retenir de ta journée" />
      <Button title="Enregistrer" onPress={save} loading={busy} />
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
  const [day, setDay] = useState(today);
  const [tab, setTab] = useState('jour');
  return (
    <Screen back title="Suivi santé">
      <Segmented items={[{ key: 'jour', label: 'Mon journal' }, { key: 'evolution', label: 'Évolution' }]} value={tab} onChange={setTab} />
      <Gap h={18} />
      {tab === 'jour' ? (
        <>
          <Row justify="space-between" style={{ marginBottom: 14 }}>
            <IconButton name="chevronLeft" label="Jour précédent" onPress={() => setDay(addDays(day, -1))} />
            <Row gap={8}>
              <Icon name="calendar" size={18} color={colors.muted} />
              <T variant="bold">{day === today ? 'Aujourd’hui' : longDate(day)}</T>
            </Row>
            <IconButton name="chevronRight" label="Jour suivant" onPress={() => day < today && setDay(addDays(day, 1))} />
          </Row>
          <DailyLog day={day} />
        </>
      ) : (
        <Evolution />
      )}
    </Screen>
  );
}

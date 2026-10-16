// RG-05 — questionnaire d'accueil : dernières règles, durées habituelles (ou « je ne sais pas »),
// objectif adapté à la situation (RG-05 ter), cycles passés facultatifs (RG-13).
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { DateField } from '../components/forms';
import { Button, Card, Checkbox, Chips, Label, ProgressBar, Screen, Stepper, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { addDays, toDay } from '../lib/format';
import { colors } from '../theme';

export default function Onboarding() {
  const { user, setSession } = useAuth();
  const married = user?.situation === 'mariee';
  const [step, setStep] = useState(0);
  const [lastPeriod, setLastPeriod] = useState(null);
  const [unknownLast, setUnknownLast] = useState(false);
  const [cycleLength, setCycleLength] = useState(28);
  const [cycleUnknown, setCycleUnknown] = useState(false);
  const [periodLength, setPeriodLength] = useState(5);
  const [periodUnknown, setPeriodUnknown] = useState(false);
  const [goal, setGoal] = useState('suivre');
  const [past, setPast] = useState([null, null, null]);
  const [dueDate, setDueDate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const today = toDay(new Date());

  const goals = [{ key: 'suivre', label: 'Suivre mon cycle' }, ...(married ? [{ key: 'enfant', label: 'Avoir un enfant' }, { key: 'enceinte', label: 'Je suis enceinte' }] : [])];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const pl = periodUnknown ? 5 : periodLength;
      const r = await api.post('/me/onboarding', {
        lastPeriodStart: unknownLast ? null : lastPeriod,
        cycleLength: cycleUnknown ? null : cycleLength,
        periodLength: periodUnknown ? null : periodLength,
        goal,
        pastPeriods: past.filter(Boolean).map((start) => ({ start, end: addDays(start, pl - 1) })),
        pregnancy: goal === 'enceinte' ? { lmp: unknownLast ? undefined : lastPeriod || undefined, dueDate: dueDate || undefined } : undefined,
      });
      await setSession(r);
      router.replace(goal === 'enceinte' ? '/grossesse' : '/');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    <View key="goal" style={{ gap: 16 }}>
      <T variant="h2">Bienvenue {user?.firstName} !</T>
      <T variant="muted">Quel est ton objectif ?</T>
      <Chips items={goals} value={goal} onChange={setGoal} />
      {!married ? <T variant="small">Les autres objectifs restent accessibles depuis ton profil.</T> : null}
    </View>,
    <View key="last" style={{ gap: 16 }}>
      <T variant="h2">{goal === 'enceinte' ? 'Ta grossesse' : 'Tes dernières règles'}</T>
      <DateField label="Premier jour de tes dernières règles" value={lastPeriod} onChange={(v) => { setLastPeriod(v); setUnknownLast(false); }} maxDay={today} />
      <Checkbox checked={unknownLast} onChange={(v) => { setUnknownLast(v); if (v) setLastPeriod(null); }}>
        Je ne sais pas
      </Checkbox>
      {goal === 'enceinte' ? <DateField label="Ou date du terme (échographie, sage-femme)" value={dueDate} onChange={setDueDate} maxDay={addDays(today, 300)} minDay={today} allowClear /> : null}
    </View>,
    <View key="lengths" style={{ gap: 18 }}>
      <T variant="h2">Ton cycle habituel</T>
      <Card style={{ gap: 6 }}>
        <Label>Durée du cycle</Label>
        <T variant="small">Nombre de jours entre le début de deux règles (souvent entre 24 et 38).</T>
        {!cycleUnknown ? <Stepper value={cycleLength} onChange={setCycleLength} min={15} max={60} suffix=" j" /> : null}
        <Checkbox checked={cycleUnknown} onChange={setCycleUnknown}>Je ne sais pas</Checkbox>
      </Card>
      <Card style={{ gap: 6 }}>
        <Label>Durée des règles</Label>
        {!periodUnknown ? <Stepper value={periodLength} onChange={setPeriodLength} min={1} max={15} suffix=" j" /> : null}
        <Checkbox checked={periodUnknown} onChange={setPeriodUnknown}>Je ne sais pas</Checkbox>
      </Card>
      {cycleUnknown || periodUnknown ? (
        <Card tone="soft">
          <T>Pas de souci : nous partirons de 28 jours de cycle et 5 jours de règles. Tes prédictions s’affineront au fil des cycles.</T>
        </Card>
      ) : null}
    </View>,
    <View key="past" style={{ gap: 16 }}>
      <T variant="h2">Tes cycles précédents</T>
      <T variant="muted">Facultatif : indique le début de tes règles des mois précédents pour des prédictions plus justes dès aujourd’hui.</T>
      {past.map((d, i) => (
        <DateField
          key={i}
          label={`Règles précédentes n°${i + 1}`}
          value={d}
          allowClear
          onChange={(v) => setPast((p) => p.map((x, j) => (j === i ? v : x)))}
          maxDay={lastPeriod ? addDays(lastPeriod, -10) : today}
        />
      ))}
    </View>,
  ];

  const visible = goal === 'enceinte' ? steps.slice(0, 2) : steps;
  const last = step === visible.length - 1;
  const canNext = step !== 1 || unknownLast || lastPeriod || dueDate;

  return (
    <Screen
      title="Faisons connaissance"
      footer={
        <View style={{ padding: 20, gap: 10 }}>
          {error ? <T color={colors.danger} style={{ textAlign: 'center' }}>{error}</T> : null}
          <Button title={last ? 'C’est parti' : 'Continuer'} onPress={last ? submit : () => setStep((s) => s + 1)} loading={busy} disabled={!canNext} />
          {step > 0 ? <Button title="Retour" variant="ghost" onPress={() => setStep((s) => s - 1)} /> : null}
        </View>
      }
    >
      <View style={{ gap: 18 }}>
        <ProgressBar progress={(step + 1) / visible.length} color={colors.bordeaux} track={colors.blush} height={6} />
        {visible[step]}
        <T variant="small">Nissali n’est pas un moyen de contraception : les prédictions sont des estimations.</T>
      </View>
    </Screen>
  );
}

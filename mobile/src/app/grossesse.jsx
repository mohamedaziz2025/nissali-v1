// 5.6 / 6.7 — Mode grossesse et post-partum : SA, mois, trimestre, terme, compte à rebours,
// contenu semaine par semaine, rendez-vous médicaux, jeûne, fin de grossesse.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { DateField } from '../components/forms';
import { usePeriodActions } from '../components/PeriodSheets';
import { Button, Card, ErrorState, Gap, Label, Loader, Notice, Ring, Row, Screen, Segmented, Sheet, Stepper, T, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { addDays, dayMonth, longDate, today as serverToday } from '../lib/format';
import { useApi } from '../lib/useApi';
import { colors } from '../theme';

import { tr } from '../lib/i18n';
function Setup({ onDone }) {
  const toast = useToast();
  const [source, setSource] = useState('lmp');
  const [date, setDate] = useState(null);
  const [cycleLength, setCycleLength] = useState(28);
  const [busy, setBusy] = useState(false);
  const today = serverToday();
  const submit = async () => {
    setBusy(true);
    try {
      const body = source === 'lmp' ? { lmp: date, cycleLength } : source === 'conception' ? { conceptionDate: date } : { dueDate: date };
      await onDone(await api.post('/pregnancy', body));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 16 }}>
      <T variant="muted">{tr("Choisis la date que tu connais. La date du terme donnée par l’échographie de datation est la plus précise.")}</T>
      <Segmented
        items={[
          { key: 'lmp', label: tr("Règles") },
          { key: 'conception', label: tr("Début") },
          { key: 'due', label: tr("Terme") },
        ]}
        value={source}
        onChange={(v) => {
          setSource(v);
          setDate(null);
        }}
      />
      <DateField
        label={source === 'lmp' ? tr("Premier jour des dernières règles (DDR)") : source === 'conception' ? tr("Date de début de grossesse") : tr("Date prévue du terme")}
        value={date}
        onChange={setDate}
        maxDay={source === 'due' ? addDays(today, 300) : today}
        minDay={source === 'due' ? today : addDays(today, -300)}
      />
      {source === 'lmp' ? <Stepper label={tr("Durée habituelle du cycle")} value={cycleLength} onChange={setCycleLength} min={20} max={45} suffix=" j" /> : null}
      <Button title={tr("Activer le mode grossesse")} onPress={submit} loading={busy} disabled={!date} />
    </View>
  );
}

export default function Pregnancy() {
  const toast = useToast();
  const { setSession } = useAuth();
  const { data, loading, error, reload } = useApi('/pregnancy');
  const { openEnd, sheets } = usePeriodActions(reload);
  const [endOpen, setEndOpen] = useState(false);
  const [birth, setBirth] = useState(serverToday());
  const [message, setMessage] = useState(null);

  if (loading && !data) return <Screen back title={tr("Grossesse")}><Loader /></Screen>;
  if (error && !data) return <Screen back title={tr("Grossesse")}><ErrorState error={error} onRetry={reload} /></Screen>;

  const end = async (outcome) => {
    try {
      const r = await api.post('/pregnancy/end', { outcome, date: birth });
      await setSession(r.session);
      setEndOpen(false);
      setMessage(r.message);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (!data.active) {
    return (
      <Screen back title={data.mode === 'postpartum' ? tr("Post-partum") : tr("Mode grossesse")}>
        {message ? (
          <>
            <Card tone="soft" style={{ gap: 8 }}>
              <T>{message}</T>
            </Card>
            <Gap />
          </>
        ) : null}
        {data.mode === 'postpartum' ? (
          <View style={{ gap: 14 }}>
            <Card tone="hero" style={{ gap: 6 }}>
              <Label color={colors.rose}>{tr("Post-partum")}</Label>
              <T variant="h2" color={colors.white}>{tr("Naissance le")} {data.deliveryDate ? dayMonth(data.deliveryDate) : '—'}</T>
              <T color={colors.white}>{tr("Durée maximale du nifas retenue :")} {data.maxNifasDays} {tr("jours.")}</T>
            </Card>
            <Button title={tr("Mes saignements sont terminés")} onPress={() => openEnd(null, 'nifas')} />
            <Notice title={tr("Après le nifas")}>{tr("Fais ton ghusl et reprends la prière. Le retour des règles est imprévisible, surtout si tu allaites : pas de prédiction avant deux cycles enregistrés.")}</Notice>
            <Button
              title={tr("Reprendre le suivi du cycle")}
              variant="outline"
              onPress={async () => {
                await setSession(await api.post('/pregnancy/resume-cycle'));
                router.replace('/');
              }}
            />
          </View>
        ) : (
          <Setup
            onDone={async (r) => {
              await setSession(r.session);
              reload();
            }}
          />
        )}
        {sheets}
      </Screen>
    );
  }

  const st = data.status;
  return (
    <Screen back title={tr("Ma grossesse")} onRefresh={reload}>
      <Card tone="hero" style={{ gap: 6 }}>
        <Row justify="space-between">
          <View style={{ flex: 1, gap: 4 }}>
            <Label color={colors.rose}>{tr("Semaine de grossesse")}</Label>
            <T variant="hero">{st.sa.label}</T>
            <T color={colors.white}>
              {st.month}{tr("e mois ·")} {st.trimester}{tr("e trimestre")}
            </T>
          </View>
          <Ring progress={st.progress} size={96}>
            <T variant="h3" color={colors.white}>{Math.max(0, st.daysLeft)}</T>
            <T variant="small" color={colors.rose}>{tr("jours")}</T>
          </Ring>
        </Row>
        <T color={colors.white} style={{ marginTop: 8 }}>
          {tr("Terme prévu le")} {longDate(st.dueDate, { year: true }).toLowerCase()} {tr("(41 SA)")}
        </T>
        <T variant="small" color={colors.rose}>
          {st.sg.weeks} {tr("semaines de grossesse (SG) · calcul basé sur")} {st.source === 'echographie' ? tr("l’échographie") : st.source === 'ddr' ? tr("tes dernières règles") : tr("la date de début")}
        </T>
      </Card>
      <Gap />
      {data.week ? (
        <Card style={{ gap: 8 }}>
          <Label>{tr("Cette semaine")}</Label>
          <T variant="h3">{tr("Bébé a la taille d’")}{data.week.size}</T>
          <T>{data.week.baby}</T>
          <Card tone="soft" style={{ padding: 14 }}>
            <T>{data.week.tip}</T>
          </Card>
          <T variant="small">{tr("Contenu relu par une sage-femme.")}</T>
        </Card>
      ) : null}
      <Gap />
      <Card style={{ gap: 8 }}>
        <Label>{tr("Mes rendez-vous médicaux")}</Label>
        {data.appointments.length ? (
          data.appointments.map((a) => (
            <View key={a._id}>
              <T variant="medium">{a.title}</T>
              <T variant="small">
                {longDate(a.day)}
                {a.time ? ` à ${a.time}` : ''}
              </T>
            </View>
          ))
        ) : (
          <T variant="muted">{tr("Note tes échographies et consultations depuis l’onglet Cycle.")}</T>
        )}
        <Button title={tr("Ajouter dans l’onglet Cycle")} variant="ghost" small onPress={() => router.push('/cycle')} />
      </Card>
      <Gap />
      <Notice title={tr("Jeûne et grossesse")}>{data.fastingInfo}</Notice>
      <Gap />
      <Card tone="soft" style={{ gap: 10 }}>
        <Label color={colors.or}>{tr("Invocations")}</Label>
        {data.duas.map((d) => (
          <View key={d.source} style={{ gap: 2 }}>
            <T variant="quote" style={{ fontSize: 17 }}>{d.text}</T>
            <T variant="small">{d.source}</T>
          </View>
        ))}
      </Card>
      <Gap />
      <Button title={tr("Bébé est né / fin de grossesse")} variant="outline" onPress={() => setEndOpen(true)} />
      <Sheet visible={endOpen} onClose={() => setEndOpen(false)} title={tr("Fin de grossesse")}>
        <DateField label={tr("Date")} value={birth} onChange={setBirth} />
        <Button title={tr("Bébé est né")} onPress={() => end('naissance')} />
        <Button
          title={tr("J’ai fait une fausse couche")}
          variant="outline"
          onPress={() =>
            Alert.alert(tr("Fausse couche"), tr("Nous pensons fort à toi. Confirmer la fin de la grossesse ?"), [
              { text: tr("Annuler"), style: 'cancel' },
              { text: tr("Confirmer"), onPress: () => end('fausse_couche') },
            ])
          }
        />
        <Button title={tr("Arrêter le suivi de grossesse")} variant="ghost" onPress={() => end('arretee')} />
      </Sheet>
      {sheets}
    </Screen>
  );
}

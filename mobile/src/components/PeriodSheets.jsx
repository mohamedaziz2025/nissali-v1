// Saisie des règles (5.3) : « Mes règles ont commencé » (RG-09, RG-18) et
// « Mes règles sont terminées » avec l'heure facultative (RG-11, RG-16, RG-19).
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { sendOrQueue } from '../lib/api';
import { toDay } from '../lib/format';
import { colors, PRAYER_LABELS } from '../theme';
import { DateField, TimeField } from './forms';
import { Button, Card, Label, Notice, Sheet, T, useToast } from './ui';

export function usePeriodActions(onChange) {
  const toast = useToast();
  const [mode, setMode] = useState(null); // start | end | result
  const [periodId, setPeriodId] = useState(null);
  const [kind, setKind] = useState('hayd');
  const [day, setDay] = useState(toDay(new Date()));
  const [time, setTime] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const openStart = () => {
    setDay(toDay(new Date()));
    setTime(null);
    setMode('start');
  };
  const openEnd = (id, k = 'hayd') => {
    setPeriodId(id);
    setKind(k);
    setDay(toDay(new Date()));
    setTime(null);
    setMode('end');
  };
  const close = () => setMode(null);

  const start = async () => {
    setBusy(true);
    try {
      const r = await sendOrQueue('POST', '/cycle/periods/start', { day, ...(time ? { time } : {}) });
      if (r.queued) toast('Enregistré hors connexion, synchronisation au retour du réseau.');
      else toast('C’est noté. Tes rappels de prière sont en pause.');
      setWarnings(r.data?.warnings || []);
      setMode(r.data?.warnings?.length ? 'warnings' : null);
      onChange?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    setBusy(true);
    try {
      const path = kind === 'nifas' ? '/pregnancy/nifas/end' : `/cycle/periods/${periodId}/end`;
      const r = await sendOrQueue('POST', path, { day, ...(time ? { time } : {}) });
      if (r.queued) {
        toast('Enregistré hors connexion.');
        setMode(null);
      } else {
        setResult(r.data);
        setMode('result');
      }
      onChange?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const sheets = (
    <>
      <Sheet visible={mode === 'start'} onClose={close} title="Mes règles ont commencé" footer={<Button title="Confirmer" onPress={start} loading={busy} />}>
        <DateField label="Premier jour" value={day} onChange={setDay} />
        <TimeField label="Heure (facultatif)" value={time} onChange={setTime} hint="Utile pendant Ramadan pour savoir si la journée de jeûne est comptée." />
        <T variant="small">Tes rappels de prière se mettent en pause uniquement après ta confirmation.</T>
      </Sheet>

      <Sheet visible={mode === 'end'} onClose={close} title={kind === 'nifas' ? 'Fin du nifas' : 'Mes règles sont terminées'} footer={<Button title="Confirmer" onPress={end} loading={busy} />}>
        <DateField label="Dernier jour" value={day} onChange={setDay} />
        <TimeField label="Heure de la purification (facultatif)" value={time} onChange={setTime} hint="Avec l’heure, Nissali t’indique la ou les prières à accomplir après le ghusl." />
        <Notice title="Signes de fin">Sécheresse complète ou pertes blanches.</Notice>
      </Sheet>

      <Sheet visible={mode === 'result'} onClose={close} title="Tes prières reprennent" footer={<Button title="Compris" onPress={close} />}>
        <Card tone="hero" style={{ gap: 8 }}>
          <Label color={colors.rose}>Après ton ghusl</Label>
          {result?.prayers?.prayers?.length ? (
            <>
              <T variant="h3" color={colors.white}>{result.prayers.prayers.map((p) => PRAYER_LABELS[p]).join(' et ')}</T>
              <T color={colors.white}>à accomplir, selon l’avis retenu par notre comité.</T>
            </>
          ) : result?.prayers ? (
            <T color={colors.white}>Aucune prière à rattraper : reprends avec {PRAYER_LABELS[result.prayers.next]} à son heure.</T>
          ) : (
            <T color={colors.white}>Indique l’heure de ta purification pour savoir quelles prières accomplir.</T>
          )}
        </Card>
        <View style={{ gap: 8 }}>
          <Label>Le ghusl, pas à pas</Label>
          {(result?.ghuslSteps || []).map((s, i) => (
            <T key={i}>
              {i + 1}. {s}
            </T>
          ))}
        </View>
        <Button title="Lire le guide du ghusl" variant="outline" onPress={() => { close(); router.push('/blog/comment-faire-mes-grandes-ablutions-ghusl'); }} />
        <T variant="small">En cas de doute, rapproche-toi d’une personne de science.</T>
      </Sheet>

      <Sheet visible={mode === 'warnings'} onClose={close} title="À savoir" footer={<Button title="Compris" onPress={close} />}>
        {warnings.map((w) => (
          <Notice key={w.key}>{w.text}</Notice>
        ))}
      </Sheet>
    </>
  );

  return { openStart, openEnd, sheets };
}

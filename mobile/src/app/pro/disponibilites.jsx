// Disponibilités hebdomadaires et congés.
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { DateField } from '../../components/forms';
import Icon from '../../components/Icon';
import { Button, Card, ErrorState, Field, Gap, Label, Loader, Row, Screen, Sheet, T, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { addDays, longDate, toDay, WEEKDAY_NAMES } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors } from '../../theme';

import { tr } from '../../lib/i18n';
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const valid = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export default function Availability() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/pro/availability');
  const [slots, setSlots] = useState([]);
  const [adding, setAdding] = useState(null);
  const [off, setOff] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setSlots(data.slots.map(({ weekday, start, end }) => ({ weekday, start, end })));
  }, [data]);
  if (loading && !data) return <Screen back title={tr("Disponibilités")}><Loader /></Screen>;
  if (error && !data) return <Screen back title={tr("Disponibilités")}><ErrorState error={error} onRetry={reload} /></Screen>;

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/pro/availability', { slots });
      toast(tr("Disponibilités enregistrées"));
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const saveOff = async () => {
    try {
      await api.post('/pro/time-off', off);
      setOff(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Screen back title={tr("Disponibilités")} footer={<View style={{ padding: 20 }}><Button title={tr("Enregistrer mes horaires")} onPress={save} loading={busy} /></View>}>
      {ORDER.map((wd) => {
        const list = slots.map((s, i) => ({ ...s, i })).filter((s) => s.weekday === wd);
        return (
          <Card key={wd} style={{ marginBottom: 10, gap: 8, paddingVertical: 14 }}>
            <Row justify="space-between">
              <T variant="bold">{WEEKDAY_NAMES[wd]}</T>
              <Pressable onPress={() => setAdding({ weekday: wd, start: '09:00', end: '12:00' })} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr("Ajouter une plage le {0}", [WEEKDAY_NAMES[wd]])}>
                <Icon name="plus" size={22} color={colors.bordeaux} />
              </Pressable>
            </Row>
            {list.length ? (
              list.map((s) => (
                <Row key={s.i} justify="space-between">
                  <T>
                    {s.start} – {s.end}
                  </T>
                  <Pressable onPress={() => setSlots((all) => all.filter((_, j) => j !== s.i))} hitSlop={10} accessibilityLabel={tr("Retirer")}>
                    <Icon name="close" size={18} color={colors.muted} />
                  </Pressable>
                </Row>
              ))
            ) : (
              <T variant="small">{tr("Fermé")}</T>
            )}
          </Card>
        );
      })}
      <Gap />
      <Card style={{ gap: 8 }}>
        <Row justify="space-between">
          <Label>{tr("Congés et absences")}</Label>
          <Pressable onPress={() => setOff({ from: toDay(new Date()), to: addDays(toDay(new Date()), 7), reason: '' })} hitSlop={10}>
            <T variant="medium" color={colors.bordeaux}>{tr("+ Ajouter")}</T>
          </Pressable>
        </Row>
        {data.timeOff.length ? (
          data.timeOff.map((t) => (
            <Row key={t._id} justify="space-between">
              <T style={{ flex: 1 }}>
                {tr("Du")} {longDate(t.from)} {tr("au")} {longDate(t.to)}
                {t.reason ? ` · ${t.reason}` : ''}
              </T>
              <Pressable onPress={() => api.delete(`/pro/time-off/${t._id}`).then(reload)} accessibilityLabel={tr("Supprimer")}>
                <Icon name="trash" size={18} color={colors.muted} />
              </Pressable>
            </Row>
          ))
        ) : (
          <T variant="small">{tr("Aucun congé prévu.")}</T>
        )}
      </Card>
      <Sheet
        visible={Boolean(adding)}
        onClose={() => setAdding(null)}
        title={adding ? WEEKDAY_NAMES[adding.weekday] : ''}
        footer={
          <Button
            title={tr("Ajouter")}
            disabled={!adding || !valid(adding.start) || !valid(adding.end) || adding.end <= adding.start}
            onPress={() => {
              setSlots((s) => [...s, adding]);
              setAdding(null);
            }}
          />
        }
      >
        {adding ? (
          <>
            <Field label={tr("Début")} value={adding.start} onChangeText={(v) => setAdding((a) => ({ ...a, start: v }))} placeholder="09:00" maxLength={5} />
            <Field label={tr("Fin")} value={adding.end} onChangeText={(v) => setAdding((a) => ({ ...a, end: v }))} placeholder="12:00" maxLength={5} />
          </>
        ) : null}
      </Sheet>
      <Sheet visible={Boolean(off)} onClose={() => setOff(null)} title={tr("Congé")} footer={<Button title={tr("Ajouter")} onPress={saveOff} />}>
        {off ? (
          <>
            <DateField label={tr("Du")} value={off.from} onChange={(v) => setOff((o) => ({ ...o, from: v }))} maxDay={addDays(toDay(new Date()), 365)} minDay={toDay(new Date())} />
            <DateField label={tr("Au")} value={off.to} onChange={(v) => setOff((o) => ({ ...o, to: v }))} maxDay={addDays(toDay(new Date()), 365)} minDay={off.from} />
            <Field label={tr("Motif (facultatif)")} value={off.reason} onChangeText={(v) => setOff((o) => ({ ...o, reason: v }))} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

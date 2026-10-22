// Mise à jour Cycle · 6.9 à 6.11 — feuilles de modification : date, valeur, « Supprimer » (si la valeur
// existe) et « Enregistrer ». Sommeil : − / + par 15 min (0 à 16 h), nuit = date du réveil.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { sendOrQueue } from '../lib/api';
import { cap, longDate, today as serverToday } from '../lib/format';
import { colors, fonts, MOODS, SYMPTOMS, tnum } from '../theme';
import { MoodFace } from './HealthCards';
import { Button, Chips, Row, Sheet, useToast } from './ui';

import { tr } from '../lib/i18n';
export const hm = (h) => (h == null ? '—' : `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`);

/** « Aujourd’hui · mer. 21 oct. », « Hier · … » ou la date. */
export function dayTitle(day) {
  const today = serverToday();
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);
  const label = cap(longDate(day));
  return day === today ? tr("Aujourd’hui · {0}", [label]) : day === yesterday ? tr("Hier · {0}", [label]) : label;
}

function DateRow({ day }) {
  return (
    <View style={s.date}>
      <Text style={s.dateLabel}>{tr("Date")}</Text>
      <Text style={s.dateValue}>{dayTitle(day)}</Text>
    </View>
  );
}

function Footer({ exists, onDelete, onSave, busy, disabled }) {
  return (
    <Row gap={10}>
      {exists ? <Button title={tr("Supprimer")} variant="outline" onPress={onDelete} disabled={busy} style={{ flex: 1 }} /> : null}
      <Button title={tr("Enregistrer")} onPress={onSave} loading={busy} disabled={busy || disabled} style={{ flex: exists ? 1.6 : 1 }} />
    </Row>
  );
}

function useSave(day, onSaved, onClose) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const save = async (patch, message) => {
    setBusy(true);
    try {
      await sendOrQueue('PUT', `/health-log/day/${day}`, patch);
      toast(message);
      onSaved?.();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return { busy, save };
}

export function SleepSheet({ visible, day, value, onClose, onSaved }) {
  const [h, setH] = useState(7.5);
  useEffect(() => {
    if (visible) setH(value ?? 7.5);
  }, [visible, value]);
  const { busy, save } = useSave(day, onSaved, onClose);
  if (!day) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title={value != null ? tr("Modifier la nuit") : tr("Ajouter une nuit")} footer={<Footer exists={value != null} busy={busy} onDelete={() => save({ sleepHours: null }, tr("Nuit supprimée"))} onSave={() => save({ sleepHours: h }, tr("Sommeil enregistré"))} />}>
      <DateRow day={day} />
      <Row gap={12} justify="space-between">
        <Pressable onPress={() => setH((v) => Math.max(0, v - 0.25))} accessibilityRole="button" accessibilityLabel={tr("Moins 15 minutes")} style={s.step}>
          <Text style={s.stepText}>−</Text>
        </Pressable>
        <Text style={[s.value, tnum]}>{hm(h)}</Text>
        <Pressable onPress={() => setH((v) => Math.min(16, v + 0.25))} accessibilityRole="button" accessibilityLabel={tr("Plus 15 minutes")} style={s.step}>
          <Text style={s.stepText}>+</Text>
        </Pressable>
      </Row>
      <Text style={s.hint}>{tr("La nuit compte à la date du réveil.")}</Text>
    </Sheet>
  );
}

export function MoodSheet({ visible, day, value, onClose, onSaved }) {
  const [mood, setMood] = useState(null);
  useEffect(() => {
    if (visible) setMood(value || null);
  }, [visible, value]);
  const { busy, save } = useSave(day, onSaved, onClose);
  if (!day) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title={value ? tr("Modifier mon humeur") : tr("Mon humeur")} footer={<Footer exists={Boolean(value)} busy={busy} disabled={!mood} onDelete={() => save({ mood: null }, tr("Humeur supprimée"))} onSave={() => save({ mood }, tr("Humeur enregistrée"))} />}>
      <DateRow day={day} />
      <Row gap={2} justify="space-between">
        {MOODS.map((m) => {
          const on = mood === m.key;
          return (
            <Pressable key={m.key} onPress={() => setMood(m.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={m.label} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
              <MoodFace mood={m.key} on={on} size={44} />
              <Text style={[s.moodLabel, on && { color: colors.bordeaux, fontFamily: fonts.bold }]} numberOfLines={1}>{m.label}</Text>
            </Pressable>
          );
        })}
      </Row>
    </Sheet>
  );
}

export function SymptomsSheet({ visible, day, value, onClose, onSaved }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (visible) setList(value || []);
  }, [visible, value]);
  const { busy, save } = useSave(day, onSaved, onClose);
  if (!day) return null;
  const today = day === serverToday();
  return (
    <Sheet visible={visible} onClose={onClose} title={today ? tr("Mes symptômes aujourd’hui") : tr("Mes symptômes")} footer={<Footer exists={false} busy={busy} onSave={() => save({ symptoms: list }, tr("Symptômes enregistrés"))} />}>
      <DateRow day={day} />
      <Chips items={Object.entries(SYMPTOMS).map(([key, label]) => ({ key, label }))} value={list} onChange={setList} multi />
    </Sheet>
  );
}

const s = StyleSheet.create({
  date: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.creme, borderRadius: 14, paddingHorizontal: 14, minHeight: 46 },
  dateLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  dateValue: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.prune },
  step: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.bold, fontSize: 24, color: colors.bordeaux, marginTop: -2 },
  value: { fontFamily: fonts.extra, fontSize: 30, color: colors.bordeaux },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
  moodLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
});

// 02 / 03 — Poids : saisie numérique en kg (virgule acceptée), datée du jour par défaut et modifiable,
// correction et suppression d'une mesure.
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { shortDate, toDay } from '../lib/format';
import { colors, fonts } from '../theme';
import { DateField } from './forms';
import Icon from './Icon';
import { Button, Label, Sheet, T, useToast } from './ui';

import { tr } from '../lib/i18n';
/** « 64,2 » */
export const kg = (v) => (v == null ? '' : String(Math.round(v * 10) / 10).replace('.', ','));
/** Lit « 64,2 » ou « 64.2 » ; NaN si la saisie n'est pas un nombre. */
export const parseKg = (t) => (/^\s*\d{1,3}([.,]\d{1,2})?\s*$/.test(t || '') ? Number(t.trim().replace(',', '.')) : NaN);

function confirmAction(title, message, label, action, destructive = false) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [{ text: tr("Annuler"), style: 'cancel' }, { text: label, style: destructive ? 'destructive' : 'default', onPress: action }]);
}
const confirm = (title, message, action) => confirmAction(title, message, 'Supprimer', action, true);

/**
 * Fenêtre « Ajouter une mesure » / « Modifier la mesure ».
 * entry : mesure existante à corriger ({ day, weight }) ; sinon nouvelle mesure datée du jour.
 */
export function WeightSheet({ visible, onClose, entry, lastWeight, onSaved, day: presetDay }) {
  const toast = useToast();
  const [day, setDay] = useState(toDay(new Date()));
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setDay(entry?.day || presetDay || toDay(new Date()));
    setText(entry ? kg(entry.weight) : lastWeight != null ? kg(lastWeight) : '');
    setError(null);
  }, [visible, entry, lastWeight, presetDay]);

  const value = parseKg(text);
  const step = (d) => {
    const base = Number.isFinite(value) ? value : lastWeight ?? 60;
    setText(kg(Math.min(300, Math.max(25, Math.round((base + d) * 10) / 10))));
    setError(null);
  };
  const save = async (confirmed = false) => {
    // Saisie invalide : message, sans effacer ce qui a été tapé.
    if (!Number.isFinite(value)) return setError('Indique ton poids en kg, par exemple 64,2');
    if (value < 25 || value > 300) return setError('Poids invalide : entre 25 et 300 kg');
    // Mise à jour Cycle · 6.8 — écart de plus de 5 kg avec la pesée précédente : on demande confirmation.
    if (!confirmed && lastWeight != null && Math.abs(value - lastWeight) > 5) {
      return confirmAction(tr("Tu confirmes ?"), tr("{0} kg, soit plus de 5 kg d’écart avec ta pesée précédente ({1} kg).", [kg(value), kg(lastWeight)]), 'Confirmer', () => save(true));
    }
    setBusy(true);
    try {
      await api.put(`/health-log/weights/${day}`, { weight: value });
      if (entry && entry.day !== day) await api.delete(`/health-log/weights/${entry.day}`).catch(() => {});
      toast(tr("Poids enregistré"));
      onSaved?.({ day, weight: value });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    confirm(tr("Supprimer cette mesure ?"), tr("{0} kg le {1}", [kg(entry.weight), shortDate(entry.day)]), async () => {
      try {
        await api.delete(`/health-log/weights/${entry.day}`);
        toast(tr("Mesure supprimée"));
        onSaved?.(null);
        onClose();
      } catch (e) {
        setError(e.message);
      }
    });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={entry ? tr("Modifier la mesure") : tr("Ajouter une mesure")}
      footer={
        <View style={{ gap: 10 }}>
          <Button title={tr("Enregistrer mon poids")} onPress={() => save()} loading={busy} disabled={busy} />
          <Button title={tr("Annuler")} variant="outline" onPress={onClose} />
        </View>
      }
    >
      <DateField label={tr("Date")} value={day} onChange={setDay} />
      <View style={{ gap: 8 }}>
        <Label>{tr("Poids (kg)")}</Label>
        <View style={s.row}>
          <Pressable onPress={() => step(-0.1)} accessibilityRole="button" accessibilityLabel={tr("Moins 100 grammes")} style={s.stepBtn}>
            <Text style={s.stepText}>−</Text>
          </Pressable>
          <View style={[s.input, error && { borderColor: colors.danger }]}>
            <TextInput
              value={text}
              onChangeText={(t) => {
                setText(t);
                setError(null);
              }}
              keyboardType="decimal-pad"
              placeholder="64,2"
              placeholderTextColor="#A88C93"
              accessibilityLabel={tr("Poids en kilogrammes")}
              style={s.inputText}
              maxLength={6}
            />
            <Text style={s.unit}>{tr("kg")}</Text>
          </View>
          <Pressable onPress={() => step(0.1)} accessibilityRole="button" accessibilityLabel={tr("Plus 100 grammes")} style={s.stepBtn}>
            <Text style={s.stepText}>+</Text>
          </Pressable>
        </View>
        {error ? <T variant="small" color={colors.danger}>{error}</T> : <T variant="small">{tr("Tu peux modifier la date pour une mesure passée.")}</T>}
      </View>
      {entry ? (
        <Pressable onPress={remove} accessibilityRole="button" style={s.delete}>
          <Icon name="trash" size={17} color={colors.danger} />
          <Text style={s.deleteText}>{tr("Supprimer cette mesure")}</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.bold, fontSize: 24, color: colors.bordeaux, marginTop: -2 },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 18 },
  inputText: { flex: 1, fontFamily: fonts.title, fontSize: 24, color: colors.prune, textAlign: 'center' },
  unit: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  delete: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', paddingVertical: 6 },
  deleteText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.danger },
});

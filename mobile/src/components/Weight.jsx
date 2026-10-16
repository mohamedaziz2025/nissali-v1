// 02 / 03 — Poids : saisie numérique en kg (virgule acceptée), datée du jour par défaut et modifiable,
// correction et suppression d'une mesure ; graphique d'évolution.
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { api } from '../lib/api';
import { shortDate, toDay } from '../lib/format';
import { colors, fonts } from '../theme';
import { DateField } from './forms';
import Icon from './Icon';
import { Button, Label, Sheet, T, useToast } from './ui';

/** « 64,2 » */
export const kg = (v) => (v == null ? '' : String(Math.round(v * 10) / 10).replace('.', ','));
/** Lit « 64,2 » ou « 64.2 » ; NaN si la saisie n'est pas un nombre. */
export const parseKg = (t) => (/^\s*\d{1,3}([.,]\d{1,2})?\s*$/.test(t || '') ? Number(t.trim().replace(',', '.')) : NaN);

function confirm(title, message, action) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: action }]);
}

/**
 * Fenêtre « Ajouter une mesure » / « Modifier la mesure ».
 * entry : mesure existante à corriger ({ day, weight }) ; sinon nouvelle mesure datée du jour.
 */
export function WeightSheet({ visible, onClose, entry, lastWeight, onSaved }) {
  const toast = useToast();
  const [day, setDay] = useState(toDay(new Date()));
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setDay(entry?.day || toDay(new Date()));
    setText(entry ? kg(entry.weight) : lastWeight != null ? kg(lastWeight) : '');
    setError(null);
  }, [visible, entry, lastWeight]);

  const value = parseKg(text);
  const step = (d) => {
    const base = Number.isFinite(value) ? value : lastWeight ?? 60;
    setText(kg(Math.min(300, Math.max(25, Math.round((base + d) * 10) / 10))));
    setError(null);
  };
  const save = async () => {
    // Saisie invalide : message, sans effacer ce qui a été tapé.
    if (!Number.isFinite(value)) return setError('Indique ton poids en kg, par exemple 64,2');
    if (value < 25 || value > 300) return setError('Poids invalide : entre 25 et 300 kg');
    setBusy(true);
    try {
      await api.put(`/health-log/weights/${day}`, { weight: value });
      if (entry && entry.day !== day) await api.delete(`/health-log/weights/${entry.day}`).catch(() => {});
      toast('Poids enregistré');
      onSaved?.({ day, weight: value });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    confirm('Supprimer cette mesure ?', `${kg(entry.weight)} kg le ${shortDate(entry.day)}`, async () => {
      try {
        await api.delete(`/health-log/weights/${entry.day}`);
        toast('Mesure supprimée');
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
      title={entry ? 'Modifier la mesure' : 'Ajouter une mesure'}
      footer={
        <View style={{ gap: 10 }}>
          <Button title="Enregistrer mon poids" onPress={save} loading={busy} disabled={busy} />
          <Button title="Annuler" variant="outline" onPress={onClose} />
        </View>
      }
    >
      <DateField label="Date" value={day} onChange={setDay} />
      <View style={{ gap: 8 }}>
        <Label>Poids (kg)</Label>
        <View style={s.row}>
          <Pressable onPress={() => step(-0.1)} accessibilityRole="button" accessibilityLabel="Moins 100 grammes" style={s.stepBtn}>
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
              accessibilityLabel="Poids en kilogrammes"
              style={s.inputText}
              maxLength={6}
            />
            <Text style={s.unit}>kg</Text>
          </View>
          <Pressable onPress={() => step(0.1)} accessibilityRole="button" accessibilityLabel="Plus 100 grammes" style={s.stepBtn}>
            <Text style={s.stepText}>+</Text>
          </Pressable>
        </View>
        {error ? <T variant="small" color={colors.danger}>{error}</T> : <T variant="small">Tu peux modifier la date pour une mesure passée.</T>}
      </View>
      {entry ? (
        <Pressable onPress={remove} accessibilityRole="button" style={s.delete}>
          <Icon name="trash" size={17} color={colors.danger} />
          <Text style={s.deleteText}>Supprimer cette mesure</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

/** Courbe de poids : une série, trait de 2 px, points de 8 px, grille discrète. */
export function WeightChart({ items, width, height = 150 }) {
  const pts = items.slice(-12);
  if (pts.length < 2) return <T variant="small" style={{ paddingVertical: 12 }}>La courbe apparaîtra dès ta deuxième mesure.</T>;
  const values = pts.map((p) => p.weight);
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const left = 30;
  const top = 10;
  const bottom = 24;
  const w = width - left - 8;
  const h = height - top - bottom;
  const x = (i) => left + (pts.length === 1 ? w / 2 : (i / (pts.length - 1)) * w);
  const y = (v) => top + (1 - (v - lo) / (hi - lo)) * h;
  const ticks = [hi, Math.round((hi + lo) / 2), lo];
  const labels = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  return (
    <Svg width={width} height={height} accessibilityLabel={`Courbe de poids : de ${kg(values[0])} à ${kg(values[values.length - 1])} kg`}>
      {ticks.map((t) => (
        <Line key={t} x1={left} x2={left + w} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
      ))}
      {ticks.map((t) => (
        <SvgText key={`l${t}`} x={left - 6} y={y(t) + 4} fontSize={11} fill={colors.muted} textAnchor="end">
          {t}
        </SvgText>
      ))}
      <Path d={pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.weight)}`).join(' ')} stroke={colors.bordeaux} strokeWidth={2} fill="none" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <Circle key={p.day} cx={x(i)} cy={y(p.weight)} r={i === pts.length - 1 ? 5.5 : 4} fill={colors.bordeaux} stroke={colors.white} strokeWidth={2} />
      ))}
      {labels.map((i) => (
        <SvgText key={`d${i}`} x={x(i)} y={height - 6} fontSize={11} fill={colors.muted} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}>
          {shortDate(pts[i].day)}
        </SvgText>
      ))}
    </Svg>
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

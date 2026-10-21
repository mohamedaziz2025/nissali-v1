// 5.12 — Fréquence des notifications : Faible (par défaut), Modérée, Élevée. Ne touche jamais aux rappels
// de prière ni aux rappels personnels (notes, jeûnes) : choisir « Faible » ne fait perdre aucun rappel demandé.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import Icon from './Icon';

import { tr } from '../lib/i18n';
export const FREQUENCIES = [
  { key: 'faible', label: tr("Faible"), hint: tr("Uniquement les rappels essentiels que tu as activés"), more: 'Aucun conseil ni actualité' },
  { key: 'moderee', label: tr("Modérée"), hint: tr("Les essentiels + quelques conseils et actualités"), more: '3 notifications maximum par semaine' },
  { key: 'elevee', label: tr("Élevée"), hint: tr("Davantage de conseils, de contenus et de nouveautés"), more: '5 notifications maximum par semaine' },
];

export function FrequencyPicker({ value = 'faible', onChange }) {
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup">
      {FREQUENCIES.map((f) => {
        const on = value === f.key;
        return (
          <Pressable key={f.key} onPress={() => onChange(f.key)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${f.label}. ${f.hint}. ${f.more}`} style={({ pressed }) => [s.option, on && s.optionOn, pressed && { opacity: 0.85 }]}>
            <View style={[s.radio, on && { borderColor: colors.bordeaux }]}>{on ? <View style={s.dot} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>
                {f.label}
                {f.key === 'faible' ? <Text style={s.default}> {tr("· par défaut")}</Text> : null}
              </Text>
              <Text style={s.hint}>{f.hint}</Text>
              <Text style={s.more}>{f.more}</Text>
            </View>
            {on ? <Icon name="check" size={18} color={colors.bordeaux} strokeWidth={2.4} /> : null}
          </Pressable>
        );
      })}
      <Text style={s.note}>{tr("Tes rappels de prière, de notes et de jeûnes ne changent pas, quel que soit le niveau. Pas de conseil la nuit (22:00–08:00) ni à l’heure d’une prière, jamais deux le même jour.")}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  optionOn: { borderColor: colors.bordeaux, backgroundColor: colors.blush },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.bordeaux },
  label: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  default: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.prune },
  more: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  note: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 },
});

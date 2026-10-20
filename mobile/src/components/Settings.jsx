// Écrans de réglages (4.5) : carte blanche avec titre, sélecteur segmenté.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export function SettingsCard({ title, children, onLayout, style }) {
  return (
    <View onLayout={onLayout} style={[s.card, style]}>
      {title ? <Text style={s.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Segment({ items, value, onChange }) {
  return (
    <View style={s.segment} accessibilityRole="radiogroup">
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={String(it.key)} onPress={() => onChange(it.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[s.segItem, on && s.segOn]}>
            <Text style={[s.segText, on && { color: colors.white }]} numberOfLines={1} adjustsFontSizeToFit>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 14, gap: 6, borderWidth: 1, borderColor: colors.line },
  cardTitle: { fontFamily: fonts.extra, fontSize: 17, color: colors.prune, marginBottom: 4 },
  segment: { flexDirection: 'row', backgroundColor: colors.blush, borderRadius: 999, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segOn: { backgroundColor: colors.bordeaux },
  segText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.prune },
});

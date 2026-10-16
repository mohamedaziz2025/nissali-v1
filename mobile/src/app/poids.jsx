// 02 / 03 — Mon poids : dernière mesure, courbe, historique ; chaque mesure se corrige ou se supprime.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Icon from '../components/Icon';
import { Button, Card, ErrorState, Gap, Label, Loader, Screen, T } from '../components/ui';
import { kg, WeightChart, WeightSheet } from '../components/Weight';
import { longDate, toDay } from '../lib/format';
import { useApi } from '../lib/useApi';
import { colors, fonts } from '../theme';

export default function MyWeight() {
  const { width } = useWindowDimensions();
  const { data, loading, error, reload } = useApi('/health-log/weights');
  const [sheet, setSheet] = useState(null); // { entry } | { entry: null }

  if (loading && !data) return <Screen back title="Mon poids"><Loader /></Screen>;
  if (error && !data) return <Screen back title="Mon poids"><ErrorState error={error} onRetry={reload} /></Screen>;
  const last = data.last;
  const items = data.items || [];

  return (
    <Screen back title="Mon poids" subtitle={longDate(toDay(new Date()))} onRefresh={reload}>
      <Card tone="soft" style={{ gap: 4 }}>
        <Label>Dernière mesure</Label>
        {last ? (
          <View style={s.lastRow}>
            <Text style={s.lastValue}>{kg(last.weight)} kg</Text>
            <Pressable onPress={() => setSheet({ entry: last })} accessibilityRole="button" accessibilityLabel="Modifier la dernière mesure" hitSlop={8} style={s.edit}>
              <Icon name="edit" size={16} color={colors.bordeaux} />
              <Text style={s.editText}>Modifier</Text>
            </Pressable>
          </View>
        ) : (
          <T variant="h3">Aucune mesure pour l’instant</T>
        )}
        {last ? <T variant="small">{longDate(last.day)}</T> : null}
      </Card>
      <Gap />
      {items.length ? (
        <Card style={{ paddingHorizontal: 16 }}>
          <WeightChart items={items} width={Math.min(width, 640) - 40 - 32} />
        </Card>
      ) : null}
      <Gap />
      <Button title={last ? 'Ajouter une mesure' : 'Ajouter mon poids'} icon="plus" onPress={() => setSheet({ entry: null })} />
      {items.length ? (
        <>
          <Gap h={22} />
          <Label>Historique</Label>
          <Gap h={8} />
          <View style={s.list}>
            {[...items].reverse().map((m, i, arr) => (
              <Pressable key={m.day} onPress={() => setSheet({ entry: m })} accessibilityRole="button" accessibilityLabel={`${kg(m.weight)} kilos le ${longDate(m.day)}, modifier`} style={[s.item, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <T style={{ flex: 1 }}>{longDate(m.day)}</T>
                <Text style={s.itemValue}>{kg(m.weight)} kg</Text>
                <Icon name="edit" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <WeightSheet visible={Boolean(sheet)} entry={sheet?.entry || null} lastWeight={last?.weight} onClose={() => setSheet(null)} onSaved={reload} />
    </Screen>
  );
}

const s = StyleSheet.create({
  lastRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastValue: { fontFamily: fonts.title, fontSize: 38, color: colors.prune },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editText: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux, textDecorationLine: 'underline' },
  list: { backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.line },
  itemValue: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.prune },
});

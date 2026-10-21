// Mise à jour Cycle · 6.8 à 6.11 — structure commune des pages détail : retour, titre, bouton rond « + »
// (valeur pour aujourd'hui), sélecteur Semaine / Mois / 6 mois, carte résumé + graphique, liste des 7 derniers
// jours (toucher une ligne ouvre la feuille de modification).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays } from '../lib/format';
import { colors, fonts } from '../theme';
import { PERIODS } from './HealthCharts';
import { dayTitle } from './HealthEditSheets';
import Icon from './Icon';
import { ErrorState, Gap, Loader, Row, Screen, Segmented } from './ui';

import { tr } from '../lib/i18n';
export function HealthDetailScreen({ title, onAdd, period, onPeriod, loading, error, onRetry, onRefresh, children }) {
  const right = (
    <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={tr("Ajouter ({0}) pour aujourd’hui", [title.toLowerCase()])} hitSlop={6} style={s.add}>
      <Icon name="plus" size={20} color={colors.white} />
    </Pressable>
  );
  if (loading) return <Screen back title={title} right={right}><Loader /></Screen>;
  if (error) return <Screen back title={title} right={right}><ErrorState error={error} onRetry={onRetry} /></Screen>;
  return (
    <Screen back title={title} right={right} onRefresh={onRefresh}>
      <Segmented items={PERIODS} value={period} onChange={onPeriod} />
      <Gap h={14} />
      {children}
    </Screen>
  );
}

export function SummaryCard({ children }) {
  return <View style={s.card}>{children}</View>;
}

/** Liste des 7 derniers jours : date à gauche, valeur à droite, chevron. */
export function LastDays({ title, today, render, onPress }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  return (
    <View style={{ marginTop: 18 }}>
      <Row justify="space-between" style={{ marginBottom: 8 }}>
        <Text style={s.listTitle}>{title}</Text>
        <Text style={s.listHint}>{tr("Touche une ligne pour la modifier")}</Text>
      </Row>
      <View style={s.list}>
        {days.map((d, i) => (
          <Pressable key={d} onPress={() => onPress(d)} accessibilityRole="button" accessibilityLabel={tr("{0}, modifier", [dayTitle(d)])} style={({ pressed }) => [s.row, i === days.length - 1 && { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}>
            <Text style={s.rowDay} numberOfLines={1}>{dayTitle(d)}</Text>
            {render(d)}
            <Icon name="chevronRight" size={14} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export const detailStyles = StyleSheet.create({
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  big: { fontFamily: fonts.extra, fontSize: 30, letterSpacing: -0.8, color: colors.bordeaux },
  value: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
  empty: { fontFamily: fonts.bold, fontSize: 13, color: colors.caseVide },
});

const s = StyleSheet.create({
  add: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.line },
  listTitle: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
  listHint: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  list: { backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowDay: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.prune },
});

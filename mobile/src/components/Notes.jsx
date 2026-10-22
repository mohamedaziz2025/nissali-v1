// 5.2 bis — Mes notes : ligne de note (date, titre, répétition) réutilisée sur l'accueil et dans les listes.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { parseDay, MONTHS_SHORT as FMT_MONTHS_SHORT, WEEK as FMT_WEEK } from '../lib/format';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
export const NOTE_TYPES = [
  { key: 'medicament', label: tr("Médicament") },
  { key: 'cours', label: tr("Cours") },
  { key: 'rendez_vous', label: tr("Rendez-vous") },
  { key: 'symptome', label: tr("Symptôme") },
  { key: 'autre', label: tr("Autre") },
];
export const NOTE_REPEATS = [
  { key: 'once', label: tr("Une fois") },
  { key: 'daily', label: tr("Chaque jour") },
  { key: 'weekly', label: tr("Chaque semaine") },
  { key: 'monthly', label: tr("Chaque mois") },
];
// Lundi en premier ; valeurs JS (0 = dimanche).
export const NOTE_WEEKDAYS = FMT_WEEK;
const MONTHS = FMT_MONTHS_SHORT;
const DAYS = [tr("Dim."), tr("Lun."), tr("Mar."), tr("Mer."), tr("Jeu."), tr("Ven."), tr("Sam.")];

/** « Lun. 19 oct. » */
export const noteDate = (day) => {
  const d = parseDay(day);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** Ligne « 19 OCT · Comprimé de fer · Chaque lundi » (style de la maquette). */
export function NoteRow({ n, onPress, compact, last }) {
  const d = parseDay(n.day);
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${n.text}, ${noteDate(n.day)}${n.time ? ` à ${n.time}` : ''}, ${n.repeatLabel}${n.paused ? tr(", en pause") : ''}`} style={({ pressed }) => [s.row, !last && s.rowLine, pressed && { opacity: 0.8 }, n.paused && { opacity: 0.55 }]}>
      {compact ? (
        <View style={s.bar} />
      ) : (
        <View style={s.date}>
          <Text style={s.dateDay}>{d.getUTCDate()}</Text>
          <Text style={s.dateMonth}>{MONTHS[d.getUTCMonth()].replace('.', '').toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.title} numberOfLines={1}>{n.text}</Text>
        {compact ? <Text style={s.meta} numberOfLines={1}>{noteDate(n.day)}{n.time ? ` · ${n.time}` : ''}</Text> : n.time ? <Text style={s.meta}>{n.time}</Text> : null}
      </View>
      <View style={[s.pill, n.repeat === 'once' && s.pillOnce]}>
        <Text style={[s.pillText, n.repeat === 'once' && { color: colors.muted }]} numberOfLines={1}>{n.paused ? tr("En pause") : n.repeatLabel}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.bordeaux },
  date: { width: 38, alignItems: 'center' },
  dateDay: { fontFamily: fonts.title, fontSize: 19, lineHeight: 22, color: colors.prune },
  dateMonth: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.6, color: colors.muted },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  meta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  pill: { maxWidth: '42%', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.blush },
  pillOnce: { backgroundColor: colors.ivoire, borderWidth: 1, borderColor: colors.line },
  pillText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.bordeaux },
});

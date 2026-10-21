// Mise à jour Jeûnes — carte « Mes jeûnes » (bas de Surérogatoires). Mois : 3 chiffres (surérogatoires, rattrapés,
// programmés) puis calendrier : or plein = surérogatoire jeûné, bordeaux plein = rattrapage, pointillés or =
// programmé, rose clair = règles, anneau = aujourd'hui. Année : total (hors Ramadan) et barres empilées par mois ;
// toucher une barre ouvre ce mois. Mis à jour dès qu'un jeûne est validé (prop `stamp`).
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useApi } from '../lib/useApi';
import { monthLabel, shiftMonth, MONTH_LETTERS as FMT_MONTH_LETTERS, WEEKDAYS_SHORT as FMT_WEEKDAYS_SHORT } from '../lib/format';
import { colors, fonts } from '../theme';
import { monthGrid } from './Calendar';
import Icon from './Icon';
import { Row, Segmented } from './ui';

import { tr } from '../lib/i18n';
const LETTERS = FMT_WEEKDAYS_SHORT;
const INITIALS = FMT_MONTH_LETTERS;

export default function MyFasts({ stamp, onLayout }) {
  const { width } = useWindowDimensions();
  const [view, setView] = useState('mois');
  const [month, setMonth] = useState(null);
  const o = useApi(`/fasts/overview${month ? `?month=${month}` : ''}`);
  const { reload } = o;
  useEffect(() => {
    if (stamp) reload();
  }, [stamp, reload]);
  const d = o.data;
  const inner = Math.min(width, 640) - 40 - 32;
  const cell = Math.floor(inner / 7);

  const head = (
    <Row justify="space-between">
      <Text style={s.title}>{tr("Mes jeûnes")}</Text>
      <View style={{ width: 150 }}>
        <Segmented
          items={[
            { key: 'mois', label: tr("Mois") },
            { key: 'annee', label: tr("Année") },
          ]}
          value={view}
          onChange={setView}
        />
      </View>
    </Row>
  );
  if (!d) return <View style={s.card} onLayout={onLayout}>{head}</View>;

  const vol = new Set(d.voluntary);
  const made = new Set(d.madeUp);
  const planned = new Set(d.planned);
  const period = new Set(d.period);
  const cur = d.month;
  const maxBar = Math.max(1, ...d.byMonth.map((m) => m.voluntary + m.madeUp));
  const barH = 90;

  return (
    <View style={s.card} onLayout={onLayout}>
      {head}
      {view === 'mois' ? (
        <>
          <Row justify="space-between">
            <Pressable onPress={() => setMonth(shiftMonth(cur, -1))} accessibilityRole="button" accessibilityLabel={tr("Mois précédent")} hitSlop={8} style={s.arrow}>
              <Icon name="chevronLeft" size={15} color={colors.prune} />
            </Pressable>
            <Text style={s.month}>{monthLabel(cur)}</Text>
            <Pressable onPress={() => setMonth(shiftMonth(cur, 1))} accessibilityRole="button" accessibilityLabel={tr("Mois suivant")} hitSlop={8} style={s.arrow}>
              <Icon name="chevronRight" size={15} color={colors.prune} />
            </Pressable>
          </Row>
          <Row gap={8}>
            <View style={[s.stat, { backgroundColor: colors.sable }]}>
              <Text style={[s.statValue, { color: colors.orText }]}>{d.voluntary.length}</Text>
              <Text style={s.statLabel}>{tr("surérogatoires")}</Text>
            </View>
            <View style={[s.stat, { backgroundColor: colors.blush }]}>
              <Text style={[s.statValue, { color: colors.bordeaux }]}>{d.madeUp.length}</Text>
              <Text style={s.statLabel}>{tr("rattrapés")}</Text>
            </View>
            <View style={[s.stat, { backgroundColor: colors.creme }]}>
              <Text style={s.statValue}>{d.planned.length}</Text>
              <Text style={s.statLabel}>{tr("programmés")}</Text>
            </View>
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {LETTERS.map((l, i) => (
              <Text key={i} style={[s.letter, { width: cell }]}>{l}</Text>
            ))}
            {monthGrid(cur).map((day, i) => {
              if (!day) return <View key={`e${i}`} style={{ width: cell, height: cell }} />;
              const isVol = vol.has(day);
              const isMade = made.has(day);
              const isPlanned = !isVol && !isMade && planned.has(day);
              const isPeriod = !isVol && !isMade && !isPlanned && period.has(day);
              const today = day === d.today;
              const size = cell - 8;
              return (
                <View key={day} style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}>
                  <View
                    style={[
                      { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
                      isVol && { backgroundColor: colors.or },
                      isMade && { backgroundColor: colors.bordeaux },
                      isPlanned && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.or },
                      isPeriod && { backgroundColor: colors.blush },
                      today && { borderWidth: 1.5, borderColor: colors.prune },
                    ]}
                  >
                    <Text style={[s.dayNum, (isVol || isMade) && { color: colors.white, fontFamily: fonts.bold }, isPeriod && { color: colors.bordeaux }]}>{Number(day.slice(8))}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <Row gap={12} style={{ flexWrap: 'wrap' }}>
            <Row gap={4}><View style={[s.dot, { backgroundColor: colors.or }]} /><Text style={s.legend}>{tr("Surérogatoire")}</Text></Row>
            <Row gap={4}><View style={[s.dot, { backgroundColor: colors.bordeaux }]} /><Text style={s.legend}>{tr("Rattrapage")}</Text></Row>
            <Row gap={4}><View style={[s.dot, { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.or }]} /><Text style={s.legend}>{tr("Programmé")}</Text></Row>
            <Row gap={4}><View style={[s.dot, { backgroundColor: colors.blush }]} /><Text style={s.legend}>{tr("Règles")}</Text></Row>
          </Row>
        </>
      ) : (
        <>
          <Row gap={8} align="flex-end">
            <Text style={s.total}>{d.yearTotal}</Text>
            <Text style={[s.legend, { marginBottom: 6 }]}>{tr("jours jeûnés en")} {d.year}{tr(", hors Ramadan")}</Text>
          </Row>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: barH, gap: 6 }}>
            {d.byMonth.map((m, i) => {
              const total = m.voluntary + m.madeUp;
              const key = `${d.year}-${String(i + 1).padStart(2, '0')}`;
              return (
                <Pressable key={key} onPress={() => { setMonth(key); setView('mois'); }} accessibilityRole="button" accessibilityLabel={tr("{0} : {1} surérogatoires, {2} rattrapages", [monthLabel(key), m.voluntary, m.madeUp])} style={{ flex: 1, height: barH, justifyContent: 'flex-end' }}>
                  {total ? (
                    <View style={{ borderRadius: 4, overflow: 'hidden' }}>
                      <View style={{ height: (m.voluntary / maxBar) * barH, backgroundColor: colors.or }} />
                      <View style={{ height: (m.madeUp / maxBar) * barH, backgroundColor: colors.bordeaux }} />
                    </View>
                  ) : (
                    <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.line }} />
                  )}
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {INITIALS.map((l, i) => (
              <Text key={i} style={[s.letter, { flex: 1 }]}>{l}</Text>
            ))}
          </View>
          <Row gap={12}>
            <Row gap={4}><View style={[s.dot, { backgroundColor: colors.or }]} /><Text style={s.legend}>{tr("Surérogatoires")}</Text></Row>
            <Row gap={4}><View style={[s.dot, { backgroundColor: colors.bordeaux }]} /><Text style={s.legend}>{tr("Rattrapages")}</Text></Row>
          </Row>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.line },
  title: { fontFamily: fonts.extra, fontSize: 19, letterSpacing: -0.4, color: colors.prune },
  arrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune, textTransform: 'capitalize' },
  stat: { flex: 1, borderRadius: 14, padding: 10, gap: 2 },
  statValue: { fontFamily: fonts.extra, fontSize: 22, color: colors.prune },
  statLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  letter: { textAlign: 'center', fontFamily: fonts.semi, fontSize: 11, color: colors.muted, paddingVertical: 3 },
  dayNum: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.prune },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legend: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  total: { fontFamily: fonts.extra, fontSize: 30, letterSpacing: -0.8, color: colors.bordeaux },
});

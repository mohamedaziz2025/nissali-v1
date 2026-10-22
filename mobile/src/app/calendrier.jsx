// Mise à jour Cycle · 6.2 et 6.3 — Mon calendrier. Mois : flèches et glisser pour changer de mois (passé
// illimité, futur 12 mois de prévisions), légende complète, carte d'état, « Modifier mes règles » (→ 6.5) ;
// toucher un jour ouvre le détail (6.4). Année : 12 mini-mois aux mêmes couleurs, le mois en cours encadré,
// toucher un mois → vue Mois ; carte « Mes cycles » (→ 6.6).
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CalendarGrid, Legend, monthGrid, MonthNav, PREDICTED } from '../components/Calendar';
import DaySheet from '../components/DaySheet';
import Icon from '../components/Icon';
import { usePeriodActions } from '../components/PeriodSheets';
import { Button, ErrorState, Gap, Loader, Row, Screen, Segmented } from '../components/ui';
import { dayMonth, monthLabel, shiftMonth, today as serverToday } from '../lib/format';
import { useApi } from '../lib/useApi';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
/** Petit mois de la vue « Année ». */
function MiniMonth({ month, days, width, current, onPress }) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const cell = Math.floor((width - 12) / 7);
  const r = cell / 2 - 1;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={tr("{0}, ouvrir le mois", [monthLabel(month)])} style={[s.mini, { width }, current && s.miniCurrent]}>
      <Text style={s.miniTitle}>{monthLabel(month).split(' ')[0]}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {monthGrid(month).map((day, i) => {
          if (!day) return <View key={`e${i}`} style={{ width: cell, height: cell }} />;
          const info = byDay.get(day);
          const real = info?.period === 'reelle' || info?.period === 'nifas';
          const predicted = info?.period === 'prevue';
          const ovulation = !real && info?.ovulation;
          const fertile = !real && !predicted && !ovulation && info?.fertile;
          return (
            <Svg key={day} width={cell} height={cell}>
              <Circle
                cx={cell / 2}
                cy={cell / 2}
                r={info?.today ? r - 1 : r}
                fill={real ? colors.bordeaux : fertile ? colors.roseFertile : ovulation ? colors.creme : colors.line}
                stroke={info?.today ? colors.prune : predicted ? PREDICTED : ovulation ? colors.or : 'none'}
                strokeWidth={info?.today ? 1.6 : 1}
                strokeDasharray={predicted && !info?.today ? '1.5 1.5' : undefined}
                fillOpacity={real || fertile || ovulation ? 1 : predicted ? 0 : 0.7}
              />
            </Svg>
          );
        })}
      </View>
    </Pressable>
  );
}

export default function MyCalendar() {
  const { width } = useWindowDimensions();
  const [view, setView] = useState('mois');
  const [month, setMonth] = useState(null);
  const [year, setYear] = useState(Number(serverToday().slice(0, 4)));
  const [day, setDay] = useState(null);
  const cycle = useApi(`/cycle${month ? `?month=${month}` : ''}`);
  const yearData = useApi(view === 'annee' ? `/cycle/year/${year}` : null);
  const { openStart, sheets } = usePeriodActions(() => cycle.reload());
  const touchX = useRef(null);
  const data = cycle.data;

  if (cycle.loading && !data) return <Screen back title={tr("Mon calendrier")}><Loader /></Screen>;
  if (cycle.error && !data) return <Screen back title={tr("Mon calendrier")}><ErrorState error={cycle.error} onRetry={cycle.reload} /></Screen>;

  const maxMonth = shiftMonth(data.today.slice(0, 7), 12);
  const currentMonth = data.today.slice(0, 7);
  const go = (m) => {
    if (m > maxMonth) return;
    setMonth(m);
  };
  const calWidth = Math.min(width, 640) - 40 - 32;
  const miniWidth = (Math.min(width, 640) - 40 - 20) / 3;
  const nextStart = data.inPeriod ? data.predictions?.[0]?.start : data.next?.date;
  const doneCycles = (data.history || []).filter((c) => !c.excluded).length;

  return (
    <Screen back title={tr("Mon calendrier")} onRefresh={cycle.reload}>
      <Segmented
        items={[
          { key: 'mois', label: tr("Mois") },
          { key: 'annee', label: tr("Année") },
        ]}
        value={view}
        onChange={setView}
      />
      <Gap h={14} />
      {view === 'mois' ? (
        <>
          <View
            style={s.card}
            onTouchStart={(e) => (touchX.current = e.nativeEvent.pageX)}
            onTouchEnd={(e) => {
              const dx = e.nativeEvent.pageX - (touchX.current ?? e.nativeEvent.pageX);
              if (Math.abs(dx) > 60) go(shiftMonth(data.month, dx < 0 ? 1 : -1));
              touchX.current = null;
            }}
          >
            <MonthNav month={data.month} onChange={go} style={{ marginBottom: 8 }} />
            <CalendarGrid month={data.month} days={data.calendar} width={calWidth} onDayPress={setDay} />
          </View>
          <Gap h={14} />
          <Legend />
          <Gap h={14} />
          {data.inPeriod || nextStart ? (
            <View style={s.status}>
              <View style={s.statusIcon}>
                <Icon name="drop" size={18} color={colors.bordeaux} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statusTitle}>{data.inPeriod ? tr("Règles en cours · Jour {0}", [data.inPeriod.day]) : tr("Prochaines règles vers le {0}", [dayMonth(nextStart)])}</Text>
                {data.inPeriod && nextStart ? <Text style={s.statusSub}>{tr("Prochaines règles prévues vers le")} {dayMonth(nextStart)}</Text> : data.isDefault ? <Text style={s.statusSub}>{tr("Estimation : elle s’affine au fil des cycles")}</Text> : null}
              </View>
            </View>
          ) : null}
          <Gap h={14} />
          <Button title={tr("Modifier mes règles")} variant="outline" onPress={() => router.push('/mes-regles')} />
        </>
      ) : (
        <>
          <View style={s.yearNav}>
            <Pressable onPress={() => setYear((y) => y - 1)} accessibilityRole="button" accessibilityLabel={tr("Année précédente")} hitSlop={10} style={s.navBtn}>
              <Icon name="chevronLeft" size={22} />
            </Pressable>
            <Text style={s.yearTitle}>{year}</Text>
            <Pressable onPress={() => setYear((y) => y + 1)} accessibilityRole="button" accessibilityLabel={tr("Année suivante")} hitSlop={10} style={s.navBtn}>
              <Icon name="chevronRight" size={22} />
            </Pressable>
          </View>
          {yearData.loading && !yearData.data ? (
            <Loader />
          ) : (
            <View style={s.yearGrid}>
              {(yearData.data?.months || []).map((m) => (
                <MiniMonth key={m.month} month={m.month} days={m.days} width={miniWidth} current={m.month === currentMonth} onPress={() => { go(m.month); setView('mois'); }} />
              ))}
            </View>
          )}
          <Gap h={12} />
          <Row gap={12} style={{ flexWrap: 'wrap' }}>
            <Row gap={4}><View style={[s.legendDot, { backgroundColor: colors.bordeaux }]} /><Text style={s.legend}>{tr("Règles")}</Text></Row>
            <Row gap={4}><View style={[s.legendDot, { borderWidth: 1, borderStyle: 'dashed', borderColor: PREDICTED }]} /><Text style={s.legend}>{tr("Prévues")}</Text></Row>
            <Row gap={4}><View style={[s.legendDot, { backgroundColor: colors.roseFertile }]} /><Text style={s.legend}>{tr("Fertile")}</Text></Row>
            <Row gap={4}><View style={[s.legendDot, { backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.or }]} /><Text style={s.legend}>{tr("Ovulation")}</Text></Row>
          </Row>
          <Gap h={14} />
          <Pressable onPress={() => router.push('/suivi/cycles')} accessibilityRole="button" style={s.cycles}>
            <View style={{ flex: 1 }}>
              <Text style={s.statusTitle}>{tr("Mes cycles")}</Text>
              <Text style={s.statusSub}>
                {doneCycles} {tr("cycle")}{doneCycles > 1 ? 's' : ''} {tr("noté")}{doneCycles > 1 ? 's' : ''}
                {data.averages?.cycleLength ? tr(" · {0} jours en moyenne", [data.averages.cycleLength]) : ''}
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color={colors.muted} />
          </Pressable>
        </>
      )}

      <DaySheet day={day} onClose={() => setDay(null)} onStartPeriod={(d) => openStart(d)} periodLength={data.averages?.periodLength || 5} />
      {sheets}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.line },
  statusIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontFamily: fonts.extra, fontSize: 14.5, color: colors.prune },
  statusSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  yearTitle: { fontFamily: fonts.title, fontSize: 22, color: colors.prune },
  navBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mini: { backgroundColor: colors.white, borderRadius: 16, padding: 6, borderWidth: 1, borderColor: colors.line },
  miniCurrent: { borderColor: colors.bordeaux, borderWidth: 1.5 },
  miniTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.prune, textTransform: 'capitalize', marginBottom: 4, marginLeft: 2 },
  legend: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  cycles: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.line },
});

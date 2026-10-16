// 11 — Mon calendrier : mois ou année, règles notées (pleines) et prévues (pointillées, estimatives),
// détail de la journée au toucher (journal, flux, poids, historique), « Modifier mes dates ».
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CalendarGrid, Legend, monthGrid, MonthNav } from '../components/Calendar';
import { DayPanel, HistorySheet, JournalSheet } from '../components/CycleDay';
import { FlowSheet } from '../components/Flow';
import Icon from '../components/Icon';
import { Button, Card, ErrorState, Gap, Loader, Screen, Segmented } from '../components/ui';
import { WeightSheet } from '../components/Weight';
import { monthLabel } from '../lib/format';
import { useApi } from '../lib/useApi';
import { colors, fonts } from '../theme';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Petit mois de la vue « Année ». */
function MiniMonth({ month, days, width, onPress }) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const cell = Math.floor((width - 12) / 7);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${monthLabel(month)}, ouvrir le mois`} style={[s.mini, { width }]}>
      <Text style={s.miniTitle}>{monthLabel(month).split(' ')[0]}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {LETTERS.map((l, i) => (
          <Text key={i} style={[s.miniLetter, { width: cell }]}>{l}</Text>
        ))}
        {monthGrid(month).map((day, i) => {
          if (!day) return <View key={`e${i}`} style={{ width: cell, height: cell }} />;
          const info = byDay.get(day);
          const real = info?.period === 'reelle' || info?.period === 'nifas';
          const predicted = info?.period === 'prevue';
          return (
            <View key={day} style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}>
              <View style={[s.miniDay, { width: cell - 3, height: cell - 3, borderRadius: cell }, real && { backgroundColor: colors.bordeaux }, predicted && s.miniPredicted, info?.fertile && !real && !predicted && { backgroundColor: colors.blush }, info?.today && s.miniToday]}>
                <Text style={[s.miniNum, real && { color: colors.white, fontFamily: fonts.bold }, predicted && { color: colors.bordeaux }]}>{Number(day.slice(8))}</Text>
              </View>
            </View>
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
  const [year, setYear] = useState(new Date().getFullYear());
  const [selected, setSelected] = useState(null);
  const [sheet, setSheet] = useState(null); // 'journal' | 'flow' | 'weight' | 'history'
  const [focus, setFocus] = useState(null);
  const cycle = useApi(`/cycle${month ? `?month=${month}` : ''}`);
  const yearData = useApi(view === 'annee' ? `/cycle/year/${year}` : null);
  const weights = useApi('/health-log/weights');
  const data = cycle.data;
  const byDay = useMemo(() => new Map((data?.calendar || []).map((d) => [d.day, d])), [data]);

  if (cycle.loading && !data) return <Screen back title="Mon calendrier"><Loader /></Screen>;
  if (cycle.error && !data) return <Screen back title="Mon calendrier"><ErrorState error={cycle.error} onRetry={cycle.reload} /></Screen>;

  const day = selected || data.today;
  const info = byDay.get(day);
  const weightOf = (d) => weights.data?.items?.find((w) => w.day === d) || null;
  const calWidth = Math.min(width, 640) - 40 - 32;
  const miniWidth = (Math.min(width, 640) - 40 - 20) / 3;
  const reload = () => {
    cycle.reload();
    weights.reload();
  };

  return (
    <Screen back title="Mon calendrier" onRefresh={reload}>
      <Segmented
        items={[
          { key: 'mois', label: 'Mois' },
          { key: 'annee', label: 'Année' },
        ]}
        value={view}
        onChange={setView}
      />
      <Gap h={14} />
      {view === 'mois' ? (
        <>
          <Card style={{ paddingHorizontal: 16 }}>
            <MonthNav month={data.month} onChange={(m) => { setMonth(m); setSelected(null); }} style={{ marginBottom: 8 }} />
            <CalendarGrid month={data.month} days={data.calendar} width={calWidth} selected={selected} onDayPress={(d) => setSelected(d)} />
          </Card>
          <Gap h={14} />
          <Legend />
          <Gap h={14} />
          <Button title="Modifier mes dates" variant="outline" onPress={() => router.push('/mes-regles')} />
          <Gap h={14} />
          {byDay.has(day) || day === data.today ? (
            <DayPanel
              day={day}
              info={info}
              periods={data.periods}
              weight={weightOf(day)?.weight}
              today={data.today}
              onJournal={(f) => { setFocus(f); setSheet('journal'); }}
              onFlow={() => setSheet('flow')}
              onWeight={() => setSheet('weight')}
              onHistory={() => setSheet('history')}
            />
          ) : null}
        </>
      ) : (
        <>
          <View style={s.yearNav}>
            <Pressable onPress={() => setYear((y) => y - 1)} accessibilityRole="button" accessibilityLabel="Année précédente" hitSlop={10} style={s.navBtn}>
              <Icon name="chevronLeft" size={22} />
            </Pressable>
            <Text style={s.yearTitle}>{year}</Text>
            <Pressable onPress={() => setYear((y) => y + 1)} accessibilityRole="button" accessibilityLabel="Année suivante" hitSlop={10} style={s.navBtn}>
              <Icon name="chevronRight" size={22} />
            </Pressable>
          </View>
          {yearData.loading && !yearData.data ? (
            <Loader />
          ) : (
            <View style={s.yearGrid}>
              {(yearData.data?.months || []).map((m) => (
                <MiniMonth key={m.month} month={m.month} days={m.days} width={miniWidth} onPress={() => { setMonth(m.month); setSelected(null); setView('mois'); }} />
              ))}
            </View>
          )}
          <Gap h={14} />
          <Legend />
        </>
      )}

      <JournalSheet visible={sheet === 'journal'} day={day} focus={focus} onClose={() => setSheet(null)} onSaved={reload} />
      <FlowSheet visible={sheet === 'flow'} day={day} onClose={() => setSheet(null)} onSaved={reload} />
      <WeightSheet visible={sheet === 'weight'} entry={weightOf(day) || null} lastWeight={weights.data?.last?.weight} onClose={() => setSheet(null)} onSaved={reload} />
      <HistorySheet visible={sheet === 'history'} onClose={() => setSheet(null)} history={data.history} averages={data.averages} />
    </Screen>
  );
}

const s = StyleSheet.create({
  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  yearTitle: { fontFamily: fonts.title, fontSize: 22, color: colors.prune },
  navBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mini: { backgroundColor: colors.white, borderRadius: 16, padding: 6, borderWidth: 1, borderColor: colors.line },
  miniTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.prune, textTransform: 'capitalize', marginBottom: 2, marginLeft: 2 },
  miniLetter: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 8.5, color: colors.muted },
  miniDay: { alignItems: 'center', justifyContent: 'center' },
  miniPredicted: { borderWidth: 1, borderColor: colors.bordeaux, borderStyle: 'dashed' },
  miniToday: { borderWidth: 1.5, borderColor: colors.prune, borderStyle: 'solid' },
  miniNum: { fontFamily: fonts.body, fontSize: 9, color: colors.prune },
});

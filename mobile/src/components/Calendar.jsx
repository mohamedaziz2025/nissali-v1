// Calendrier du cycle (5.4) : règles passées en bordeaux plein, règles prévues en pointillé,
// fenêtre fertile en rose, ovulation cerclée d'or, jour actuel en prune, rendez-vous entourés.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { addDays, monthLabel, shiftMonth, WEEKDAYS_SHORT } from '../lib/format';
import { colors, fonts } from '../theme';
import Icon from './Icon';
import { Button, Row, Sheet, T } from './ui';

import { tr } from '../lib/i18n';
/** Grille du mois : semaines commençant le lundi. */
export function monthGrid(month) {
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const wd = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const offset = (wd + 6) % 7;
  const cells = Array(offset).fill(null);
  for (let i = 0; i < daysInMonth; i += 1) cells.push(addDays(first, i));
  while (cells.length % 7) cells.push(null);
  return cells;
}

// Couleurs des jours (partout, mise à jour Cycle) : règles notées = rond bordeaux plein ; règles prévues = cercle
// pointillé rose #B9566E ; fertile (estimation) = rond rose #F6D9DF ; ovulation (estimation) = fond crème + contour
// or ; aujourd'hui = anneau encre ; note ou rappel = petit point or (blanc sur un jour de règles).
export const PREDICTED = '#B9566E';

function DayCell({ day, info, size, onPress, selected, disabled }) {
  const n = Number(day.slice(8));
  const r = size / 2 - 3;
  const real = info?.period === 'reelle' || info?.period === 'nifas';
  let fill = 'transparent';
  let stroke = null;
  let dash = null;
  let strokeWidth = 1.8;
  let textColor = colors.prune;
  let bold = false;

  if (info?.fertile && !real) fill = colors.roseFertile;
  if (info?.ovulation && !real) {
    fill = colors.creme;
    stroke = colors.or;
    bold = true;
  }
  if (info?.period === 'reelle') {
    fill = colors.bordeaux;
    textColor = colors.white;
    bold = true;
  }
  if (info?.period === 'nifas') {
    fill = colors.bordeauxSoft;
    textColor = colors.white;
  }
  if (info?.period === 'prevue') {
    fill = info?.fertile ? fill : 'transparent';
    stroke = PREDICTED;
    dash = '4 4';
    textColor = PREDICTED;
    bold = true;
  } else if (info?.inRange && !info?.period) {
    stroke = colors.roseDeep;
    dash = '2 5';
  }
  if (info?.appointments?.length && !stroke) {
    stroke = '#E2CBB0';
    strokeWidth = 2.5;
  }
  if (selected) {
    fill = colors.bordeaux;
    textColor = colors.white;
    stroke = null;
    bold = true;
  }
  if (disabled) textColor = '#CDB8BD';
  // Aujourd'hui : anneau encre autour du jour, sans masquer sa couleur.
  const ring = info?.today && !disabled;
  const inner = ring ? r - 3.5 : r;

  const parts = [info?.today && 'aujourd’hui', info?.period === 'reelle' && 'règles', info?.period === 'prevue' && 'règles prévues', info?.ovulation && 'ovulation', info?.fertile && !info?.ovulation && 'fertile', info?.appointments?.length && 'rendez-vous', info?.notes?.length && `${info.notes.length} note${info.notes.length > 1 ? 's' : ''}`, info?.fast && 'jeûne programmé'].filter(Boolean);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${n}${parts.length ? `, ${parts.join(', ')}` : ''}`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {ring ? <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.prune} strokeWidth={2} /> : null}
        <Circle cx={size / 2} cy={size / 2} r={inner} fill={fill} stroke={stroke || 'none'} strokeWidth={stroke ? strokeWidth : 0} strokeDasharray={dash || undefined} />
      </Svg>
      <Text style={{ fontFamily: bold || info?.today ? fonts.bold : fonts.body, fontSize: 16, color: textColor }}>{n}</Text>
      {info?.notes?.length || info?.fast ? <View style={[s.noteDot, { bottom: Math.max(3, size * 0.12), backgroundColor: textColor === colors.white ? colors.white : colors.or }]} /> : null}
    </Pressable>
  );
}

export function CalendarGrid({ month, days = [], width, onDayPress, selected, maxDay, minDay }) {
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const cell = Math.floor(width / 7);
  const cells = monthGrid(month);
  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS_SHORT.map((d, i) => (
          <Text key={i} style={[s.weekday, { width: cell }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 }}>
        {cells.map((day, i) =>
          day ? (
            <DayCell
              key={day}
              day={day}
              info={byDay.get(day)}
              size={cell}
              selected={selected === day}
              disabled={(maxDay && day > maxDay) || (minDay && day < minDay)}
              onPress={onDayPress ? () => onDayPress(day, byDay.get(day)) : undefined}
            />
          ) : (
            <View key={`e${i}`} style={{ width: cell, height: cell }} />
          ),
        )}
      </View>
    </View>
  );
}

export function MonthNav({ month, onChange, style }) {
  return (
    <Row justify="space-between" style={style}>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Mois précédent")} hitSlop={10} onPress={() => onChange(shiftMonth(month, -1))} style={s.navBtn}>
        <Icon name="chevronLeft" size={22} />
      </Pressable>
      <T variant="bold" style={{ fontSize: 18 }}>{monthLabel(month)}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Mois suivant")} hitSlop={10} onPress={() => onChange(shiftMonth(month, 1))} style={s.navBtn}>
        <Icon name="chevronRight" size={22} />
      </Pressable>
    </Row>
  );
}

export function Legend() {
  const item = (el, label) => (
    <Row gap={8} key={label}>
      {el}
      <T variant="muted">{label}</T>
    </Row>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 10 }}>
      {item(<View style={[s.legendDot, { backgroundColor: colors.bordeaux }]} />, 'Règles notées')}
      {item(
        <Svg width={20} height={20}>
          <Circle cx={10} cy={10} r={8} stroke={PREDICTED} strokeWidth={1.8} strokeDasharray="3 3" fill="none" />
        </Svg>,
        'Règles prévues',
      )}
      {item(<View style={[s.legendDot, { backgroundColor: colors.roseFertile }]} />, 'Fertile (estimation)')}
      {item(<View style={[s.legendDot, { backgroundColor: colors.creme, borderWidth: 1.8, borderColor: colors.or }]} />, 'Ovulation (estimation)')}
      {item(<View style={[s.legendDot, { borderWidth: 2, borderColor: colors.prune }]} />, 'Aujourd’hui')}
      {item(<View style={[s.legendDot, { borderWidth: 3, borderColor: '#E2CBB0' }]} />, 'Rendez-vous')}
      {item(<View style={[s.legendDot, { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 }]}><View style={[s.noteDot, { position: 'relative', backgroundColor: colors.or }]} /></View>, 'Note ou rappel')}
    </View>
  );
}

/** Feuille de choix d'une date (la date du jour est proposée par défaut). */
export function DatePickerSheet({ visible, onClose, onPick, value, maxDay, minDay, title = 'Choisir une date', width = 320 }) {
  const [month, setMonth] = useState((value || maxDay || new Date().toISOString()).slice(0, 7));
  const [picked, setPicked] = useState(value);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <Button
          title={tr("Valider")}
          disabled={!picked}
          onPress={() => {
            onPick(picked);
            onClose();
          }}
        />
      }
    >
      <MonthNav month={month} onChange={setMonth} />
      <CalendarGrid month={month} width={width} onDayPress={setPicked} selected={picked} maxDay={maxDay} minDay={minDay} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  weekday: { textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: colors.muted, paddingVertical: 8 },
  navBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  legendDot: { width: 20, height: 20, borderRadius: 10 },
  noteDot: { position: 'absolute', width: 5, height: 5, borderRadius: 3 },
});

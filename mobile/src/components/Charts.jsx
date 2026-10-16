// Graphiques d'évolution (5.9). Une série par graphique : pas de légende, le titre nomme la série.
// Ligne 2 px, voile à 10 %, point final cerclé, quadrillage fin et discret, valeur au toucher,
// vue en liste pour l'accessibilité.
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { shortDate } from '../lib/format';
import { colors, fonts } from '../theme';
import { T } from './ui';

const GRID = colors.line;
const INK = colors.muted;
const PAD = { top: 26, right: 46, bottom: 24, left: 34 };

function niceRange(values, minSpan) {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < minSpan) {
    const mid = (max + min) / 2;
    min = mid - minSpan / 2;
    max = mid + minSpan / 2;
  }
  const step = (max - min) / 3;
  return { min: Math.floor((min - step * 0.2) * 10) / 10, max: Math.ceil((max + step * 0.2) * 10) / 10 };
}

const fmt = (v, unit, digits) => `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: digits })}${unit}`;

export function LineChart({ data, width, height = 170, unit = '', digits = 1, minSpan = 1, label }) {
  const [selected, setSelected] = useState(null);
  const [table, setTable] = useState(false);
  const geo = useMemo(() => {
    if (data.length < 2) return null;
    const { min, max } = niceRange(
      data.map((d) => d.value),
      minSpan,
    );
    const w = width - PAD.left - PAD.right;
    const h = height - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (i / (data.length - 1)) * w;
    const y = (v) => PAD.top + (1 - (v - min) / (max - min)) * h;
    const points = data.map((d, i) => [x(i), y(d.value)]);
    const line = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
    const area = `${line} L${points[points.length - 1][0].toFixed(1)},${PAD.top + h} L${PAD.left},${PAD.top + h} Z`;
    const ticks = [0, 1, 2, 3].map((k) => min + ((max - min) * k) / 3);
    return { min, max, x, y, points, line, area, ticks, w, h };
  }, [data, width, height, minSpan]);

  if (!geo) return <T variant="muted">Pas encore assez de données : note-les quelques jours pour voir leur évolution.</T>;

  const last = data[data.length - 1];
  const sel = selected != null ? data[selected] : null;
  const onPress = (e) => {
    const px = e.nativeEvent.locationX;
    const i = Math.round(((px - PAD.left) / geo.w) * (data.length - 1));
    setSelected(Math.max(0, Math.min(data.length - 1, i)));
  };
  const values = data.map((d) => d.value);

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="image"
        accessibilityLabel={`${label} : ${data.length} valeurs, de ${fmt(Math.min(...values), unit, digits)} à ${fmt(Math.max(...values), unit, digits)}, dernière ${fmt(last.value, unit, digits)}`}
      >
        <Svg width={width} height={height}>
          {geo.ticks.map((t) => (
            <Line key={t} x1={PAD.left} x2={width - PAD.right + 8} y1={geo.y(t)} y2={geo.y(t)} stroke={GRID} strokeWidth={1} />
          ))}
          {geo.ticks.map((t) => (
            <SvgText key={`l${t}`} x={PAD.left - 6} y={geo.y(t) + 4} fontSize={11} fill={INK} textAnchor="end" fontFamily={fonts.body}>
              {Number(t).toLocaleString('fr-FR', { maximumFractionDigits: digits })}
            </SvgText>
          ))}
          <Path d={geo.area} fill={colors.bordeaux} opacity={0.1} />
          <Path d={geo.line} stroke={colors.bordeaux} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {sel ? (
            <>
              <Line x1={geo.points[selected][0]} x2={geo.points[selected][0]} y1={PAD.top} y2={PAD.top + geo.h} stroke={colors.muted} strokeWidth={1} />
              <Circle cx={geo.points[selected][0]} cy={geo.points[selected][1]} r={6} fill={colors.bordeaux} stroke={colors.white} strokeWidth={2} />
            </>
          ) : null}
          <Circle cx={geo.points[geo.points.length - 1][0]} cy={geo.points[geo.points.length - 1][1]} r={5} fill={colors.bordeaux} stroke={colors.white} strokeWidth={2} />
          <SvgText x={geo.points[geo.points.length - 1][0] + 9} y={geo.points[geo.points.length - 1][1] + 4} fontSize={12} fill={colors.prune} fontFamily={fonts.bold}>
            {fmt(last.value, unit, digits)}
          </SvgText>
          <SvgText x={PAD.left} y={height - 6} fontSize={11} fill={INK} fontFamily={fonts.body}>
            {shortDate(data[0].day)}
          </SvgText>
          <SvgText x={width - PAD.right} y={height - 6} fontSize={11} fill={INK} textAnchor="end" fontFamily={fonts.body}>
            {shortDate(last.day)}
          </SvgText>
          {sel ? (
            <SvgText x={PAD.left} y={14} fontSize={12.5} fill={colors.prune} fontFamily={fonts.bold}>
              {`${shortDate(sel.day)} · ${fmt(sel.value, unit, digits)}`}
            </SvgText>
          ) : null}
        </Svg>
      </Pressable>
      <Pressable onPress={() => setTable((v) => !v)} accessibilityRole="button" hitSlop={8}>
        <T variant="small" color={colors.bordeaux}>{table ? 'Masquer les valeurs' : 'Voir les valeurs'}</T>
      </Pressable>
      {table
        ? [...data]
            .reverse()
            .slice(0, 30)
            .map((d) => (
              <View key={d.day} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T variant="small">{shortDate(d.day)}</T>
                <T variant="small" color={colors.prune}>{fmt(d.value, unit, digits)}</T>
              </View>
            ))
        : null}
    </View>
  );
}

/** Colonnes (durée des cycles) : ≤ 24 px, extrémité arrondie, valeur au toucher et sur la dernière. */
export function ColumnChart({ data, width, height = 170, unit = ' j', label }) {
  const [selected, setSelected] = useState(data.length - 1);
  if (!data.length) return <T variant="muted">Les durées apparaîtront après ton premier cycle complet.</T>;
  const max = Math.max(...data.map((d) => d.value), 35);
  const min = 0;
  const w = width - PAD.left - 12;
  const h = height - PAD.top - PAD.bottom;
  const band = w / data.length;
  const bar = Math.min(24, band * 0.6);
  const y = (v) => PAD.top + (1 - (v - min) / (max - min)) * h;
  const ticks = [0, Math.round(max / 2), Math.round(max)];
  const onPress = (e) => {
    const i = Math.floor((e.nativeEvent.locationX - PAD.left) / band);
    if (i >= 0 && i < data.length) setSelected(i);
  };
  return (
    <Pressable onPress={onPress} accessibilityRole="image" accessibilityLabel={`${label} : ${data.map((d) => `${d.value}${unit}`).join(', ')}`}>
      <Svg width={width} height={height}>
        {ticks.map((t) => (
          <Line key={t} x1={PAD.left} x2={width - 8} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
        ))}
        {ticks.map((t) => (
          <SvgText key={`t${t}`} x={PAD.left - 6} y={y(t) + 4} fontSize={11} fill={INK} textAnchor="end" fontFamily={fonts.body}>
            {t}
          </SvgText>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const top = y(d.value);
          const bottom = y(0);
          const r = 4;
          const path = `M${cx - bar / 2},${bottom} L${cx - bar / 2},${top + r} Q${cx - bar / 2},${top} ${cx - bar / 2 + r},${top} L${cx + bar / 2 - r},${top} Q${cx + bar / 2},${top} ${cx + bar / 2},${top + r} L${cx + bar / 2},${bottom} Z`;
          return <Path key={d.start} d={path} fill={i === selected ? colors.bordeaux : colors.rose} />;
        })}
        {selected != null && data[selected] ? (
          <SvgText x={PAD.left + band * selected + band / 2} y={y(data[selected].value) - 8} fontSize={12.5} fill={colors.prune} textAnchor="middle" fontFamily={fonts.bold}>
            {`${data[selected].value}${unit}`}
          </SvgText>
        ) : null}
        {selected != null && data[selected] ? (
          <SvgText x={PAD.left} y={height - 6} fontSize={11} fill={INK} fontFamily={fonts.body}>
            {`Cycle du ${shortDate(data[selected].start)}`}
          </SvgText>
        ) : null}
      </Svg>
    </Pressable>
  );
}

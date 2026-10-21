// Graphiques d'évolution (5.9). Une série par graphique : pas de légende, le titre nomme la série.
// Ligne 2 px, voile à 10 %, point final cerclé, quadrillage fin et discret, valeur au toucher,
// vue en liste pour l'accessibilité.
import { useState } from 'react';
import { Pressable } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { shortDate } from '../lib/format';
import { colors, fonts } from '../theme';
import { T } from './ui';

import { tr } from '../lib/i18n';
const GRID = colors.line;
const INK = colors.muted;
const PAD = { top: 26, right: 46, bottom: 24, left: 34 };

export function ColumnChart({ data, width, height = 170, unit = ' j', label }) {
  const [selected, setSelected] = useState(data.length - 1);
  if (!data.length) return <T variant="muted">{tr("Les durées apparaîtront après ton premier cycle complet.")}</T>;
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
            {tr("Cycle du {0}", [shortDate(data[selected].start)])}
          </SvgText>
        ) : null}
      </Svg>
    </Pressable>
  );
}

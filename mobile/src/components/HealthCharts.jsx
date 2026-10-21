// Mise à jour Cycle · 6.1 bis et 6.8 à 6.11 — graphiques de « Suivre ma santé » et des pages détail :
// courbe d'humeur (5 niveaux, jours de règles en rose), courbe dorée du poids, barres du sommeil (ligne 8 h),
// répartition des humeurs, barres de symptômes, durée des cycles. Agrégation Semaine / Mois / 6 mois.
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { addDays, diffDays, MONTHS_SHORT as FMT_MONTHS_SHORT, WEEKDAYS_SHORT as FMT_WEEKDAYS_SHORT } from '../lib/format';
import { colors, fonts, MOODS } from '../theme';
import { kg } from './Weight';
import { MoodFace } from './HealthCards';

import { tr } from '../lib/i18n';
export const PERIODS = [
  { key: 'semaine', label: tr("Semaine"), days: 7 },
  { key: 'mois', label: tr("Mois"), days: 30 },
  { key: 'six', label: tr("6 mois"), days: 182 },
];
export const periodDays = (key) => PERIODS.find((p) => p.key === key)?.days || 7;

const MONTHS = FMT_MONTHS_SHORT;
const LETTERS = [FMT_WEEKDAYS_SHORT[6], ...FMT_WEEKDAYS_SHORT.slice(0, 6)];
const MOOD_LEVEL = { sereine: 4, bien: 3, fatiguee: 2, irritable: 1, triste: 0 };

/** Jours de la période (du plus ancien à aujourd'hui). */
export function rangeDays(today, key) {
  const n = periodDays(key);
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

/** 6 mois : moyennes par semaine ; sinon une valeur par jour. */
export function series(days, valueOf, key) {
  if (key !== 'six') return days.map((d) => ({ day: d, value: valueOf(d) }));
  const out = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    const v = chunk.map(valueOf).filter((x) => x != null);
    out.push({ day: chunk[0], value: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null });
  }
  return out;
}

function axisLabel(day, i, n, key) {
  if (key === 'semaine') return LETTERS[new Date(`${day}T12:00:00Z`).getUTCDay()];
  if (key === 'mois') return i % 7 === 0 || i === n - 1 ? String(Number(day.slice(8))) : '';
  return i === 0 || Number(day.slice(8)) <= 7 ? MONTHS[Number(day.slice(5, 7)) - 1] : '';
}

function Axis({ points, width, left, right, keyName }) {
  const n = points.length;
  const step = n > 1 ? (width - left - right) / (n - 1) : 0;
  return (
    <View style={{ height: 16, marginTop: 4 }}>
      {points.map((p, i) => {
        const label = axisLabel(p.day, i, n, keyName);
        if (!label) return null;
        return (
          <Text key={`${p.day}-${i}`} style={{ position: 'absolute', left: left + i * step - 14, width: 28, textAlign: 'center', fontFamily: fonts.semi, fontSize: 10, color: colors.muted }}>
            {label}
          </Text>
        );
      })}
    </View>
  );
}

/** Pas assez de valeurs : invitation à noter quelques jours. */
export function NotEnough({ what }) {
  return <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted, paddingVertical: 14 }}>{tr("Note")} {what} {tr("quelques jours pour voir ta courbe.")}</Text>;
}

/** Humeur jour par jour (Semaine, Mois) : Sereine en haut → Triste en bas, visages sur l'axe. */
export function MoodLine({ days, moodOf, inPeriod, width, keyName }) {
  const left = 26;
  const right = 8;
  const h = 130;
  const top = 8;
  const n = days.length;
  const step = n > 1 ? (width - left - right) / (n - 1) : 0;
  const x = (i) => left + i * step;
  const y = (lvl) => top + (4 - lvl) * ((h - top * 2) / 4);
  const pts = days.map((d, i) => ({ i, d, lvl: moodOf(d) ? MOOD_LEVEL[moodOf(d)] : null }));
  let path = '';
  let prev = null;
  for (const p of pts) {
    if (p.lvl == null) {
      prev = null;
      continue;
    }
    path += `${prev ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.lvl).toFixed(1)}`;
    prev = p;
  }
  return (
    <View>
      <Svg width={width} height={h}>
        {days.map((d, i) => (inPeriod(d) ? <Rect key={`p${d}`} x={x(i) - step / 2} y={0} width={Math.max(step, 4)} height={h} fill={colors.blush} /> : null))}
        {[0, 1, 2, 3, 4].map((l) => (
          <Line key={l} x1={left} x2={width - right} y1={y(l)} y2={y(l)} stroke={colors.line} strokeWidth={1} />
        ))}
        {path ? <Path d={path} stroke={colors.bordeaux} strokeWidth={2} fill="none" strokeLinejoin="round" /> : null}
        {n <= 31
          ? pts.filter((p) => p.lvl != null).map((p) => <Circle key={p.d} cx={x(p.i)} cy={y(p.lvl)} r={4} fill={colors.white} stroke={colors.bordeaux} strokeWidth={2} />)
          : null}
      </Svg>
      {MOODS.map((m) => (
        <View key={m.key} style={{ position: 'absolute', left: 0, top: y(MOOD_LEVEL[m.key]) - 9 }}>
          <MoodFace mood={m.key} size={18} />
        </View>
      ))}
      <Axis points={days.map((d) => ({ day: d }))} width={width} left={left} right={right} keyName={keyName} />
    </View>
  );
}

/** Barres horizontales : nombre de jours par humeur (6 mois, page Humeur). */
export function MoodBars({ counts, faces = false }) {
  const max = Math.max(1, ...MOODS.map((m) => counts[m.key] || 0));
  return (
    <View style={{ gap: 10 }}>
      {MOODS.map((m) => {
        const n = counts[m.key] || 0;
        return (
          <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {faces ? <MoodFace mood={m.key} size={18} /> : null}
            <Text style={{ width: faces ? 70 : 80, fontFamily: fonts.bold, fontSize: 12.5, color: colors.prune }}>{m.label}</Text>
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line }}>
              <View style={{ width: `${(n / max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.bordeaux }} />
            </View>
            <Text style={{ width: 48, textAlign: 'right', fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted }}>{n} {tr("jour")}{n > 1 ? 's' : ''}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Courbe dorée (poids) : échelle automatique min − 0,2 / max + 0,2. */
export function GoldCurve({ points, width, keyName, dots = keyName === 'semaine' }) {
  const left = 4;
  const right = 4;
  const h = 110;
  const vals = points.map((p) => p.value).filter((v) => v != null);
  const lo = Math.min(...vals) - 0.2;
  const hi = Math.max(...vals) + 0.2;
  const n = points.length;
  const step = n > 1 ? (width - left - right) / (n - 1) : 0;
  const x = (i) => left + i * step;
  const y = (v) => 8 + (1 - (v - lo) / (hi - lo || 1)) * (h - 16);
  const known = points.map((p, i) => ({ ...p, i })).filter((p) => p.value != null);
  const line = known.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.value).toFixed(1)}`).join('');
  const area = known.length ? `${line}L${x(known[known.length - 1].i).toFixed(1)} ${h}L${x(known[0].i).toFixed(1)} ${h}Z` : '';
  return (
    <View>
      <Svg width={width} height={h}>
        {area ? <Path d={area} fill={colors.sable} /> : null}
        <Path d={line} stroke={colors.or} strokeWidth={2} fill="none" strokeLinejoin="round" />
        {dots ? known.map((p) => <Circle key={`${p.day}-${p.i}`} cx={x(p.i)} cy={y(p.value)} r={4} fill={colors.white} stroke={colors.or} strokeWidth={2} />) : null}
      </Svg>
      <Axis points={points} width={width} left={left} right={right} keyName={keyName} />
    </View>
  );
}

/** Barres du sommeil (une par nuit ; 6 mois = moyenne par semaine), ligne pointillée à 8 h. */
export function SleepBars({ points, width, keyName }) {
  const h = 110;
  const max = 10;
  const n = points.length;
  const gap = n > 40 ? 2 : n > 10 ? 3 : 8;
  const bw = Math.max(2, (width - gap * (n - 1)) / n);
  const y = (v) => h - (Math.min(max, v) / max) * h;
  return (
    <View>
      <Svg width={width} height={h}>
        {points.map((p, i) => (p.value != null ? <Rect key={`${p.day}-${i}`} x={i * (bw + gap)} y={y(p.value)} width={bw} height={h - y(p.value)} rx={Math.min(4, bw / 2)} fill={colors.bordeaux} /> : null))}
        <Line x1={0} x2={width} y1={y(8)} y2={y(8)} stroke={colors.or} strokeWidth={1.2} strokeDasharray="4 4" />
      </Svg>
      <Axis points={points} width={width} left={bw / 2} right={bw / 2} keyName={keyName} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.muted, marginTop: 4 }}>{tr("Pointillés : 8 h, durée conseillée")}</Text>
    </View>
  );
}

/** Barres dorées : symptômes et nombre de fois. */
export function RankBars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <View style={{ gap: 8 }}>
      {items.map((it) => (
        <View key={it.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.prune }} numberOfLines={1}>{it.label}</Text>
          <View style={{ width: '38%', height: 6, borderRadius: 3, backgroundColor: colors.line }}>
            <View style={{ width: `${(it.count / max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.or }} />
          </View>
          <Text style={{ width: 44, textAlign: 'right', fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted }}>{it.count} {tr("fois")}</Text>
        </View>
      ))}
    </View>
  );
}

/** Durée de tes cycles : une barre par cycle terminé, le cycle en cours en bordeaux. */
export function CycleBars({ lengths, current, height = 46 }) {
  const all = [...lengths, current].filter((v) => v != null);
  const max = Math.max(1, ...all);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height }}>
      {lengths.map((v, i) => (
        <View key={i} style={{ flex: 1, height: (v / max) * height, borderRadius: 4, backgroundColor: colors.roseFertile }} />
      ))}
      {current != null ? <View style={{ flex: 1, height: Math.max(4, (current / max) * height), borderRadius: 4, backgroundColor: colors.bordeaux }} /> : null}
    </View>
  );
}

/** Écart entre deux dates en jours (pour « depuis le … »). */
export const since = (from, to) => diffDays(to, from) + 1;

/** « Le plus souvent : bien » */
export function moodSummary(counts) {
  const top = MOODS.map((m) => ({ ...m, n: counts[m.key] || 0 })).sort((a, b) => b.n - a.n)[0];
  return top?.n ? tr("Le plus souvent : {0}", [top.label.toLowerCase()]) : '';
}

/** Écart de poids : vert si baisse ou stable, gris neutre si hausse. */
export function WeightDiff({ diff, suffix }) {
  if (diff == null) return null;
  const up = diff > 0;
  return <Text style={[diffStyle, { color: up ? colors.muted : colors.success }]}>{up ? '+' : diff < 0 ? '−' : ''}{kg(Math.abs(diff))} {tr("kg")} {suffix}</Text>;
}

export const SUFFIX = { semaine: tr("cette semaine"), mois: tr("ce mois-ci"), six: tr("en 6 mois") };


const diffStyle = { fontFamily: fonts.bold, fontSize: 12, marginBottom: 4 };

/** « 2 nov. » */
export const shortDay = (day) => `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

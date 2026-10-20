// Santé du jour et cycle (cahier V4.1, 4.7) : visages d'humeur, « Comment tu te sens ? », conseil santé,
// frise des 4 phases. Utilisés dans l'onglet Cycle (déplacés de l'accueil en V4).
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { assetUrl } from '../lib/api';
import { colors, fonts, MOODS, SYMPTOMS } from '../theme';
import Icon from './Icon';
import { Button, Card, Chip, Row, Sheet, T } from './ui';
import { kg } from './Weight';

export const PHASE_NAMES = { menstruelle: 'phase menstruelle', folliculaire: 'phase folliculaire', ovulatoire: 'phase ovulatoire', luteale: 'phase lutéale', grossesse: 'grossesse' };
export const PHASE_SHORT = { menstruelle: 'Règles', folliculaire: 'Folliculaire', ovulatoire: 'Ovulation', luteale: 'Lutéale' };
const PHASE_COLORS = { menstruelle: 'rgba(255,255,255,0.35)', folliculaire: 'rgba(255,255,255,0.35)', ovulatoire: 'rgba(255,255,255,0.35)', luteale: 'rgba(255,255,255,0.35)' };
const HOME_SYMPTOMS = ['crampes', 'fatigue', 'migraine', 'ballonnements'];

/** Frise des 4 phases du cycle avec la position du jour (carte Règles, 5.2). */
export function Frieze({ frieze, phase }) {
  const [w, setW] = useState(0);
  if (!frieze?.bounds || !frieze.cycleLength) return null;
  const order = ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale'].filter((k) => frieze.bounds[k]);
  const len = frieze.cycleLength;
  const pos = Math.min(1, Math.max(0, (frieze.cycleDay - 0.5) / len));
  return (
    <View style={{ marginTop: 12 }} accessibilityLabel={`Jour ${frieze.cycleDay} sur ${len}, ${phase ? PHASE_SHORT[phase] : ''}`}>
      <View style={s.frieze} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {order.map((k) => {
          const [a, b] = frieze.bounds[k];
          return <View key={k} style={[s.friezeSeg, { flex: Math.max(1, b - a + 1), backgroundColor: k === phase ? colors.orClair : PHASE_COLORS[k] }]} />;
        })}
        {w ? <View style={[s.friezeDot, { left: Math.max(0, Math.min(w - 16, pos * w - 8)) }]} /> : null}
      </View>
      <View style={s.friezeLabels}>
        {order.map((k) => {
          const [a, b] = frieze.bounds[k];
          const on = k === phase;
          return (
            <Text key={k} style={[s.friezeLabel, { flex: Math.max(1, b - a + 1) }, on && s.friezeLabelOn]} numberOfLines={1}>
              {PHASE_SHORT[k]}{on ? ' · toi' : ''}
            </Text>
          );
        })}
        <Text style={s.friezeLabel}>J{len}</Text>
      </View>
    </View>
  );
}

/** Visages d'humeur. */
export function MoodFace({ mood, size = 44, on }) {
  const stroke = on ? colors.white : colors.bordeaux;
  const mouths = { sereine: 'M15 27 Q23 33 31 27', bien: 'M14 26 Q23 35 32 26', fatiguee: 'M16 29 L30 29', irritable: 'M16 30 Q23 26 30 30', triste: 'M15 31 Q23 24 31 31' };
  const eyes =
    mood === 'fatiguee' ? ['M14 19 L19 19', 'M27 19 L32 19'] : mood === 'sereine' ? ['M14 19 Q16.5 21 19 19', 'M27 19 Q29.5 21 32 19'] : mood === 'irritable' ? ['M13 16 L19 19', 'M33 16 L27 19'] : null;
  return (
    <Svg width={size} height={size} viewBox="0 0 46 46">
      <Circle cx="23" cy="23" r="21.5" fill={on ? colors.bordeaux : colors.white} stroke={on ? colors.bordeaux : stroke} strokeWidth={1.5} />
      {eyes ? eyes.map((d) => <Path key={d} d={d} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />) : (
        <>
          <Circle cx="17" cy="19" r="2" fill={stroke} />
          <Circle cx="29" cy="19" r="2" fill={stroke} />
        </>
      )}
      <Path d={mouths[mood]} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** 5.2 · 6 — Comment tu te sens ? Humeur (5 visages), symptômes en un geste, bouton bordeaux « Suivi santé ». */
export function FeelCard({ health, onMood, onSymptom, onWeight }) {
  const last = health.lastWeight;
  return (
    <Card style={{ gap: 14 }}>
      <Text style={s.cardTitle}>Comment tu te sens ?</Text>
      <Row gap={2} justify="space-between">
        {MOODS.map((m) => {
          const on = health.mood === m.key;
          return (
            <Pressable key={m.key} onPress={() => onMood(on ? null : m.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={m.label} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
              <MoodFace mood={m.key} on={on} size={42} />
              <Text style={[s.moodLabel, on && { color: colors.bordeaux, fontFamily: fonts.bold }]} numberOfLines={1}>{m.label}</Text>
            </Pressable>
          );
        })}
      </Row>
      <View style={s.symptoms}>
        {HOME_SYMPTOMS.map((k) => {
          const on = health.symptoms?.includes(k);
          return <Chip key={k} label={SYMPTOMS[k]} selected={on} onPress={() => onSymptom(k, !on)} />;
        })}
      </View>
      <Pressable onPress={onWeight} accessibilityRole="button" accessibilityLabel={last ? `Mon poids : ${kg(last.weight)} kilos. Modifier` : 'Ajouter mon poids'} style={s.weightLine}>
        <Icon name="scale" size={17} color={colors.bordeaux} />
        <Text style={s.weightLabel}>Mon poids</Text>
        <Text style={last ? s.weightValue : s.weightAdd}>{last ? `${kg(last.weight)} kg` : 'Ajouter'}</Text>
        <Icon name="chevronRight" size={14} color={colors.muted} />
      </Pressable>
      <Button title="Suivi santé complet" icon="heart" onPress={() => router.push('/sante')} />
    </Card>
  );
}

/** 5.2 · 7 — Conseil santé adapté à la phase (RG-08 ter) ; ouvre l'article lié, sinon le détail. */
export function TipCard({ tip, onOpen }) {
  if (!tip) return null;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Conseil santé : ${tip.title}`} style={({ pressed }) => [s.tipCard, pressed && { opacity: 0.9 }]}>
      <Row gap={12} align="flex-start">
        <View style={s.tipIcon}>
          <Icon name="bulb" size={18} color={colors.or} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.tipLabel}>Conseil santé · {PHASE_NAMES[tip.phase] || 'aujourd’hui'}</Text>
          <Text style={s.tipTitle}>{tip.title}</Text>
        </View>
      </Row>
      <T style={{ lineHeight: 22 }} numberOfLines={5}>{tip.text}</T>
      <T variant="small">{tip.reviewed ? 'Relu par une sage-femme' : 'Conseil Nissali'}{tip.article ? ' · lire l’article' : ''}</T>
    </Pressable>
  );
}

/** 15 — Conseil santé autonome ; « En savoir plus » seulement si un article approfondit le même sujet. */
export function TipSheet({ tip, weatherTips, visible, onClose }) {
  if (!tip) return null;
  const a = tip.article;
  return (
    <Sheet visible={visible} onClose={onClose} title="Mon conseil santé">
      <Text style={s.tipLabel}>Conseil santé · {PHASE_NAMES[tip.phase] || 'aujourd’hui'}</Text>
      <T variant="h3" style={{ fontSize: 20 }}>{tip.title}</T>
      <T style={{ lineHeight: 24 }}>{tip.text}</T>
      {weatherTips?.[0] ? <T variant="small">{weatherTips[0].text}</T> : null}
      <T variant="small">{tip.reviewed ? 'Relu par une sage-femme' : 'Conseil Nissali'}</T>
      {a ? (
        <Pressable
          onPress={() => {
            onClose();
            router.push(`/blog/${a.slug}`);
          }}
          accessibilityRole="link"
          accessibilityLabel={`En savoir plus : ${a.title}`}
          style={({ pressed }) => [s.moreCard, pressed && { opacity: 0.85 }]}
        >
          {a.coverUrl ? <Image source={{ uri: assetUrl(a.coverUrl) }} style={s.moreImg} resizeMode="cover" accessibilityLabel={a.coverAlt || a.title} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.moreLabel}>En savoir plus{a.readMinutes ? ` · ${a.readMinutes} min` : ''}</Text>
            <Text style={s.moreTitle} numberOfLines={2}>{a.title}</Text>
          </View>
          <Icon name="chevronRight" size={18} color={colors.bordeaux} />
        </Pressable>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  cardTitle: { fontFamily: fonts.extra, fontSize: 19, letterSpacing: -0.4, color: colors.prune },
  frieze: { flexDirection: 'row', height: 8, gap: 4, alignItems: 'center' },
  friezeSeg: { height: 8, borderRadius: 4 },
  friezeDot: { position: 'absolute', top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.or },
  friezeLabels: { flexDirection: 'row', gap: 4, marginTop: 8 },
  friezeLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.rose },
  friezeLabelOn: { fontFamily: fonts.bold, color: colors.white },
  moodLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
  symptoms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weightLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  weightLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.prune },
  weightValue: { fontFamily: fonts.title, fontSize: 17, color: colors.prune },
  weightAdd: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  tipCard: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.line },
  tipIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F6EBDD', alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontFamily: fonts.title, fontSize: 18, lineHeight: 23, color: colors.prune },
  tipLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.orText, letterSpacing: 0.4 },
  moreCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.blush, borderRadius: 18, padding: 10, paddingRight: 14 },
  moreImg: { width: 72, height: 54, borderRadius: 12, backgroundColor: colors.line },
  moreLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.bordeaux, textTransform: 'uppercase' },
  moreTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.prune },
});

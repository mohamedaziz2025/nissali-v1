// 4.4 — Inscription et questionnaire d'accueil : une question par écran, barre de progression en haut
// (Ton compte 1→6, Ta confidentialité, Ton cycle 1→3, Dernière étape), « Continuer » toujours au même endroit en bas,
// retour toujours possible.
import { useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, tnum } from '../theme';
import Icon from './Icon';
import { Button } from './ui';

import { tr } from '../lib/i18n';
export function SignupShell({ section, index, count, title, subtitle, onBack, onNext, nextLabel = 'Continuer', canNext = true, busy, error, children, secondary }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.ivoire }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.top, { paddingTop: insets.top + 8 }]}>
        <View style={s.topRow}>
          {onBack ? (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={tr("Retour")} hitSlop={12} style={s.back}>
              <Icon name="chevronLeft" size={24} />
            </Pressable>
          ) : (
            <View style={s.back} />
          )}
          <Text style={s.section}>
            {section}
            {count > 1 ? ` · ${index}/${count}` : ''}
          </Text>
          <View style={s.back} />
        </View>
        <View style={s.bars} accessibilityLabel={tr("{0}, étape {1} sur {2}", [section, index, count])}>
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={[s.bar, i < index && { backgroundColor: colors.bordeaux }]} />
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.title} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        <View style={{ gap: 16, marginTop: 8 }}>{children}</View>
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Button title={nextLabel} onPress={onNext} disabled={!canNext || busy} loading={busy} />
        {secondary}
      </View>
    </KeyboardAvoidingView>
  );
}

/** Grande carte de choix (situation, objectif…). */
export function ChoiceCard({ title, text, icon, selected, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} style={[s.choice, selected && s.choiceOn]}>
      {icon ? (
        <View style={[s.choiceIcon, selected && { backgroundColor: colors.onBordeauxSurface }]}>
          <Icon name={icon} size={20} color={selected ? colors.white : colors.bordeaux} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[s.choiceTitle, selected && { color: colors.white }]}>{title}</Text>
        {text ? <Text style={[s.choiceText, selected && { color: colors.onBordeaux }]}>{text}</Text> : null}
      </View>
      <View style={[s.radio, selected && { borderColor: colors.white }]}>{selected ? <View style={s.radioDot} /> : null}</View>
    </Pressable>
  );
}

const ITEM = 56;
/** Roue des nombres (âge 15–60, durées) : défilement aimanté, la valeur au centre est choisie. */
export function NumberWheel({ min, max, value, onChange, suffix = '' }) {
  const ref = useRef(null);
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollTo({ y: (value - min) * ITEM, animated: false }), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const settle = (y) => {
    const v = Math.min(max, Math.max(min, min + Math.round(y / ITEM)));
    if (v !== value) onChange(v);
  };
  return (
    <View style={s.wheel} accessibilityRole="adjustable" accessibilityValue={{ min, max, now: value, text: `${value}${suffix}` }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={(e) => {
      const v = e.nativeEvent.actionName === 'increment' ? Math.min(max, value + 1) : Math.max(min, value - 1);
      onChange(v);
      ref.current?.scrollTo({ y: (v - min) * ITEM, animated: true });
    }}>
      <View pointerEvents="none" style={s.wheelBand} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM * 2 }}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => settle(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        {values.map((v) => {
          const d = Math.abs(v - value);
          return (
            <Pressable key={v} onPress={() => { onChange(v); ref.current?.scrollTo({ y: (v - min) * ITEM, animated: true }); }} style={s.wheelItem}>
              <Text style={[s.wheelText, tnum, d === 0 ? s.wheelOn : d === 1 ? { opacity: 0.55 } : { opacity: 0.25 }]}>
                {v}
                {d === 0 && suffix ? <Text style={s.wheelSuffix}>{suffix}</Text> : null}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 20, gap: 10, backgroundColor: colors.ivoire },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  section: { fontFamily: fonts.bold, fontSize: 12.5, letterSpacing: 1.2, color: colors.orText, textTransform: 'uppercase' },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.blush },
  body: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24 },
  title: { fontFamily: fonts.extra, fontSize: 30, lineHeight: 36, letterSpacing: -1, color: colors.prune },
  subtitle: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.muted, marginTop: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 10, gap: 8, backgroundColor: colors.ivoire },
  error: { fontFamily: fonts.semi, fontSize: 14, color: colors.danger, textAlign: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: 22, padding: 18, borderWidth: 1.5, borderColor: colors.line },
  choiceOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  choiceIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { fontFamily: fonts.extra, fontSize: 17, color: colors.prune },
  choiceText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted, marginTop: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.caseVide, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
  wheel: { height: ITEM * 5, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  wheelBand: { position: 'absolute', left: 16, right: 16, top: ITEM * 2, height: ITEM, borderRadius: 16, backgroundColor: colors.blush },
  wheelItem: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  wheelText: { fontFamily: fonts.bold, fontSize: 22, color: colors.prune },
  wheelOn: { fontFamily: fonts.extra, fontSize: 30, color: colors.bordeaux },
  wheelSuffix: { fontFamily: fonts.semi, fontSize: 16, color: colors.bordeaux },
});

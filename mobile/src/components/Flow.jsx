// 04 / 05 — Flux du jour : Moyen, Léger, Abondant. Le clic montre tout de suite le choix (bordeaux, coche),
// « Enregistrer mon flux » confirme. Un seul niveau par jour ; aucun choix pré-coché ; traces / spotting à part.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { api } from '../lib/api';
import { longDate } from '../lib/format';
import { colors, fonts, SYMPTOMS } from '../theme';
import { DateField } from './forms';
import Icon from './Icon';
import { Button, Chip, Notice, Sheet, T, useToast } from './ui';

export const FLOW_LEVELS = [
  { key: 'moyen', label: 'Moyen' },
  { key: 'leger', label: 'Léger' },
  { key: 'abondant', label: 'Abondant' },
];
export const FLOW_LABEL = { moyen: 'moyen', leger: 'léger', abondant: 'abondant' };
const QUICK = ['crampes', 'fatigue'];

/** Gouttes au trait : une pleine (moyen), une vide (léger), deux (abondant). */
export function FlowDrop({ level, color, size = 26 }) {
  const drop = (dx = 0, s = 1) => `M${12 + dx} ${3 * s + (1 - s) * 12}c0 0 ${-6 * s} ${7 * s} ${-6 * s} ${11 * s}a${6 * s} ${6 * s} 0 0 0 ${12 * s} 0c0-${4 * s}-${6 * s}-${11 * s}-${6 * s}-${11 * s}z`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {level === 'abondant' ? (
        <>
          <Path d={drop(-4, 0.8)} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
          <Path d={drop(4, 0.8)} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
        </>
      ) : (
        <Path d={drop()} stroke={color} strokeWidth={1.6} fill={level === 'moyen' ? color : 'none'} strokeLinejoin="round" />
      )}
    </Svg>
  );
}

/** Sélecteur des 3 niveaux (fenêtre Flux du jour et carte de l'accueil). */
export function FlowPicker({ value, onChange, disabled, compact }) {
  return (
    <View style={s.levels} accessibilityRole="radiogroup">
      {FLOW_LEVELS.map((l) => {
        const on = value === l.key;
        return (
          <Pressable
            key={l.key}
            onPress={() => onChange(l.key)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled }}
            accessibilityLabel={`Flux ${l.label.toLowerCase()}`}
            style={({ pressed }) => [compact ? s.levelCompact : s.level, on && s.levelOn, disabled && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
          >
            {compact ? (
              <>
                {on ? <Icon name="check" size={15} color={colors.white} strokeWidth={2.6} /> : null}
                <Text style={[s.levelText, on && { color: colors.white }]}>{l.label}</Text>
              </>
            ) : (
              <>
                {on ? (
                  <View style={s.checkBadge}>
                    <Icon name="check" size={12} color={colors.bordeaux} strokeWidth={3} />
                  </View>
                ) : null}
                <FlowDrop level={l.key} color={on ? colors.white : colors.bordeaux} size={30} />
                <Text style={[s.levelText, on && { color: colors.white }]}>{l.label}</Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export function FlowSheet({ visible, day: initialDay, onClose, onSaved }) {
  const toast = useToast();
  const [day, setDay] = useState(initialDay);
  const [info, setInfo] = useState(null);
  const [level, setLevel] = useState(null);
  const [symptoms, setSymptoms] = useState([]);
  const [more, setMore] = useState(false);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const loaded = useRef(null);

  useEffect(() => {
    if (visible) setDay(initialDay);
  }, [visible, initialDay]);
  useEffect(() => {
    if (!visible || !day) return;
    let alive = true;
    setInfo(null);
    loaded.current = day;
    api
      .get(`/cycle/flow/${day}`)
      .then((r) => {
        if (!alive) return;
        setInfo(r);
        setLevel(r.level); // aucun choix pré-coché si rien n'a été noté
        setSaved(r.level);
        setSymptoms(r.symptoms || []);
      })
      .catch((e) => toast(e.message, 'error'));
    return () => {
      alive = false;
    };
  }, [visible, day, toast]);

  const save = async () => {
    if (!level || busy) return;
    setBusy(true);
    try {
      await api.put('/cycle/flow', { day, level, symptoms });
      setSaved(level);
      toast('Flux enregistré');
      onSaved?.({ day, level });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const toggleSpotting = async () => {
    const next = !info.spotting;
    setInfo((i) => ({ ...i, spotting: next }));
    try {
      await api.put('/cycle/spotting', { day, spotting: next });
      toast(next ? 'Traces notées' : 'Traces retirées');
    } catch (e) {
      setInfo((i) => ({ ...i, spotting: !next }));
      toast(e.message, 'error');
    }
  };
  const toggleSymptom = (k) => setSymptoms((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]));
  const shown = more ? Object.keys(SYMPTOMS) : [...new Set([...QUICK, ...symptoms])];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Flux du jour"
      footer={
        info?.inPeriod ? (
          <View style={{ gap: 10 }}>
            <Button title="Enregistrer mon flux" onPress={save} loading={busy} disabled={!level || busy || (level === saved && loaded.current === day && !symptomsChanged(info, symptoms))} />
            {saved ? (
              <View style={s.savedPill} accessibilityLiveRegion="polite">
                <Icon name="check" size={15} color={colors.bordeaux} strokeWidth={2.6} />
                <Text style={s.savedText}>Flux {FLOW_LABEL[saved]} sélectionné</Text>
              </View>
            ) : null}
            <Pressable onPress={() => setDateOpen((v) => !v)} accessibilityRole="button" style={{ alignSelf: 'center' }} hitSlop={8}>
              <Text style={s.dateLink}>Modifier la date</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setDateOpen((v) => !v)} accessibilityRole="button" style={{ alignSelf: 'center' }} hitSlop={8}>
            <Text style={s.dateLink}>Modifier la date</Text>
          </Pressable>
        )
      }
    >
      <T variant="muted" style={{ marginTop: -10 }}>{day ? longDate(day) : ''}</T>
      {dateOpen ? <DateField label="Date" value={day} onChange={(d) => { setDay(d); setDateOpen(false); }} /> : null}
      {!info ? (
        <ActivityIndicator color={colors.bordeaux} style={{ marginVertical: 24 }} />
      ) : (
        <>
          <T variant="bold" style={{ fontSize: 17 }}>Comment est ton flux ?</T>
          {!info.inPeriod ? <Notice title="Hors de tes règles">Ce jour ne fait pas partie de tes règles notées. Pour un nouveau saignement, utilise « Mes règles ont commencé ». Tu peux noter des traces ci-dessous.</Notice> : null}
          <FlowPicker value={level} onChange={setLevel} disabled={!info.inPeriod} />
          <Pressable onPress={toggleSpotting} accessibilityRole="switch" accessibilityState={{ checked: info.spotting }} style={s.spotting}>
            <Text style={s.spottingText}>{info.spotting ? '✓ Traces / spotting notées' : 'Noter des traces / spotting'}</Text>
            <Icon name="chevronRight" size={16} color={colors.bordeaux} />
          </Pressable>
          <View style={{ gap: 10 }}>
            <Text style={s.feelTitle}>
              Tu ressens aussi ? <Text style={s.optional}>(optionnel)</Text>
            </Text>
            <View style={s.chips}>
              {shown.map((k) => (
                <Chip key={k} label={SYMPTOMS[k] || k} selected={symptoms.includes(k)} onPress={() => toggleSymptom(k)} />
              ))}
              {!more ? <Chip label="+ Ajouter" onPress={() => setMore(true)} /> : null}
            </View>
          </View>
        </>
      )}
    </Sheet>
  );
}

const symptomsChanged = (info, list) => {
  const a = [...(info?.symptoms || [])].sort().join();
  return a !== [...list].sort().join();
};

const s = StyleSheet.create({
  levels: { flexDirection: 'row', gap: 10 },
  level: { flex: 1, height: 104, borderRadius: 20, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#F0D5DA' },
  levelCompact: { flex: 1, flexDirection: 'row', gap: 4, minHeight: 42, paddingHorizontal: 4, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#EAD1D6' },
  levelOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  levelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  spotting: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  spottingText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.bordeaux, textDecorationLine: 'underline' },
  feelTitle: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.prune },
  optional: { fontFamily: fonts.body, color: colors.muted, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  savedPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.blush, borderRadius: 999, minHeight: 38 },
  savedText: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux },
  dateLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux, textDecorationLine: 'underline' },
});

// 4.5 · 4.2 — Prières et adhan : mosquée ou ville (« Changer »), une ligne par prière (interrupteur + son : adhan
// complet, adhan court, bip, silencieux), « Me prévenir » (à l'heure, 10 ou 15 min avant), voix de l'adhan,
// et la section « Pendant mes règles » (accueil, rappels de prière, rappel de dhikr).
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { AdhanSoundSheet } from '../../components/AdhanSound';
import Icon from '../../components/Icon';
import { Segment, SettingsCard } from '../../components/Settings';
import { Gap, Screen, Sheet, Stepper, T, Toggle, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { syncLocation } from '../../lib/location';
import { useApi } from '../../lib/useApi';
import { colors, fonts, PRAYER_LABELS, PRAYERS } from '../../theme';

const SOUNDS = [
  { key: 'complet', label: 'Adhan complet' },
  { key: 'court', label: 'Adhan court' },
  { key: 'bip', label: 'Bip' },
  { key: 'silencieux', label: 'Silencieux' },
];
const OFFSETS = [
  { key: 0, label: 'À l’heure' },
  { key: 10, label: '10 min avant' },
  { key: 15, label: '15 min avant' },
];

export default function PrayerSettings() {
  const { section } = useLocalSearchParams();
  const { user, setSession } = useAuth();
  const toast = useToast();
  const [soundFor, setSoundFor] = useState(null);
  const [adjust, setAdjust] = useState(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const scrollRef = useRef(null);
  const prayers = useApi('/prayers');
  if (!user) return null;
  const ps = user.prayerSettings || {};
  const src = user.prayerSource || {};

  const patch = async (prayerSettings, message) => {
    try {
      await setSession(await api.patch('/me', { prayerSettings }));
      if (message) toast(message);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const soundOf = (p) => ps.prayerSound?.[p] || (ps.adhan !== false && ps.adhanMode !== 'notification' && ps.adhanPrayers?.[p] !== false ? 'complet' : 'bip');
  // Le son choisi pilote aussi l'adhan de cette prière (complet ou court = adhan ; bip ou silencieux = pas d'adhan).
  const setSound = (p, sound) => {
    const adhan = sound === 'complet' || sound === 'court';
    const others = PRAYERS.filter((k) => k !== p).some((k) => ['complet', 'court'].includes(soundOf(k)));
    patch({ prayerSound: { [p]: sound }, adhanPrayers: { [p]: adhan }, ...(adhan ? { adhan: true, adhanMode: 'adhan' } : others ? {} : { adhanMode: 'notification' }) }, `${PRAYER_LABELS[p]} : ${SOUNDS.find((x) => x.key === sound).label.toLowerCase()}`);
    setSoundFor(null);
  };
  const followLocation = async (on) => {
    if (!on) return patch({ followLocation: false }, 'Horaires calculés pour ta ville enregistrée');
    const session = await syncLocation(user, { ask: true, force: true });
    if (session) {
      await setSession(session);
      toast(`Horaires à ta position : ${session.user.city?.name}`);
    } else await patch({ followLocation: true }, 'Autorise la localisation dans les réglages du téléphone');
  };
  const place = (src.mode === 'mosquee' && prayers.data?.source?.label) || user.city?.name || '—';

  return (
    <Screen back title="Prières et adhan" scrollRef={scrollRef}>
      <SettingsCard title="Mes horaires">
        <View style={s.row}>
          <Icon name={src.mode === 'mosquee' ? 'home' : 'pin'} size={18} color={colors.bordeaux} />
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle} numberOfLines={1}>{place}</Text>
            <Text style={s.rowSub}>{src.mode === 'mosquee' ? 'Horaires de ta mosquée' : 'Horaires calculés pour ta ville'}</Text>
          </View>
          <Pressable onPress={() => router.push('/horaires')} accessibilityRole="button" hitSlop={8}>
            <Text style={s.link}>Changer</Text>
          </Pressable>
        </View>
        <Toggle label="Suivre ma position (GPS)" hint={ps.followLocation !== false ? `Actuellement : ${user.city?.name || '—'}` : 'Ville fixe'} value={ps.followLocation !== false} onChange={followLocation} />
        <Pressable onPress={() => setAdjust({ ...(ps.adjustments || {}) })} accessibilityRole="button" style={s.row}>
          <Icon name="clock" size={18} color={colors.bordeaux} />
          <Text style={[s.rowTitle, { flex: 1 }]}>Ajuster de quelques minutes</Text>
          <Icon name="chevronRight" size={16} color={colors.muted} />
        </Pressable>
      </SettingsCard>
      <Gap />

      <SettingsCard title="Rappel par prière">
        {PRAYERS.map((p, i) => {
          const on = ps.notifications !== false && ps.notifyPrayers?.[p] !== false;
          const sound = soundOf(p);
          return (
            <View key={p} style={[s.prayer, i === PRAYERS.length - 1 && { borderBottomWidth: 0 }]}>
              <Pressable onPress={() => on && setSoundFor(p)} disabled={!on} accessibilityRole="button" accessibilityLabel={`${PRAYER_LABELS[p]} : ${on ? SOUNDS.find((x) => x.key === sound).label : 'pas de rappel'}. Changer le son`} style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{PRAYER_LABELS[p]}</Text>
                <Text style={[s.rowSub, on && { color: colors.bordeaux }]}>{on ? `${SOUNDS.find((x) => x.key === sound).label} ›` : 'Pas de rappel'}</Text>
              </Pressable>
              <Switch value={on} onValueChange={(v) => patch({ notifyPrayers: { [p]: v }, ...(v ? { notifications: true } : {}) })} trackColor={{ true: colors.bordeaux, false: colors.line }} thumbColor={colors.white} accessibilityLabel={`Rappel de ${PRAYER_LABELS[p]}`} />
            </View>
          );
        })}
        <Text style={s.label}>Me prévenir</Text>
        <Segment items={OFFSETS} value={ps.notifyOffset || 0} onChange={(v) => patch({ notifyOffset: v }, v ? `Rappel ${v} min avant` : 'Rappel à l’heure')} />
        <Pressable onPress={() => setVoiceOpen(true)} accessibilityRole="button" style={[s.row, { marginTop: 4 }]}>
          <Icon name="volume" size={18} color={colors.bordeaux} />
          <Text style={[s.rowTitle, { flex: 1 }]}>Voix de l’adhan et test</Text>
          <Icon name="chevronRight" size={16} color={colors.muted} />
        </Pressable>
      </SettingsCard>
      <Gap />

      <SettingsCard
        title="Pendant mes règles"
        onLayout={(e) => {
          if (section === 'regles') setTimeout(() => scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y - 10, animated: true }), 250);
        }}
      >
        <Text style={s.label}>Sur l’accueil</Text>
        <Segment items={[{ key: 'horaires', label: 'Afficher les horaires' }, { key: 'ligne', label: 'Réduire en une ligne' }]} value={ps.periodHome || 'horaires'} onChange={(v) => patch({ periodHome: v }, 'Accueil mis à jour')} />
        <Toggle label="Garder les rappels de prière" hint="Sans adhan, avec un texte neutre « Petit rappel »" value={Boolean(ps.keepRemindersDuringPeriod)} onChange={(v) => patch({ keepRemindersDuringPeriod: v })} />
        <Toggle label="Garder le rappel de dhikr" hint="Le dhikr reste recommandé pendant les règles" value={ps.keepDhikrDuringPeriod !== false} onChange={(v) => patch({ keepDhikrDuringPeriod: v })} />
        <Toggle label="Un dhikr à l’heure de chaque prière" hint="À la place du rappel de prière, si les rappels sont coupés" value={Boolean(ps.dhikrDuringPeriod)} onChange={(v) => patch({ dhikrDuringPeriod: v })} />
      </SettingsCard>
      <Gap />

      <SettingsCard title="Adhkar">
        <Toggle label="Adhkar du matin" hint="20 min après Fajr" value={ps.adhkarMorning !== false} onChange={(v) => patch({ adhkarMorning: v })} />
        <Toggle label="Adhkar du soir" hint="20 min après Asr" value={ps.adhkarEvening !== false} onChange={(v) => patch({ adhkarEvening: v })} />
        <Toggle label="Vendredi (Jumu’a)" hint="Sourate Al-Kahf le matin, du’a avant Maghrib" value={ps.jumua !== false} onChange={(v) => patch({ jumua: v })} />
      </SettingsCard>
      <T variant="small" style={{ marginTop: 12 }}>Pendant les règles, aucune prière n’est comptée comme manquée. La méthode de calcul est choisie par notre comité.</T>

      <Sheet visible={Boolean(soundFor)} onClose={() => setSoundFor(null)} title={soundFor ? `Son pour ${PRAYER_LABELS[soundFor]}` : ''}>
        {SOUNDS.map((x) => {
          const on = soundFor && soundOf(soundFor) === x.key;
          return (
            <Pressable key={x.key} onPress={() => setSound(soundFor, x.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[s.choice, on && s.choiceOn]}>
              <View style={[s.radio, on && s.radioOn]}>{on ? <View style={s.radioDot} /> : null}</View>
              <Text style={s.rowTitle}>{x.label}</Text>
            </Pressable>
          );
        })}
        <T variant="small">Sur iPhone, l’adhan joué appli fermée dure 30 secondes au plus (limite d’Apple).</T>
      </Sheet>
      <Sheet visible={Boolean(adjust)} onClose={() => setAdjust(null)} title="Ajuster mes horaires" footer={<Pressable onPress={() => { patch({ adjustments: adjust }, 'Horaires ajustés'); setAdjust(null); }} accessibilityRole="button" style={s.save}><Text style={s.saveText}>Enregistrer</Text></Pressable>}>
        {PRAYERS.map((p) => (
          <Stepper key={p} label={PRAYER_LABELS[p]} value={adjust?.[p] || 0} onChange={(v) => setAdjust((d) => ({ ...d, [p]: v }))} min={-30} max={30} suffix=" min" />
        ))}
      </Sheet>
      <AdhanSoundSheet visible={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.orText, textTransform: 'uppercase', marginTop: 8 },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  rowTitle: { fontFamily: fonts.semi, fontSize: 15, color: colors.prune },
  rowSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  prayer: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, borderBottomWidth: 1, borderBottomColor: colors.line },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, backgroundColor: colors.white },
  choiceOn: { borderColor: colors.bordeaux, backgroundColor: colors.blush },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.caseVide, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.bordeaux },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.bordeaux },
  save: { minHeight: 52, borderRadius: 999, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.white },
});

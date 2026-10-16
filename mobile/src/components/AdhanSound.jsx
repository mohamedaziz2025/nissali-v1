// 07 — Son de l'adhan : activé ou désactivé, choix par prière, aperçu sonore. Réglage distinct des rappels :
// activer le son ne réactive jamais des rappels en pause ou désactivés ; les horaires restent consultables.
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { onAdhan, playAdhan, stopAdhan } from '../lib/adhan';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/useApi';
import { colors, fonts, PRAYER_LABELS, PRAYERS } from '../theme';
import Icon from './Icon';
import { Label, Notice, Sheet, T, Toggle, useToast } from './ui';

export function useAdhanPrefs() {
  const { user } = useAuth();
  const p = user?.prayerSettings || {};
  const on = p.adhan !== false && p.adhanMode !== 'notification';
  const prayers = PRAYERS.filter((k) => p.adhanPrayers?.[k] !== false);
  return { on, prayers, voice: p.adhanVoice || 'a9', notifications: p.notifications !== false };
}

export function AdhanSoundSheet({ visible, onClose, paused }) {
  const { setSession } = useAuth();
  const toast = useToast();
  const prefs = useAdhanPrefs();
  const adhans = useApi('/prayers/adhans');
  const [playing, setPlaying] = useState(null);
  useEffect(() => onAdhan((a) => setPlaying(a?.prayer === 'Aperçu' ? a.key : null)), []);

  const patch = async (prayerSettings, message) => {
    try {
      // Seuls les réglages du son changent : les rappels (notifications) ne sont jamais modifiés ici.
      await setSession(await api.patch('/me', { prayerSettings }));
      toast(message);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const close = () => {
    stopAdhan();
    onClose();
  };
  const voices = adhans.data?.items || [];

  return (
    <Sheet visible={visible} onClose={close} title="Son de l’adhan">
      <Toggle
        label="Son de l’adhan"
        hint={prefs.on ? 'L’adhan est joué à l’heure des prières choisies' : 'Notification seule à l’heure de la prière'}
        value={prefs.on}
        onChange={(v) => patch({ adhan: true, adhanMode: v ? 'adhan' : 'notification' }, v ? 'Son de l’adhan activé' : 'Son de l’adhan désactivé')}
      />
      {prefs.on ? (
        <>
          <Label>Pour quelles prières ?</Label>
          <View style={s.prayers}>
            {PRAYERS.map((k) => {
              const on = prefs.prayers.includes(k);
              return (
                <Pressable
                  key={k}
                  onPress={() => patch({ adhanPrayers: { [k]: !on } }, on ? `Adhan désactivé pour ${PRAYER_LABELS[k]}` : `Adhan activé pour ${PRAYER_LABELS[k]}`)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[s.prayer, on && s.prayerOn]}
                >
                  {on ? <Icon name="check" size={14} color={colors.white} strokeWidth={2.8} /> : null}
                  <Text style={[s.prayerText, on && { color: colors.white }]}>{PRAYER_LABELS[k]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Label>Voix</Label>
          {voices.map((a) => {
            const selected = prefs.voice === a.key;
            const isPlaying = playing === a.key;
            return (
              <View key={a.key} style={[s.voice, selected && s.voiceOn]}>
                <Pressable onPress={() => patch({ adhanVoice: a.key }, `Voix : ${a.label}`)} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[s.radio, selected && { borderColor: colors.bordeaux }]}>{selected ? <View style={s.radioDot} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <T variant="medium">{a.label}</T>
                    {a.detail ? <T variant="small">{a.detail}</T> : null}
                  </View>
                </Pressable>
                <Pressable onPress={() => (isPlaying ? stopAdhan() : playAdhan({ ...a, prayer: 'Aperçu' }))} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Arrêter l’aperçu' : `Écouter ${a.label}`} hitSlop={6} style={s.play}>
                  <Icon name={isPlaying ? 'stop' : 'volume'} size={18} color={colors.bordeaux} />
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}
      {paused ? <Notice title="Rappels en pause">Tes rappels de prière sont en pause pendant tes règles. Le réglage du son est mémorisé pour leur reprise : il ne les réactive pas.</Notice> : null}
      {!prefs.notifications ? <Notice title="Rappels désactivés">Tes notifications de prière sont désactivées (Horaires › Mes rappels). Le son de l’adhan ne les réactive pas.</Notice> : null}
      <T variant="small">
        {Platform.OS === 'ios'
          ? 'Sur iPhone, l’adhan complet est joué quand Nissali est ouverte. Téléphone verrouillé ou appli fermée, iOS ne permet qu’une notification avec un son court ; touche-la pour lancer l’adhan.'
          : 'Sur Android, l’adhan complet est joué quand Nissali est ouverte. Téléphone verrouillé ou appli fermée, Android affiche la notification avec un son court ; touche-la pour lancer l’adhan.'}
      </T>
    </Sheet>
  );
}

const s = StyleSheet.create({
  prayers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prayer: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: '#EAD1D6', backgroundColor: colors.white },
  prayerOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  prayerText: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line },
  voiceOn: { borderColor: colors.bordeaux },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.bordeaux },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
});

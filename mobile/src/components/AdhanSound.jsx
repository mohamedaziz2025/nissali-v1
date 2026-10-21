// 07 — Son de l'adhan : activé ou désactivé, choix par prière, aperçu sonore. Réglage distinct des rappels :
// activer le son ne réactive jamais des rappels en pause ou désactivés ; les horaires restent consultables.
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { onAdhan, playAdhan, stopAdhan } from '../lib/adhan';
import { notificationAccess, SYSTEM_ADHAN, testAdhan } from '../lib/notifications';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/useApi';
import { colors, fonts, PRAYER_LABELS, PRAYERS } from '../theme';
import { tr } from '../lib/i18n';
import Icon from './Icon';
import { Button, Label, Notice, Sheet, T, Toggle, useToast } from './ui';

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
  const [access, setAccess] = useState(null);
  const [testing, setTesting] = useState(false);
  useEffect(() => onAdhan((a) => setPlaying(a?.prayer === 'Aperçu' ? a.key : null)), []);
  useEffect(() => {
    if (visible && Platform.OS !== 'web') notificationAccess().then(setAccess).catch(() => {});
  }, [visible]);

  // Test : l'adhan est joué par le téléphone dans 10 secondes (verrouiller le téléphone pour l'entendre comme en vrai).
  const test = async () => {
    setTesting(true);
    try {
      const r = await testAdhan(10, prefs.voice);
      if (!r.ok) {
        setAccess(await notificationAccess());
        toast(tr("Autorise les notifications de Nissali pour entendre l’adhan"), 'error');
        return;
      }
      toast(tr("L’adhan retentit dans 10 secondes : verrouille ton téléphone"));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setTimeout(() => setTesting(false), 10_000);
    }
  };

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
    <Sheet visible={visible} onClose={close} title={tr("Son de l’adhan")}>
      <Toggle
        label={tr("Son de l’adhan")}
        hint={prefs.on ? tr("L’adhan est joué à l’heure des prières choisies") : tr("Notification seule à l’heure de la prière")}
        value={prefs.on}
        onChange={(v) => patch({ adhan: true, adhanMode: v ? 'adhan' : 'notification' }, v ? tr("Son de l’adhan activé") : tr("Son de l’adhan désactivé"))}
      />
      {prefs.on && access && (!access.granted || !access.sound) ? (
        <Notice title={access.granted ? tr("Son des notifications coupé") : tr("Notifications désactivées")}>
          {access.granted
            ? tr("Le son des notifications de Nissali est coupé dans les réglages du téléphone : l’adhan ne peut pas retentir. Active « Sons » dans Réglages › Nissali › Notifications.")
            : tr("Le téléphone bloque les notifications de Nissali : l’adhan ne peut pas retentir à l’heure de la prière. Autorise-les dans les réglages.")}
          {'\n'}
          <Text style={s.link} onPress={() => Linking.openSettings()}>{tr("Ouvrir les réglages")}</Text>
        </Notice>
      ) : null}
      {prefs.on ? (
        <>
          {Platform.OS !== 'web' ? <Button title={testing ? tr("L’adhan retentit dans quelques secondes…") : tr("Tester l’adhan sur ce téléphone")} icon="volume" variant="outline" onPress={test} disabled={testing} /> : null}
          <Label>{tr("Pour quelles prières ?")}</Label>
          <View style={s.prayers}>
            {PRAYERS.map((k) => {
              const on = prefs.prayers.includes(k);
              return (
                <Pressable
                  key={k}
                  onPress={() => patch({ adhanPrayers: { [k]: !on } }, on ? tr("Adhan désactivé pour {0}", [PRAYER_LABELS[k]]) : tr("Adhan activé pour {0}", [PRAYER_LABELS[k]]))}
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
          <Label>{tr("Voix")}</Label>
          {voices.map((a) => {
            const selected = prefs.voice === a.key;
            const isPlaying = playing === a.key;
            return (
              <View key={a.key} style={[s.voice, selected && s.voiceOn]}>
                <Pressable onPress={() => patch({ adhanVoice: a.key }, tr("Voix : {0}", [a.label]))} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[s.radio, selected && { borderColor: colors.bordeaux }]}>{selected ? <View style={s.radioDot} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <T variant="medium">{a.label}</T>
                    {a.detail ? <T variant="small">{a.detail}</T> : null}
                  </View>
                </Pressable>
                <Pressable onPress={() => (isPlaying ? stopAdhan() : playAdhan({ ...a, prayer: 'Aperçu' }))} accessibilityRole="button" accessibilityLabel={isPlaying ? tr("Arrêter l’aperçu") : tr("Écouter {0}", [a.label])} hitSlop={6} style={s.play}>
                  <Icon name={isPlaying ? 'stop' : 'volume'} size={18} color={colors.bordeaux} />
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}
      {paused ? <Notice title={tr("Rappels en pause")}>{tr("Tes rappels de prière sont en pause pendant tes règles. Le réglage du son est mémorisé pour leur reprise : il ne les réactive pas.")}</Notice> : null}
      {!prefs.notifications ? <Notice title={tr("Rappels désactivés")}>{tr("Tes notifications de prière sont désactivées (Horaires › Mes rappels). Le son de l’adhan ne les réactive pas.")}</Notice> : null}
      <T variant="small">
        {!SYSTEM_ADHAN
          ? tr("Version de test (Expo Go) : l’adhan est joué quand Nissali est ouverte ; appli fermée, la notification garde le son standard du téléphone. L’adhan joué par le téléphone fonctionne dans l’appli installée.")
          : Platform.OS === 'ios'
            ? tr("Appli fermée ou téléphone verrouillé, ton iPhone joue l’adhan avec la notification : les 30 premières secondes (limite d’Apple). Le bouton latéral ne doit pas être sur silencieux (orange) ; en mode Concentration, autorise les notifications urgentes de Nissali. Touche la notification pour l’écouter en entier.")
            : tr("Appli fermée ou téléphone verrouillé, ton téléphone joue l’adhan en entier avec la notification, au volume « Alarme » : il est entendu même en mode vibreur. Canal « Adhan » réglable dans les paramètres Android ; en mode Ne pas déranger, Android peut le couper.")}
        {SYSTEM_ADHAN ? tr(" Hors de l’appli, ton téléphone joue la voix choisie avec la notification (en entier sur Android, 30 premières secondes sur iPhone). L’adhan court garde la voix par défaut.") : ''}
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
  link: { fontFamily: fonts.bold, color: colors.bordeaux, textDecorationLine: 'underline' },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
});

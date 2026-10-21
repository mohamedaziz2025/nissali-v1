// 4.5 · 4.3 — Notifications : niveau Faible / Modérée / Élevée (RG-36, Faible par défaut), rappels essentiels
// (un interrupteur par famille, tous activés par défaut), masquer l'aperçu (oui par défaut) avec un aperçu en direct
// de l'écran verrouillé (RG-17, RG-35). Les rappels de prière se règlent dans « Prières et adhan ».
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../../components/Icon';
import { FrequencyPicker } from '../../components/NotifFrequency';
import { SettingsCard } from '../../components/Settings';
import { Gap, Screen, T, Toggle, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colors, fonts } from '../../theme';

import { tr } from '../../lib/i18n';
// Chaque famille regroupe les rappels essentiels de 5.12.
const FAMILIES = [
  { key: 'cycle', label: tr("Mon cycle"), hint: tr("Règles prévues, fenêtre fertile, fin des règles"), prefs: ['periodSoon', 'fertileWindow', 'periodEndQuestion'] },
  { key: 'jeunes', label: tr("Mes jeûnes"), hint: tr("Jeûnes programmés (la veille), Ramadan, jours blancs"), prefs: ['fastMakeup', 'fastPlanned', 'ramadan', 'whiteDays'] },
  { key: 'messages', label: tr("Messages des praticiennes"), hint: tr("À la réception d’un message"), prefs: ['messages'] },
  { key: 'events', label: tr("Mes événements"), hint: tr("Validation, rappel la veille"), prefs: ['events'] },
];

export default function NotificationSettings() {
  const { user, setSession } = useAuth();
  const toast = useToast();
  if (!user) return null;
  const np = user.notificationPrefs || {};
  const hide = np.hideNotePreview !== false;

  const patch = async (notificationPrefs, message) => {
    try {
      await setSession(await api.patch('/me', { notificationPrefs }));
      if (message) toast(message);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const familyOn = (f) => f.prefs.some((k) => np[k] !== false);

  return (
    <Screen back title={tr("Notifications")}>
      <SettingsCard title={tr("Niveau")}>
        <T variant="small">{tr("Conseils et actualités en plus de tes rappels. Tes rappels de prière et tes rappels personnels ne changent jamais.")}</T>
        <FrequencyPicker value={np.frequency || 'faible'} onChange={(v) => patch({ frequency: v, frequencyAsked: true }, 'Niveau enregistré')} />
      </SettingsCard>
      <Gap />

      <SettingsCard title={tr("Rappels essentiels")}>
        {FAMILIES.map((f) => (
          <Toggle key={f.key} label={f.label} hint={f.hint} value={familyOn(f)} onChange={(v) => patch(Object.fromEntries(f.prefs.map((k) => [k, v])))} />
        ))}
        <Toggle label={tr("Petit rappel du jour")} hint={tr("Un rappel discret le matin")} value={np.dailyReminder !== false} onChange={(v) => patch({ dailyReminder: v })} />
        <Pressable onPress={() => router.push('/reglages/prieres')} accessibilityRole="link" style={s.row}>
          <Icon name="bell" size={17} color={colors.bordeaux} />
          <Text style={s.rowText}>{tr("Rappels de prière et adhan")}</Text>
          <Icon name="chevronRight" size={16} color={colors.muted} />
        </Pressable>
      </SettingsCard>
      <Gap />

      <SettingsCard title={tr("Écran verrouillé")}>
        <Toggle label={tr("Masquer l’aperçu")} hint={tr("Aucun mot sensible : seulement « Rappel Nissali »")} value={hide} onChange={(v) => patch({ hideNotePreview: v })} />
        {/* Aperçu en direct de l'écran verrouillé */}
        <View style={s.lock} accessibilityLabel={tr("Aperçu de l’écran verrouillé : {0}", [(hide ? tr("Rappel Nissali") : tr("Prendre mon comprimé de fer, 08:00"))])}>
          <Text style={s.lockTime}>08:00</Text>
          <View style={s.notif}>
            <View style={s.notifIcon}>
              <Text style={s.notifLogo}>N</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.notifTitle}>{hide ? tr("Nissali") : tr("Rappel")}</Text>
              <Text style={s.notifBody}>{hide ? tr("Rappel Nissali") : tr("Prendre mon comprimé de fer · 08:00")}</Text>
            </View>
            <Text style={s.notifNow}>{tr("maintenant")}</Text>
          </View>
        </View>
        <T variant="small">{tr("Les rappels du cycle s’affichent toujours en « Petit rappel du jour », jamais « Tes règles arrivent ».")}</T>
      </SettingsCard>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, marginTop: 4 },
  rowText: { flex: 1, fontFamily: fonts.semi, fontSize: 15, color: colors.prune },
  lock: { backgroundColor: colors.prune, borderRadius: 22, padding: 16, gap: 12, marginVertical: 6 },
  lockTime: { fontFamily: fonts.extra, fontSize: 34, color: colors.white, textAlign: 'center', letterSpacing: -1 },
  notif: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 16, padding: 12 },
  notifIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  notifLogo: { fontFamily: fonts.logo, fontSize: 18, color: colors.white },
  notifTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.prune },
  notifBody: { fontFamily: fonts.medium, fontSize: 13, color: colors.prune },
  notifNow: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, alignSelf: 'flex-start' },
});

// 4.5 · 4.5 — Confidentialité et données : accords modifiables à tout moment (RG-03, RG-04 ; couper « Suivi de santé »
// met les fonctions du cycle en pause sans rien supprimer), « Télécharger mes données » (fichier envoyé par e-mail,
// RGPD), « Supprimer mon compte » en 2 temps (RG-07). Seul endroit de l'appli en rouge.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../../components/Icon';
import { SettingsCard } from '../../components/Settings';
import { Gap, Screen, Sheet, T, Toggle, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { cancelAll } from '../../lib/notifications';
import { colors, fonts } from '../../theme';

import { tr } from '../../lib/i18n';
const confirm = (title, text, action, label) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${text}`)) action(); // eslint-disable-line no-alert
    return;
  }
  Alert.alert(title, text, [
    { text: tr("Annuler"), style: 'cancel' },
    { text: label, style: 'destructive', onPress: action },
  ]);
};

export default function Privacy() {
  const { user, setSession, signOut } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0); // suppression : 0 → 1 (avertissement) → 2 (taper SUPPRIMER)
  const [typed, setTyped] = useState('');
  if (!user) return null;
  const c = user.consents || {};

  const consent = async (key, value) => {
    try {
      await setSession(await api.patch('/me/consents', { [key]: value }));
      if (key === 'health' && !value) router.replace('/consentement');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const toggleHealth = (v) => {
    if (v) return consent('health', true);
    confirm(tr("Couper le suivi de santé ?"), tr("Les fonctions du cycle (règles, prévisions, suivi santé) se mettent en pause. Rien n’est supprimé : tu pourras réactiver le suivi à tout moment."), () => consent('health', false), 'Couper');
  };
  const exportByMail = async () => {
    setBusy(true);
    try {
      const r = await api.post('/me/export/email', {});
      toast(tr("Fichier envoyé à {0}", [r.to]));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api.delete('/me');
      await cancelAll();
      await signOut();
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Screen back title={tr("Confidentialité")}>
      <SettingsCard title={tr("Mes accords")}>
        <Toggle label={tr("Suivi de santé")} hint={tr("Nécessaire pour le cycle, la grossesse et le suivi santé")} value={c.health?.accepted} onChange={toggleHealth} />
        <Toggle label={tr("Actualités par e-mail")} value={c.marketingEmail?.accepted} onChange={(v) => consent('marketingEmail', v)} />
        <Toggle label={tr("Actualités par SMS")} value={c.marketingSms?.accepted} onChange={(v) => consent('marketingSms', v)} />
        <Toggle label={tr("Actualités par WhatsApp")} value={c.marketingWhatsapp?.accepted} onChange={(v) => consent('marketingWhatsapp', v)} />
        <T variant="small">{tr("Tes données de santé sont chiffrées, jamais vendues, jamais utilisées pour la publicité.")}</T>
      </SettingsCard>
      <Gap />

      <SettingsCard title={tr("Mes données")}>
        <Pressable onPress={exportByMail} disabled={busy} accessibilityRole="button" style={s.row}>
          <Icon name="mail" size={18} color={colors.bordeaux} />
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{tr("Télécharger mes données")}</Text>
            <Text style={s.rowSub}>{user.email ? tr("Fichier envoyé à {0}", [user.email]) : tr("Ajoute une adresse e-mail dans ton profil")}</Text>
          </View>
          <Icon name="chevronRight" size={16} color={colors.muted} />
        </Pressable>
        <Pressable onPress={() => router.push('/legal?doc=confidentialite')} accessibilityRole="link" style={s.row}>
          <Icon name="lock" size={18} color={colors.bordeaux} />
          <Text style={[s.rowTitle, { flex: 1 }]}>{tr("Politique de confidentialité")}</Text>
          <Icon name="chevronRight" size={16} color={colors.muted} />
        </Pressable>
        <Pressable onPress={() => router.push('/legal?doc=cgu')} accessibilityRole="link" style={s.row}>
          <Icon name="info" size={18} color={colors.bordeaux} />
          <Text style={[s.rowTitle, { flex: 1 }]}>{tr("Conditions d’utilisation")}</Text>
          <Icon name="chevronRight" size={16} color={colors.muted} />
        </Pressable>
      </SettingsCard>
      <Gap />

      <Pressable onPress={() => setStep(1)} accessibilityRole="button" style={s.danger}>
        <Icon name="trash" size={18} color={colors.danger} />
        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, { color: colors.danger }]}>{tr("Supprimer mon compte")}</Text>
          <Text style={s.rowSub}>{tr("Toutes tes données sont effacées, au plus tard sous 30 jours")}</Text>
        </View>
      </Pressable>

      <Sheet visible={step === 1} onClose={() => setStep(0)} title={tr("Supprimer mon compte ?")}>
        <T>{tr("Ton compte et toutes tes données (cycle, santé, jeûnes, notes, dhikr, rendez-vous) seront définitivement effacés. Cette action ne peut pas être annulée.")}</T>
        <Pressable onPress={() => { setTyped(''); setStep(2); }} accessibilityRole="button" style={s.dangerBtn}>
          <Text style={s.dangerBtnText}>{tr("Continuer")}</Text>
        </Pressable>
        <Pressable onPress={() => setStep(0)} accessibilityRole="button" style={s.cancel}>
          <Text style={s.cancelText}>{tr("Garder mon compte")}</Text>
        </Pressable>
      </Sheet>
      <Sheet visible={step === 2} onClose={() => setStep(0)} title={tr("Dernière confirmation")}>
        <T>{tr("Écris SUPPRIMER pour confirmer.")}</T>
        <TextInput value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} placeholder={tr("SUPPRIMER")} placeholderTextColor={colors.caseVide} style={s.input} accessibilityLabel={tr("Écris SUPPRIMER pour confirmer")} />
        <Pressable onPress={deleteAccount} disabled={busy || typed.trim().toUpperCase() !== 'SUPPRIMER'} accessibilityRole="button" style={[s.dangerBtn, (busy || typed.trim().toUpperCase() !== 'SUPPRIMER') && { opacity: 0.4 }]}>
          <Text style={s.dangerBtnText}>{tr("Supprimer définitivement")}</Text>
        </Pressable>
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  rowTitle: { fontFamily: fonts.semi, fontSize: 15, color: colors.prune },
  rowSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  danger: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F0C4C1' },
  dangerBtn: { minHeight: 52, borderRadius: 999, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  dangerBtnText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.white },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  input: { minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: colors.lineField, paddingHorizontal: 16, fontFamily: fonts.bold, fontSize: 16, color: colors.prune, backgroundColor: colors.white },
});

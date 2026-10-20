// 4.14 · 9.3 — Mon espace praticienne : un écran de réglages normal (retour vers le profil), sans bascule.
// Carte profil (badge Diplômée), « Visible dans l'annuaire / Profil en pause », chiffres du mois, Mon activité,
// Ma formule, puis « Supprimer mon profil praticienne » (9.4 : le compte perso reste intact, la pause est proposée).
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Icon from '../components/Icon';
import { SettingsCard } from '../components/Settings';
import { ErrorState, Gap, Loader, Screen, Sheet, T, useToast } from '../components/ui';
import { api, assetUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/useApi';
import { colors, fonts, tnum } from '../theme';

const STATUS = {
  validee: { label: 'En ligne', color: colors.success },
  en_attente: { label: 'En vérification', color: colors.or },
  refusee: { label: 'À corriger', color: colors.danger },
  suspendue: { label: 'Suspendue', color: colors.muted },
};

export default function PractitionerSpace() {
  const toast = useToast();
  const { setSession } = useAuth();
  const { data, setData, loading, error, reload } = useApi('/pro-profile/space');
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Screen back title="Mon espace praticienne"><Loader /></Screen>;
  if (error && !data) {
    if (error.status === 404) {
      router.replace('/devenir-praticienne');
      return null;
    }
    return <Screen back title="Mon espace praticienne"><ErrorState error={error} onRetry={reload} /></Screen>;
  }

  const st = data.status === 'validee' && !data.visible ? { label: 'En pause', color: colors.muted } : STATUS[data.status] || STATUS.en_attente;
  const setVisible = async (visible) => {
    setData((d) => ({ ...d, visible }));
    try {
      await api.patch('/pro-profile/visibility', { visible });
      toast(visible ? 'Ton profil est visible dans l’annuaire' : 'Profil en pause : caché de l’annuaire, messages gardés');
    } catch (e) {
      setData((d) => ({ ...d, visible: !visible }));
      toast(e.message, 'error');
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await setSession(await api.delete('/pro-profile'));
      toast('Profil praticienne supprimé. Ton compte personnel est intact.');
      router.replace('/profil');
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };
  const exportMessages = async () => {
    try {
      const r = await api.post('/pro-profile/messages/export/email', {});
      toast(`Tes messages ont été envoyés à ${r.to}`);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const activity = [
    ['user', 'Mon profil public', 'Ce que voient les sœurs', () => router.push(`/praticienne/${data.id}`)],
    ['edit', 'Modifier ma fiche', 'Présentation, tarifs, photo', () => router.push('/pro/profil')],
    ['chat', 'Messages', data.stats.unread ? `${data.stats.unread} non lu${data.stats.unread > 1 ? 's' : ''}` : 'Aucun message non lu', () => router.push('/pro/messages')],
    ['clock', 'Disponibilités', 'Jours et horaires', () => router.push('/pro/disponibilites')],
    ['star', 'Avis', data.stats.reviews ? `${data.stats.reviews} avis` : 'Pas encore d’avis', () => router.push('/pro')],
  ];

  return (
    <Screen back title="Mon espace praticienne" onRefresh={reload}>
      <View style={s.hero}>
        <View style={s.avatar}>{data.photoUrl ? <Image source={{ uri: assetUrl(data.photoUrl) }} style={s.avatarImg} /> : <Text style={s.avatarText}>{data.displayName[0]}</Text>}</View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={s.name}>{data.displayName}</Text>
            {data.diplomaVerified ? (
              <View style={s.diploma}>
                <Icon name="star" size={11} color={colors.white} />
                <Text style={s.diplomaText}>Diplômée</Text>
              </View>
            ) : null}
          </View>
          <Text style={s.meta}>{data.specialtyLabel}{data.otherPending ? ' (métier en validation)' : ''}</Text>
          <View style={s.status}>
            <View style={[s.statusDot, { backgroundColor: st.color }]} />
            <Text style={s.statusText}>{st.label}</Text>
          </View>
        </View>
      </View>
      {data.status === 'refusee' && data.rejectionReason ? (
        <View style={s.alert}>
          <Text style={s.alertTitle}>À corriger</Text>
          <T>{data.rejectionReason}</T>
        </View>
      ) : null}
      {data.status === 'en_attente' ? <T variant="small" style={{ marginTop: 10 }}>Ta pièce d’identité est vérifiée par l’équipe sous 48 h. Tu recevras une notification au résultat.</T> : null}
      <Gap />

      <SettingsCard>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{data.visible ? 'Visible dans l’annuaire' : 'Profil en pause'}</Text>
            <Text style={s.rowSub}>{data.visible ? 'Les sœurs te trouvent et te contactent' : 'Cachée de l’annuaire, tes messages sont gardés'}</Text>
          </View>
          <Switch value={data.visible} onValueChange={setVisible} trackColor={{ true: colors.bordeaux, false: colors.line }} thumbColor={colors.white} accessibilityLabel="Visible dans l’annuaire" />
        </View>
      </SettingsCard>
      <Gap />

      <View style={s.stats}>
        {[
          [data.stats.views, 'vues ce mois'],
          [data.stats.unread, 'messages non lus'],
          [data.stats.reviews ? `${Number(data.stats.rating || 0).toFixed(1)}` : '—', data.stats.reviews ? `${data.stats.reviews} avis` : 'pas d’avis'],
        ].map(([n, l]) => (
          <View key={l} style={s.stat}>
            <Text style={[s.statNum, tnum]}>{n}</Text>
            <Text style={s.statLabel}>{l}</Text>
          </View>
        ))}
      </View>
      <Gap />

      <SettingsCard title="Mon activité">
        {activity.map(([icon, title, sub, onPress]) => (
          <Pressable key={title} onPress={onPress} accessibilityRole="button" style={s.row}>
            <Icon name={icon} size={18} color={colors.bordeaux} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{title}</Text>
              <Text style={s.rowSub}>{sub}</Text>
            </View>
            <Icon name="chevronRight" size={16} color={colors.muted} />
          </Pressable>
        ))}
        <View style={[s.row, { opacity: 0.45 }]} accessibilityLabel="Rendez-vous, bientôt disponible">
          <Icon name="calendar" size={18} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>Rendez-vous</Text>
            <Text style={s.rowSub}>Bientôt disponible</Text>
          </View>
        </View>
      </SettingsCard>
      <Gap />

      <SettingsCard title="Ma formule">
        <Text style={s.rowTitle}>{data.plan?.name || 'Découverte'}</Text>
        {data.plan?.trial && data.plan.endsAt ? <Text style={s.rowSub}>Essai gratuit jusqu’au {new Date(data.plan.endsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</Text> : null}
        <Pressable onPress={() => router.push('/pro')} accessibilityRole="link" style={{ paddingVertical: 6 }}>
          <Text style={s.link}>Gérer ma formule →</Text>
        </Pressable>
      </SettingsCard>
      <Gap />

      <Pressable onPress={() => setDeleting(true)} accessibilityRole="button" style={s.danger}>
        <Icon name="trash" size={18} color={colors.danger} />
        <Text style={s.dangerText}>Supprimer mon profil praticienne</Text>
      </Pressable>

      <Sheet visible={deleting} onClose={() => setDeleting(false)} title="Supprimer mon profil praticienne ?">
        <T>Ton compte personnel reste intact : cycle, notes, prières et jeûnes ne sont pas touchés.</T>
        <T>Tout de suite : tu disparais de l’annuaire et les sœurs ne peuvent plus t’écrire.</T>
        <T>Sous 30 jours : ton profil, tes avis, tes messages et tes justificatifs sont effacés.</T>
        <Pressable onPress={exportMessages} accessibilityRole="link">
          <Text style={s.exportLink}>Télécharger mes messages avant</Text>
        </Pressable>
        {data.visible ? (
          <Pressable onPress={() => { setDeleting(false); setVisible(false); }} accessibilityRole="button" style={s.pause}>
            <Text style={s.pauseText}>Plutôt mettre mon profil en pause</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={remove} disabled={busy} accessibilityRole="button" style={[s.dangerBtn, busy && { opacity: 0.5 }]}>
          <Text style={s.dangerBtnText}>Supprimer mon profil praticienne</Text>
        </Pressable>
        <T variant="small">Tu pourras recréer un profil plus tard (nouvelle vérification).</T>
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  exportLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux, textDecorationLine: 'underline' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.sable, borderRadius: 24, padding: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontFamily: fonts.extra, fontSize: 24, color: colors.bordeaux },
  name: { fontFamily: fonts.extra, fontSize: 19, color: colors.prune },
  meta: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted },
  diploma: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.or, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  diplomaText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.prune },
  alert: { backgroundColor: colors.blush, borderRadius: 16, padding: 14, gap: 4, marginTop: 12 },
  alertTitle: { fontFamily: fonts.extra, fontSize: 15, color: colors.bordeaux },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  rowTitle: { fontFamily: fonts.semi, fontSize: 15, color: colors.prune },
  rowSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  statNum: { fontFamily: fonts.extra, fontSize: 24, color: colors.bordeaux },
  statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted, textAlign: 'center' },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  danger: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F0C4C1' },
  dangerText: { fontFamily: fonts.bold, fontSize: 15, color: colors.danger },
  pause: { minHeight: 50, borderRadius: 999, borderWidth: 1.5, borderColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  pauseText: { fontFamily: fonts.bold, fontSize: 15, color: colors.bordeaux },
  dangerBtn: { minHeight: 52, borderRadius: 999, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  dangerBtnText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.white },
});

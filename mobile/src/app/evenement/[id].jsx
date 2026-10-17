// 5.11 — Fiche événement : description, programme, adresse, places restantes, inscription (gratuit)
// ou « Prendre ma place » (payant), conditions d'annulation et de remboursement (RG-31).
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoGrid } from '../../components/EventPhotos';
import Icon from '../../components/Icon';
import { Button, Card, ErrorState, Gap, Label, Loader, Row, Screen, T, useToast } from '../../components/ui';
import { api, assetUrl } from '../../lib/api';
import { longDate } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

const STATUS = { en_attente: 'En attente de validation', modification: 'Modification demandée', refuse: 'Refusé', annule: 'Annulé', publie: 'Publié' };

export default function EventScreen() {
  const { id } = useLocalSearchParams();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { data: e, setData, loading, error, reload } = useApi(`/events/${id}`);
  const [busy, setBusy] = useState(false);
  if (loading && !e) return <Screen back title="Événement"><Loader /></Screen>;
  if (error && !e) return <Screen back title="Événement"><ErrorState error={error} onRetry={reload} /></Screen>;

  const nissali = e.organizerType === 'nissali';
  const price = e.free ? 'Gratuit' : `${String(e.price).replace('.', ',')} €`;
  const address = [e.location?.name, e.location?.address, e.location?.city].filter(Boolean).join(', ');
  const isOrganizer = e.moderationNote !== undefined || e.registrationsCount !== undefined;

  const register = async () => {
    setBusy(true);
    try {
      setData(await api.post(`/events/${e.id}/register`, {}));
      toast(e.free ? 'Inscription confirmée, à bientôt !' : e.ticketUrl ? 'Billet ajouté à tes événements' : 'Ta place est réservée');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const unregister = () => {
    const go = async () => {
      try {
        setData(await api.post(`/events/${e.id}/unregister`, {}));
        toast('Inscription annulée');
      } catch (err) {
        toast(err.message, 'error');
      }
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Annuler ton inscription ?', e.cancellationPolicy, [{ text: 'Garder ma place', style: 'cancel' }, { text: 'Annuler', style: 'destructive', onPress: go }]);
  };
  const ticketHost = e.ticketUrl ? e.ticketUrl.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0] : null;
  // 17 / 18 — la billetterie externe s'ouvre seulement si le lien est sécurisé (https).
  const secureTicket = /^https:\/\/\S+\.\S+/.test(e.ticketUrl || '');
  const openTicket = () => {
    if (!secureTicket) return toast('Lien de billetterie indisponible', 'error');
    (Platform.OS === 'web' ? Linking.openURL(e.ticketUrl) : WebBrowser.openBrowserAsync(e.ticketUrl)).catch(() => Linking.openURL(e.ticketUrl));
  };
  const openMap = () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);

  return (
    <Screen back title="Événement" footer={
      e.status === 'publie' && !isOrganizer ? (
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={{ flex: 1 }}>
            <T variant="bold" style={{ fontSize: 18 }}>{price}</T>
            <T variant="small">{e.placesLeft ? `${e.placesLeft} place${e.placesLeft > 1 ? 's' : ''} restante${e.placesLeft > 1 ? 's' : ''}` : 'Complet'}</T>
          </View>
          {!e.free && secureTicket ? (
            <Button title="Réserver ma place" icon="external" onPress={openTicket} />
          ) : e.registered ? (
            <Button title="Annuler ma place" variant="outline" small onPress={unregister} />
          ) : !e.free ? (
            <Button title="Billetterie à venir" small variant="soft" disabled />
          ) : (
            <Button title="Je m’inscris" onPress={register} loading={busy} disabled={!e.placesLeft} />
          )}
        </View>
      ) : null
    }>
      {e.imageUrl ? <Image source={{ uri: assetUrl(e.imageUrl) }} style={s.cover} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
      <Text style={[s.tag, { color: nissali ? colors.bordeaux : colors.or }]}>{nissali ? 'ORGANISÉ PAR NISSALI' : `PROPOSÉ PAR ${String(e.organizerName).toUpperCase()}`}</Text>
      <T variant="h1" style={{ fontSize: 28, lineHeight: 34 }}>{e.title}</T>
      {e.status !== 'publie' ? (
        <Card tone="soft" style={{ marginTop: 12, gap: 4 }}>
          <Label color={colors.or}>{STATUS[e.status]}</Label>
          {e.moderationNote ? <T>{e.moderationNote}</T> : <T variant="small">Notre équipe vérifie chaque événement avant publication.</T>}
          {['en_attente', 'modification'].includes(e.status) ? <Button title="Modifier ma proposition" small variant="soft" onPress={() => router.push(`/evenement/proposer?id=${e.id}`)} style={{ marginTop: 8, alignSelf: 'flex-start' }} /> : null}
        </Card>
      ) : null}
      <Gap />
      <Card style={{ gap: 12 }}>
        <Row gap={12}>
          <Icon name="calendar" size={20} color={colors.bordeaux} />
          <T style={{ flex: 1 }}>
            {longDate(e.day, { year: true })} · {e.time}
            {e.endTime ? ` – ${e.endTime}` : ''}
          </T>
        </Row>
        <Row gap={12} align="flex-start">
          <Icon name="pin" size={20} color={colors.bordeaux} />
          <View style={{ flex: 1 }}>
            <T>{address || 'Lieu communiqué après inscription'}</T>
            {e.distanceKm != null ? <T variant="small">à {String(e.distanceKm).replace('.', ',')} km de toi</T> : null}
          </View>
          {address ? <Button title="Itinéraire" small variant="soft" onPress={openMap} /> : null}
        </Row>
        <Row gap={12}>
          <Icon name="users" size={20} color={colors.bordeaux} />
          <T style={{ flex: 1 }}>{e.placesLeft} place{e.placesLeft > 1 ? 's' : ''} restante{e.placesLeft > 1 ? 's' : ''} sur {e.capacity}</T>
        </Row>
        {e.registered ? (
          <Row gap={12}>
            <Icon name="check" size={20} color={colors.success} />
            <T style={{ flex: 1 }} color={colors.success}>
              {e.registration?.paymentStatus === 'billetterie' ? 'Billet noté dans tes événements' : e.registration?.paymentStatus === 'a_regler' ? 'Place réservée · le règlement se fait selon les indications de l’organisatrice' : 'Tu es inscrite'}
            </T>
          </Row>
        ) : null}
      </Card>
      {!e.free && e.status === 'publie' ? (
        <View style={s.ticket}>
          <Row gap={12}>
            <View style={[s.ticketIcon, !secureTicket && { backgroundColor: colors.muted }]}>
              <Icon name="external" size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ticketLabel}>BILLETTERIE EXTERNE</Text>
              {secureTicket ? (
                <>
                  <T variant="bold" numberOfLines={1}>{ticketHost}</T>
                  <T variant="small">Billet à {price}. La réservation et le paiement se font sur ce site sécurisé, en dehors de Nissali.</T>
                </>
              ) : (
                <>
                  <T variant="bold">Billetterie à venir</T>
                  <T variant="small">L’organisatrice n’a pas encore publié son lien de réservation.</T>
                </>
              )}
            </View>
          </Row>
          {!isOrganizer && secureTicket ? <Button title="Réserver ma place" icon="external" onPress={openTicket} /> : null}
          {!isOrganizer && e.registered ? (
            <Pressable onPress={unregister} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center' }}>
              <T variant="small" color={colors.bordeaux}>Retirer de mes événements</T>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Gap />
      <PhotoGrid photos={e.photos} title={e.title} />
      {e.photos?.length ? <Gap /> : null}
      <Label>Description</Label>
      <T style={{ marginTop: 6 }}>{e.description}</T>
      {e.programme ? (
        <>
          <Gap />
          <Label>Programme</Label>
          <T style={{ marginTop: 6 }}>{e.programme}</T>
        </>
      ) : null}
      <Gap />
      <Card tone="soft" style={{ gap: 6 }}>
        <Label>Annulation et remboursement</Label>
        <T variant="small">{e.cancellationPolicy}</T>
      </Card>
      {isOrganizer && e.registrationsCount != null ? (
        <>
          <Gap />
          <Card style={{ gap: 6 }}>
            <Label color={colors.or}>Ton événement</Label>
            <T>{e.registrationsCount} inscrite{e.registrationsCount > 1 ? 's' : ''}</T>
            {secureTicket ? <T variant="small">Billetterie externe : {ticketHost}</T> : !e.free ? <T variant="small" color={colors.bordeaux}>Ajoute le lien de billetterie externe (https://) pour que les sœurs puissent réserver leur place.</T> : null}
            {e.commissionRate ? <T variant="small">Commission Nissali : {Math.round(e.commissionRate * 100)} % du prix de chaque billet vendu via Nissali, réglée après l’événement.</T> : null}
          </Card>
        </>
      ) : null}
      <Gap h={24} />
    </Screen>
  );
}

const s = StyleSheet.create({
  cover: { width: '100%', height: 190, borderRadius: 24, marginBottom: 16, backgroundColor: colors.blush },
  tag: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.8, marginBottom: 6 },
  ticket: { marginTop: 14, gap: 12, backgroundColor: colors.blush, borderRadius: 24, padding: 16 },
  ticketIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  ticketLabel: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1, color: colors.or },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
});

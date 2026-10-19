// Éléments partagés de l'espace pro.
import * as WebBrowser from 'expo-web-browser';
import { Linking, Pressable, View } from 'react-native';
import { api } from '../lib/api';
import { longDate, price } from '../lib/format';
import { BOOKING_STATUS, colors } from '../theme';
import AccountButton from './AccountSwitcher';
import Icon from './Icon';
import { Button, Card, Label, Row, T } from './ui';

/** Bouton de compte de l'espace pro : avatar cerclé d'or, ouvre le sélecteur d'espace. */
export function SpaceSwitch() {
  return <AccountButton size={44} showPro />;
}

/** Carte d'une réservation avec les actions possibles selon son statut. */
export function BookingCard({ b, onAction }) {
  const st = BOOKING_STATUS[b.status];
  const future = new Date(b.startAt) > new Date();
  return (
    <Card style={{ marginBottom: 12, gap: 6 }}>
      <Row justify="space-between">
        <Label color={st?.color}>{st?.label}</Label>
        <T variant="small">{b.mode === 'visio' ? 'Visio' : 'Cabinet'} · {price(b.price)}{b.paymentStatus === 'paye' ? ' · payé' : ''}</T>
      </Row>
      <T variant="h3">{b.client?.firstName || 'Cliente'}</T>
      <T>{b.serviceName}</T>
      <T variant="muted">
        {longDate(b.day)} · {b.time}–{b.endTime}
      </T>
      {b.clientNote ? <T variant="small">« {b.clientNote} »</T> : null}
      <Row style={{ flexWrap: 'wrap', marginTop: 4 }} gap={8}>
        {b.status === 'en_attente' ? (
          <>
            <Button title="Accepter" small onPress={() => onAction(b, 'confirmee')} />
            <Button title="Refuser" small variant="outline" onPress={() => onAction(b, 'refusee')} />
          </>
        ) : null}
        {b.status === 'confirmee' ? (
          <>
            {b.videoUrl ? <Button title="Visio" icon="video" small onPress={() => WebBrowser.openBrowserAsync(b.videoUrl)} /> : null}
            {!future ? <Button title="Terminé" small variant="soft" onPress={() => onAction(b, 'terminee')} /> : null}
            {!future ? <Button title="Absente" small variant="ghost" onPress={() => onAction(b, 'absente')} /> : null}
            {future ? <Button title="Annuler" small variant="outline" onPress={() => onAction(b, 'annulee')} /> : null}
          </>
        ) : null}
        {['confirmee', 'terminee'].includes(b.status) && b.paymentStatus !== 'paye' ? <Button title="Marquer payé" small variant="ghost" onPress={() => onAction(b, 'paye')} /> : null}
        {b.client?.phone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${b.client.phone}`)} accessibilityLabel="Appeler" style={{ padding: 10 }}>
            <Icon name="phone" size={20} color={colors.bordeaux} />
          </Pressable>
        ) : null}
        {b.client?.email ? (
          <Pressable onPress={() => Linking.openURL(`mailto:${b.client.email}`)} accessibilityLabel="Écrire un e-mail" style={{ padding: 10 }}>
            <Icon name="mail" size={20} color={colors.bordeaux} />
          </Pressable>
        ) : null}
      </Row>
    </Card>
  );
}

export function StatTile({ label, value }) {
  return (
    <Card style={{ flex: 1, gap: 4, padding: 16 }}>
      <T variant="small">{label}</T>
      <T variant="h2">{value}</T>
    </Card>
  );
}

export function StatusBanner({ practitioner, pending }) {
  if (practitioner?.status === 'validee' && !pending) return null;
  const text = {
    en_attente: 'Ton profil est en cours de validation par l’équipe Nissali. Prépare tes prestations et tes disponibilités en attendant.',
    refusee: 'Ton inscription n’a pas été retenue. Contacte-nous sur contact@nissali.fr.',
    suspendue: 'Ton profil est suspendu. Contacte-nous sur contact@nissali.fr.',
  }[practitioner?.status];
  return (
    <View style={{ gap: 10, marginBottom: 14 }}>
      {text ? (
        <Card tone="soft">
          <T>{text}</T>
        </Card>
      ) : null}
      {pending ? (
        <Card tone="dashed" style={{ gap: 4 }}>
          <Label color={colors.or}>Formule en attente</Label>
          <T>
            « {pending.plan} » · {price(pending.amount)} {pending.billing === 'annuel' ? '/ an' : '/ mois'} · réf. {pending.paymentReference}
          </T>
          <T variant="small">Termine le règlement (en ligne ou avec l’équipe Nissali) pour activer ta formule.</T>
        </Card>
      ) : null}
    </View>
  );
}

export async function bookingAction(b, action, toast, reload) {
  try {
    if (action === 'paye') await api.patch(`/pro/bookings/${b.id}/payment`, { paymentStatus: 'paye' });
    else await api.patch(`/pro/bookings/${b.id}`, { status: action });
    toast({ confirmee: 'Rendez-vous confirmé', refusee: 'Demande refusée', annulee: 'Rendez-vous annulé', terminee: 'Rendez-vous terminé', absente: 'Absence notée', paye: 'Paiement noté' }[action]);
    reload();
  } catch (e) {
    toast(e.message, 'error');
  }
}

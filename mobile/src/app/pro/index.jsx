// Espace pro — accueil : statut, statistiques, demandes à traiter, prochains rendez-vous.
import { router } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { ColumnChart } from '../../components/Charts';
import { BookingCard, bookingAction, SpaceSwitch, StatTile, StatusBanner } from '../../components/ProBits';
import { Button, Card, ErrorState, Gap, Label, Loader, Row, Screen, T, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { price } from '../../lib/format';
import { useApi } from '../../lib/useApi';

export default function ProHome() {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { practitioner } = useAuth();
  const { data, loading, error, reload } = useApi('/pro/overview');
  const me = useApi('/pro/me');
  if (loading && !data) return <Screen title="Espace pro"><Loader /></Screen>;
  if (error && !data) return <Screen title="Espace pro" right={<SpaceSwitch />}><ErrorState error={error} onRetry={reload} /></Screen>;
  const act = (b, a) => bookingAction(b, a, toast, () => { reload(); me.reload(); });

  return (
    <Screen title={data.practitioner.displayName} subtitle="Espace pro" right={<SpaceSwitch />} onRefresh={reload}>
      <StatusBanner practitioner={data.practitioner} pending={me.data?.pendingSubscription} />
      <Row gap={12}>
        <StatTile label="RDV ce mois" value={data.stats.monthBookings} />
        <StatTile label="Encaissé ce mois" value={price(data.stats.monthRevenue).replace('Gratuit', '0 €')} />
      </Row>
      <Gap h={12} />
      <Row gap={12}>
        <StatTile label="Clientes" value={data.stats.clients} />
        <StatTile label="Note" value={data.stats.reviewsCount ? `${data.stats.rating} ★` : '—'} />
      </Row>
      <Gap />
      <Card tone="soft" style={{ gap: 4 }}>
        <Label>Formule {data.plan?.name}</Label>
        <T variant="small">
          {data.plan?.features?.maxServices ? `${data.plan.features.maxServices} prestation(s)` : 'Prestations illimitées'} · {data.plan?.features?.video ? 'visio incluse' : 'sans visio'} · {data.plan?.features?.crm ? 'fiches clientes' : 'sans fiches clientes'}
        </T>
        <Button title="Voir les formules" variant="ghost" small onPress={() => router.push('/pro/profil')} />
      </Card>
      <Gap h={20} />
      <Label>Demandes à traiter ({data.pending.length})</Label>
      <Gap h={10} />
      {data.pending.length ? data.pending.map((b) => <BookingCard key={b.id} b={b} onAction={act} />) : <T variant="muted">Aucune demande en attente.</T>}
      <Gap h={20} />
      <Label>Prochains rendez-vous</Label>
      <Gap h={10} />
      {data.upcoming.length ? data.upcoming.map((b) => <BookingCard key={b.id} b={b} onAction={act} />) : <T variant="muted">Aucun rendez-vous confirmé à venir.</T>}
      {data.series ? (
        <>
          <Gap h={20} />
          <Card style={{ gap: 10 }}>
            <Label>Rendez-vous sur 6 mois</Label>
            <ColumnChart data={data.series.map((s) => ({ start: `${s.month}-01`, value: s.bookings }))} width={width - 80} unit="" label="Rendez-vous par mois" />
          </Card>
        </>
      ) : null}
      <Gap />
      <Button title="Gérer mes disponibilités" variant="outline" icon="clock" onPress={() => router.push('/pro/disponibilites')} />
      {practitioner?.status === 'validee' ? null : <T variant="small" style={{ marginTop: 10 }}>Ton profil apparaîtra dans l’annuaire après validation.</T>}
    </Screen>
  );
}

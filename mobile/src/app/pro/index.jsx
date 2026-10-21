// Espace pro — accueil : statut, statistiques, demandes à traiter, prochains rendez-vous.
import { router } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { ColumnChart } from '../../components/Charts';
import { BookingCard, bookingAction, SpaceSwitch, StatTile, StatusBanner } from '../../components/ProBits';
import { Button, Card, ErrorState, Gap, Label, Loader, Row, Screen, T, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { price } from '../../lib/format';
import { useApi } from '../../lib/useApi';

import { tr } from '../../lib/i18n';
export default function ProHome() {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { practitioner } = useAuth();
  const { data, loading, error, reload } = useApi('/pro/overview');
  const me = useApi('/pro/me');
  if (loading && !data) return <Screen title={tr("Espace pro")}><Loader /></Screen>;
  if (error && !data) return <Screen title={tr("Espace pro")} right={<SpaceSwitch />}><ErrorState error={error} onRetry={reload} /></Screen>;
  const act = (b, a) => bookingAction(b, a, toast, () => { reload(); me.reload(); });

  return (
    <Screen title={data.practitioner.displayName} subtitle={tr("Espace pro")} right={<SpaceSwitch />} onRefresh={reload}>
      <StatusBanner practitioner={data.practitioner} pending={me.data?.pendingSubscription} />
      <Row gap={12}>
        <StatTile label={tr("RDV ce mois")} value={data.stats.monthBookings} />
        <StatTile label={tr("Encaissé ce mois")} value={price(data.stats.monthRevenue).replace('Gratuit', '0 €')} />
      </Row>
      <Gap h={12} />
      <Row gap={12}>
        <StatTile label={tr("Clientes")} value={data.stats.clients} />
        <StatTile label={tr("Note")} value={data.stats.reviewsCount ? `${data.stats.rating} ★` : '—'} />
      </Row>
      <Gap />
      <Card tone="soft" style={{ gap: 4 }}>
        {me.data?.trial ? (
          <>
            <Label>{tr("Essai gratuit")}{me.data.trial.daysLeft != null ? tr(" · {0} jour{1} restant{2}", [me.data.trial.daysLeft, me.data.trial.daysLeft > 1 ? 's' : '', me.data.trial.daysLeft > 1 ? 's' : '']) : ''}</Label>
            <T variant="small">{tr("Tu es en essai gratuit. Fonctionnalités incluses :")} {me.data.trial.included.join(', ').toLowerCase()}.</T>
          </>
        ) : (
          <>
            <Label>{tr("Formule")} {data.plan?.name}</Label>
            <T variant="small">
              {me.data?.included?.length
                ? me.data.included.join(' · ')
                : `${(data.plan?.features?.maxServices ? tr("{0} prestation(s)", [data.plan.features.maxServices]) : tr("Prestations illimitées"))} · ${(data.plan?.features?.video ? tr("visio incluse") : tr("sans visio"))} · ${(data.plan?.features?.crm ? tr("fiches clientes") : tr("sans fiches clientes"))}`}
            </T>
          </>
        )}
        <Button title={tr("Voir les formules")} variant="ghost" small onPress={() => router.push('/pro/profil')} />
      </Card>
      <Gap h={20} />
      <Label>{tr("Demandes à traiter (")}{data.pending.length})</Label>
      <Gap h={10} />
      {data.pending.length ? data.pending.map((b) => <BookingCard key={b.id} b={b} onAction={act} />) : <T variant="muted">{tr("Aucune demande en attente.")}</T>}
      <Gap h={20} />
      <Label>{tr("Prochains rendez-vous")}</Label>
      <Gap h={10} />
      {data.upcoming.length ? data.upcoming.map((b) => <BookingCard key={b.id} b={b} onAction={act} />) : <T variant="muted">{tr("Aucun rendez-vous confirmé à venir.")}</T>}
      {data.series ? (
        <>
          <Gap h={20} />
          <Card style={{ gap: 10 }}>
            <Label>{tr("Rendez-vous sur 6 mois")}</Label>
            <ColumnChart data={data.series.map((s) => ({ start: `${s.month}-01`, value: s.bookings }))} width={width - 80} unit="" label={tr("Rendez-vous par mois")} />
          </Card>
        </>
      ) : null}
      <Gap />
      <Button title={tr("Gérer mes disponibilités")} variant="outline" icon="clock" onPress={() => router.push('/pro/disponibilites')} />
      {practitioner?.status === 'validee' ? null : <T variant="small" style={{ marginTop: 10 }}>{tr("Ton profil apparaîtra dans l’annuaire après validation.")}</T>}
    </Screen>
  );
}

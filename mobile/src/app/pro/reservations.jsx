import { useState } from 'react';
import { BookingCard, bookingAction, SpaceSwitch } from '../../components/ProBits';
import { ErrorState, Gap, Loader, Screen, Segmented, T, useToast } from '../../components/ui';
import { today as serverToday } from '../../lib/format';
import { useApi } from '../../lib/useApi';

import { tr } from '../../lib/i18n';
const FILTERS = {
  avenir: { label: tr("À venir"), query: () => `?from=${serverToday()}`, keep: (b) => ['confirmee', 'en_attente'].includes(b.status) },
  attente: { label: tr("En attente"), query: () => '?status=en_attente', keep: () => true },
  passees: { label: tr("Passées"), query: () => '?order=desc', keep: (b) => ['terminee', 'absente'].includes(b.status) || (b.status === 'confirmee' && new Date(b.endAt) < new Date()) },
  annulees: { label: tr("Annulées"), query: () => '?order=desc', keep: (b) => ['annulee', 'refusee'].includes(b.status) },
};

export default function ProBookings() {
  const toast = useToast();
  const [filter, setFilter] = useState('avenir');
  const { data, loading, error, reload } = useApi(`/pro/bookings${FILTERS[filter].query()}`);
  const list = (data || []).filter(FILTERS[filter].keep);
  return (
    <Screen title={tr("Rendez-vous")} right={<SpaceSwitch />} onRefresh={reload}>
      <Segmented items={Object.entries(FILTERS).map(([key, f]) => ({ key, label: f.label }))} value={filter} onChange={setFilter} />
      <Gap />
      {loading && !data ? <Loader /> : null}
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : null}
      {data && !list.length ? <T variant="muted">{tr("Aucun rendez-vous.")}</T> : null}
      {list.map((b) => (
        <BookingCard key={b.id} b={b} onAction={(bk, a) => bookingAction(bk, a, toast, reload)} />
      ))}
    </Screen>
  );
}

// Mise à jour Cycle — données de « Suivre ma santé » et des pages détail : entrées des N derniers jours et
// jours de règles (fond rose des graphiques).
import { useApi } from './useApi';
import { periodDays } from '../components/HealthCharts';

export function useHealthRange(periodKey) {
  // 6 mois et les 7 derniers jours de la liste : on charge toujours au moins 7 jours.
  const entries = useApi(`/health-log/entries?days=${Math.max(7, periodDays(periodKey))}`);
  const cycle = useApi('/cycle');
  const items = entries.data?.items || [];
  const byDay = new Map(items.map((e) => [e.day, e]));
  const periods = cycle.data?.periods || [];
  const today = entries.data?.to || cycle.data?.today;
  const inPeriod = (d) => periods.some((p) => p.kind !== 'nifas' && d >= p.start && d <= (p.end || today));
  return {
    loading: (entries.loading && !entries.data) || (cycle.loading && !cycle.data),
    error: (!entries.data && entries.error) || (!cycle.data && cycle.error),
    today,
    byDay,
    items,
    inPeriod,
    cycle: cycle.data,
    reload: () => {
      entries.reload();
      cycle.reload();
    },
  };
}

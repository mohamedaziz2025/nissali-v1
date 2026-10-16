'use client';
import Shell from '@/components/Shell';
import { useFetch } from '@/lib/useFetch';

export default function AdminLayout({ children }) {
  const { data } = useFetch('/admin/stats');
  const events = useFetch('/admin/events?status=en_attente');
  const reports = useFetch('/admin/message-reports');
  return (
    <Shell
      area="admin"
      badges={{
        '/admin/praticiennes': data?.practitioners?.pending || 0,
        '/admin/abonnements': data?.practitioners?.pendingSubscriptions || 0,
        '/admin/evenements': events.data?.counts?.en_attente || 0,
        '/admin/signalements': (reports.data || []).filter((r) => r.open).length,
      }}
    >
      {children}
    </Shell>
  );
}

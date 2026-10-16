'use client';
import { ErrorBox, Loading } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

export default function AuditLog() {
  const { data, error, loading } = useFetch('/admin/audit?limit=100');
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Journal d’audit</h1>
          <p>Toutes les actions du back-office sont tracées (8.3).</p>
        </div>
      </div>
      <div className="card">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Administratrice</th>
                <th>Action</th>
                <th>Cible</th>
                <th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {data.map((l) => (
                <tr key={l._id}>
                  <td>{dateTime(l.createdAt)}</td>
                  <td>{l.admin?.firstName || l.admin?.email}</td>
                  <td>{l.action.replace(/_/g, ' ')}</td>
                  <td className="muted small">{l.target || '—'}</td>
                  <td className="muted small">{l.meta ? JSON.stringify(l.meta).slice(0, 120) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { Badge, ErrorBox, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { BOOKING_STATUS, euros, longDate } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

export default function AdminBookings() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useFetch(`/admin/bookings${status ? `?status=${status}` : ''}`);
  const cancel = async (b) => {
    if (!window.confirm('Annuler ce rendez-vous ?')) return;
    try {
      await api.patch(`/admin/bookings/${b._id}`, { status: 'annulee' });
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Réservations</h1>
          <p>Tous les rendez-vous pris entre utilisatrices et praticiennes.</p>
        </div>
      </div>
      <div className="chips">
        {[['', 'Toutes'], ...Object.entries(BOOKING_STATUS).map(([k, [l]]) => [k, l])].map(([k, l]) => (
          <button key={k} className={`chip ${status === k ? 'on' : ''}`} onClick={() => setStatus(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="card">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} />
        ) : data.length ? (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Praticienne</th>
                <th>Cliente</th>
                <th>Prestation</th>
                <th>Prix</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b._id}>
                  <td>
                    {longDate(b.day)} · {b.time}
                  </td>
                  <td>{b.practitioner?.displayName}</td>
                  <td>{b.client?.firstName}</td>
                  <td>
                    {b.serviceName} · {b.mode}
                  </td>
                  <td>{euros(b.price)}</td>
                  <td>
                    <Badge status={b.status} map={BOOKING_STATUS} />
                  </td>
                  <td>{['en_attente', 'confirmee'].includes(b.status) ? <button className="btn sm ghost" onClick={() => cancel(b)}>Annuler</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Aucune réservation.</p>
        )}
      </div>
    </div>
  );
}

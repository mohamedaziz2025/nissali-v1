'use client';
import Link from 'next/link';
import BookingActions from './BookingActions';
import { Avatar, Badge } from './ui';
import { BOOKING_STATUS, euros, parseDay } from '@/lib/format';

const DAY = (d) => parseDay(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function BookingTable({ rows, onDone, empty = 'Aucun rendez-vous.' }) {
  if (!rows.length) return <p className="muted" style={{ padding: 16 }}>{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Cliente</th>
            <th>Prestation</th>
            <th>Prix</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td style={{ whiteSpace: 'nowrap' }}>
                <strong>{DAY(b.day)}</strong>
                <div className="muted small">
                  {b.time}–{b.endTime}
                </div>
              </td>
              <td>
                <div className="cell-user">
                  <Avatar name={b.client?.firstName} />
                  <div>
                    <strong>{b.client?.id ? <Link href={`/pro/clientes/${b.client.id}`}>{b.client.firstName}</Link> : b.client?.firstName}</strong>
                    <span>{b.client?.phone || b.client?.email}</span>
                  </div>
                </div>
                {b.clientNote ? <div className="small muted" style={{ marginTop: 4 }}>« {b.clientNote} »</div> : null}
              </td>
              <td>
                {b.serviceName}
                <div className="muted small">{b.mode === 'visio' ? 'Visio' : 'Cabinet'}</div>
              </td>
              <td>
                {euros(b.price)}
                <div className="muted small">tarif indicatif</div>
              </td>
              <td>
                <Badge status={b.status} map={BOOKING_STATUS} />
              </td>
              <td>
                <BookingActions b={b} onDone={onDone} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

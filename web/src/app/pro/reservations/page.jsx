'use client';
import { useMemo, useState } from 'react';
import { ErrorBox, Loading } from '@/components/ui';
import { addDays, BOOKING_STATUS, parseDay, toDay, WEEKDAYS } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';
import BookingTable from '@/components/BookingTable';

const FILTERS = [
  ['', 'Tous'],
  ['en_attente', 'En attente'],
  ['confirmee', 'Confirmés'],
  ['terminee', 'Terminés'],
  ['annulee', 'Annulés'],
];

function mondayOf(day) {
  const wd = parseDay(day).getUTCDay();
  return addDays(day, wd === 0 ? -6 : 1 - wd);
}

export default function Bookings() {
  const [view, setView] = useState('liste');
  const [status, setStatus] = useState('');
  const [week, setWeek] = useState(mondayOf(toDay(new Date())));
  const listPath = `/pro/bookings?order=desc${status ? `&status=${status}` : ''}`;
  const weekPath = `/pro/bookings?from=${week}&to=${addDays(week, 6)}`;
  const { data, error, loading, reload } = useFetch(view === 'liste' ? listPath : weekPath);
  const today = toDay(new Date());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Rendez-vous</h1>
          <p>Accepte les demandes, partage le lien visio, note les paiements reçus.</p>
        </div>
        <div className="tabs" style={{ width: 260 }}>
          <button className={view === 'liste' ? 'on' : ''} onClick={() => setView('liste')}>Liste</button>
          <button className={view === 'agenda' ? 'on' : ''} onClick={() => setView('agenda')}>Agenda</button>
        </div>
      </div>
      {view === 'liste' ? (
        <>
          <div className="chips">
            {FILTERS.map(([k, l]) => (
              <button key={k} className={`chip ${status === k ? 'on' : ''}`} onClick={() => setStatus(k)}>
                {l}
              </button>
            ))}
          </div>
          <div className="card">{loading && !data ? <Loading /> : error ? <ErrorBox error={error} /> : <BookingTable rows={data} onDone={reload} />}</div>
        </>
      ) : (
        <>
          <div className="row between">
            <button className="btn sm outline" onClick={() => setWeek(addDays(week, -7))}>← Semaine précédente</button>
            <strong>
              Semaine du {parseDay(week).getUTCDate()}/{parseDay(week).getUTCMonth() + 1}
            </strong>
            <button className="btn sm outline" onClick={() => setWeek(addDays(week, 7))}>Semaine suivante →</button>
          </div>
          <div className="agenda">
            {days.map((d) => (
              <div key={d} className={`agenda-day ${d === today ? 'today' : ''}`}>
                <strong>
                  {WEEKDAYS[parseDay(d).getUTCDay()].slice(0, 3)} {parseDay(d).getUTCDate()}
                </strong>
                {(data || [])
                  .filter((b) => b.day === d && !['annulee', 'refusee'].includes(b.status))
                  .map((b) => (
                    <div key={b.id} className={`agenda-item ${b.status === 'en_attente' ? 'pending' : ''}`} title={BOOKING_STATUS[b.status][0]}>
                      <strong>{b.time}</strong> {b.client?.firstName}
                      <div className="muted">{b.serviceName}</div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

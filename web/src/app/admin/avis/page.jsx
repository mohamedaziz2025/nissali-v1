'use client';
import { ErrorBox, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

export default function Moderation() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/reviews');
  const toggle = async (r) => {
    try {
      await api.patch(`/admin/reviews/${r._id}`, { hidden: !r.hidden });
      toast(r.hidden ? 'Avis rétabli' : 'Avis masqué');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Avis</h1>
          <p>Modération des avis laissés après les rendez-vous.</p>
        </div>
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
                <th>Autrice</th>
                <th>Note</th>
                <th>Commentaire</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r._id} style={{ opacity: r.hidden ? 0.55 : 1 }}>
                  <td>{shortDate(r.createdAt)}</td>
                  <td>{r.practitioner?.displayName}</td>
                  <td>{r.client?.firstName}</td>
                  <td style={{ color: 'var(--or)' }}>{'★'.repeat(r.rating)}</td>
                  <td>
                    {r.comment}
                    {r.reply ? <div className="muted small">Réponse : {r.reply}</div> : null}
                  </td>
                  <td>
                    <button className="btn sm ghost" onClick={() => toggle(r)}>
                      {r.hidden ? 'Rétablir' : 'Masquer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Aucun avis.</p>
        )}
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { ErrorBox, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

export default function Reviews() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/pro/reviews');
  const [drafts, setDrafts] = useState({});
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const reply = async (id) => {
    try {
      await api.post(`/pro/reviews/${id}/reply`, { reply: drafts[id] });
      toast('Réponse publiée');
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
          <p>Les avis sont laissés par tes clientes après un rendez-vous terminé.</p>
        </div>
      </div>
      {data.length ? (
        data.map((r) => (
          <div key={r.id} className="card stack">
            <div className="row between">
              <strong>{r.author}</strong>
              <span style={{ color: 'var(--or)', fontSize: 18 }} aria-label={`${r.rating} sur 5`}>
                {'★'.repeat(r.rating)}
                <span style={{ color: 'var(--line)' }}>{'★'.repeat(5 - r.rating)}</span>
              </span>
            </div>
            {r.comment ? <p>{r.comment}</p> : null}
            <span className="muted small">{dateTime(r.createdAt)}{r.hidden ? ' · masqué par la modération' : ''}</span>
            {r.reply ? (
              <div className="card soft">Ta réponse : {r.reply}</div>
            ) : (
              <div className="row">
                <input className="input" style={{ flex: 1 }} placeholder="Répondre publiquement…" value={drafts[r.id] || ''} onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })} />
                <button className="btn sm" disabled={!drafts[r.id]?.trim()} onClick={() => reply(r.id)}>Publier</button>
              </div>
            )}
          </div>
        ))
      ) : (
        <p className="muted">Pas encore d’avis.</p>
      )}
    </div>
  );
}

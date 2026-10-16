'use client';
import { useState } from 'react';
import { Badge, ErrorBox, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { euros, shortDate, SUB_STATUS } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

export default function Subscriptions() {
  const toast = useToast();
  const [status, setStatus] = useState('en_attente');
  const { data, error, loading, reload } = useFetch(`/admin/subscriptions${status ? `?status=${status}` : ''}`);
  const set = async (s, next) => {
    try {
      await api.patch(`/admin/subscriptions/${s._id}`, { status: next });
      toast(next === 'active' ? 'Formule activée' : 'Abonnement mis à jour');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Abonnements</h1>
          <p>Confirme le règlement d’une formule payante pour l’activer (1 mois ou 1 an).</p>
        </div>
      </div>
      <div className="chips">
        {[
          ['en_attente', 'Paiement attendu'],
          ['active', 'Actifs'],
          ['', 'Tous'],
        ].map(([k, l]) => (
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
                <th>Praticienne</th>
                <th>Formule</th>
                <th>Montant</th>
                <th>Référence</th>
                <th>Demande</th>
                <th>Fin</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s._id}>
                  <td>
                    {s.practitioner?.displayName}
                    <div className="muted small">{s.practitioner?.location?.city}</div>
                  </td>
                  <td>
                    {s.plan} · {s.billing}
                  </td>
                  <td>{euros(s.amount)}</td>
                  <td>{s.paymentReference || '—'}</td>
                  <td>{shortDate(s.createdAt)}</td>
                  <td>{s.endsAt ? shortDate(s.endsAt) : '—'}</td>
                  <td>
                    <Badge status={s.status} map={SUB_STATUS} />
                  </td>
                  <td>
                    <div className="row">
                      {s.status === 'en_attente' ? <button className="btn sm" onClick={() => set(s, 'active')}>Paiement reçu : activer</button> : null}
                      {s.status !== 'annulee' ? <button className="btn sm ghost" onClick={() => set(s, 'annulee')}>Annuler</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Aucun abonnement.</p>
        )}
      </div>
    </div>
  );
}

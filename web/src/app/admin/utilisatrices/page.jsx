'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Avatar, ErrorBox, Loading, PageHeader, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

function UsersContent() {
  const toast = useToast();
  const [q, setQ] = useState(useSearchParams().get('q') || '');
  const [situation, setSituation] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), ...(q ? { q } : {}), ...(situation ? { situation } : {}) });
  const { data, error, loading, reload } = useFetch(`/admin/users?${params}`);

  const toggle = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}`, { status: u.status === 'suspendue' ? 'active' : 'suspendue' });
      toast(u.status === 'suspendue' ? 'Compte réactivé' : 'Compte suspendu');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Utilisatrices</h1>
          <p>{data ? `${data.total.toLocaleString('fr-FR')} compte(s)` : ' '}</p>
        </div>
        <a className="btn outline" href="/api/admin/users/export.csv">Export CSV des contacts consentants</a>
      </div>
      <div className="row">
        <input className="input" placeholder="Rechercher (prénom, e-mail, téléphone, ville)" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ maxWidth: 380 }} />
        <select className="select" value={situation} onChange={(e) => { setSituation(e.target.value); setPage(1); }} style={{ width: 200 }}>
          <option value="">Toutes situations</option>
          <option value="mariee">Mariées</option>
          <option value="celibataire">Célibataires</option>
        </select>
      </div>
      <div className="card flush">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prénom</th>
                  <th>Âge</th>
                  <th>Ville</th>
                  <th>Situation</th>
                  <th>Contact</th>
                  <th>Communications</th>
                  <th>Inscription</th>
                  <th>Dernière activité</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={u.firstName} />
                        <div>
                          <strong>
                            {u.firstName || '—'}
                            {u.role === 'admin' ? <span className="badge" style={{ marginLeft: 6 }}>Admin</span> : null}
                            {u.isPractitioner ? <span className="badge warning" style={{ marginLeft: 6 }}>Pro</span> : null}
                          </strong>
                        </div>
                      </div>
                    </td>
                    <td>{u.age ?? '—'}</td>
                    <td>{u.city || '—'}</td>
                    <td>{u.situation === 'mariee' ? 'Mariée' : u.situation === 'celibataire' ? 'Célibataire' : '—'}</td>
                    <td className="small">
                      {u.email}
                      <div>{u.phone}</div>
                    </td>
                    <td className="small">{[u.marketing.email && 'e-mail', u.marketing.sms && 'SMS', u.marketing.whatsapp && 'WhatsApp'].filter(Boolean).join(', ') || 'non'}</td>
                    <td>{shortDate(u.createdAt)}</td>
                    <td>{shortDate(u.lastActiveAt)}</td>
                    <td>
                      {u.role !== 'admin' ? (
                        <button className={`btn sm ${u.status === 'suspendue' ? 'soft' : 'ghost'}`} onClick={() => toggle(u)}>
                          {u.status === 'suspendue' ? 'Réactiver' : 'Suspendre'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && data.pages > 1 ? (
        <div className="row">
          <button className="btn sm outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Précédent</button>
          <span className="muted">Page {page} / {data.pages}</span>
          <button className="btn sm outline" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Suivant →</button>
        </div>
      ) : null}
    </div>
  );
}

export default function Users() {
  return (
    <Suspense fallback={<Loading />}>
      <UsersContent />
    </Suspense>
  );
}

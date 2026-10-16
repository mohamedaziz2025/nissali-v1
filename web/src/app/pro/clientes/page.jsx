'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import Icon from '@/components/Icons';
import { Avatar, Empty, ErrorBox, Kpi, Loading, PageHeader, Tabs } from '@/components/ui';
import { euros, shortDate } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const STATUS = { nouvelle: ['Nouvelle', ''], reguliere: ['Régulière', 'success'], fidele: ['Fidèle', 'warning'], inactive: ['Inactive', 'neutral'] };

export default function Clients() {
  const { data, error, loading } = useFetch('/pro/clients');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('recent');
  const list = useMemo(() => {
    const rows = (data || []).filter((r) => (!status || r.status === status) && (!q || `${r.client?.firstName} ${r.client?.email || ''} ${r.client?.phone || ''} ${(r.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())));
    const key = { recent: (r) => r.stats.lastVisit || '', visits: (r) => r.stats.visits, name: (r) => r.client?.firstName || '' }[sort];
    return rows.sort((a, b) => (sort === 'name' ? String(key(a)).localeCompare(String(key(b))) : key(a) < key(b) ? 1 : -1));
  }, [data, q, status, sort]);

  if (loading && !data) return <Loading />;
  if (error?.code === 'PLAN_UPGRADE_REQUIRED') {
    return (
      <div className="stack" style={{ gap: 20 }}>
        <PageHeader title="Fiches clientes" />
        <div className="card">
          <Empty icon="users" title="Fiches clientes" action={<Link className="btn" href="/pro/abonnement">Voir les formules</Link>}>
            Historique, notes de séance, documents, suivi : inclus dans les formules Essentiel et Premium.
          </Empty>
        </div>
      </div>
    );
  }
  if (error) return <ErrorBox error={error} />;

  const totals = (data || []).reduce((a, r) => ({ upcoming: a.upcoming + (r.stats.nextBooking ? 1 : 0), visits: a.visits + r.stats.visits, regular: a.regular + (['reguliere', 'fidele'].includes(r.status) ? 1 : 0) }), { upcoming: 0, visits: 0, regular: 0 });

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="Fiches clientes" subtitle="Ton dossier professionnel. Aucune donnée de cycle ou de santé Nissali n’est partagée : seulement le prénom et les coordonnées." />
      <div className="grid grid-4">
        <Kpi tone="hero" icon="users" label="Clientes" value={data.length} />
        <Kpi icon="heart" label="Régulières et fidèles" value={totals.regular} hint={data.length ? `${Math.round((totals.regular / data.length) * 100)} % de tes clientes` : ''} />
        <Kpi icon="calendar" label="Séances réalisées" value={totals.visits} />
        <Kpi icon="clock" label="Avec un RDV à venir" value={totals.upcoming} />
      </div>
      <div className="row between">
        <div className="row">
          <Tabs label="Statut" value={status} onChange={setStatus} items={[['', 'Toutes'], ...Object.entries(STATUS).map(([k, [l]]) => [k, l])]} />
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 210 }} aria-label="Trier">
            <option value="recent">Dernière visite</option>
            <option value="visits">Nombre de séances</option>
            <option value="name">Prénom</option>
          </select>
        </div>
        <div className="search" style={{ width: 300 }}>
          <Icon name="search" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Prénom, contact, étiquette…" aria-label="Rechercher une cliente" />
        </div>
      </div>
      <div className="card flush">
        {list.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Statut</th>
                  <th>Séances</th>
                  <th>Dernière visite</th>
                  <th>Prochain RDV</th>
                  <th>Étiquettes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/pro/clientes/${r.client.id}`} className="cell-user" style={{ color: 'inherit' }}>
                        <Avatar name={r.client.firstName} />
                        <div>
                          <strong>{r.client.firstName}</strong>
                          <span>{r.client.phone || r.client.email}</span>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
                    </td>
                    <td className="num">
                      {r.stats.visits}
                      {r.stats.noShows ? <span className="muted small"> · {r.stats.noShows} abs.</span> : null}
                    </td>
                    <td>{r.stats.lastVisit ? shortDate(r.stats.lastVisit) : '—'}</td>
                    <td>{r.stats.nextBooking ? `${shortDate(r.stats.nextBooking.day)} · ${r.stats.nextBooking.time}` : <span className="muted">—</span>}</td>
                    <td className="small">{(r.tags || []).length ? r.tags.map((t) => <span key={t} className="badge neutral" style={{ marginRight: 4 }}>{t}</span>) : <span className="muted">—</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link className="btn sm outline" href={`/pro/clientes/${r.client.id}`}>
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="users" title={data.length ? 'Aucun résultat' : 'Pas encore de cliente'}>
            {data.length ? 'Modifie ta recherche ou tes filtres.' : 'Tes clientes apparaissent ici dès leur premier rendez-vous confirmé.'}
          </Empty>
        )}
      </div>
    </div>
  );
}

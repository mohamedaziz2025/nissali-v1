'use client';
// 4.13 · 8.3 — Magazine : liste des articles (titre, catégorie, statut, date, vues), filtre par statut.
import Link from 'next/link';
import { useState } from 'react';
import { ErrorBox, Loading } from '@/components/ui';
import { shortDate } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const STATUS = { brouillon: ['Brouillon', ''], programme: ['Programmé', 'warning'], publie: ['Publié', 'success'] };

export default function BlogAdmin() {
  const [filter, setFilter] = useState('');
  const { data, error, loading } = useFetch(`/admin/articles${filter ? `?status=${filter}` : ''}`);
  const list = data || [];
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Magazine</h1>
          <p>Deux étapes : Brouillon → Publié (tout de suite ou programmé). Les catégories sont gérées par l’équipe.</p>
        </div>
        <div className="row">
          <Link className="btn ghost" href="/admin/blog/categories">Gérer les catégories</Link>
          <Link className="btn" href="/admin/blog/nouveau">Nouvel article</Link>
        </div>
      </div>
      <div className="chips">
        {[['', 'Tous'], ...Object.entries(STATUS).map(([k, [l]]) => [k, l])].map(([k, l]) => (
          <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="card">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} />
        ) : list.length ? (
          <table>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Catégorie</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Vues</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a._id}>
                  <td>
                    <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
                      {a.coverUrl ? <img src={a.coverUrl} alt={a.coverAlt || ''} className="thumb-sm" /> : <span className="thumb-sm" style={{ background: 'var(--blush, #F7E8EA)' }} title="Sans photo" />}
                      <Link href={`/admin/blog/${a._id}`}>
                        <strong>{a.title}</strong>
                      </Link>
                    </div>
                    {a.featured ? <span className="badge" style={{ marginLeft: 8 }}>À la une</span> : null}
                    {a.pushOnPublish ? <span className="badge" style={{ marginLeft: 8 }}>{a.pushBroadcast ? 'Push envoyé' : 'Push à la publication'}</span> : null}
                  </td>
                  <td>{a.categoryLabel}</td>
                  <td>
                    <span className={`badge ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>
                  </td>
                  <td>{shortDate(a.publishAt)}</td>
                  <td>{a.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Aucun article.</p>
        )}
      </div>
    </div>
  );
}

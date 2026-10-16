'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorBox, Loading } from '@/components/ui';
import { shortDate } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const VALIDATION = { a_valider: ['À valider', 'warning'], valide_comite: ['Validé par le comité', 'success'], valide_sante: ['Validé santé', 'success'] };
const CATEGORIES = { cycle: 'Cycle', fiqh: 'Fiqh féminin', grossesse: 'Grossesse', ramadan: 'Ramadan', fertilite: 'Fertilité', sante: 'Santé féminine' };

export default function BlogAdmin() {
  const { data, error, loading } = useFetch('/admin/articles');
  const [filter, setFilter] = useState('');
  const list = (data || []).filter((a) => !filter || a.validation === filter);
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Blog</h1>
          <p>Seuls les articles validés (comité ou professionnelle de santé), publiés et dont la date est passée sont visibles dans l’appli.</p>
        </div>
        <Link className="btn" href="/admin/blog/nouveau">Nouvel article</Link>
      </div>
      <div className="chips">
        {[['', 'Tous'], ...Object.entries(VALIDATION).map(([k, [l]]) => [k, l])].map(([k, l]) => (
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
        ) : (
          <table>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Catégorie</th>
                <th>Validation</th>
                <th>Publication</th>
                <th>Lectures</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a._id}>
                  <td>
                    <Link href={`/admin/blog/${a._id}`}>
                      <strong>{a.title}</strong>
                    </Link>
                    {a.featured ? <span className="badge" style={{ marginLeft: 8 }}>À la une</span> : null}
                  </td>
                  <td>{CATEGORIES[a.category]}</td>
                  <td>
                    <span className={`badge ${VALIDATION[a.validation][1]}`}>{VALIDATION[a.validation][0]}</span>
                  </td>
                  <td>{a.published ? shortDate(a.publishAt) : <span className="muted">Brouillon</span>}</td>
                  <td>{a.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

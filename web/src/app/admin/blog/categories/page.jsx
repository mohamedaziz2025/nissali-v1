'use client';
// 4.13 · 8.3 — Catégories du Magazine : renommer, changer l'ordre (= ordre des puces dans l'appli), masquer ;
// supprimer seulement une catégorie vide, sinon déplacer ses articles vers une autre.
import Link from 'next/link';
import { useState } from 'react';
import { ErrorBox, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';

export default function ArticleCategories() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/article-categories');
  const [label, setLabel] = useState('');
  const [editing, setEditing] = useState(null); // { id, label }
  const list = data || [];

  const run = async (fn, message) => {
    try {
      await fn();
      if (message) toast(message);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const move = (i, delta) => {
    const ids = list.map((c) => c.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api.put('/admin/article-categories/order', { ids }));
  };
  const remove = (c) => {
    if (!c.articles) {
      if (window.confirm(`Supprimer la catégorie « ${c.label} » ?`)) run(() => api.delete(`/admin/article-categories/${c.id}`), 'Catégorie supprimée');
      return;
    }
    const others = list.filter((x) => x.id !== c.id);
    const to = window.prompt(`${c.articles} article(s) dans « ${c.label} ». Vers quelle catégorie les déplacer ?\n${others.map((o) => `${o.key} (${o.label})`).join('\n')}`, others[0]?.key || '');
    if (to) run(() => api.delete(`/admin/article-categories/${c.id}?moveTo=${encodeURIComponent(to.trim())}`), 'Articles déplacés, catégorie supprimée');
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <Link href="/admin/blog">← Magazine</Link>
      <div className="page-head">
        <div>
          <h1>Catégories du Magazine</h1>
          <p>L’ordre de la liste est l’ordre des puces dans le Magazine de l’appli. Les changements apparaissent tout de suite.</p>
        </div>
      </div>
      <form
        className="card row"
        style={{ gap: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api.post('/admin/article-categories', { label: label.trim() }), 'Catégorie créée').then(() => setLabel(''));
        }}
      >
        <input className="input" style={{ flex: 1 }} value={label} onChange={(e) => setLabel(e.target.value.slice(0, 25))} placeholder="Nouvelle catégorie (2 à 25 caractères)" />
        <button className="btn" disabled={label.trim().length < 2}>+ Ajouter</button>
      </form>
      <div className="card">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ordre</th>
                <th>Nom</th>
                <th>Articles</th>
                <th>Visible</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((c, i) => (
                <tr key={c.id} style={c.hidden ? { opacity: 0.55 } : null}>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn ghost small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">↑</button>
                      <button className="btn ghost small" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">↓</button>
                    </div>
                  </td>
                  <td>
                    {editing?.id === c.id ? (
                      <form
                        className="row"
                        style={{ gap: 6 }}
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() => api.patch(`/admin/article-categories/${c.id}`, { label: editing.label.trim() }), 'Catégorie renommée').then(() => setEditing(null));
                        }}
                      >
                        <input className="input" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value.slice(0, 25) })} autoFocus />
                        <button className="btn small" disabled={editing.label.trim().length < 2}>OK</button>
                      </form>
                    ) : (
                      <button className="btn ghost small" onClick={() => setEditing({ id: c.id, label: c.label })}>{c.label} ✎</button>
                    )}
                  </td>
                  <td>{c.articles}</td>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={!c.hidden} onChange={(e) => run(() => api.patch(`/admin/article-categories/${c.id}`, { hidden: !e.target.checked }))} />
                      <span>{c.hidden ? 'Masquée' : 'Visible'}</span>
                    </label>
                  </td>
                  <td>
                    <button className="btn ghost small" onClick={() => remove(c)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

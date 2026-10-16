'use client';
import { useState } from 'react';
import { ErrorBox, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';

export default function Categories() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/categories');
  const [form, setForm] = useState({ key: '', label: '' });
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/categories', { ...form, order: (data?.length || 0) + 1 });
      setForm({ key: '', label: '' });
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const patch = async (c, body) => {
    try {
      await api.patch(`/admin/categories/${c._id}`, body);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Catégories</h1>
          <p>Catégories des praticiennes : filtres de l’annuaire et choix de spécialité à l’inscription.</p>
        </div>
      </div>
      <form className="card row" onSubmit={add}>
        <input className="input" placeholder="Clé (ex. sophrologue)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase() })} pattern="[a-z0-9_]{2,30}" required style={{ maxWidth: 220 }} />
        <input className="input" placeholder="Libellé (ex. Sophrologue)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required style={{ maxWidth: 280 }} />
        <button className="btn">Ajouter</button>
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
                <th>Libellé</th>
                <th>Clé</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c._id}>
                  <td>
                    <input className="input" type="number" defaultValue={c.order} onBlur={(e) => patch(c, { order: Number(e.target.value) })} style={{ width: 80 }} aria-label="Ordre" />
                  </td>
                  <td>
                    <input className="input" defaultValue={c.label} onBlur={(e) => e.target.value !== c.label && patch(c, { label: e.target.value })} aria-label="Libellé" />
                  </td>
                  <td className="muted">{c.key}</td>
                  <td>{c.active ? <span className="badge success">Active</span> : <span className="badge neutral">Masquée</span>}</td>
                  <td>
                    <button className="btn sm ghost" onClick={() => patch(c, { active: !c.active })}>
                      {c.active ? 'Masquer' : 'Afficher'}
                    </button>
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

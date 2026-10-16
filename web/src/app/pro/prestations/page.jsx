'use client';
import { useState } from 'react';
import { Chips, ErrorBox, Field, Loading, Modal, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { euros } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const MODES = [
  { key: 'cabinet', label: 'Cabinet' },
  { key: 'visio', label: 'Visio' },
  { key: 'les_deux', label: 'Cabinet ou visio' },
];
const EMPTY = { name: '', description: '', price: 50, durationMinutes: 45, mode: 'cabinet', active: true };

export default function Services() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/pro/services');
  const me = useFetch('/pro/me');
  const [edit, setEdit] = useState(null);
  const max = me.data?.plan?.features?.maxServices;

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { name: edit.name, description: edit.description, price: Number(edit.price), durationMinutes: Number(edit.durationMinutes), mode: edit.mode, active: edit.active };
      if (edit._id) await api.patch(`/pro/services/${edit._id}`, body);
      else await api.post('/pro/services', body);
      toast('Prestation enregistrée');
      setEdit(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const remove = async () => {
    try {
      const r = await api.delete(`/pro/services/${edit._id}`);
      toast(r.archived ? 'Prestation désactivée (rendez-vous à venir)' : 'Prestation supprimée');
      setEdit(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Prestations</h1>
          <p>{max ? `Ta formule permet ${max} prestation(s) active(s).` : 'Prestations illimitées avec ta formule.'}</p>
        </div>
        <button className="btn" onClick={() => setEdit({ ...EMPTY })}>Ajouter une prestation</button>
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
                <th>Prestation</th>
                <th>Durée</th>
                <th>Lieu</th>
                <th>Prix</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s._id}>
                  <td>
                    <strong>{s.name}</strong>
                    <div className="muted small">{s.description}</div>
                  </td>
                  <td>{s.durationMinutes} min</td>
                  <td>{MODES.find((m) => m.key === s.mode)?.label}</td>
                  <td>{euros(s.price)}</td>
                  <td>{s.active ? <span className="badge success">Active</span> : <span className="badge neutral">Désactivée</span>}</td>
                  <td>
                    <button className="btn sm outline" onClick={() => setEdit({ ...s })}>Modifier</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Ajoute ta première prestation pour recevoir des rendez-vous.</p>
        )}
      </div>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Modifier la prestation' : 'Nouvelle prestation'}>
        {edit ? (
          <form className="stack" onSubmit={save}>
            <Field label="Nom">
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required minLength={2} />
            </Field>
            <Field label="Description">
              <textarea className="textarea" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <div className="grid grid-2">
              <Field label="Prix (€)">
                <input className="input" type="number" min="0" step="1" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} required />
              </Field>
              <Field label="Durée (minutes)">
                <input className="input" type="number" min="10" max="480" step="5" value={edit.durationMinutes} onChange={(e) => setEdit({ ...edit, durationMinutes: e.target.value })} required />
              </Field>
            </div>
            <Field label="Lieu" hint={me.data?.plan?.features?.video ? null : 'La visio est incluse dans les formules Essentiel et Premium.'}>
              <Chips items={MODES} value={edit.mode} onChange={(v) => setEdit({ ...edit, mode: v })} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              <span>Prestation active (réservable)</span>
            </label>
            <div className="row between">
              {edit._id ? <button type="button" className="btn danger sm" onClick={remove}>Supprimer</button> : <span />}
              <button className="btn">Enregistrer</button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

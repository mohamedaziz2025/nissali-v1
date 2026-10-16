'use client';
// Petit rappel du jour : versets, hadiths, conseils validés par le comité, programmables à une date.
import { useState } from 'react';
import { Chips, ErrorBox, Field, Loading, Modal, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { longDate } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const KINDS = [
  { key: 'verset', label: 'Verset' },
  { key: 'hadith', label: 'Hadith' },
  { key: 'conseil', label: 'Conseil' },
];
const EMPTY = { kind: 'hadith', text: '', source: '', scheduledFor: '', validated: true };

export default function Reminders() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/reminders');
  const [edit, setEdit] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    const body = { kind: edit.kind, text: edit.text, source: edit.source, scheduledFor: edit.scheduledFor || null, validated: edit.validated };
    try {
      if (edit._id) await api.patch(`/admin/reminders/${edit._id}`, body);
      else await api.post('/admin/reminders', body);
      toast('Rappel enregistré');
      setEdit(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const remove = async () => {
    await api.delete(`/admin/reminders/${edit._id}`);
    setEdit(null);
    reload();
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Petit rappel du jour</h1>
          <p>Un rappel programmé à une date est prioritaire ; sinon l’appli fait tourner les rappels validés.</p>
        </div>
        <button className="btn" onClick={() => setEdit({ ...EMPTY })}>Nouveau rappel</button>
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
                <th>Type</th>
                <th>Texte</th>
                <th>Source</th>
                <th>Programmé</th>
                <th>Validé</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r._id} onClick={() => setEdit({ ...r, scheduledFor: r.scheduledFor || '' })} style={{ cursor: 'pointer' }}>
                  <td>{KINDS.find((k) => k.key === r.kind)?.label}</td>
                  <td style={{ fontFamily: 'var(--font-title)', fontStyle: 'italic' }}>{r.text}</td>
                  <td className="muted small">{r.source}</td>
                  <td>{r.scheduledFor ? longDate(r.scheduledFor) : <span className="muted">Rotation</span>}</td>
                  <td>{r.validated ? <span className="badge success">Oui</span> : <span className="badge warning">Non</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Modifier le rappel' : 'Nouveau rappel'}>
        {edit ? (
          <form className="stack" onSubmit={save}>
            <Chips items={KINDS} value={edit.kind} onChange={(v) => setEdit({ ...edit, kind: v })} />
            <Field label="Texte">
              <textarea className="textarea" value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} required maxLength={500} />
            </Field>
            <Field label="Source">
              <input className="input" value={edit.source || ''} onChange={(e) => setEdit({ ...edit, source: e.target.value })} placeholder="Al-Bukhari et Muslim" />
            </Field>
            <Field label="Programmer pour le (facultatif)">
              <input className="input" type="date" value={edit.scheduledFor} onChange={(e) => setEdit({ ...edit, scheduledFor: e.target.value })} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={edit.validated} onChange={(e) => setEdit({ ...edit, validated: e.target.checked })} />
              <span>Validé par le comité religieux</span>
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

'use client';
// 4.13 · 8.5 — Bibliothèque de dhikr (Par défaut / Proposé, ajouter, modifier, réordonner, retirer) et Petit rappel
// du jour (verset, hadith, invocation ou message ; 160 caractères ; source obligatoire sauf pour un message ;
// alerte sous 7 jours programmés ; un jour vide affiche un ancien rappel tiré au hasard).
import { useState } from 'react';
import { Chips, ErrorBox, Field, Loading, Modal, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { longDate } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const KINDS = [
  { key: 'verset', label: 'Verset' },
  { key: 'hadith', label: 'Hadith' },
  { key: 'invocation', label: 'Invocation' },
  { key: 'message', label: 'Message' },
];
const kindLabel = (k) => KINDS.find((x) => x.key === k)?.label || (k === 'conseil' ? 'Message' : k);
const EMPTY_R = { kind: 'verset', text: '', source: '', scheduledFor: '' };
const EMPTY_D = { name: '', arabic: '', meaning: '', source: '', goal: 33, isDefault: false, published: true };

/** Aperçu identique à la carte « Petit rappel » de l'accueil. */
function ReminderPreview({ r }) {
  return (
    <div style={{ background: '#F3E8DA', borderRadius: 20, padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: 1.2, color: '#8A5E2E' }}>PETIT RAPPEL</div>
      <p style={{ fontStyle: 'italic', fontSize: 16, lineHeight: 1.45, margin: '8px 0', color: '#2A1218' }}>{r.text || 'Ton texte apparaît ici.'}</p>
      <div className="muted small">{r.source ? `${r.kind === 'hadith' ? 'Rapporté par ' : ''}${r.source}` : r.kind === 'message' ? 'L’équipe Nissali' : 'Source'}</div>
    </div>
  );
}

function Reminders() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/reminders');
  const [edit, setEdit] = useState(null);
  const needSource = edit && edit.kind !== 'message';
  const save = async (e) => {
    e.preventDefault();
    const body = { kind: edit.kind, text: edit.text.trim(), source: edit.source?.trim() || null, scheduledFor: edit.scheduledFor || null };
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
    if (!window.confirm('Supprimer ce rappel ?')) return;
    await api.delete(`/admin/reminders/${edit._id}`);
    setEdit(null);
    reload();
  };
  const items = data?.items || [];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <p className="muted" style={{ margin: 0 }}>Un texte par jour. Un jour vide affiche un ancien rappel tiré au hasard : jamais de carte vide.</p>
        <button className="btn" onClick={() => setEdit({ ...EMPTY_R })}>Nouveau rappel</button>
      </div>
      {data?.alert ? <div className="alert error">{data.alert}</div> : null}
      <div className="card">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date d’affichage</th>
                <th>Type</th>
                <th>Texte</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r._id} onClick={() => setEdit({ ...r, kind: r.kind === 'conseil' ? 'message' : r.kind, scheduledFor: r.scheduledFor || '' })} style={{ cursor: 'pointer' }}>
                  <td>{r.scheduledFor ? longDate(r.scheduledFor) : <span className="muted">Réserve</span>}</td>
                  <td>{kindLabel(r.kind)}</td>
                  <td style={{ fontStyle: 'italic' }}>{r.text}</td>
                  <td className="muted small">{r.source || 'L’équipe Nissali'}</td>
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
            <Field label="Texte" hint={`${edit.text.length}/160`}>
              <textarea className="textarea" value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value.slice(0, 160) })} required />
            </Field>
            <Field label={needSource ? 'Source (obligatoire)' : 'Signature (facultatif)'} hint={needSource ? null : 'Par défaut : « L’équipe Nissali »'}>
              <input className="input" value={edit.source || ''} onChange={(e) => setEdit({ ...edit, source: e.target.value })} placeholder={edit.kind === 'verset' ? 'Sourate Al-Baqara, 2:286' : edit.kind === 'message' ? 'L’équipe Nissali' : 'Al-Bukhari et Muslim'} required={needSource} />
            </Field>
            <Field label="Date d’affichage" hint="Laisser vide : le rappel rejoint la réserve tirée au hasard.">
              <input className="input" type="date" value={edit.scheduledFor} onChange={(e) => setEdit({ ...edit, scheduledFor: e.target.value })} />
            </Field>
            <ReminderPreview r={edit} />
            <div className="row between">
              {edit._id ? <button type="button" className="btn danger sm" onClick={remove}>Supprimer</button> : <span />}
              <button className="btn" disabled={edit.text.trim().length < 3 || (needSource && !edit.source?.trim())}>Enregistrer</button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

function DhikrLibrary() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/dhikr');
  const [edit, setEdit] = useState(null);
  const list = data || [];
  const run = async (fn, message) => {
    try {
      await fn();
      if (message) toast(message);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const save = (e) => {
    e.preventDefault();
    const body = { name: edit.name.trim(), arabic: edit.arabic.trim(), meaning: edit.meaning?.trim() || '', source: edit.source?.trim() || '', goal: Number(edit.goal) || 33, isDefault: Boolean(edit.isDefault), published: edit.published !== false };
    run(() => (edit._id ? api.patch(`/admin/dhikr/${edit._id}`, body) : api.post('/admin/dhikr', body)), 'Dhikr enregistré').then(() => setEdit(null));
  };
  const move = (i, delta) => {
    const ids = list.map((d) => d._id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api.put('/admin/dhikr-order', { ids }));
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <p className="muted" style={{ margin: 0 }}>« Par défaut » : dans la liste de chaque nouvelle utilisatrice. « Proposé » : dans « Les plus connus ». Retirer un dhikr ne l’efface pas chez celles qui l’ont déjà. Les dhikr personnels n’apparaissent jamais ici.</p>
        <button className="btn" onClick={() => setEdit({ ...EMPTY_D })}>Ajouter un dhikr</button>
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
                <th>Ordre</th>
                <th>Phonétique</th>
                <th>Arabe</th>
                <th>Sens</th>
                <th>Objectif</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d, i) => (
                <tr key={d._id} style={d.published === false ? { opacity: 0.5 } : null}>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn ghost small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">↑</button>
                      <button className="btn ghost small" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">↓</button>
                    </div>
                  </td>
                  <td>
                    <button className="btn ghost small" onClick={() => setEdit({ ...d })}>{d.name}</button>
                  </td>
                  <td style={{ fontFamily: 'Amiri, serif', fontSize: 18, direction: 'rtl' }}>{d.arabic}</td>
                  <td className="small muted">{d.meaning}</td>
                  <td>{d.goal}</td>
                  <td>{d.published === false ? <span className="badge">Retiré</span> : d.isDefault ? <span className="badge success">Par défaut</span> : <span className="badge">Proposé</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Modifier le dhikr' : 'Ajouter un dhikr'}>
        {edit ? (
          <form className="stack" onSubmit={save}>
            <Field label="Phonétique">
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
            </Field>
            <Field label="Arabe">
              <input className="input" dir="rtl" style={{ fontSize: 20 }} value={edit.arabic} onChange={(e) => setEdit({ ...edit, arabic: e.target.value })} required />
            </Field>
            <Field label="Sens en français">
              <input className="input" value={edit.meaning || ''} onChange={(e) => setEdit({ ...edit, meaning: e.target.value })} />
            </Field>
            <Field label="Source">
              <input className="input" value={edit.source || ''} onChange={(e) => setEdit({ ...edit, source: e.target.value })} placeholder="Muslim" />
            </Field>
            <Field label="Objectif par défaut">
              <Chips items={[33, 99, 100].map((g) => ({ key: g, label: String(g) }))} value={Number(edit.goal)} onChange={(v) => setEdit({ ...edit, goal: v })} />
              <input className="input" type="number" min="1" max="10000" value={edit.goal} onChange={(e) => setEdit({ ...edit, goal: e.target.value })} style={{ marginTop: 8, maxWidth: 140 }} />
            </Field>
            <Field label="Statut">
              <Chips items={[{ key: 'defaut', label: 'Par défaut' }, { key: 'propose', label: 'Proposé' }, { key: 'retire', label: 'Retiré' }]} value={edit.published === false ? 'retire' : edit.isDefault ? 'defaut' : 'propose'} onChange={(v) => setEdit({ ...edit, isDefault: v === 'defaut', published: v !== 'retire' })} />
            </Field>
            <p className="muted small">Textes validés par le comité religieux avant publication (RG-41).</p>
            <div className="row between">
              <span />
              <button className="btn">Enregistrer</button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

export default function RemindersAndDhikr() {
  const [tab, setTab] = useState('rappel');
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Dhikr et petit rappel</h1>
          <p>Ce que l’appli propose chaque jour.</p>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === 'rappel' ? 'on' : ''} onClick={() => setTab('rappel')}>Petit rappel du jour</button>
        <button className={tab === 'dhikr' ? 'on' : ''} onClick={() => setTab('dhikr')}>Bibliothèque de dhikr</button>
      </div>
      {tab === 'rappel' ? <Reminders /> : <DhikrLibrary />}
    </div>
  );
}

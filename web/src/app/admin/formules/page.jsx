'use client';
import { useState } from 'react';
import { ErrorBox, Field, Loading, Modal, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { euros } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const FEATURES = [
  ['video', 'Consultations en visio'],
  ['crm', 'Fiches clientes'],
  ['stats', 'Statistiques'],
  ['featured', 'Mise en avant dans l’annuaire'],
  ['verifiedBadge', 'Badge vérifiée'],
  ['prioritySupport', 'Support prioritaire'],
];
const EMPTY = { key: '', name: '', tagline: '', priceMonthly: 0, priceYearly: 0, order: 9, active: true, highlights: '', features: { maxServices: 1, maxBookingsPerMonth: 0, video: false, crm: false, stats: false, featured: false, verifiedBadge: false, prioritySupport: false } };

export default function Plans() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/plans');
  const [edit, setEdit] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    const body = {
      key: edit.key,
      name: edit.name,
      tagline: edit.tagline,
      priceMonthly: Number(edit.priceMonthly),
      priceYearly: Number(edit.priceYearly),
      order: Number(edit.order),
      active: edit.active,
      highlights: String(edit.highlights).split('\n').map((h) => h.trim()).filter(Boolean),
      features: { ...edit.features, maxServices: Number(edit.features.maxServices), maxBookingsPerMonth: Number(edit.features.maxBookingsPerMonth) },
    };
    try {
      if (edit._id) await api.patch(`/admin/plans/${edit._id}`, body);
      else await api.post('/admin/plans', body);
      toast('Formule enregistrée');
      setEdit(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const setF = (k, v) => setEdit((e) => ({ ...e, features: { ...e.features, [k]: v } }));
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Formules</h1>
          <p>Formules d’abonnement proposées aux praticiennes. Les utilisatrices ne paient jamais.</p>
        </div>
        <button className="btn" onClick={() => setEdit({ ...EMPTY })}>Nouvelle formule</button>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} /> : null}
      <div className="grid grid-3">
        {(data || []).map((p) => (
          <div key={p._id} className="card stack">
            <div className="row between">
              <h2>{p.name}</h2>
              {p.active ? <span className="badge success">Active</span> : <span className="badge neutral">Inactive</span>}
            </div>
            <p>
              {euros(p.priceMonthly)} / mois · {euros(p.priceYearly)} / an
            </p>
            <p className="muted small">
              {p.features.maxServices || '∞'} prestation(s) · {p.features.maxBookingsPerMonth || '∞'} RDV / mois · {FEATURES.filter(([k]) => p.features[k]).map(([, l]) => l.toLowerCase()).join(', ') || 'aucune option'}
            </p>
            <button className="btn sm outline" style={{ justifySelf: 'start' }} onClick={() => setEdit({ ...p, highlights: (p.highlights || []).join('\n') })}>
              Modifier
            </button>
          </div>
        ))}
      </div>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? `Formule ${edit.name}` : 'Nouvelle formule'}>
        {edit ? (
          <form className="stack" onSubmit={save}>
            <div className="grid grid-2">
              <Field label="Clé technique">
                <input className="input" value={edit.key} onChange={(e) => setEdit({ ...edit, key: e.target.value })} disabled={Boolean(edit._id)} required pattern="[a-z0-9_-]{2,30}" />
              </Field>
              <Field label="Nom">
                <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
              </Field>
            </div>
            <Field label="Accroche">
              <input className="input" value={edit.tagline || ''} onChange={(e) => setEdit({ ...edit, tagline: e.target.value })} />
            </Field>
            <div className="grid grid-3">
              <Field label="Prix mensuel (€)">
                <input className="input" type="number" min="0" value={edit.priceMonthly} onChange={(e) => setEdit({ ...edit, priceMonthly: e.target.value })} />
              </Field>
              <Field label="Prix annuel (€)">
                <input className="input" type="number" min="0" value={edit.priceYearly} onChange={(e) => setEdit({ ...edit, priceYearly: e.target.value })} />
              </Field>
              <Field label="Ordre">
                <input className="input" type="number" value={edit.order} onChange={(e) => setEdit({ ...edit, order: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-2">
              <Field label="Prestations max (0 = illimité)">
                <input className="input" type="number" min="0" value={edit.features.maxServices} onChange={(e) => setF('maxServices', e.target.value)} />
              </Field>
              <Field label="RDV par mois max (0 = illimité)">
                <input className="input" type="number" min="0" value={edit.features.maxBookingsPerMonth} onChange={(e) => setF('maxBookingsPerMonth', e.target.value)} />
              </Field>
            </div>
            {FEATURES.map(([k, l]) => (
              <label key={k} className="check">
                <input type="checkbox" checked={Boolean(edit.features[k])} onChange={(e) => setF(k, e.target.checked)} />
                <span>{l}</span>
              </label>
            ))}
            <Field label="Points forts affichés (un par ligne)">
              <textarea className="textarea" value={edit.highlights} onChange={(e) => setEdit({ ...edit, highlights: e.target.value })} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              <span>Proposée aux praticiennes</span>
            </label>
            <button className="btn">Enregistrer</button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

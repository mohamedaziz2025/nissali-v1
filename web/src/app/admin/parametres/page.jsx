'use client';
// 7.2 — Paramètres religieux et techniques, jamais codés en dur, avec historique des modifications.
import { useEffect, useState } from 'react';
import { ErrorBox, Field, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const GROUPS = [
  ['religieux', 'Référentiel religieux (avis retenu par le comité)'],
  ['prieres', 'Horaires de prière'],
  ['calendrier', 'Calendrier hégirien'],
  ['calculs', 'Méthodes de calcul'],
  ['application', 'Application'],
];

const show = (v) => (typeof v === 'boolean' ? (v ? 'oui' : 'non') : String(v ?? '—').slice(0, 80));

export default function Settings() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/settings');
  const history = useFetch('/admin/settings/history');
  const [values, setValues] = useState(null);
  useEffect(() => {
    if (data) setValues(data.values);
  }, [data]);
  if ((loading && !data) || !values) return error ? <ErrorBox error={error} /> : <Loading />;

  const changed = Object.keys(values).filter((k) => values[k] !== data.values[k]);
  const save = async () => {
    try {
      const r = await api.put('/admin/settings', Object.fromEntries(changed.map((k) => [k, values[k]])));
      if (r.errors?.length) toast(r.errors[0], 'error');
      else toast('Paramètres enregistrés');
      reload();
      history.reload();
    } catch (e) {
      toast(e.data?.errors?.[0] || e.message, 'error');
    }
  };

  const input = (key, def) => {
    const v = values[key];
    const set = (val) => setValues((x) => ({ ...x, [key]: val }));
    if (def.type === 'boolean') {
      return (
        <label className="check">
          <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(e.target.checked)} />
          <span>{def.label}</span>
        </label>
      );
    }
    let control;
    if (def.type === 'select') {
      const labels = data.optionLabels[key] || {};
      control = (
        <select className="select" value={String(v)} onChange={(e) => set(def.options.find((o) => String(o) === e.target.value))}>
          {def.options.map((o) => (
            <option key={String(o)} value={String(o)}>
              {labels[o] || o}
            </option>
          ))}
        </select>
      );
    } else if (def.type === 'number') {
      control = <input className="input" type="number" min={def.min} max={def.max} value={v} onChange={(e) => set(Number(e.target.value))} style={{ maxWidth: 160 }} />;
    } else {
      control = <textarea className="textarea" style={{ minHeight: 80 }} value={v} onChange={(e) => set(e.target.value)} />;
    }
    return <Field label={def.label}>{control}</Field>;
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Paramètres</h1>
          <p>Valeurs proposées sur la référence malikite, à valider par le comité. L’appli ne nomme jamais d’école juridique.</p>
        </div>
        <button className="btn" disabled={!changed.length} onClick={save}>
          Enregistrer {changed.length ? `(${changed.length})` : ''}
        </button>
      </div>
      {GROUPS.map(([group, title]) => (
        <div key={group} className="card stack">
          <h2>{title}</h2>
          {Object.entries(data.definitions)
            .filter(([, d]) => d.group === group)
            .map(([key, def]) => (
              <div key={key}>{input(key, def)}</div>
            ))}
        </div>
      ))}
      <div className="card">
        <h2>Historique des modifications</h2>
        {history.data?.length ? (
          <table className="mt">
            <thead>
              <tr>
                <th>Date</th>
                <th>Paramètre</th>
                <th>Avant</th>
                <th>Après</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((h) => (
                <tr key={h._id}>
                  <td>{dateTime(h.createdAt)}</td>
                  <td>{data.definitions[h.key]?.label || h.key}</td>
                  <td className="muted">{show(h.oldValue)}</td>
                  <td>{show(h.newValue)}</td>
                  <td>{h.byName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted mt">Aucune modification pour l’instant.</p>
        )}
      </div>
    </div>
  );
}

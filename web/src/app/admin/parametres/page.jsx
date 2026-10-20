'use client';
// 7.2 / 4.13 · 8.6 — Paramètres religieux et techniques, jamais codés en dur ; aperçu immédiat du 1er Ramadan selon
// l'ajustement hégirien ; historique (ancienne valeur, nouvelle, qui, quand) avec retour arrière.
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
  ['notifications', 'Fréquence des notifications (5.12)'],
  ['application', 'Application'],
];

const show = (v) => (typeof v === 'boolean' ? (v ? 'oui' : 'non') : String(v ?? '—').slice(0, 80));

export default function Settings() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/settings');
  const history = useFetch('/admin/settings/history');
  const [values, setValues] = useState(null);
  const [ramadan, setRamadan] = useState(null);
  useEffect(() => {
    if (data) setValues(data.values);
  }, [data]);
  const adj = values?.hijriAdjustment;
  useEffect(() => {
    if (adj === undefined) return;
    api.get(`/admin/settings/ramadan-preview?adj=${adj}`).then(setRamadan).catch(() => setRamadan(null));
  }, [adj]);
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

  const revert = async (h) => {
    if (!window.confirm(`Rétablir « ${show(h.oldValue)} » pour « ${data.definitions[h.key]?.label || h.key} » ?`)) return;
    try {
      await api.post(`/admin/settings/history/${h._id}/revert`);
      toast('Ancienne valeur rétablie');
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
    return (
      <Field label={def.label} hint={key === 'hijriAdjustment' && ramadan?.start ? `1er Ramadan ${ramadan.hijriYear} avec ce réglage : ${new Date(`${ramadan.start}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}` : null}>
        {control}
      </Field>
    );
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
                <th />
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
                  <td>
                    <button className="btn ghost small" onClick={() => revert(h)}>Rétablir</button>
                  </td>
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

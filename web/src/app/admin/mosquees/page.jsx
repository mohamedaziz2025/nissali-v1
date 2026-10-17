'use client';
// Mosquées partenaires et leurs horaires (5.7, 6.8) : utilisés partout dans l'appli quand une utilisatrice
// choisit cette mosquée ; sans horaires pour un jour, l'appli bascule sur le calcul (RG-16 bis).
import { useState } from 'react';
import Icon from '@/components/Icons';
import { Empty, ErrorBox, Field, Loading, Modal, PageHeader, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';

const empty = { name: '', address: '', city: '', jumua: '13:30', jumua2: '' };

export default function AdminMosques() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/mosques');
  const [edit, setEdit] = useState(null);
  const [timetable, setTimetable] = useState(null); // { mosque, csv, replace }
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name: edit.name, address: edit.address, city: edit.city, jumua: edit.jumua || '', jumua2: edit.jumua2 || '' };
      if (edit.id) await api.patch(`/admin/mosques/${edit.id}`, body);
      else await api.post('/admin/mosques', body);
      toast('Mosquée enregistrée');
      setEdit(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const importTimetable = async () => {
    setBusy(true);
    try {
      const r = await api.put(`/admin/mosques/${timetable.mosque.id}/timetable`, { csv: timetable.csv, replace: timetable.replace });
      toast(`${r.imported} jour(s) importé(s)${r.errors.length ? ` · ${r.errors.length} ligne(s) ignorée(s)` : ''}`);
      setTimetable(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (m) => {
    if (!window.confirm(`Retirer « ${m.name} » des mosquées partenaires ?`)) return;
    const r = await api.delete(`/admin/mosques/${m.id}`);
    toast(r.switchedToCity ? `${r.switchedToCity} utilisatrice(s) repassent en mode ville` : 'Mosquée retirée');
    reload();
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader
        eyebrow="Horaires de prière"
        title="Mosquées partenaires"
        subtitle="Les utilisatrices qui choisissent une mosquée partenaire reçoivent ses horaires (y compris la Jumu’a) sur l’accueil et dans leurs notifications. Les autres mosquées viennent d’OpenStreetMap, avec des horaires calculés."
        actions={
          <button className="btn" onClick={() => setEdit({ ...empty })}>
            <Icon name="plus" /> Ajouter une mosquée
          </button>
        }
      />
      <div className="card">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={reload} />
        ) : data.length ? (
          <table>
            <thead>
              <tr>
                <th>Mosquée</th>
                <th>Ville</th>
                <th>Jumu’a</th>
                <th>Horaires publiés</th>
                <th>Fidèles</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong>
                    {m.timetableNote ? <div className="muted small">{m.timetableNote}</div> : null}
                  </td>
                  <td>{m.city}{m.region ? <span className="muted small"> · {m.region}</span> : null}</td>
                  <td className="num">{[m.jumua, m.jumua2].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{m.timetableDays ? <span className="badge success">{m.timetableDays} jours · jusqu’au {new Date(m.timetableTo).toLocaleDateString('fr-FR')}</span> : <span className="badge warning">Aucun (horaires calculés)</span>}</td>
                  <td className="num">{m.followers}</td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn sm outline" onClick={() => setTimetable({ mosque: m, csv: '', replace: false })}>Importer des horaires</button>
                      <button className="btn sm ghost" onClick={() => setEdit({ id: m.id, name: m.name, address: m.address || '', city: m.city, jumua: m.jumua || '', jumua2: m.jumua2 || '' })}>Modifier</button>
                      <button className="btn sm ghost" onClick={() => remove(m)} aria-label="Retirer"><Icon name="trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty icon="home" title="Aucune mosquée partenaire">Ajoute une mosquée puis importe ses horaires (copier-coller depuis un tableur).</Empty>
        )}
      </div>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Modifier la mosquée' : 'Nouvelle mosquée partenaire'}>
        {edit ? (
          <form className="stack" onSubmit={save}>
            <Field label="Nom"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Adresse"><input className="input" value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
            <Field label="Ville" hint="Sert à placer la mosquée sur la carte (distance)."><input className="input" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} required /></Field>
            <div className="grid grid-2">
              <Field label="Heure de la Jumu’a" hint="Affichée à la place de Dhuhr le vendredi."><input className="input" type="time" value={edit.jumua} onChange={(e) => setEdit({ ...edit, jumua: e.target.value })} /></Field>
              <Field label="2ᵉ Jumu’a (facultatif)" hint="Si la mosquée en organise deux."><input className="input" type="time" value={edit.jumua2} onChange={(e) => setEdit({ ...edit, jumua2: e.target.value })} /></Field>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Annuler</button>
              <button className="btn" disabled={busy}>Enregistrer</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(timetable)}
        onClose={() => setTimetable(null)}
        title={timetable ? `Horaires · ${timetable.mosque.name}` : ''}
        footer={
          <>
            <button className="btn ghost" onClick={() => setTimetable(null)}>Annuler</button>
            <button className="btn" onClick={importTimetable} disabled={busy || !timetable?.csv.trim()}>Importer</button>
          </>
        }
      >
        {timetable ? (
          <div className="stack">
            <p className="muted small">
              Une ligne par jour : <code>date;fajr;lever;dhuhr;asr;maghrib;isha;jumu’a;jumu’a 2</code> (lever et jumu’a facultatifs ; la jumu’a d’un vendredi prime sur l’heure habituelle). Dates au format 2026-10-16 ou 16/10/2026. Copie-colle directement depuis Excel ou le calendrier de la mosquée.
            </p>
            <textarea className="textarea" rows={10} value={timetable.csv} onChange={(e) => setTimetable({ ...timetable, csv: e.target.value })} placeholder={'date;fajr;lever;dhuhr;asr;maghrib;isha;jumua\n16/10/2026;06:30;08:12;13:40;16:30;19:02;20:35;13:30'} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} />
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={timetable.replace} onChange={(e) => setTimetable({ ...timetable, replace: e.target.checked })} />
              <span className="small">Remplacer tous les horaires existants (sinon, les jours importés sont ajoutés ou mis à jour)</span>
            </label>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

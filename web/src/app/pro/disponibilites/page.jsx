'use client';
import { useEffect, useState } from 'react';
import { ErrorBox, Field, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, longDate, toDay, WEEKDAYS } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function AvailabilityPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/pro/availability');
  const [slots, setSlots] = useState([]);
  const [off, setOff] = useState({ from: toDay(new Date()), to: addDays(toDay(new Date()), 7), reason: '' });
  useEffect(() => {
    if (data) setSlots(data.slots.map(({ weekday, start, end }) => ({ weekday, start, end })));
  }, [data]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const save = async () => {
    try {
      await api.put('/pro/availability', { slots });
      toast('Horaires enregistrés');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const addOff = async (e) => {
    e.preventDefault();
    try {
      await api.post('/pro/time-off', off);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const update = (i, patch) => setSlots((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Disponibilités</h1>
          <p>Tes plages horaires de la semaine : les créneaux sont proposés selon la durée de chaque prestation.</p>
        </div>
        <button className="btn" onClick={save}>Enregistrer les horaires</button>
      </div>
      <div className="grid grid-2">
        {ORDER.map((wd) => (
          <div key={wd} className="card stack">
            <div className="row between">
              <h3>{WEEKDAYS[wd]}</h3>
              <button className="btn sm soft" onClick={() => setSlots((s) => [...s, { weekday: wd, start: '09:00', end: '12:00' }])}>+ Plage</button>
            </div>
            {slots.map((s, i) =>
              s.weekday === wd ? (
                <div key={i} className="row">
                  <input className="input" type="time" value={s.start} onChange={(e) => update(i, { start: e.target.value })} style={{ width: 130 }} aria-label="Début" />
                  <span>→</span>
                  <input className="input" type="time" value={s.end} onChange={(e) => update(i, { end: e.target.value })} style={{ width: 130 }} aria-label="Fin" />
                  <button className="btn sm ghost" onClick={() => setSlots((all) => all.filter((_, j) => j !== i))} aria-label="Retirer">✕</button>
                </div>
              ) : null,
            )}
            {!slots.some((s) => s.weekday === wd) ? <span className="muted small">Fermé</span> : null}
          </div>
        ))}
      </div>
      <div className="card stack">
        <h2>Congés et absences</h2>
        <form className="row" onSubmit={addOff} style={{ alignItems: 'flex-end' }}>
          <Field label="Du">
            <input className="input" type="date" value={off.from} onChange={(e) => setOff({ ...off, from: e.target.value })} required />
          </Field>
          <Field label="Au">
            <input className="input" type="date" value={off.to} onChange={(e) => setOff({ ...off, to: e.target.value })} required />
          </Field>
          <Field label="Motif">
            <input className="input" value={off.reason} onChange={(e) => setOff({ ...off, reason: e.target.value })} />
          </Field>
          <button className="btn outline">Ajouter</button>
        </form>
        {data.timeOff.map((t) => (
          <div key={t._id} className="row between">
            <span>
              Du {longDate(t.from)} au {longDate(t.to)} {t.reason ? `· ${t.reason}` : ''}
            </span>
            <button className="btn sm ghost" onClick={() => api.delete(`/pro/time-off/${t._id}`).then(reload)}>Supprimer</button>
          </div>
        ))}
      </div>
    </div>
  );
}

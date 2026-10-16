'use client';
import { useEffect, useState } from 'react';
import { Chips, ErrorBox, Field, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useFetch } from '@/lib/useFetch';

export default function PublicProfile() {
  const toast = useToast();
  const { refresh } = useSession();
  const { data, error, loading, reload } = useFetch('/pro/me');
  const meta = useFetch('/practitioners/status');
  const [form, setForm] = useState(null);
  useEffect(() => {
    const p = data?.practitioner;
    if (p) setForm({ displayName: p.displayName, specialty: p.specialty, city: p.location?.city || '', address: p.location?.address || '', description: p.description || '', siret: p.legal?.siret || '', languages: (p.languages || []).join(', '), inPerson: p.inPerson, supportsVideo: p.supportsVideo, minNoticeHours: p.minNoticeHours ?? 12, autoConfirm: Boolean(p.autoConfirm), phone: p.phone || '', showPhone: Boolean(p.showPhone), diplomas: (p.diplomas || []).join('\n'), professionalId: p.professionalId || '' });
  }, [data]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!form) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/pro/me', { ...form, minNoticeHours: Number(form.minNoticeHours), languages: form.languages.split(',').map((l) => l.trim()).filter(Boolean), diplomas: form.diplomas.split('\n').map((d) => d.trim()).filter((d) => d.length >= 2).slice(0, 10) });
      toast('Profil enregistré');
      reload();
      refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('photo', file);
    try {
      await api.upload('/pro/photo', fd);
      toast('Photo mise à jour');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const p = data.practitioner;
  return (
    <form className="stack" style={{ gap: 20 }} onSubmit={save}>
      <div className="page-head">
        <div>
          <h1>Profil public</h1>
          <p>Ce que voient les utilisatrices dans l’annuaire Nissali.</p>
        </div>
        <button className="btn">Enregistrer</button>
      </div>
      <div className="grid grid-3">
        <div className="card stack" style={{ justifyItems: 'center', textAlign: 'center' }}>
          {p.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photoUrl} alt="" width={120} height={120} style={{ borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--blush)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-title)', fontSize: 48, color: 'var(--bordeaux)' }}>{p.displayName[0]}</div>
          )}
          <label className="btn sm outline" style={{ cursor: 'pointer' }}>
            Changer la photo
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} hidden />
          </label>
          <span className="muted small">JPEG, PNG ou WebP · 5 Mo max</span>
        </div>
        <div className="card stack" style={{ gridColumn: 'span 2' }}>
          <Field label="Nom affiché">
            <input className="input" value={form.displayName} onChange={set('displayName')} required />
          </Field>
          <Field label="Spécialité">
            <Chips items={meta.data?.categories || []} value={form.specialty} onChange={set('specialty')} />
          </Field>
          <div className="grid grid-2">
            <Field label="Ville">
              <input className="input" value={form.city} onChange={set('city')} />
            </Field>
            <Field label="SIRET">
              <input className="input" value={form.siret} onChange={set('siret')} />
            </Field>
          </div>
          <Field label="Adresse du cabinet">
            <input className="input" value={form.address} onChange={set('address')} />
          </Field>
          <Field label="Langues (séparées par des virgules)">
            <input className="input" value={form.languages} onChange={set('languages')} />
          </Field>
          <Field label="Présentation">
            <textarea className="textarea" value={form.description} onChange={set('description')} />
          </Field>
          <Field label="Diplômes et certifications" hint="Un par ligne, affichés sur ta fiche.">
            <textarea className="textarea" rows={3} value={form.diplomas} onChange={set('diplomas')} placeholder="Diplôme d’État de sage-femme" />
          </Field>
          <div className="grid grid-2">
            <Field label="Numéro professionnel (téléphone)">
              <input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="06 12 34 56 78" />
            </Field>
            <Field label="ADELI ou RPPS" hint="Visible par l’équipe Nissali seulement (RG-25).">
              <input className="input" value={form.professionalId} onChange={set('professionalId')} />
            </Field>
          </div>
          <label className="check">
            <input type="checkbox" checked={form.showPhone} onChange={set('showPhone')} disabled={!form.phone} />
            <span>Afficher mon numéro sur ma fiche : les utilisatrices pourront m’appeler (la messagerie reste toujours disponible).</span>
          </label>
        </div>
      </div>
      <div className="card stack">
        <h3>Réservations</h3>
        <label className="check">
          <input type="checkbox" checked={form.inPerson} onChange={set('inPerson')} />
          <span>Consultations au cabinet</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={form.supportsVideo} onChange={set('supportsVideo')} />
          <span>Consultations en visio (lien Jitsi créé automatiquement à la confirmation)</span>
        </label>
        {form.supportsVideo && !data.videoActive ? (
          <p className="muted small" style={{ marginLeft: 28 }}>
            Ta formule actuelle n’inclut pas la visio : elle sera proposée aux utilisatrices dès que ta formule Essentiel ou Premium sera active.
          </p>
        ) : null}
        <label className="check">
          <input type="checkbox" checked={form.autoConfirm} onChange={set('autoConfirm')} />
          <span>Confirmer automatiquement les demandes</span>
        </label>
        <Field label="Délai minimum avant un rendez-vous (heures)">
          <input className="input" type="number" min="0" max="168" value={form.minNoticeHours} onChange={set('minNoticeHours')} style={{ width: 140 }} />
        </Field>
      </div>
    </form>
  );
}

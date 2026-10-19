'use client';
// Notifications push envoyées par l'équipe : titre, message, image facultative, page ouverte au toucher,
// audience ciblée. Reçues sur le téléphone (push) et dans le centre de notifications de l'appli.
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icons';
import { CardHead, Empty, ErrorBox, Field, Loading, PageHeader, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTime as formatDateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const AUDIENCES = [
  { key: 'toutes', label: 'Toutes les utilisatrices' },
  { key: 'actualites', label: 'Ayant accepté les actualités' },
  { key: 'praticiennes', label: 'Praticiennes validées' },
  { key: 'ville', label: 'Une ville' },
  { key: 'situation', label: 'Selon la situation' },
];
const LINKS = [
  { key: '/notifications', label: 'Centre de notifications' },
  { key: '/', label: 'Accueil' },
  { key: '/lifestyle?tab=evenements', label: 'Lifestyle › Événements' },
  { key: '/lifestyle', label: 'Lifestyle › Magazine' },
  { key: '/jeunes', label: 'Jeûnes' },
  { key: '/praticiennes', label: 'Praticiennes' },
];

export default function AdminNotifications() {
  const toast = useToast();
  const history = useFetch('/admin/broadcasts');
  const [form, setForm] = useState({ title: '', body: '', detail: '', imageUrl: '', link: '/notifications', category: 'conseil', audience: { type: 'toutes', city: '', situation: 'mariee' } });
  const [reach, setReach] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));
  const setAudience = (patch) => setForm((f) => ({ ...f, audience: { ...f.audience, ...patch } }));

  // Nombre de destinataires et d'appareils joignables en push pour l'audience choisie.
  useEffect(() => {
    const a = form.audience;
    if (a.type === 'ville' && a.city.trim().length < 2) return setReach(null);
    const t = setTimeout(() => {
      api
        .post('/admin/broadcasts/preview', { audience: { type: a.type, ...(a.type === 'ville' ? { city: a.city.trim() } : {}), ...(a.type === 'situation' ? { situation: a.situation } : {}) } })
        .then(setReach)
        .catch(() => setReach(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form.audience]);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.upload('/admin/upload-image', fd);
      setForm((f) => ({ ...f, imageUrl: r.url }));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Envoyer cette notification à ${reach?.recipients ?? '…'} destinataire(s) ?`)) return;
    setBusy(true);
    try {
      const a = form.audience;
      const r = await api.post('/admin/broadcasts', {
        title: form.title.trim(),
        body: form.body.trim(),
        ...(form.detail.trim() ? { detail: form.detail.trim() } : {}),
        ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
        link: form.link,
        category: form.category,
        audience: { type: a.type, ...(a.type === 'ville' ? { city: a.city.trim() } : {}), ...(a.type === 'situation' ? { situation: a.situation } : {}) },
      });
      toast(`Notification envoyée à ${r.recipients} destinataire(s) · ${r.pushed} téléphone(s) en push${form.category === 'conseil' ? ' (selon la fréquence choisie par chacune)' : ''}`);
      setForm((f) => ({ ...f, title: '', body: '', detail: '', imageUrl: '' }));
      history.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader eyebrow="Communication" title="Notifications push" subtitle="Envoie une notification sur le téléphone des utilisatrices, avec une image si tu le souhaites. Elle reste aussi dans leur centre de notifications." />
      <div className="grid grid-main">
        <form className="card stack" onSubmit={send} style={{ gap: 16 }}>
          <CardHead title="Nouvelle notification" subtitle="Reste discrète : pas de mot sensible sur l’écran verrouillé (RG-17)." />
          <Field label="Titre" hint={`${form.title.length}/80`}>
            <input className="input" value={form.title} onChange={set('title')} maxLength={80} required placeholder="Ex. Ramadan approche 🌙" />
          </Field>
          <Field label="Message" hint={`${form.body.length}/300 · affiché dans la notification`}>
            <textarea className="textarea" rows={3} value={form.body} onChange={set('body')} maxLength={300} required placeholder="Ex. Prépare-toi en douceur : nos conseils dans le Magazine." />
          </Field>
          <Field label="Texte complet (facultatif)" hint="Visible en ouvrant la notification dans l’appli.">
            <textarea className="textarea" rows={3} value={form.detail} onChange={set('detail')} maxLength={2000} />
          </Field>
          <Field label="Image (facultatif)" hint="JPEG, PNG ou WebP, 5 Mo maximum. Format paysage conseillé (16:9).">
            <div className="row" style={{ alignItems: 'center', gap: 12 }}>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
              <button type="button" className="btn outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Icon name="image" /> {uploading ? 'Envoi…' : form.imageUrl ? 'Changer l’image' : 'Ajouter une image'}
              </button>
              {form.imageUrl ? (
                <button type="button" className="btn ghost sm" onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}>
                  Retirer
                </button>
              ) : null}
            </div>
          </Field>
          <Field label="Type" hint={form.category === 'conseil' ? 'Envoyée seulement à celles qui ont choisi « Modérée » (3 par semaine) ou « Élevée » (5 par semaine), jamais deux le même jour ; la nuit (22:00–08:00) et à l’heure d’une prière, elle arrive sans son, dans le centre de notifications.' : 'Information importante (compte, sécurité, service) : envoyée à toutes, quel que soit le niveau choisi.'}>
            <select className="select" value={form.category} onChange={set('category')}>
              <option value="conseil">Conseil ou actualité (selon la fréquence choisie)</option>
              <option value="essentiel">Information essentielle (toutes)</option>
            </select>
          </Field>
          <div className="grid grid-2">
            <Field label="Audience">
              <select className="select" value={form.audience.type} onChange={(e) => setAudience({ type: e.target.value })}>
                {AUDIENCES.map((a) => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            </Field>
            {form.audience.type === 'ville' ? (
              <Field label="Ville">
                <input className="input" value={form.audience.city} onChange={(e) => setAudience({ city: e.target.value })} placeholder="Ex. Nanterre" />
              </Field>
            ) : form.audience.type === 'situation' ? (
              <Field label="Situation">
                <select className="select" value={form.audience.situation} onChange={(e) => setAudience({ situation: e.target.value })}>
                  <option value="mariee">Mariées</option>
                  <option value="celibataire">Célibataires</option>
                </select>
              </Field>
            ) : (
              <Field label="Au toucher, ouvrir">
                <select className="select" value={form.link} onChange={set('link')}>
                  {LINKS.map((l) => (
                    <option key={l.key} value={l.key}>{l.label}</option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <div className="alert" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            <Icon name="users" />
            <span>
              {reach ? (
                <>
                  <strong>{reach.recipients}</strong> destinataire{reach.recipients > 1 ? 's' : ''} · <strong>{reach.devices}</strong> téléphone{reach.devices > 1 ? 's' : ''} joignable{reach.devices > 1 ? 's' : ''} en push
                  {reach.recipients > reach.devices ? ' (les autres la verront dans leur centre de notifications)' : ''}
                </>
              ) : (
                'Choisis une audience'
              )}
            </span>
          </div>
          <button className="btn lg" disabled={busy || !form.title.trim() || !form.body.trim() || !reach?.recipients}>
            <Icon name="send" /> {busy ? 'Envoi en cours…' : 'Envoyer la notification'}
          </button>
        </form>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <CardHead title="Aperçu sur le téléphone" />
            <div className="push-preview">
              <div className="push-app">
                <span className="push-icon">n</span>
                <span>NISSALI</span>
                <span className="muted">maintenant</span>
              </div>
              <strong>{form.title || 'Titre de la notification'}</strong>
              <p>{form.body || 'Le message apparaît ici.'}</p>
              {form.imageUrl ? <img src={form.imageUrl} alt="" /> : null}
            </div>
          </div>
          <div className="card">
            <CardHead title="Envois récents" subtitle={history.data ? `${history.data.devices} téléphone(s) inscrit(s) aux notifications push` : null} />
            {history.loading && !history.data ? (
              <Loading />
            ) : history.error ? (
              <ErrorBox error={history.error} />
            ) : history.data.items.length ? (
              history.data.items.slice(0, 12).map((b) => (
                <div key={b.id} className="list-item">
                  {b.imageUrl ? <img src={b.imageUrl} alt="" className="thumb" /> : <span className="kpi-icon"><Icon name="megaphone" /></span>}
                  <div className="grow">
                    <strong>{b.title}</strong>
                    <span>
                      {formatDateTime(b.createdAt)} · {AUDIENCES.find((a) => a.key === b.audience?.type)?.label || b.audience?.type}
                      {b.audience?.city ? ` (${b.audience.city})` : ''}
                    </span>
                  </div>
                  <span className="muted small num">
                    {b.recipients} · {b.pushed} push
                  </span>
                </div>
              ))
            ) : (
              <Empty icon="megaphone" title="Aucune notification envoyée">Les envois apparaîtront ici.</Empty>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

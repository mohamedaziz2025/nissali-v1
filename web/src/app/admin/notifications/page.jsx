'use client';
// 4.13 · 8.4 — Notifications de l'équipe : canal (push + centre, ou seulement dans l'appli), type, titre (40) et texte
// (120), page ouverte au toucher, ciblage par zone, situation et âge (jamais de santé), envoi immédiat ou programmé.
// Le serveur applique la fréquence (RG-36), la nuit et l'heure de prière (RG-37, envoi décalé) et bloque les mots
// sensibles (RG-17). Audience estimée recalculée à chaque changement ; aperçus iPhone, Android et dans l'appli.
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icons';
import { CardHead, Empty, ErrorBox, Field, Loading, PageHeader, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTime as formatDateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const KINDS = [
  { key: 'conseil', label: 'Conseil' },
  { key: 'article', label: 'Nouvel article' },
  { key: 'evenement', label: 'Événement' },
  { key: 'nouveaute', label: 'Nouveauté' },
];
const STATUS = { programmee: 'Programmée', en_cours: 'En cours (envois décalés)', envoyee: 'Envoyée', annulee: 'Annulée' };

function PhonePreview({ view, hidden, form }) {
  const title = hidden ? 'Nissali' : form.title || 'Titre de la notification';
  const body = hidden ? 'Rappel Nissali' : form.body || 'Le texte apparaît ici, coupé à deux lignes comme sur le téléphone.';
  const now = new Date();
  if (view === 'app') {
    return (
      <div className="pp-app">
        <span className="pp-dot" />
        <div>
          <strong>{form.title || 'Titre de la notification'}</strong>
          <p className="pp-clamp">{form.body || 'Le texte apparaît ici.'}</p>
          <span className="muted small">À l’instant</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`pp-lock ${view}`}>
      <div className="pp-date">{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <div className="pp-time">{now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
      <div className="pp-card">
        <div className="pp-head">
          <span className={`pp-icon ${view}`}>n</span>
          <span>{view === 'ios' ? 'NISSALI' : 'Nissali • Actualités'}</span>
          <span className="pp-now">{view === 'ios' ? 'maintenant' : 'à l’instant'}</span>
        </div>
        <strong>{title}</strong>
        <p className="pp-clamp">{body}</p>
      </div>
    </div>
  );
}

// useSearchParams demande une frontière Suspense (pré-remplissage depuis l'éditeur d'article).
export default function AdminNotificationsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminNotifications />
    </Suspense>
  );
}

function AdminNotifications() {
  const toast = useToast();
  const params = useSearchParams();
  const history = useFetch('/admin/broadcasts');
  const [form, setForm] = useState({
    channel: 'push',
    kind: params.get('type') || 'conseil',
    title: (params.get('titre') || '').slice(0, 40),
    body: (params.get('texte') || '').slice(0, 120),
    link: params.get('lien') || '/notifications',
    imageUrl: '',
    targeting: { country: '', region: '', city: '', situation: '', ageMin: '', ageMax: '' },
    when: 'now',
    scheduledAt: '',
  });
  const [reach, setReach] = useState(null);
  const [view, setView] = useState('ios');
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const setT = (k) => (e) => setForm((f) => ({ ...f, targeting: { ...f.targeting, [k]: e.target.value } }));

  const targeting = () => {
    const t = form.targeting;
    return Object.fromEntries(
      Object.entries({ country: t.country.trim(), region: t.region.trim(), city: t.city.trim(), situation: t.situation, ageMin: t.ageMin ? Number(t.ageMin) : undefined, ageMax: t.ageMax ? Number(t.ageMax) : undefined }).filter(([, v]) => v !== '' && v !== undefined),
    );
  };
  const payload = () => ({
    channel: form.channel,
    kind: form.kind,
    title: form.title.trim(),
    body: form.body.trim(),
    link: form.link,
    ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
    targeting: targeting(),
    ...(form.when === 'later' && form.scheduledAt ? { scheduledAt: new Date(form.scheduledAt).toISOString() } : {}),
  });

  // Audience estimée et mots sensibles, recalculés à chaque changement.
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .post('/admin/broadcasts/preview', { channel: form.channel, title: form.title, body: form.body, targeting: targeting() })
        .then(setReach)
        .catch(() => setReach(null));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.channel, form.title, form.body, form.targeting]);
  useEffect(() => {
    if (form.channel === 'app') setView('app');
  }, [form.channel]);

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
    const later = form.when === 'later';
    if (!window.confirm(later ? `Programmer cette notification pour le ${new Date(form.scheduledAt).toLocaleString('fr-FR')} ?` : `Envoyer cette notification à environ ${reach?.recipients ?? '…'} destinataire(s) ?`)) return;
    setBusy(true);
    try {
      const r = await api.post('/admin/broadcasts', payload());
      toast(later ? 'Notification programmée' : `Envoyée à ${r.recipients} destinataire(s) · ${r.pushed} en push${r.deferred ? ` · ${r.deferred} décalée(s) (nuit ou prière)` : ''}`);
      setForm((f) => ({ ...f, title: '', body: '', imageUrl: '', when: 'now', scheduledAt: '' }));
      history.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (id) => {
    if (!window.confirm('Annuler cette notification programmée ?')) return;
    try {
      await api.post(`/admin/broadcasts/${id}/cancel`);
      history.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const links = [...(history.data?.pages || []), ...(history.data?.articles || []).map((a) => ({ ...a, label: `Article · ${a.label}` })), ...(history.data?.events || []).map((e) => ({ ...e, label: `Événement · ${e.label}` }))];
  const sensitive = reach?.sensitive || [];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader eyebrow="Communication" title="Notifications push" subtitle="Conseils et actualités de l’équipe. Seules les utilisatrices en fréquence Modérée ou Élevée les reçoivent, dans la limite de leur plafond." />
      <div className="grid grid-main">
        <form className="card stack" onSubmit={send} style={{ gap: 16 }}>
          <CardHead title="1. Canal et message" />
          <div className="tabs">
            <button type="button" className={form.channel === 'push' ? 'on' : ''} onClick={() => set('channel')('push')}>Push + centre de notifications</button>
            <button type="button" className={form.channel === 'app' ? 'on' : ''} onClick={() => set('channel')('app')}>Seulement dans l’appli</button>
          </div>
          {form.channel === 'app' ? <p className="muted small">Visible dans la cloche, aucun push, ne compte pas dans le plafond hebdomadaire.</p> : null}
          <Field label="Type">
            <select className="select" value={form.kind} onChange={set('kind')}>
              {KINDS.map((k) => (
                <option key={k.key} value={k.key}>{k.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Titre" hint={`${form.title.length}/40`}>
            <input className="input" value={form.title} onChange={(e) => set('title')(e.target.value.slice(0, 40))} required placeholder="Ex. Ramadan approche" />
          </Field>
          <Field label="Texte" hint={`${form.body.length}/120`}>
            <textarea className="textarea" rows={3} value={form.body} onChange={(e) => set('body')(e.target.value.slice(0, 120))} required placeholder="Ex. Prépare-toi en douceur : nos conseils dans le Magazine." />
          </Field>
          {sensitive.length ? (
            <div className="alert danger">
              <Icon name="flag" />
              <span>Envoi bloqué : mot sensible ({sensitive.join(', ')}). Les notifications restent discrètes sur l’écran verrouillé (RG-17).</span>
            </div>
          ) : null}
          <Field label="Au toucher, ouvrir">
            <select className="select" value={form.link} onChange={set('link')}>
              {links.map((l) => (
                <option key={l.link} value={l.link}>{l.label}</option>
              ))}
              {!links.some((l) => l.link === form.link) ? <option value={form.link}>{form.link}</option> : null}
            </select>
          </Field>
          <Field label="Image (facultatif)" hint="JPEG, PNG ou WebP, 5 Mo maximum.">
            <div className="row" style={{ alignItems: 'center', gap: 12 }}>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
              <button type="button" className="btn outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Icon name="image" /> {uploading ? 'Envoi…' : form.imageUrl ? 'Changer l’image' : 'Ajouter une image'}
              </button>
              {form.imageUrl ? <button type="button" className="btn ghost sm" onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}>Retirer</button> : null}
            </div>
          </Field>

          <CardHead title="2. Ciblage" subtitle="Zone, situation et âge. Jamais de ciblage sur une donnée de santé." />
          <div className="grid grid-3">
            <Field label="Pays">
              <input className="input" value={form.targeting.country} onChange={setT('country')} placeholder="France" />
            </Field>
            <Field label="Région">
              <input className="input" value={form.targeting.region} onChange={setT('region')} placeholder="Île-de-France" />
            </Field>
            <Field label="Ville">
              <input className="input" value={form.targeting.city} onChange={setT('city')} placeholder="Nanterre" />
            </Field>
          </div>
          <div className="grid grid-3">
            <Field label="Situation">
              <select className="select" value={form.targeting.situation} onChange={setT('situation')}>
                <option value="">Toutes</option>
                <option value="mariee">Mariées</option>
                <option value="celibataire">Célibataires</option>
              </select>
            </Field>
            <Field label="Âge minimum">
              <input className="input" type="number" min="15" max="100" value={form.targeting.ageMin} onChange={setT('ageMin')} placeholder="15" />
            </Field>
            <Field label="Âge maximum">
              <input className="input" type="number" min="15" max="100" value={form.targeting.ageMax} onChange={setT('ageMax')} placeholder="60" />
            </Field>
          </div>

          <CardHead title="3. Quand" />
          <div className="row" style={{ gap: 16 }}>
            <label className="check">
              <input type="radio" name="when" checked={form.when === 'now'} onChange={() => set('when')('now')} />
              <span>Dès que possible</span>
            </label>
            <label className="check">
              <input type="radio" name="when" checked={form.when === 'later'} onChange={() => set('when')('later')} />
              <span>Programmer</span>
            </label>
            {form.when === 'later' ? <input className="input" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} style={{ maxWidth: 240 }} /> : null}
          </div>
          <p className="muted small">Jamais entre 22:00 et 08:00, ni à l’heure de prière de l’utilisatrice, jamais deux le même jour : l’envoi est décalé pour chacune.</p>

          <div className="alert" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            <Icon name="users" />
            <span>
              {reach ? (
                <>
                  Audience estimée : <strong>{reach.recipients}</strong> sur {reach.total} utilisatrice{reach.total > 1 ? 's' : ''} ciblée{reach.total > 1 ? 's' : ''}
                  {reach.capped ? ` · ${reach.capped} ont atteint leur plafond` : ''} · {reach.devices} téléphone{reach.devices > 1 ? 's' : ''} inscrit{reach.devices > 1 ? 's' : ''}
                </>
              ) : (
                'Calcul de l’audience…'
              )}
            </span>
          </div>
          <button className="btn lg" disabled={busy || !form.title.trim() || !form.body.trim() || sensitive.length > 0 || (form.when === 'later' && !form.scheduledAt)}>
            <Icon name="send" /> {busy ? 'Envoi en cours…' : form.when === 'later' ? 'Programmer' : 'Envoyer'}
          </button>
        </form>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card stack">
            <CardHead title="Aperçu téléphone" />
            <div className="tabs">
              {form.channel === 'push' ? (
                <>
                  <button type="button" className={view === 'ios' ? 'on' : ''} onClick={() => setView('ios')}>iPhone</button>
                  <button type="button" className={view === 'android' ? 'on' : ''} onClick={() => setView('android')}>Android</button>
                </>
              ) : null}
              <button type="button" className={view === 'app' ? 'on' : ''} onClick={() => setView('app')}>Dans l’appli</button>
            </div>
            {view !== 'app' ? (
              <div className="tabs">
                <button type="button" className={!hidden ? 'on' : ''} onClick={() => setHidden(false)}>Aperçu visible</button>
                <button type="button" className={hidden ? 'on' : ''} onClick={() => setHidden(true)}>Aperçu masqué</button>
              </div>
            ) : null}
            <PhonePreview view={view} hidden={hidden} form={form} />
          </div>
          <div className="card">
            <CardHead title="Historique" subtitle={history.data ? `${history.data.devices} téléphone(s) inscrit(s) aux notifications push` : null} />
            {history.loading && !history.data ? (
              <Loading />
            ) : history.error ? (
              <ErrorBox error={history.error} />
            ) : history.data.items.length ? (
              history.data.items.slice(0, 20).map((b) => (
                <div key={b.id} className="list-item">
                  <span className="kpi-icon"><Icon name="megaphone" /></span>
                  <div className="grow">
                    <strong>{b.title}</strong>
                    <span>
                      {formatDateTime(b.sentAt || b.scheduledAt || b.createdAt)} · {STATUS[b.status] || 'Envoyée'}
                      {b.channel === 'app' ? ' · dans l’appli' : ''}
                      {b.blockedReason ? ` · ${b.blockedReason}` : ''}
                    </span>
                  </div>
                  {b.status === 'programmee' ? (
                    <button className="btn ghost sm" onClick={() => cancel(b.id)}>Annuler</button>
                  ) : (
                    <span className="muted small num">
                      {b.recipients} envoyée{b.recipients > 1 ? 's' : ''}
                      {b.openRate != null ? ` · ${b.openRate} % ouvertes` : ''}
                    </span>
                  )}
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

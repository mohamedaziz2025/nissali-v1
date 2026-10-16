'use client';
// Lifestyle › Événements (RG-28 à RG-31) : file des propositions (valider, refuser avec motif, demander une
// modification), événements Nissali, inscriptions, ventes, commission de 15 % et reversements.
import { useState } from 'react';
import Icon from '@/components/Icons';
import { Badge, Empty, ErrorBox, Field, Kpi, Loading, Modal, PageHeader, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTime, euros } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const STATUS = {
  en_attente: ['À valider', 'warning'],
  modification: ['Modification demandée', 'warning'],
  publie: ['Publié', 'success'],
  refuse: ['Refusé', 'neutral'],
  annule: ['Annulé', 'danger'],
};
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const PAY = { gratuit: 'Gratuit', a_regler: 'À régler', paye: 'Payé', rembourse: 'Remboursé' };
const emptyForm = { title: '', description: '', programme: '', day: '', time: '14:00', endTime: '', name: '', address: '', city: '', capacity: 30, price: 0, ticketUrl: '', imageUrl: '' };

function EventForm({ initial, onSaved, onClose }) {
  const toast = useToast();
  const [f, setF] = useState(initial || emptyForm);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const upload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      const r = await api.upload('/admin/upload-image', fd);
      setF((x) => ({ ...x, imageUrl: r.url }));
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { title: f.title, description: f.description, programme: f.programme, day: f.day, time: f.time, endTime: f.endTime || '', location: { name: f.name, address: f.address, city: f.city }, capacity: Number(f.capacity), price: Number(f.price) || 0, ticketUrl: Number(f.price) ? f.ticketUrl.trim() : '', imageUrl: f.imageUrl || '' };
      if (f.id) await api.put(`/admin/events/${f.id}`, body);
      else await api.post('/admin/events', body);
      toast(f.id ? 'Événement mis à jour' : 'Événement Nissali publié');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="stack" onSubmit={save}>
      <Field label="Titre"><input className="input" value={f.title} onChange={set('title')} required minLength={3} /></Field>
      <Field label="Description"><textarea className="textarea" rows={3} value={f.description} onChange={set('description')} required minLength={10} /></Field>
      <Field label="Programme (facultatif)"><textarea className="textarea" rows={3} value={f.programme} onChange={set('programme')} /></Field>
      <div className="grid grid-3">
        <Field label="Date"><input className="input" type="date" value={f.day} onChange={set('day')} required /></Field>
        <Field label="Début"><input className="input" type="time" value={f.time} onChange={set('time')} required /></Field>
        <Field label="Fin"><input className="input" type="time" value={f.endTime} onChange={set('endTime')} /></Field>
      </div>
      <div className="grid grid-3">
        <Field label="Lieu"><input className="input" value={f.name} onChange={set('name')} /></Field>
        <Field label="Adresse"><input className="input" value={f.address} onChange={set('address')} /></Field>
        <Field label="Ville"><input className="input" value={f.city} onChange={set('city')} required /></Field>
      </div>
      <div className="grid grid-3">
        <Field label="Places"><input className="input" type="number" min={1} value={f.capacity} onChange={set('capacity')} required /></Field>
        <Field label="Prix (€, 0 = gratuit)" hint="Événements Nissali : sans commission."><input className="input" type="number" min={0} step="0.5" value={f.price} onChange={set('price')} /></Field>
        <Field label="Image">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files?.[0])} />
        </Field>
      </div>
      {Number(f.price) ? (
        <Field label="Lien de la billetterie" hint="Obligatoire pour un événement payant : page où les sœurs achètent leur billet (HelloAsso, Billetweb, Weezevent…).">
          <input className="input" type="url" placeholder="https://www.helloasso.com/…" value={f.ticketUrl} onChange={set('ticketUrl')} required pattern="https?://.+" />
        </Field>
      ) : null}
      {f.imageUrl ? <img src={f.imageUrl} alt="" style={{ width: 220, borderRadius: 12 }} /> : null}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost" onClick={onClose}>Annuler</button>
        <button className="btn" disabled={busy}>{f.id ? 'Enregistrer' : 'Publier l’événement'}</button>
      </div>
    </form>
  );
}

export default function AdminEvents() {
  const toast = useToast();
  const [tab, setTab] = useState('en_attente');
  const { data, error, loading, reload } = useFetch(`/admin/events${tab === 'tous' ? '' : `?status=${tab}`}`);
  const all = useFetch('/admin/events');
  const [creating, setCreating] = useState(null);
  const [moderation, setModeration] = useState(null); // { event, action }
  const [note, setNote] = useState('');
  const [regs, setRegs] = useState(null);

  const moderate = async () => {
    try {
      await api.post(`/admin/events/${moderation.event.id}/moderate`, { action: moderation.action, note });
      toast(moderation.action === 'valider' ? 'Événement publié, l’organisatrice est prévenue' : 'Réponse envoyée à l’organisatrice');
      setModeration(null);
      setNote('');
      reload();
      all.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const openRegs = async (e) => {
    try {
      setRegs({ event: e, items: await api.get(`/admin/events/${e.id}/registrations`) });
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const setPayment = async (r, paymentStatus) => {
    await api.patch(`/admin/events/${regs.event.id}/registrations/${r.id}`, { paymentStatus });
    openRegs(regs.event);
  };
  const setPayout = async (e, payoutStatus) => {
    await api.patch(`/admin/events/${e.id}/payout`, { payoutStatus });
    reload();
  };

  const counts = all.data?.counts || {};
  const published = (all.data?.items || []).filter((e) => e.status === 'publie');
  const sales = (all.data?.items || []).reduce((a, e) => a + (e.sales || 0), 0);
  const commission = (all.data?.items || []).reduce((a, e) => a + (e.commission || 0), 0);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader
        eyebrow="Lifestyle"
        title="Événements"
        subtitle="Événements Nissali et propositions des sœurs, vérifiées avant publication."
        actions={
          <button className="btn" onClick={() => setCreating({ ...emptyForm })}>
            <Icon name="plus" /> Créer un événement Nissali
          </button>
        }
      />
      <div className="grid grid-4">
        <Kpi icon="alert" label="À valider" value={counts.en_attente || 0} />
        <Kpi icon="calendar" label="Publiés" value={published.length} />
        <Kpi icon="euro" label="Billets réservés" value={euros(sales)} hint="Montant des places payantes" />
        <Kpi icon="trendUp" label="Commission Nissali (15 %)" value={euros(commission)} hint="Événements des sœurs" />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'en_attente', label: `À valider${counts.en_attente ? ` (${counts.en_attente})` : ''}` },
          { key: 'modification', label: 'Modifications demandées' },
          { key: 'publie', label: 'Publiés' },
          { key: 'refuse', label: 'Refusés' },
          { key: 'tous', label: 'Tous' },
        ]}
      />
      <div className="card">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={reload} />
        ) : data.items.length ? (
          data.items.map((e) => {
            const [, m, d] = e.day.split('-').map(Number);
            return (
              <div key={e.id} className="event-row">
                <div className="date-block">
                  <strong>{d}</strong>
                  <span>{MONTHS[m - 1]}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="tag-line" style={{ color: e.organizerType === 'nissali' ? 'var(--bordeaux)' : 'var(--or)' }}>
                    {e.organizerType === 'nissali' ? 'Organisé par Nissali' : `Proposé par ${e.organizer?.name || e.organizerName}${e.organizer?.email ? ` · ${e.organizer.email}` : ''}`}
                  </div>
                  <h3 style={{ margin: '2px 0' }}>{e.title}</h3>
                  <p className="muted small" style={{ margin: 0 }}>
                    {e.time}
                    {e.endTime ? `–${e.endTime}` : ''} · {[e.location?.name, e.location?.city].filter(Boolean).join(', ')} · {e.free ? 'Gratuit' : euros(e.price)} · {e.registrationsCount}/{e.capacity} inscrites
                  </p>
                  <p className="small" style={{ margin: '6px 0 0', maxWidth: 680 }}>{e.description}</p>
                  {!e.free ? (
                    <p className="small" style={{ margin: '6px 0 0' }}>
                      Billetterie :{' '}
                      {e.ticketUrl ? (
                        <a href={e.ticketUrl} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--bordeaux)', fontWeight: 600 }}>{e.ticketUrl.replace(/^https?:\/\//, '')}</a>
                      ) : (
                        <span className="badge warning">Lien manquant</span>
                      )}
                    </p>
                  ) : null}
                  {e.moderationNote ? <p className="small muted" style={{ margin: '6px 0 0' }}>Note : {e.moderationNote}</p> : null}
                  {!e.free && e.organizerType === 'soeur' && e.status === 'publie' ? (
                    <p className="small" style={{ margin: '6px 0 0' }}>
                      Ventes {euros(e.sales)} · commission {euros(e.commission)} · à reverser {euros(e.payout)} ·{' '}
                      {e.payoutStatus === 'verse' ? <span className="badge success">Reversé</span> : <button className="btn sm ghost" onClick={() => setPayout(e, 'verse')}>Marquer reversé</button>}
                    </p>
                  ) : null}
                </div>
                <div className="stack" style={{ gap: 8, justifyItems: 'end' }}>
                  <Badge status={e.status} map={STATUS} />
                  {e.status === 'en_attente' || e.status === 'modification' ? (
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn sm" onClick={() => setModeration({ event: e, action: 'valider' })}>Valider</button>
                      <button className="btn sm outline" onClick={() => setModeration({ event: e, action: 'modification' })}>Modifier</button>
                      <button className="btn sm danger" onClick={() => setModeration({ event: e, action: 'refuser' })}>Refuser</button>
                    </div>
                  ) : null}
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm ghost" onClick={() => openRegs(e)}>Inscriptions</button>
                    {e.organizerType === 'nissali' ? (
                      <button className="btn sm ghost" onClick={() => setCreating({ id: e.id, title: e.title, description: e.description, programme: e.programme || '', day: e.day, time: e.time, endTime: e.endTime || '', name: e.location?.name || '', address: e.location?.address || '', city: e.location?.city || '', capacity: e.capacity, price: e.price, ticketUrl: e.ticketUrl || '', imageUrl: e.imageUrl || '' })}>
                        Modifier
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <Empty icon="sparkle" title="Aucun événement ici">Les propositions des sœurs à valider apparaîtront dans « À valider ».</Empty>
        )}
      </div>

      <Modal open={Boolean(creating)} onClose={() => setCreating(null)} title={creating?.id ? 'Modifier l’événement' : 'Nouvel événement Nissali'}>
        {creating ? (
          <EventForm
            initial={creating}
            onClose={() => setCreating(null)}
            onSaved={() => {
              setCreating(null);
              reload();
              all.reload();
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(moderation)}
        onClose={() => setModeration(null)}
        title={moderation?.action === 'valider' ? 'Publier cet événement ?' : moderation?.action === 'refuser' ? 'Refuser l’événement' : 'Demander une modification'}
        footer={
          <>
            <button className="btn ghost" onClick={() => setModeration(null)}>Annuler</button>
            <button className={`btn ${moderation?.action === 'refuser' ? 'danger' : ''}`} onClick={moderate}>
              {moderation?.action === 'valider' ? 'Publier' : 'Envoyer'}
            </button>
          </>
        }
      >
        <p className="muted">« {moderation?.event.title} » — l’organisatrice est prévenue par notification.</p>
        <Field label={moderation?.action === 'valider' ? 'Message (facultatif)' : 'Motif (obligatoire)'}>
          <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>

      <Modal open={Boolean(regs)} onClose={() => setRegs(null)} title={regs ? `Inscriptions · ${regs.event.title}` : ''}>
        {regs?.items?.length ? (
          <table>
            <thead>
              <tr>
                <th>Participante</th>
                <th>Contact</th>
                <th>Inscription</th>
                <th>Montant</th>
                <th>Paiement</th>
              </tr>
            </thead>
            <tbody>
              {regs.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}{r.status === 'annulee' ? <span className="badge neutral" style={{ marginLeft: 6 }}>Annulée</span> : null}</td>
                  <td className="small">{[r.email, r.phone].filter(Boolean).join(' · ')}</td>
                  <td className="small muted">{dateTime(r.createdAt)}</td>
                  <td className="num">{r.amount ? euros(r.amount) : '—'}</td>
                  <td>
                    {r.amount ? (
                      <select className="select" value={r.paymentStatus} onChange={(e) => setPayment(r, e.target.value)} style={{ minHeight: 32 }}>
                        {['a_regler', 'paye', 'rembourse'].map((k) => (
                          <option key={k} value={k}>{PAY[k]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="muted small">Gratuit</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Aucune inscription pour le moment.</p>
        )}
      </Modal>
    </div>
  );
}

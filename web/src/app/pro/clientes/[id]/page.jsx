'use client';
import { useRouter } from 'next/navigation';
// Fiche cliente : dossier professionnel de la praticienne (informations, suivi, notes de séance,
// historique, documents privés). Imprimable.
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icons';
import { Avatar, Badge, CardHead, Empty, ErrorBox, Field, Kpi, Loading, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { BOOKING_STATUS, dateTime, euros, longDate, shortDate } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const STATUSES = [
  ['nouvelle', 'Nouvelle'],
  ['reguliere', 'Régulière'],
  ['fidele', 'Fidèle'],
  ['inactive', 'Inactive'],
];
const REFERRALS = [
  ['', '—'],
  ['annuaire', 'Annuaire Nissali'],
  ['bouche_a_oreille', 'Bouche-à-oreille'],
  ['reseaux', 'Réseaux sociaux'],
  ['medecin', 'Orientée par un médecin'],
  ['autre', 'Autre'],
];
const MODES = [
  ['', '—'],
  ['cabinet', 'Au cabinet'],
  ['visio', 'En visio'],
  ['indifferent', 'Indifférent'],
];
const size = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1e3))} Ko`);
const age = (birth) => {
  if (!birth) return null;
  const d = new Date(birth);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a -= 1;
  return a;
};

function NoteForm({ bookings, onSave }) {
  const [kind, setKind] = useState('seance');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [bookingId, setBookingId] = useState('');
  const past = bookings.filter((b) => ['terminee', 'confirmee'].includes(b.status));
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({ kind, title: title || undefined, content, bookingId: bookingId || undefined });
        setTitle('');
        setContent('');
        setBookingId('');
      }}
    >
      <div className="row">
        <Tabs label="Type" value={kind} onChange={setKind} items={[['seance', 'Compte rendu de séance'], ['note', 'Note']]} />
        {kind === 'seance' && past.length ? (
          <select className="select" value={bookingId} onChange={(e) => setBookingId(e.target.value)} style={{ width: 280 }} aria-label="Séance concernée">
            <option value="">Séance concernée (facultatif)</option>
            {past.map((b) => (
              <option key={b.id} value={b.id}>
                {shortDate(b.day)} · {b.time} · {b.serviceName}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'seance' ? 'Titre (ex. Séance 3 — gestion du stress)' : 'Titre (facultatif)'} maxLength={120} />
      <textarea className="textarea" value={content} onChange={(e) => setContent(e.target.value)} placeholder={kind === 'seance' ? 'Déroulé, observations, exercices proposés, suite à donner…' : 'Information à retenir…'} required />
      <button className="btn" style={{ justifySelf: 'start' }} disabled={!content.trim()}>
        <Icon name="plus" /> Ajouter
      </button>
    </form>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, error, loading, reload } = useFetch(`/pro/clients/${id}`);
  const [tab, setTab] = useState('parcours');
  const router = useRouter();
  const writeMessage = async () => {
    const conv = await api.post('/messages/conversations?as=pro', { clientId: id, as: 'pro' });
    router.push(`/pro/messages?c=${conv.id}`);
  };
  const [info, setInfo] = useState(null);
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!data) return;
    setInfo({ profile: { ...(data.profile || {}) }, care: { ...(data.care || {}) } });
    setTags((data.tags || []).join(', '));
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!info) return null;

  const patch = async (body, message = 'Fiche mise à jour') => {
    try {
      await api.patch(`/pro/clients/${id}`, body);
      toast(message);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const setP = (group, key) => (e) => setInfo((x) => ({ ...x, [group]: { ...x[group], [key]: e.target.value } }));
  const addNote = async (body) => {
    try {
      await api.post(`/pro/clients/${id}/notes`, body);
      toast('Note ajoutée');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      await api.upload(`/pro/clients/${id}/files`, fd);
      toast('Document ajouté');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const s = data.stats;
  const c = data.client;
  const bookingLabel = (bid) => {
    const b = data.bookings.find((x) => x.id === String(bid));
    return b ? `${shortDate(b.day)} · ${b.serviceName}` : null;
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <Link href="/pro/clientes" className="no-print">
        ← Fiches clientes
      </Link>

      <div className="card">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <Avatar name={c.firstName} size="lg" />
            <div>
              <h1>{c.firstName}</h1>
              <div className="row muted" style={{ gap: 14, marginTop: 6 }}>
                <button className="btn sm no-print" onClick={writeMessage}>
                  <Icon name="mail" size={15} /> Message
                </button>
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className="row" style={{ gap: 6 }}>
                    <Icon name="phone" size={15} /> {c.phone}
                  </a>
                ) : null}
                {c.email ? (
                  <a href={`mailto:${c.email}`} className="row" style={{ gap: 6 }}>
                    <Icon name="mail" size={15} /> {c.email}
                  </a>
                ) : null}
                {c.city ? (
                  <span className="row" style={{ gap: 6 }}>
                    <Icon name="pin" size={15} /> {c.city}
                  </span>
                ) : null}
                {age(data.profile?.birthDate) != null ? <span>{age(data.profile.birthDate)} ans</span> : null}
              </div>
            </div>
          </div>
          <div className="row no-print">
            <select className="select" value={data.status} onChange={(e) => patch({ status: e.target.value }, 'Statut mis à jour')} style={{ width: 150 }} aria-label="Statut">
              {STATUSES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <button className="btn outline" onClick={() => window.print()}>
              <Icon name="printer" /> Imprimer
            </button>
          </div>
        </div>
        <div className="row mt" style={{ gap: 12 }}>
          <input className="input no-print" value={tags} onChange={(e) => setTags(e.target.value)} onBlur={() => tags !== (data.tags || []).join(', ') && patch({ tags: tags.split(',').map((t) => t.trim()).filter(Boolean) }, 'Étiquettes enregistrées')} placeholder="Étiquettes : visio, prénatal, stress… (séparées par des virgules)" style={{ maxWidth: 480 }} />
          <label className="check" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={Boolean(data.consent?.given)} onChange={(e) => patch({ consent: e.target.checked }, e.target.checked ? 'Consentement enregistré' : 'Consentement retiré')} />
            <span className="small">
              La cliente consent à la conservation de sa fiche{data.consent?.at ? ` (depuis le ${new Date(data.consent.at).toLocaleDateString('fr-FR')})` : ''}
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-4">
        <Kpi tone="hero" icon="calendar" label="Séances réalisées" value={s.visits} hint={s.firstVisit ? `depuis le ${shortDate(s.firstVisit)}` : 'aucune pour l’instant'} />
        <Kpi icon="calendar" label="Rendez-vous" value={data.bookings.length} hint={`${data.bookings.filter((b) => ['en_attente', 'confirmee'].includes(b.status)).length} à venir · ${s.cancellations} annulé(s)`} />
        <Kpi icon="clock" label="Prochain rendez-vous" value={s.nextBooking ? shortDate(s.nextBooking.day) : '—'} hint={s.nextBooking ? `${s.nextBooking.time} · ${s.nextBooking.serviceName}` : 'aucun prévu'} />
        <Kpi icon="history" label="Fréquence" value={s.averageGapDays ? `${s.averageGapDays} j` : '—'} hint={`${s.noShows} absence(s) · ${s.cancellations} annulation(s)`} />
      </div>

      <div className="grid grid-main">
        <div className="card">
          <div className="row between no-print" style={{ marginBottom: 16 }}>
            <Tabs
              label="Sections"
              value={tab}
              onChange={setTab}
              items={[
                ['parcours', `Historique (${(data.history || []).length})`],
                ['notes', `Notes et séances (${data.notes.length})`],
                ['historique', `Rendez-vous (${data.bookings.length})`],
                ['documents', `Documents (${data.files.length})`],
              ]}
            />
          </div>

          {tab === 'parcours' ? (
            (data.history || []).length ? (
              <ol className="timeline">
                {data.history.map((h, i) => (
                  <li key={`${h.kind}-${h.at}-${i}`} className={`tl-${h.kind}`}>
                    <span className="tl-dot" />
                    <div>
                      <span className="muted small">
                        {dateTime(h.at)}
                      </span>
                      <strong>{h.title}</strong>
                      {h.detail ? <p className="small">{h.detail}</p> : null}
                      {h.conversationId ? <a className="small" href={`/pro/messages?c=${h.conversationId}`}>Ouvrir la conversation →</a> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty icon="history" title="Pas encore d’historique" />
            )
          ) : null}

          {tab === 'notes' ? (
            <div className="stack" style={{ gap: 16 }}>
              <div className="no-print">
                <NoteForm bookings={data.bookings} onSave={addNote} />
              </div>
              {data.notes.length ? (
                data.notes.map((n) => (
                  <div key={n._id} className="card" style={{ boxShadow: 'none', background: n.kind === 'seance' ? 'var(--surface-2)' : 'var(--white)' }}>
                    <div className="row between">
                      <div className="row" style={{ gap: 8 }}>
                        <span className={`badge ${n.kind === 'seance' ? '' : 'neutral'}`}>{n.kind === 'seance' ? 'Séance' : 'Note'}</span>
                        {n.title ? <strong>{n.title}</strong> : null}
                      </div>
                      <span className="muted small">{dateTime(n.at)}</span>
                    </div>
                    {n.booking && bookingLabel(n.booking) ? <div className="muted small" style={{ marginTop: 4 }}>Rendez-vous du {bookingLabel(n.booking)}</div> : null}
                    <p style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{n.content}</p>
                    <div className="row no-print" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                      <button className="btn sm ghost" onClick={() => window.confirm('Supprimer cette note ?') && api.delete(`/pro/clients/${id}/notes/${n._id}`).then(reload)}>
                        <Icon name="trash" /> Supprimer
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty icon="note" title="Pas encore de note">Ajoute un compte rendu après chaque séance pour suivre l’évolution.</Empty>
              )}
            </div>
          ) : null}

          {tab === 'historique' ? (
            data.bookings.length ? (
              <div className="table-wrap" style={{ margin: '0 -20px -20px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Prestation</th>
                      <th>Lieu</th>
                      <th>Tarif indicatif</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bookings.map((b) => (
                      <tr key={b.id}>
                        <td>
                          {longDate(b.day)}
                          <div className="muted small">
                            {b.time}–{b.endTime}
                          </div>
                        </td>
                        <td>{b.serviceName}</td>
                        <td>{b.mode === 'visio' ? 'Visio' : 'Cabinet'}</td>
                        <td className="num">{euros(b.price)}</td>
                        <td>
                          <Badge status={b.status} map={BOOKING_STATUS} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="calendar">Aucun rendez-vous.</Empty>
            )
          ) : null}

          {tab === 'documents' ? (
            <div className="stack">
              <label className="btn outline no-print" style={{ justifySelf: 'start', cursor: 'pointer' }}>
                <Icon name="upload" /> {uploading ? 'Envoi…' : 'Ajouter un document'}
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={upload} hidden disabled={uploading} />
              </label>
              <p className="muted small">Ordonnances, bilans, comptes rendus… PDF ou image, 10 Mo maximum. Documents privés, visibles par toi seule.</p>
              {data.files.length ? (
                <div className="list">
                  {data.files.map((f) => (
                    <div key={f.id} className="list-item">
                      <span className="kpi-icon">
                        <Icon name="file" />
                      </span>
                      <div className="grow">
                        <strong>{f.name}</strong>
                        <span>
                          {size(f.size)} · ajouté le {new Date(f.at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <a className="btn sm outline" href={`/api/pro/clients/${id}/files/${f.id}`} target="_blank" rel="noreferrer">
                        <Icon name="external" /> Ouvrir
                      </a>
                      <button className="btn sm ghost no-print" onClick={() => window.confirm('Supprimer ce document ?') && api.delete(`/pro/clients/${id}/files/${f.id}`).then(reload)} aria-label="Supprimer">
                        <Icon name="trash" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty icon="file">Aucun document.</Empty>
              )}
            </div>
          ) : null}
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              patch({ profile: info.profile }, 'Informations enregistrées');
            }}
          >
            <CardHead title="Informations" subtitle="Saisies par toi, visibles par toi seule" />
            <Field label="Date de naissance">
              <input className="input" type="date" value={info.profile.birthDate || ''} onChange={setP('profile', 'birthDate')} />
            </Field>
            <Field label="Adresse">
              <input className="input" value={info.profile.address || ''} onChange={setP('profile', 'address')} />
            </Field>
            <Field label="Profession">
              <input className="input" value={info.profile.occupation || ''} onChange={setP('profile', 'occupation')} />
            </Field>
            <Field label="Contact d’urgence">
              <input className="input" value={info.profile.emergencyContact || ''} onChange={setP('profile', 'emergencyContact')} placeholder="Nom, lien, téléphone" />
            </Field>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <Field label="Comment elle t’a connue">
                <select className="select" value={info.profile.referral || ''} onChange={setP('profile', 'referral')}>
                  {REFERRALS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Préférence">
                <select className="select" value={info.profile.preferredMode || ''} onChange={setP('profile', 'preferredMode')}>
                  {MODES.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Créneaux préférés">
              <input className="input" value={info.profile.preferredTimes || ''} onChange={setP('profile', 'preferredTimes')} placeholder="Ex. mardi matin, après 17 h" />
            </Field>
            <button className="btn outline no-print" style={{ justifySelf: 'start' }}>
              Enregistrer
            </button>
          </form>

          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              patch({ care: info.care }, 'Suivi enregistré');
            }}
          >
            <CardHead title="Suivi" subtitle="Dossier professionnel confidentiel" />
            <Field label="Motif de consultation">
              <textarea className="textarea" style={{ minHeight: 70 }} value={info.care.reason || ''} onChange={setP('care', 'reason')} />
            </Field>
            <Field label="Antécédents">
              <textarea className="textarea" style={{ minHeight: 70 }} value={info.care.history || ''} onChange={setP('care', 'history')} />
            </Field>
            <Field label="Allergies et contre-indications">
              <input className="input" value={info.care.allergies || ''} onChange={setP('care', 'allergies')} />
            </Field>
            <Field label="Traitements en cours">
              <input className="input" value={info.care.treatments || ''} onChange={setP('care', 'treatments')} />
            </Field>
            <Field label="Objectifs de l’accompagnement">
              <textarea className="textarea" style={{ minHeight: 70 }} value={info.care.goals || ''} onChange={setP('care', 'goals')} />
            </Field>
            <button className="btn outline no-print" style={{ justifySelf: 'start' }}>
              Enregistrer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

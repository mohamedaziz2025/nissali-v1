'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Badge, ErrorBox, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { BOOKING_STATUS, euros, longDate, PRACTITIONER_STATUS, shortDate, SUB_STATUS } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

export default function PractitionerDetail() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload } = useFetch(`/admin/practitioners/${id}`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const setStatus = async (status) => {
    try {
      await api.patch(`/admin/practitioners/${id}`, { status });
      toast('Statut mis à jour');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const patch = async (body, message) => {
    try {
      await api.patch(`/admin/practitioners/${id}`, body);
      toast(message);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const DOCS = [
    ['identity', 'Pièce d’identité'],
    ['diploma', 'Diplôme ou certificat'],
    ['rcPro', 'RC Pro'],
  ];
  const remove = async () => {
    if (!window.confirm('Supprimer définitivement ce profil professionnel ? Les rendez-vous à venir seront annulés.')) return;
    await api.delete(`/admin/practitioners/${id}`);
    router.replace('/admin/praticiennes');
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <Link href="/admin/praticiennes">← Praticiennes</Link>
      <div className="page-head">
        <div>
          <h1>{data.displayName}</h1>
          <p>
            <Badge status={data.status} map={PRACTITIONER_STATUS} /> · {data.specialty} · {data.location?.city} · formule {data.plan?.name} · ★ {data.rating || '—'} ({data.reviewsCount} avis)
          </p>
        </div>
        <div className="row">
          {data.status !== 'validee' ? <button className="btn" onClick={() => setStatus('validee')}>Valider</button> : <button className="btn outline" onClick={() => setStatus('suspendue')}>Suspendre</button>}
          <button className="btn danger" onClick={remove}>Supprimer</button>
        </div>
      </div>
      <div className="card stack">
        <h3>Vérification (justificatifs chiffrés, vus seulement par l’équipe)</h3>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {DOCS.map(([k, label]) =>
            data.documents?.[k]?.storedName ? (
              <a key={k} className="btn outline small" href={`/api/pro-profile/admin/${id}/documents/${k}`} target="_blank" rel="noreferrer">
                {label} · {data.documents[k].name}
              </a>
            ) : (
              <span key={k} className="badge">{label} : non fourni</span>
            ),
          )}
        </div>
        {data.professionalId ? <p className="small">Numéro RPPS : <strong>{data.professionalId}</strong></p> : null}
        {data.specialty === 'hijama' ? <p className="small">Engagement matériel stérile et contre-indications : {data.sterileCommitment ? 'oui' : 'non'}</p> : null}
        <label className="check">
          <input type="checkbox" checked={Boolean(data.diplomaVerified)} disabled={!data.documents?.diploma?.storedName} onChange={(e) => patch({ diplomaVerified: e.target.checked }, e.target.checked ? 'Badge « Diplômée » attribué' : 'Badge « Diplômée » retiré')} />
          <span>Diplôme vérifié (badge « Diplômée », RG-47)</span>
        </label>
        {data.specialty === 'autre' ? (
          <label className="check">
            <input type="checkbox" checked={Boolean(data.otherValidated)} onChange={(e) => patch({ otherValidated: e.target.checked }, e.target.checked ? 'Métier validé : affiché sur la fiche' : 'Métier masqué')} />
            <span>Métier « {data.otherSpecialty || '—'} » validé (sinon masqué sur la fiche)</span>
          </label>
        ) : null}
        {data.visible === false ? <p className="small muted">Profil mis en pause par la praticienne (caché de l’annuaire).</p> : null}
      </div>
      <div className="grid grid-2">
        <div className="card stack">
          <h3>Fiche</h3>
          <p>{data.description || <span className="muted">Pas de présentation.</span>}</p>
          <p className="small">
            Adresse : {data.location?.address || '—'}
            <br />
            SIRET : {data.legal?.siret || '—'}
            <br />
            Contact : {data.user?.email || '—'} {data.user?.phone || ''}
            <br />
            Cabinet : {data.inPerson ? 'oui' : 'non'} · Visio : {data.supportsVideo ? 'oui' : 'non'} · Langues : {(data.languages || []).join(', ')}
          </p>
        </div>
        <div className="card stack">
          <h3>Abonnements</h3>
          {data.subscriptions.map((s) => (
            <div key={s._id} className="row between">
              <span>
                {s.plan} · {s.billing} · {euros(s.amount)}
              </span>
              <Badge status={s.status} map={SUB_STATUS} />
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>Prestations</h3>
        <table className="mt">
          <tbody>
            {data.services.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>{s.durationMinutes} min</td>
                <td>{s.mode}</td>
                <td>{euros(s.price)}</td>
                <td>{s.active ? 'active' : 'désactivée'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Derniers rendez-vous</h3>
        <table className="mt">
          <tbody>
            {data.bookings.map((b) => (
              <tr key={b._id}>
                <td>{longDate(b.day)} · {b.time}</td>
                <td>{b.serviceName}</td>
                <td>{euros(b.price)}</td>
                <td>
                  <Badge status={b.status} map={BOOKING_STATUS} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Avis</h3>
        {data.reviews.map((r) => (
          <p key={r._id} className="mt">
            {'★'.repeat(r.rating)} {r.comment} <span className="muted small">· {shortDate(r.createdAt)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

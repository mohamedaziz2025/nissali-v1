'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar, Badge, ErrorBox, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { PRACTITIONER_STATUS, shortDate } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const FILTERS = [
  ['', 'Toutes'],
  ['en_attente', 'À valider'],
  ['validee', 'Validées'],
  ['refusee', 'Refusées'],
  ['suspendue', 'Suspendues'],
];

export default function Practitioners() {
  const toast = useToast();
  const [status, setStatus] = useState('en_attente');
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useFetch(`/admin/practitioners?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) })}`);
  const setPStatus = async (p, next) => {
    try {
      const rejectionReason = next === 'refusee' ? window.prompt('Motif du refus (envoyé à la praticienne)') || undefined : undefined;
      await api.patch(`/admin/practitioners/${p.id}`, { status: next, rejectionReason });
      toast(`Praticienne ${PRACTITIONER_STATUS[next][0].toLowerCase()}`);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Praticiennes</h1>
          <p>Validation des inscriptions professionnelles, fiches, formules.</p>
        </div>
        <input className="input" placeholder="Rechercher (nom, ville)" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
      </div>
      <div className="chips">
        {FILTERS.map(([k, l]) => (
          <button key={k} className={`chip ${status === k ? 'on' : ''}`} onClick={() => setStatus(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="card flush">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} />
        ) : data.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Praticienne</th>
                  <th>Spécialité</th>
                  <th>Ville</th>
                  <th>Formule</th>
                  <th>Prestations</th>
                  <th>RDV</th>
                  <th>Inscription</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/praticiennes/${p.id}`} className="cell-user" style={{ color: 'inherit' }}>
                        <Avatar name={p.displayName} src={p.photoUrl} />
                        <div>
                          <strong>{p.displayName}</strong>
                          <span>{p.user?.email || p.user?.phone}</span>
                        </div>
                      </Link>
                    </td>
                    <td>{p.specialty}</td>
                    <td>{p.location?.city}</td>
                    <td>{p.planName}</td>
                    <td>{p.services}</td>
                    <td>{p.bookings}</td>
                    <td>{shortDate(p.createdAt)}</td>
                    <td>
                      <Badge status={p.status} map={PRACTITIONER_STATUS} />
                    </td>
                    <td>
                      <div className="row">
                        {p.status !== 'validee' ? <button className="btn sm" onClick={() => setPStatus(p, 'validee')}>Valider</button> : null}
                        {p.status === 'en_attente' ? <button className="btn sm outline" onClick={() => setPStatus(p, 'refusee')}>Refuser</button> : null}
                        {p.status === 'validee' ? <button className="btn sm ghost" onClick={() => setPStatus(p, 'suspendue')}>Suspendre</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Aucune praticienne dans cette catégorie.</p>
        )}
      </div>
    </div>
  );
}

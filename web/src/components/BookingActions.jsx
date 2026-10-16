'use client';
import { api } from '@/lib/api';
import { useToast } from './ui';

const LABELS = { confirmee: 'Rendez-vous confirmé', refusee: 'Demande refusée', annulee: 'Rendez-vous annulé', terminee: 'Rendez-vous terminé', absente: 'Absence notée' };

/** Boutons d'action d'une réservation selon son statut. */
export default function BookingActions({ b, onDone }) {
  const toast = useToast();
  const act = async (action) => {
    try {
      await api.patch(`/pro/bookings/${b.id}`, { status: action });
      toast(LABELS[action]);
      onDone?.();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const future = new Date(b.startAt) > new Date();
  return (
    <div className="row">
      {b.status === 'en_attente' ? (
        <>
          <button className="btn sm" onClick={() => act('confirmee')}>Accepter</button>
          <button className="btn sm outline" onClick={() => act('refusee')}>Refuser</button>
        </>
      ) : null}
      {b.status === 'confirmee' && b.videoUrl ? (
        <a className="btn sm soft" href={b.videoUrl} target="_blank" rel="noreferrer">Visio</a>
      ) : null}
      {b.status === 'confirmee' && !future ? (
        <>
          <button className="btn sm soft" onClick={() => act('terminee')}>Terminé</button>
          <button className="btn sm ghost" onClick={() => act('absente')}>Absente</button>
        </>
      ) : null}
      {b.status === 'confirmee' && future ? <button className="btn sm outline" onClick={() => act('annulee')}>Annuler</button> : null}
    </div>
  );
}

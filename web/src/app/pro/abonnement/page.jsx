'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, ErrorBox, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { euros, SUB_STATUS } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useFetch } from '@/lib/useFetch';

export default function Subscription() {
  const toast = useToast();
  const { refresh } = useSession();
  const me = useFetch('/pro/me');
  const { data, error, loading, reload } = useFetch('/pro/plans');
  const [billing, setBilling] = useState('mensuel');
  if ((loading && !data) || (me.loading && !me.data)) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const choose = async (key) => {
    try {
      const r = await api.post('/pro/subscription', { plan: key, billing });
      if (r.checkoutUrl) {
        toast('Redirection vers le paiement sécurisé…');
        window.location.href = r.checkoutUrl;
        return;
      }
      toast(r.message);
      reload();
      me.reload();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const openPortal = async () => {
    try {
      const r = await api.post('/pro/subscription/portal');
      window.location.href = r.url;
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const cancelSub = async () => {
    try {
      const r = await api.post('/pro/subscription/cancel');
      toast(r.message);
      me.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const online = Boolean(data.online);
  const portal = Boolean(me.data.billing?.portal);
  const sub = me.data.subscription;
  const pending = me.data.pendingSubscription;
  // Retour de Stripe Checkout (success_url / cancel_url) : on affiche le résultat du paiement.
  const paiement = useSearchParams().get('paiement');
  return (
    <div className="stack" style={{ gap: 20 }}>
      {paiement === 'ok' ? (
        <div className="card dashed">
          <Badge status="active" map={SUB_STATUS} /> Paiement reçu : ta formule s’active automatiquement. Pour un prélèvement ou un virement, la confirmation arrive en quelques jours.
        </div>
      ) : null}
      {paiement === 'annule' ? <div className="card dashed">Paiement annulé : ta formule reste inchangée.</div> : null}
      <div className="page-head">
        <div>
          <h1>Abonnement</h1>
          <p>
            Formule actuelle : <strong>{me.data.plan?.name}</strong>
            {sub?.endsAt ? ` · jusqu’au ${new Date(sub.endsAt).toLocaleDateString('fr-FR')}` : ''}
          </p>
        </div>
        <div className="tabs" style={{ width: 320 }}>
          <button className={billing === 'mensuel' ? 'on' : ''} onClick={() => setBilling('mensuel')}>Mensuel</button>
          <button className={billing === 'annuel' ? 'on' : ''} onClick={() => setBilling('annuel')}>Annuel</button>
        </div>
      </div>
      {pending ? (
        <div className="card dashed">
          <Badge status="en_attente" map={SUB_STATUS} /> Demande « {pending.plan} » · {euros(pending.amount)} · référence <strong>{pending.paymentReference}</strong>.{' '}
          {online ? 'Termine le règlement en ligne pour activer ta formule.' : 'L’équipe Nissali te contacte pour le règlement.'}
        </div>
      ) : null}
      {online && sub ? (
        <div className="card dashed" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {sub.cancelAtPeriodEnd ? <span>Résiliation programmée : ta formule reste active jusqu’au {sub.endsAt ? new Date(sub.endsAt).toLocaleDateString('fr-FR') : 'terme de la période'}.</span> : null}
          {portal ? <button className="btn outline" onClick={openPortal}>Gérer mon moyen de paiement</button> : null}
          {sub.stripeSubscriptionId && !sub.cancelAtPeriodEnd ? <button className="btn ghost" onClick={cancelSub}>Résilier à la fin de la période</button> : null}
        </div>
      ) : null}
      <div className="grid grid-3">
        {data.plans.map((p) => {
          const amount = billing === 'annuel' ? p.priceYearly : p.priceMonthly;
          const current = data.current === p.key;
          return (
            <div key={p.key} className={`card stack ${current ? 'hero' : ''}`}>
              <h2 style={{ color: current ? 'var(--white)' : undefined }}>{p.name}</h2>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: 32 }}>
                {amount ? euros(amount) : 'Gratuit'}
                {amount ? <span className="small"> {billing === 'annuel' ? '/ an' : '/ mois'}</span> : null}
              </div>
              <p className={current ? '' : 'muted'}>{p.tagline}</p>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
                {(p.highlights || []).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              {current ? <span className="label rose">Formule actuelle</span> : <button className="btn outline" onClick={() => choose(p.key)}>Choisir {p.name}</button>}
            </div>
          );
        })}
      </div>
      <p className="muted small">
        {online
          ? 'Paiement sécurisé par carte (Stripe). Ta formule s’active automatiquement après le règlement et se renouvelle jusqu’à résiliation. Tout reste gratuit pour les utilisatrices.'
          : 'Les formules payantes sont activées par l’équipe après règlement (virement ou lien de paiement envoyé par e-mail). Tout reste gratuit pour les utilisatrices.'}
      </p>
    </div>
  );
}

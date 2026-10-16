'use client';
import { useState } from 'react';
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
      toast(r.message);
      reload();
      me.reload();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const sub = me.data.subscription;
  const pending = me.data.pendingSubscription;
  return (
    <div className="stack" style={{ gap: 20 }}>
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
          <Badge status="en_attente" map={SUB_STATUS} /> Demande « {pending.plan} » · {euros(pending.amount)} · référence <strong>{pending.paymentReference}</strong>. L’équipe Nissali te contacte pour le règlement.
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
      <p className="muted small">Les formules payantes sont activées par l’équipe après règlement (virement ou lien de paiement envoyé par e-mail). Tout reste gratuit pour les utilisatrices.</p>
    </div>
  );
}

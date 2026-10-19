'use client';
import Link from 'next/link';
import BookingActions from '@/components/BookingActions';
import BookingTable from '@/components/BookingTable';
import { ColumnChart } from '@/components/Charts';
import Icon from '@/components/Icons';
import { Avatar, Badge, CardHead, Empty, ErrorBox, Kpi, Loading, PageHeader } from '@/components/ui';
import { euros, longDate, monthLabel, parseDay, PRACTITIONER_STATUS, WEEKDAYS } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

function Completion({ completion }) {
  if (completion.percent >= 100) return null;
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <h2>Complète ton profil</h2>
          <p className="muted small">Un profil complet inspire confiance et apparaît mieux dans l’annuaire.</p>
        </div>
        <strong className="num" style={{ fontSize: 22, color: 'var(--bordeaux)' }}>{completion.percent} %</strong>
      </div>
      <div className="progress" style={{ marginBottom: 14 }}>
        <div style={{ width: `${completion.percent}%` }} />
      </div>
      <div className="grid grid-2" style={{ gap: 8 }}>
        {completion.checks.map((c) => (
          <Link key={c.key} href={c.href} className={`check-item ${c.done ? 'done' : ''}`} style={{ textDecoration: c.done ? 'line-through' : 'none' }}>
            <span className="tick">{c.done ? <Icon name="check" /> : null}</span>
            {c.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Week({ week, today }) {
  const max = Math.max(1, ...week.map((d) => d.confirmed + d.pending));
  return (
    <div className="card">
      <CardHead title="Ma semaine" subtitle="Rendez-vous des 7 prochains jours" action={<Link href="/pro/reservations">Agenda →</Link>} />
      <div className="week">
        {week.map((d) => {
          const total = d.confirmed + d.pending;
          return (
            <div key={d.day} className={`week-day ${d.day === today ? 'today' : ''}`} title={`${longDate(d.day)} : ${d.confirmed} confirmé(s), ${d.pending} en attente`}>
              <strong className="num" style={{ color: 'var(--text)' }}>{total || ''}</strong>
              <div className="week-bar">
                <div className="c" style={{ height: `${(d.confirmed / max) * 100}%` }} />
                <div className="p" style={{ height: `${(d.pending / max) * 100}%` }} />
              </div>
              <strong>{WEEKDAYS[parseDay(d.day).getUTCDay()].slice(0, 3)}</strong>
              <span>{parseDay(d.day).getUTCDate()}</span>
            </div>
          );
        })}
      </div>
      <div className="legend mt">
        <span>
          <i style={{ background: 'var(--bordeaux)' }} />
          Confirmés
        </span>
        <span>
          <i style={{ background: 'var(--or)' }} />
          En attente
        </span>
      </div>
    </div>
  );
}

export default function ProDashboard() {
  const { data, error, loading, reload } = useFetch('/pro/overview');
  const me = useFetch('/pro/me');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const pending = me.data?.pendingSubscription;
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader
        eyebrow={longDate(data.today)}
        title={`Bonjour ${data.practitioner.displayName}`}
        subtitle={
          <span className="row" style={{ gap: 8 }}>
            <Badge status={data.practitioner.status} map={PRACTITIONER_STATUS} /> Formule {data.plan?.name}
            {data.practitioner.city ? ` · ${data.practitioner.city}` : ''}
          </span>
        }
        actions={
          <>
            <Link className="btn outline" href="/pro/disponibilites">
              <Icon name="clock" /> Disponibilités
            </Link>
            <Link className="btn" href="/pro/prestations">
              <Icon name="plus" /> Prestation
            </Link>
          </>
        }
      />

      {data.practitioner.status === 'en_attente' ? (
        <div className="card soft row" style={{ gap: 12 }}>
          <Icon name="clock" size={20} />
          <span>Ton profil est en cours de validation par l’équipe Nissali. Prépare tes prestations et tes disponibilités en attendant.</span>
        </div>
      ) : null}
      {me.data?.trial ? (
        <div className="card soft row between" style={{ gap: 12, flexWrap: 'wrap' }}>
          <span>
            <span className="label">Essai gratuit</span>
            <br />
            {me.data.trial.daysLeft != null ? `${me.data.trial.daysLeft} jour${me.data.trial.daysLeft > 1 ? 's' : ''} restant${me.data.trial.daysLeft > 1 ? 's' : ''} · jusqu’au ${new Date(me.data.trial.endsAt).toLocaleDateString('fr-FR')}` : 'Sans limite de durée'} · {me.data.trial.included.join(', ').toLowerCase()}
          </span>
          <Link href="/pro/abonnement">Choisir une formule →</Link>
        </div>
      ) : null}
      {pending ? (
        <div className="card dashed row between">
          <span>
            <span className="label or">Formule en attente de règlement</span>
            <br />« {pending.plan} » · {euros(pending.amount)} {pending.billing === 'annuel' ? '/ an' : '/ mois'} · référence <strong>{pending.paymentReference}</strong>
          </span>
          <Link href="/pro/abonnement">Voir l’abonnement →</Link>
        </div>
      ) : null}

      <div className="grid grid-4">
        <Kpi tone="hero" icon="calendar" label="Rendez-vous ce mois" value={data.stats.monthBookings} trend={data.stats.monthBookingsTrend} trendSuffix="vs mois dernier" />
        <Kpi icon="euro" label="Séances du mois (tarifs indicatifs)" value={euros(data.stats.monthRevenue)} hint="Réglées directement auprès de toi" trend={data.stats.monthRevenueTrend} trendSuffix="vs mois dernier" />
        <Kpi icon="users" label="Clientes" value={data.stats.clients} hint={`${data.stats.newClients} nouvelle(s) ce mois`} />
        <Kpi icon="star" label="Note moyenne" value={data.stats.reviewsCount ? `${data.stats.rating} / 5` : '—'} hint={`${data.stats.reviewsCount} avis`} />
      </div>

      <Completion completion={data.completion} />

      <div className="grid grid-main">
        <div className="stack" style={{ gap: 20 }}>
          <div className="card">
            <CardHead title="Aujourd’hui" subtitle={`${data.todayBookings.length} rendez-vous`} />
            {data.todayBookings.length ? (
              <div className="timeline">
                {data.todayBookings.map((b) => (
                  <div key={b.id} className={`slot ${b.status === 'en_attente' ? 'pending' : ''} ${b.endTime < nowTime ? 'past' : ''}`}>
                    <time className="num">{b.time}</time>
                    <div className="cell-user">
                      <Avatar name={b.client?.firstName} />
                      <div>
                        <strong>{b.client?.firstName}</strong>
                        <span>
                          {b.serviceName} · {b.mode === 'visio' ? 'visio' : 'cabinet'} · jusqu’à {b.endTime}
                        </span>
                      </div>
                    </div>
                    <BookingActions b={b} onDone={reload} />
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="calendar" title="Journée libre">Aucun rendez-vous aujourd’hui.</Empty>
            )}
          </div>
          <div className="card flush">
            <CardHead title="Demandes à traiter" subtitle="À accepter ou refuser" action={<span className="badge warning">{data.pending.length}</span>} />
            {data.pending.length ? <BookingTable rows={data.pending} onDone={reload} /> : <Empty icon="check">Aucune demande en attente.</Empty>}
          </div>
          <div className="card flush">
            <CardHead title="Prochains rendez-vous" action={<Link href="/pro/reservations">Tout voir →</Link>} />
            {data.upcoming.length ? <BookingTable rows={data.upcoming} onDone={reload} /> : <Empty icon="calendar">Aucun rendez-vous confirmé à venir.</Empty>}
          </div>
        </div>
        <div className="stack" style={{ gap: 20 }}>
          <Week week={data.week} today={data.today} />
          <div className="card">
            <CardHead title="Activité" subtitle="Séances réalisées sur 6 mois, aux tarifs indicatifs (pas de paiement sur Nissali)" />
            {data.series ? (
              <ColumnChart data={data.series.map((s) => ({ label: monthLabel(s.month), value: s.revenue, tooltip: `${s.bookings} rendez-vous` }))} height={190} format={(v) => euros(v)} label="Activité par mois, tarifs indicatifs" />
            ) : (
              <Empty icon="trendUp" title="Statistiques détaillées" action={<Link className="btn sm soft" href="/pro/abonnement">Voir les formules</Link>}>
                Incluses dans les formules Essentiel et Premium.
              </Empty>
            )}
          </div>
          <div className="card">
            <CardHead title="Derniers avis" action={<Link href="/pro/avis">Tous →</Link>} />
            {data.reviews.length ? (
              <div className="list">
                {data.reviews.map((r) => (
                  <div key={r.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <Avatar name={r.author} />
                    <div className="grow">
                      <strong>
                        {r.author} <span style={{ color: 'var(--or)' }}>{'★'.repeat(r.rating)}</span>
                      </strong>
                      <span style={{ whiteSpace: 'normal' }}>{r.comment || 'Sans commentaire'}</span>
                    </div>
                    {!r.replied ? <span className="badge warning">À répondre</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="star">Pas encore d’avis.</Empty>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

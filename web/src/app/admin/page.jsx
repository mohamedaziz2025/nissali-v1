'use client';
// Tableau de bord du back-office (11 et 13) — aucune donnée de santé n'y apparaît.
import Link from 'next/link';
import { useState } from 'react';
import { AreaChart, Bars, ColumnChart } from '@/components/Charts';
import Icon from '@/components/Icons';
import { Avatar, Badge, CardHead, Empty, ErrorBox, Kpi, Loading, PageHeader, Tabs } from '@/components/ui';
import { BOOKING_STATUS, euros, longDate, monthLabel, parseDay } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const SITUATIONS = { mariee: 'Mariées', celibataire: 'Célibataires', inconnue: 'Non renseignée' };
const CATEGORY = { cycle: 'Cycle', fiqh: 'Fiqh féminin', grossesse: 'Grossesse', ramadan: 'Ramadan', fertilite: 'Fertilité', sante: 'Santé' };
const pct = (v) => (v == null ? '—' : `${v} %`);
const shortDay = (d) => {
  const x = parseDay(d);
  return `${x.getUTCDate()}/${x.getUTCMonth() + 1}`;
};

export default function AdminDashboard() {
  const [days, setDays] = useState('30');
  const { data, error, loading, reload } = useFetch(`/admin/stats?days=${days}`);
  const dist = useFetch('/admin/users/distribution');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const spark = data.signupsDaily.map((d) => d.count);
  const tasks = [
    ['/admin/praticiennes', 'Praticiennes à valider', 'stethoscope', data.tasks.practitioners],
    ['/admin/abonnements', 'Paiements à confirmer', 'card', data.tasks.subscriptions],
    ['/admin/blog', 'Articles à valider', 'book', data.tasks.articles],
  ];
  const period = `${days} derniers jours`;

  return (
    <div className="stack" style={{ gap: 20, opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        title="Tableau de bord"
        subtitle="Vue d’ensemble de Nissali. Aucune donnée de santé n’apparaît dans le back-office."
        actions={
          <>
            <Tabs label="Période" value={days} onChange={setDays} items={[['7', '7 jours'], ['30', '30 jours'], ['90', '90 jours']]} />
            <a className="btn outline" href="/api/admin/users/export.csv">
              <Icon name="download" /> Contacts (CSV)
            </a>
          </>
        }
      />

      <div className="grid grid-4">
        <Kpi tone="hero" icon="users" label="Utilisatrices inscrites" value={data.users.total.toLocaleString('fr-FR')} trend={data.period.signupsTrend} trendSuffix={`+${data.period.signups} sur ${days} j`} spark={spark} />
        <Kpi icon="trendUp" label="Actives sur 30 jours" value={data.users.mau.toLocaleString('fr-FR')} hint={`${data.users.dau} aujourd’hui · ${data.users.total ? Math.round((data.users.mau / data.users.total) * 100) : 0} % des inscrites`} />
        <Kpi icon="calendar" label={`Réservations (${days} j)`} value={data.period.bookings.toLocaleString('fr-FR')} trend={data.period.bookingsTrend} trendSuffix="vs période précédente" />
        <Kpi icon="euro" label="Revenu mensuel praticiennes" value={euros(data.practitioners.mrr)} hint={`${data.practitioners.activeSubscriptions} formule(s) payante(s) active(s)`} />
      </div>

      <div className="grid grid-main">
        <div className="card">
          <CardHead title="Inscriptions" subtitle={`Nouvelles utilisatrices par jour · ${period}`} action={<span className="muted small num">{data.period.signups} au total</span>} />
          <AreaChart
            data={data.signupsDaily.map((d) => ({ key: d.day, label: shortDay(d.day), value: d.count, tooltip: longDate(d.day) }))}
            label="Inscriptions par jour"
            format={(v) => v.toLocaleString('fr-FR')}
          />
        </div>
        <div className="card stack" style={{ gap: 10 }}>
          <CardHead title="À traiter" subtitle="Actions en attente de l’équipe" />
          {tasks.map(([href, label, icon, n]) => (
            <Link key={href} href={href} className={`task ${n ? '' : 'done'}`}>
              <span className="kpi-icon">
                <Icon name={icon} />
              </span>
              <span>{label}</span>
              <span className="count num">{n}</span>
            </Link>
          ))}
          <div className="grid grid-2" style={{ gap: 10, marginTop: 6 }}>
            <div className="task" style={{ display: 'grid', gap: 2 }}>
              <span className="muted small">Praticiennes validées</span>
              <strong className="num" style={{ fontSize: 20 }}>{data.practitioners.validated}</strong>
            </div>
            <div className="task" style={{ display: 'grid', gap: 2 }}>
              <span className="muted small">Jeûnes rattrapés</span>
              <strong className="num" style={{ fontSize: 20 }}>{data.fastsMadeUp.toLocaleString('fr-FR')}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <Kpi icon="history" label="Rétention à 1 mois" value={pct(data.retention.m1)} hint="actives parmi les inscrites depuis 1 mois" />
        <Kpi icon="history" label="Rétention à 3 mois" value={pct(data.retention.m3)} hint="actives parmi les inscrites depuis 3 mois" />
        <Kpi icon="mail" label="Acceptent les communications" value={pct(data.users.marketingRate)} hint="e-mail, SMS ou WhatsApp" />
        <Kpi icon="heart" label="Ont saisi 2 cycles ou plus" value={pct(data.users.twoCyclesRate)} hint="l’appli devient vraiment utile" />
      </div>

      <div className="grid grid-3">
        <div className="card">
          <CardHead title="Âges" subtitle="Répartition des inscrites" />
          {dist.data ? <Bars data={dist.data.ages} /> : <Loading />}
        </div>
        <div className="card">
          <CardHead title="Villes" subtitle="15 premières villes" />
          {dist.data ? dist.data.cities.length ? <Bars data={dist.data.cities} /> : <Empty icon="pin">Aucune ville renseignée</Empty> : <Loading />}
        </div>
        <div className="card">
          <CardHead title="Situation" subtitle="Mariées / célibataires" />
          {dist.data ? <Bars data={dist.data.situations.map((s) => ({ ...s, label: SITUATIONS[s.label] || s.label }))} /> : <Loading />}
          <div className="mt">
            <CardHead title="Inscriptions par mois" subtitle="12 derniers mois" />
            <ColumnChart data={data.signups.map((s) => ({ label: monthLabel(s.month), value: s.count }))} height={160} label="Inscriptions par mois" />
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card flush">
          <CardHead title="Dernières inscrites" action={<Link href="/admin/utilisatrices">Tout voir →</Link>} />
          {data.recentUsers.length ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  {data.recentUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={u.firstName} />
                          <div>
                            <strong>{u.firstName || '—'}</strong>
                            <span>{u.contact}</span>
                          </div>
                        </div>
                      </td>
                      <td className="muted">{u.city || '—'}</td>
                      <td className="muted">{SITUATIONS[u.situation] ? SITUATIONS[u.situation].replace(/s$/, '') : '—'}</td>
                      <td className="muted small" style={{ textAlign: 'right' }}>
                        {new Date(u.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="users">Pas encore d’inscrite.</Empty>
          )}
        </div>
        <div className="card flush">
          <CardHead title="Dernières réservations" action={<Link href="/admin/reservations">Tout voir →</Link>} />
          {data.recentBookings.length ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  {data.recentBookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={b.practitioner} />
                          <div>
                            <strong>{b.practitioner}</strong>
                            <span>
                              {b.serviceName} · {b.client}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="muted small">
                        {longDate(b.day)}
                        <br />
                        {b.time}
                      </td>
                      <td className="num">{euros(b.price)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Badge status={b.status} map={BOOKING_STATUS} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="calendar">Pas encore de réservation.</Empty>
          )}
        </div>
      </div>

      <div className="card flush">
        <CardHead title="Articles les plus lus" subtitle="Depuis la publication" action={<Link href="/admin/blog">Gérer le blog →</Link>} />
        <div className="table-wrap">
          <table>
            <tbody>
              {data.topArticles.map((a, i) => {
                const max = data.topArticles[0]?.views || 1;
                return (
                  <tr key={a._id}>
                    <td className="muted num" style={{ width: 40 }}>
                      {i + 1}
                    </td>
                    <td>
                      <strong>{a.title}</strong>
                      <div className="muted small">{CATEGORY[a.category]}</div>
                    </td>
                    <td style={{ width: '32%' }}>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(a.views / max) * 100}%` }} />
                      </div>
                    </td>
                    <td className="num" style={{ textAlign: 'right', width: 110 }}>
                      {a.views.toLocaleString('fr-FR')} lectures
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';
// Signalements de la messagerie : motif, parties, derniers messages pour le contexte, blocage.
import Icon from '@/components/Icons';
import { Empty, ErrorBox, Loading, PageHeader, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

export default function AdminReports() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/message-reports');
  const act = async (r, action) => {
    try {
      await api.post(`/admin/message-reports/${r.id}`, { action });
      toast(action === 'bloquer' ? 'Conversation bloquée' : 'Signalement traité');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader eyebrow="Messagerie" title="Signalements" subtitle="Conversations signalées par une utilisatrice ou une praticienne. Seuls les derniers messages sont affichés, pour la modération." />
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.length ? (
        data.map((r) => (
          <div key={r.id} className="card stack" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0 }}>
                  {r.client?.name || 'Cliente'} ↔ {r.practitioner?.name || 'Praticienne'}
                </h3>
                <p className="muted small" style={{ margin: '4px 0 0' }}>{r.client?.email}</p>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {r.open ? <span className="badge warning">À traiter</span> : <span className="badge neutral">Traité</span>}
                {r.blocked ? <span className="badge danger">Bloquée</span> : null}
              </div>
            </div>
            {r.reports.map((rep, i) => (
              <div key={i} className="alert" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                <Icon name="flag" />
                <span>
                  <strong>{rep.by === 'pro' ? 'La praticienne' : 'L’utilisatrice'}</strong> · {dateTime(rep.at)} : {rep.reason}
                </span>
              </div>
            ))}
            <div className="stack" style={{ gap: 6 }}>
              {r.recent.map((m, i) => (
                <div key={i} className="small" style={{ alignSelf: m.from === 'pro' ? 'flex-start' : 'flex-end', maxWidth: '70%', background: m.from === 'pro' ? 'var(--blush)' : 'var(--surface-2)', borderRadius: 12, padding: '8px 12px' }}>
                  <span className="muted">{m.from === 'pro' ? r.practitioner?.name : r.client?.name} · {dateTime(m.at)}</span>
                  <div>{m.text || '📷 Photo'}</div>
                </div>
              ))}
            </div>
            {r.open ? (
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn outline" onClick={() => act(r, 'traite')}>Marquer comme traité</button>
                <button className="btn danger" onClick={() => act(r, 'bloquer')}>Bloquer la conversation</button>
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <div className="card">
          <Empty icon="flag" title="Aucun signalement">Les conversations signalées apparaîtront ici.</Empty>
        </div>
      )}
    </div>
  );
}

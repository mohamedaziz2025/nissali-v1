'use client';
// Lifestyle › NissaPlace : demandes des sœurs souhaitant ouvrir une boutique sur nissaplace.fr.
// Valider ou refuser avec motif ; la demandeuse est prévenue par notification. Le catalogue affiché dans
// l'appli vient en direct de nissaplace.fr : une fois validée, l'équipe l'onboarde elle-même sur le site.
import { useState } from 'react';
import { Badge, Empty, ErrorBox, Field, Kpi, Loading, Modal, PageHeader, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const STATUS = {
  en_attente: ['À valider', 'warning'],
  validee: ['Validée', 'success'],
  refusee: ['Refusée', 'danger'],
};

export default function AdminNissaPlace() {
  const toast = useToast();
  const [tab, setTab] = useState('en_attente');
  const { data, error, loading, reload } = useFetch(`/admin/nissaplace-requests${tab === 'tous' ? '' : `?status=${tab}`}`);
  const all = useFetch('/admin/nissaplace-requests');
  const [moderation, setModeration] = useState(null); // { request, action }
  const [note, setNote] = useState('');

  const moderate = async () => {
    try {
      await api.post(`/admin/nissaplace-requests/${moderation.request.id}/moderate`, { action: moderation.action, note });
      toast(moderation.action === 'valider' ? 'Demande validée, la sœur est prévenue' : 'Réponse envoyée à la sœur');
      setModeration(null);
      setNote('');
      reload();
      all.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const counts = all.data?.counts || {};

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader eyebrow="Lifestyle" title="Demandes NissaPlace" subtitle="Sœurs souhaitant ouvrir une boutique sur nissaplace.fr. Le catalogue affiché dans l’appli vient en direct du site." />
      <div className="grid grid-3">
        <Kpi icon="alert" label="À valider" value={counts.en_attente || 0} />
        <Kpi icon="check" label="Validées" value={counts.validee || 0} />
        <Kpi icon="close" label="Refusées" value={counts.refusee || 0} />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'en_attente', label: `À valider${counts.en_attente ? ` (${counts.en_attente})` : ''}` },
          { key: 'validee', label: 'Validées' },
          { key: 'refusee', label: 'Refusées' },
          { key: 'tous', label: 'Toutes' },
        ]}
      />
      <div className="card">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={reload} />
        ) : data.items.length ? (
          data.items.map((r) => (
            <div key={r.id} className="event-row">
              <div style={{ minWidth: 0 }}>
                <div className="tag-line" style={{ color: 'var(--or)' }}>
                  {r.user?.name || 'Sœur'}{r.user?.email ? ` · ${r.user.email}` : ''}{r.user?.phone ? ` · ${r.user.phone}` : ''}
                </div>
                <h3 style={{ margin: '2px 0' }}>{r.shopName}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  {[r.activity, r.city, r.phone, r.instagramUrl, r.websiteUrl].filter(Boolean).join(' · ')}
                </p>
                {r.description ? <p className="small" style={{ margin: '6px 0 0', maxWidth: 680 }}>{r.description}</p> : null}
                <p className="muted small" style={{ margin: '6px 0 0' }}>Reçue le {dateTime(r.createdAt)}</p>
                {r.moderationNote ? <p className="small muted" style={{ margin: '6px 0 0' }}>Note : {r.moderationNote}</p> : null}
                {r.status === 'validee' ? <p className="small muted" style={{ margin: '6px 0 0' }}>À ouvrir sur nissaplace.fr : elle apparaît ensuite automatiquement dans le catalogue de l’appli.</p> : null}
              </div>
              <div className="stack" style={{ gap: 8, justifyItems: 'end' }}>
                <Badge status={r.status} map={STATUS} />
                {r.status === 'en_attente' ? (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm" onClick={() => setModeration({ request: r, action: 'valider' })}>Valider</button>
                    <button className="btn sm danger" onClick={() => setModeration({ request: r, action: 'refuser' })}>Refuser</button>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <Empty icon="tag" title="Aucune demande ici">Les sœurs qui veulent ouvrir une boutique sur NissaPlace apparaîtront dans « À valider ».</Empty>
        )}
      </div>

      <Modal
        open={Boolean(moderation)}
        onClose={() => setModeration(null)}
        title={moderation?.action === 'valider' ? 'Valider cette demande ?' : 'Refuser la demande'}
        footer={
          <>
            <button className="btn ghost" onClick={() => setModeration(null)}>Annuler</button>
            <button className={`btn ${moderation?.action === 'refuser' ? 'danger' : ''}`} onClick={moderate}>
              {moderation?.action === 'valider' ? 'Valider' : 'Envoyer'}
            </button>
          </>
        }
      >
        <p className="muted">« {moderation?.request.shopName} » — la sœur est prévenue par notification.</p>
        <Field label={moderation?.action === 'valider' ? 'Message (facultatif)' : 'Motif (obligatoire)'}>
          <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

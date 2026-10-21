'use client';
// Lifestyle › NissaPlace : demandes des sœurs souhaitant ouvrir une boutique sur nissaplace.fr.
// Valider (avec image, catégorie et site → la fiche rejoint le catalogue de l'appli) ou refuser avec
// motif ; la demandeuse est prévenue par notification. Les fiches validées restent modifiables ensuite.
import { useState } from 'react';
import CoverCropper from '@/components/CoverCropper';
import { Badge, Empty, ErrorBox, Field, Kpi, Loading, Modal, PageHeader, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';

const STATUS = {
  en_attente: ['À valider', 'warning'],
  validee: ['Validée', 'success'],
  refusee: ['Refusée', 'danger'],
};
const CATEGORIES = { mode: 'Mode', bien_etre: 'Bien-être' };
const emptyForm = { note: '', imageUrl: '', category: 'mode', websiteUrl: '' };

export default function AdminNissaPlace() {
  const toast = useToast();
  const [tab, setTab] = useState('en_attente');
  const { data, error, loading, reload } = useFetch(`/admin/nissaplace-requests${tab === 'tous' ? '' : `?status=${tab}`}`);
  const all = useFetch('/admin/nissaplace-requests');
  const [moderation, setModeration] = useState(null); // { request, action: 'valider' | 'refuser' | 'editer' }
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const openModeration = (request, action) => {
    setForm({ note: '', imageUrl: request.imageUrl || '', category: request.category || 'mode', websiteUrl: request.websiteUrl || request.instagramUrl || '' });
    setModeration({ request, action });
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (moderation.action === 'editer') {
        await api.patch(`/admin/nissaplace-requests/${moderation.request.id}`, { imageUrl: form.imageUrl, category: form.category, websiteUrl: form.websiteUrl });
        toast('Fiche mise à jour');
      } else {
        const body = { action: moderation.action, note: form.note };
        if (moderation.action === 'valider') Object.assign(body, { imageUrl: form.imageUrl, category: form.category, websiteUrl: form.websiteUrl });
        await api.post(`/admin/nissaplace-requests/${moderation.request.id}/moderate`, body);
        toast(moderation.action === 'valider' ? 'Demande validée, la sœur est prévenue' : 'Réponse envoyée à la sœur');
      }
      setModeration(null);
      reload();
      all.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const counts = all.data?.counts || {};

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader eyebrow="Lifestyle" title="Demandes NissaPlace" subtitle="Sœurs souhaitant ouvrir une boutique sur nissaplace.fr." />
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
              {r.imageUrl ? <img src={r.imageUrl} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 16, flexShrink: 0 }} /> : null}
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
                {r.status === 'validee' ? (
                  <p className="small" style={{ margin: '6px 0 0' }}>
                    {CATEGORIES[r.category] || 'Mode'} · {r.listed ? <span className="badge success">Visible dans le catalogue</span> : <span className="badge warning">Pas encore visible (image et site requis)</span>}
                  </p>
                ) : null}
              </div>
              <div className="stack" style={{ gap: 8, justifyItems: 'end' }}>
                <Badge status={r.status} map={STATUS} />
                {r.status === 'en_attente' ? (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm" onClick={() => openModeration(r, 'valider')}>Valider</button>
                    <button className="btn sm danger" onClick={() => openModeration(r, 'refuser')}>Refuser</button>
                  </div>
                ) : r.status === 'validee' ? (
                  <button className="btn sm ghost" onClick={() => openModeration(r, 'editer')}>Modifier la fiche</button>
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
        title={moderation?.action === 'valider' ? 'Valider cette demande' : moderation?.action === 'editer' ? 'Modifier la fiche du catalogue' : 'Refuser la demande'}
        footer={
          <>
            <button className="btn ghost" onClick={() => setModeration(null)}>Annuler</button>
            <button className={`btn ${moderation?.action === 'refuser' ? 'danger' : ''}`} disabled={busy} onClick={submit}>
              {moderation?.action === 'valider' ? 'Valider' : moderation?.action === 'editer' ? 'Enregistrer' : 'Envoyer'}
            </button>
          </>
        }
      >
        <p className="muted">« {moderation?.request.shopName} »{moderation?.action !== 'editer' ? ' — la sœur est prévenue par notification.' : ''}</p>
        {moderation?.action === 'refuser' ? (
          <Field label="Motif (obligatoire)">
            <textarea className="textarea" rows={3} value={form.note} onChange={(e) => setForm((x) => ({ ...x, note: e.target.value }))} />
          </Field>
        ) : (
          <>
            {moderation?.action === 'valider' ? (
              <Field label="Message (facultatif)">
                <textarea className="textarea" rows={2} value={form.note} onChange={(e) => setForm((x) => ({ ...x, note: e.target.value }))} />
              </Field>
            ) : null}
            <Field label="Image de la fiche (format 16:9)" hint="Affichée dans le catalogue NissaPlace de l'appli.">
              <CoverCropper value={form.imageUrl} withMeta={false} maxBytes={1024 * 1024} onChange={(v) => v.coverUrl !== undefined && setForm((x) => ({ ...x, imageUrl: v.coverUrl }))} />
            </Field>
            <div className="grid grid-2">
              <Field label="Catégorie">
                <select className="select" value={form.category} onChange={(e) => setForm((x) => ({ ...x, category: e.target.value }))}>
                  {Object.entries(CATEGORIES).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Site de la marque" hint="Ouvert quand une sœur touche « Voir le site ».">
                <input className="input" type="url" placeholder="https://…" value={form.websiteUrl} onChange={(e) => setForm((x) => ({ ...x, websiteUrl: e.target.value }))} />
              </Field>
            </div>
            {moderation?.action === 'valider' ? <p className="muted small" style={{ margin: 0 }}>La fiche apparaît dans le catalogue de l’appli dès qu’elle a une image et un site (modifiable à tout moment ensuite).</p> : null}
          </>
        )}
      </Modal>
    </div>
  );
}

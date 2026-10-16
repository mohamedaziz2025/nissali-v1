'use client';
// RG-08 ter — Bibliothèque de conseils santé par phase (au moins 10 par phase), relus par une sage-femme.
import { useState } from 'react';
import Icon from '@/components/Icons';
import { Empty, ErrorBox, Field, Loading, Modal, PageHeader, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';

const PHASES = [
  { key: 'menstruelle', label: 'Menstruelle' },
  { key: 'folliculaire', label: 'Folliculaire' },
  { key: 'ovulatoire', label: 'Ovulatoire' },
  { key: 'luteale', label: 'Lutéale' },
  { key: 'grossesse', label: 'Grossesse' },
];
const THEMES = { alimentation: 'Alimentation', sommeil: 'Sommeil', activite: 'Activité', douleurs: 'Douleurs', hydratation: 'Hydratation', bien_etre: 'Bien-être' };

export default function AdminTips() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/admin/health-tips');
  // 15 / 16 — article lié choisi parmi les articles du magazine, ou aucun (jamais au hasard).
  const articles = useFetch('/admin/articles');
  const articleOf = (slug) => (articles.data || []).find((a) => a.slug === slug);
  const visible = (a) => a && a.published && ['valide_comite', 'valide_sante'].includes(a.validation);
  const [phase, setPhase] = useState('menstruelle');
  const [edit, setEdit] = useState(null);
  const list = (data || []).filter((t) => t.phase === phase);
  const count = (k) => (data || []).filter((t) => t.phase === k && t.active).length;

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { phase: edit.phase, title: edit.title, text: edit.text, theme: edit.theme, articleSlug: edit.articleSlug || '', reviewed: edit.reviewed, active: edit.active };
      if (edit.id) await api.patch(`/admin/health-tips/${edit.id}`, body);
      else await api.post('/admin/health-tips', body);
      setEdit(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const patch = async (t, body) => {
    await api.patch(`/admin/health-tips/${t.id}`, body).catch((err) => toast(err.message, 'error'));
    reload();
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader
        eyebrow="Accueil · carte « Conseil santé »"
        title="Conseils santé"
        subtitle="Un vrai conseil de santé (alimentation, sommeil, activité, douleurs), jamais un rappel religieux. Il change selon la phase du cycle. « Relu par une sage-femme » s’affiche une fois le conseil validé."
        actions={
          <button className="btn" onClick={() => setEdit({ phase, title: '', text: '', theme: 'alimentation', articleSlug: '', reviewed: false, active: true })}>
            <Icon name="plus" /> Ajouter un conseil
          </button>
        }
      />
      <Tabs value={phase} onChange={setPhase} items={PHASES.map((p) => ({ key: p.key, label: `${p.label} (${count(p.key)})` }))} />
      <div className="card">
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={reload} />
        ) : list.length ? (
          <table>
            <thead>
              <tr>
                <th>Conseil</th>
                <th>Thème</th>
                <th>Relecture</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td style={{ maxWidth: 520 }}>
                    <strong>{t.title}</strong>
                    <div className="muted small">{t.text}</div>
                    {t.articleSlug ? (
                      <div className="small">
                        En savoir plus : {articleOf(t.articleSlug)?.title || t.articleSlug}
                        {articleOf(t.articleSlug) && !visible(articleOf(t.articleSlug)) ? <span className="badge warning" style={{ marginLeft: 6 }}>Article non publié : lien masqué</span> : null}
                      </div>
                    ) : (
                      <div className="small muted">Conseil autonome (aucun article lié)</div>
                    )}
                  </td>
                  <td>{THEMES[t.theme]}</td>
                  <td>
                    {t.reviewed ? (
                      <span className="badge success">Relu par une sage-femme</span>
                    ) : (
                      <button className="btn sm outline" onClick={() => patch(t, { reviewed: true })}>Marquer relu</button>
                    )}
                  </td>
                  <td>{t.active ? <span className="badge success">Actif</span> : <span className="badge neutral">Masqué</span>}</td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn sm ghost" onClick={() => setEdit({ ...t })}>Modifier</button>
                      <button className="btn sm ghost" onClick={() => patch(t, { active: !t.active })}>{t.active ? 'Masquer' : 'Afficher'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty icon="heart" title="Aucun conseil pour cette phase" />
        )}
        {list.length && count(phase) < 10 && phase !== 'grossesse' ? <p className="small muted" style={{ marginTop: 12 }}>Le cahier des charges demande au moins 10 conseils actifs par phase.</p> : null}
      </div>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Modifier le conseil' : 'Nouveau conseil'}>
        {edit ? (
          <form className="stack" onSubmit={save}>
            <div className="grid grid-2">
              <Field label="Phase">
                <select className="select" value={edit.phase} onChange={(e) => setEdit({ ...edit, phase: e.target.value })}>
                  {PHASES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Thème">
                <select className="select" value={edit.theme} onChange={(e) => setEdit({ ...edit, theme: e.target.value })}>
                  {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Titre"><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required minLength={3} maxLength={120} /></Field>
            <Field label="Conseil" hint={`${edit.text.length}/600`}><textarea className="textarea" rows={4} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} required minLength={10} maxLength={600} /></Field>
            <Field label="Article lié « En savoir plus » (facultatif)" hint="Seulement si l’article approfondit réellement le même sujet que le conseil. Sinon, le conseil reste autonome.">
              <select className="select" value={edit.articleSlug || ''} onChange={(e) => setEdit({ ...edit, articleSlug: e.target.value })}>
                <option value="">Aucun article</option>
                {(articles.data || []).map((a) => (
                  <option key={a._id} value={a.slug}>
                    {a.title}
                    {visible(a) ? '' : ' (non publié)'}
                  </option>
                ))}
              </select>
            </Field>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={edit.reviewed} onChange={(e) => setEdit({ ...edit, reviewed: e.target.checked })} />
              <span className="small">Relu et validé par une sage-femme</span>
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Annuler</button>
              <button className="btn">Enregistrer</button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

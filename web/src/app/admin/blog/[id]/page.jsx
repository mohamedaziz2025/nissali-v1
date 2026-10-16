'use client';
// Éditeur d'article : catégorie, phases du cycle, statut de validation, programmation.
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Chips, Field, Loading, useToast } from '@/components/ui';
import { api } from '@/lib/api';

const CATEGORIES = [
  { key: 'cycle', label: 'Cycle' },
  { key: 'fiqh', label: 'Fiqh féminin' },
  { key: 'grossesse', label: 'Grossesse' },
  { key: 'ramadan', label: 'Ramadan' },
  { key: 'fertilite', label: 'Fertilité' },
  { key: 'sante', label: 'Santé féminine' },
];
const PHASES = [
  { key: 'menstruelle', label: 'Menstruelle' },
  { key: 'folliculaire', label: 'Folliculaire' },
  { key: 'ovulatoire', label: 'Ovulatoire' },
  { key: 'luteale', label: 'Lutéale' },
];
const COLORS = [
  { key: 'rose', label: 'Rose poudré' },
  { key: 'or', label: 'Or doux' },
  { key: 'blush', label: 'Blush' },
  { key: 'bordeaux', label: 'Bordeaux' },
];
const VALIDATIONS = [
  { key: 'a_valider', label: 'À valider' },
  { key: 'valide_comite', label: 'Validé par le comité' },
  { key: 'valide_sante', label: 'Validé par une professionnelle de santé' },
];

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

export default function ArticleEditor() {
  const { id } = useParams();
  const isNew = id === 'nouveau';
  const router = useRouter();
  const toast = useToast();
  const [a, setA] = useState(isNew ? { title: '', slug: '', category: 'cycle', excerpt: '', body: '', readMinutes: 4, featured: false, phases: [], validation: 'a_valider', reviewer: '', sources: '', publishAt: new Date().toISOString().slice(0, 10), published: true, color: 'rose' } : null);

  useEffect(() => {
    if (isNew) return;
    api.get(`/admin/articles/${id}`).then((d) => setA({ ...d, sources: (d.sources || []).join('\n'), publishAt: (d.publishAt || '').slice(0, 10) }));
  }, [id, isNew]);
  if (!a) return <Loading />;
  const set = (k) => (v) => setA((x) => ({ ...x, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }));

  const save = async (e) => {
    e.preventDefault();
    const body = {
      title: a.title,
      slug: a.slug || slugify(a.title),
      category: a.category,
      excerpt: a.excerpt,
      body: a.body,
      readMinutes: Number(a.readMinutes),
      featured: a.featured,
      phases: a.phases,
      validation: a.validation,
      reviewer: a.reviewer,
      sources: String(a.sources || '').split('\n').map((s) => s.trim()).filter(Boolean),
      publishAt: a.publishAt,
      published: a.published,
      color: a.color,
    };
    try {
      if (isNew) {
        const created = await api.post('/admin/articles', body);
        router.replace(`/admin/blog/${created._id}`);
      } else {
        await api.patch(`/admin/articles/${id}`, body);
      }
      toast('Article enregistré');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const remove = async () => {
    if (!window.confirm('Supprimer cet article ?')) return;
    await api.delete(`/admin/articles/${id}`);
    router.replace('/admin/blog');
  };

  return (
    <form className="stack" style={{ gap: 20 }} onSubmit={save}>
      <Link href="/admin/blog">← Blog</Link>
      <div className="page-head">
        <h1>{isNew ? 'Nouvel article' : 'Modifier l’article'}</h1>
        <div className="row">
          {!isNew ? <button type="button" className="btn danger" onClick={remove}>Supprimer</button> : null}
          <button className="btn">Enregistrer</button>
        </div>
      </div>
      <div className="grid grid-3">
        <div className="card stack" style={{ gridColumn: 'span 2' }}>
          <Field label="Titre">
            <input className="input" value={a.title} onChange={set('title')} required minLength={3} />
          </Field>
          <Field label="Adresse (slug)" hint="Générée depuis le titre si vide.">
            <input className="input" value={a.slug} onChange={set('slug')} placeholder={slugify(a.title)} />
          </Field>
          <Field label="Résumé">
            <textarea className="textarea" style={{ minHeight: 70 }} value={a.excerpt} onChange={set('excerpt')} />
          </Field>
          <Field label="Contenu (Markdown : ## titre, - liste, 1. étape, **gras**, > citation)">
            <textarea className="textarea" style={{ minHeight: 360, fontFamily: 'ui-monospace, monospace', fontSize: 14 }} value={a.body} onChange={set('body')} required />
          </Field>
          <Field label="Sources (une par ligne)">
            <textarea className="textarea" style={{ minHeight: 70 }} value={a.sources} onChange={set('sources')} />
          </Field>
        </div>
        <div className="stack">
          <div className="card stack">
            <h3>Validation</h3>
            <Chips items={VALIDATIONS} value={a.validation} onChange={set('validation')} />
            <Field label="Mention affichée">
              <input className="input" value={a.reviewer} onChange={set('reviewer')} placeholder="Relu par une sage-femme" />
            </Field>
          </div>
          <div className="card stack">
            <h3>Publication</h3>
            <Field label="Date de publication" hint="Une date future programme l’article.">
              <input className="input" type="date" value={a.publishAt} onChange={set('publishAt')} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={a.published} onChange={set('published')} />
              <span>Publié</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={a.featured} onChange={set('featured')} />
              <span>À la une</span>
            </label>
            <Field label="Temps de lecture (min)">
              <input className="input" type="number" min="1" max="60" value={a.readMinutes} onChange={set('readMinutes')} />
            </Field>
          </div>
          <div className="card stack">
            <h3>Classement</h3>
            <Field label="Catégorie">
              <Chips items={CATEGORIES} value={a.category} onChange={set('category')} />
            </Field>
            <Field label="Article du jour pour les phases">
              <Chips items={PHASES} value={a.phases} onChange={set('phases')} multi />
            </Field>
            <Field label="Couleur de la vignette">
              <Chips items={COLORS} value={a.color} onChange={set('color')} />
            </Field>
          </div>
        </div>
      </div>
    </form>
  );
}

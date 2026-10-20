import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CATEGORIES = {
  cycle: 'Cycle',
  fiqh: 'Fiqh féminin',
  grossesse: 'Grossesse',
  ramadan: 'Ramadan',
  fertilite: 'Fertilité',
  sante: 'Santé féminine',
};

const articleSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: { type: String, required: true }, // clé d'une catégorie gérée dans le back-office (ArticleCategory)
    excerpt: String,
    body: { type: String, required: true }, // Markdown simple
    readMinutes: { type: Number, default: 4 },
    featured: { type: Boolean, default: false },
    phases: [{ type: String, enum: ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale'] }],
    validation: { type: String, enum: ['a_valider', 'valide_comite', 'valide_sante'], default: 'a_valider' },
    reviewer: String, // ex. « relu par une sage-femme »
    sources: [String],
    publishAt: { type: Date, default: Date.now },
    published: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    color: { type: String, enum: ['rose', 'or', 'blush', 'bordeaux'], default: 'rose' },
    // 14 — Photo de couverture (recadrée en 16:9 dans le back-office) et texte alternatif.
    coverUrl: String,
    coverAlt: { type: String, maxlength: 200 },
    coverCredit: { type: String, maxlength: 160 },
    // 4.13 · 8.3 — notification push à la publication (désactivée par défaut), envoyée une seule fois.
    pushOnPublish: { type: Boolean, default: false },
    pushBroadcast: { type: Schema.Types.ObjectId, ref: 'Broadcast' },
    // Auteur et date de chaque modification.
    revisions: { type: [{ _id: false, by: { type: Schema.Types.ObjectId, ref: 'User' }, name: String, at: Date, action: String }], default: [] },
  },
  { timestamps: true },
);

articleSchema.index({ title: 'text', excerpt: 'text', body: 'text' }, { default_language: 'french' });

export const Article = mongoose.model('Article', articleSchema);

// 4.13 · 8.3 — catégories du Magazine gérées par l'équipe (ordre = ordre des puces dans l'appli).
const articleCategorySchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true, minlength: 2, maxlength: 25 },
    order: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const ArticleCategory = mongoose.model('ArticleCategory', articleCategorySchema);

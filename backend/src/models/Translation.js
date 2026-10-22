import mongoose from 'mongoose';

const { Schema } = mongoose;

// Traductions des contenus (articles, conseils, événements, fiches…), enregistrées en base en trois langues
// (français, anglais, arabe) par le script `npm run translate:content` (DeepL). Clé : empreinte du texte
// d'origine ; une ligne par langue, y compris la langue d'origine. L'API ne fait que les lire.
const translationSchema = new Schema(
  {
    hash: { type: String, required: true },
    lang: { type: String, enum: ['fr', 'en', 'ar'], required: true },
    text: { type: String, required: true },
    source: { type: String }, // langue d'origine détectée (fr, en, ar…)
    origin: { type: String }, // d'où vient le texte : « Article.body », « HealthTip.text »…
  },
  { timestamps: true },
);

translationSchema.index({ hash: 1, lang: 1 }, { unique: true });

export const Translation = mongoose.model('Translation', translationSchema);

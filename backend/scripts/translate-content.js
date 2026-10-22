// Traduit les contenus en base (articles, conseils, événements, fiches, dhikr…) en français, anglais et arabe,
// avec DeepL, et enregistre les trois versions en base. Reprend là où il s'est arrêté (rien n'est retraduit).
// Usage : npm run translate:content            (traduit ce qui manque)
//         npm run translate:content -- --dry-run (compte seulement les caractères à traduire)
import mongoose from 'mongoose';
import { connectDb } from '../src/config/db.js';
import { deeplUsage } from '../src/services/deepl.js';
import { translateContent } from '../src/services/contentTranslation.js';

const dryRun = process.argv.includes('--dry-run');
await connectDb();
try {
  const usage = await deeplUsage();
  console.log(`DeepL : ${usage.character_count} / ${usage.character_limit} caractères utilisés ce mois-ci`);
  const r = await translateContent({ dryRun, log: (m) => console.log(m) });
  console.log(dryRun ? 'Simulation terminée (rien n’a été envoyé à DeepL).' : r.stopped ? 'Traduction interrompue (quota).' : 'Traduction terminée : tout est en base en 3 langues.');
} finally {
  await mongoose.disconnect();
}

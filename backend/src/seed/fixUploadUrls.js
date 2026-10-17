// Réécrit les URL d'images figées en base après un changement de domaine.
// Les URL sont écrites à l'envoi du fichier (ex. pro.js : photoUrl = PUBLIC_API_URL + '/uploads/…') :
// corriger PUBLIC_API_URL ne répare que les envois suivants, pas les documents déjà enregistrés.
// Idempotent : ne touche que les valeurs qui portent encore l'ancien préfixe.
// Usage :
//   node src/seed/fixUploadUrls.js                     aperçu (ancienne IP → PUBLIC_API_URL)
//   node src/seed/fixUploadUrls.js --apply             applique
//   node src/seed/fixUploadUrls.js <ancien> <nouveau>  préfixes explicites
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { Article, Broadcast, Event, Notification, Practitioner } from '../models/index.js';

const OLD_DEFAULT = 'http://72.62.71.97:8101';

// Champs alimentés par une URL absolue renvoyée par POST /upload-image ou l'envoi des photos d'événement.
const FIELDS = [
  [Practitioner, 'photoUrl'],
  [Article, 'coverUrl'],
  [Event, 'imageUrl'],
  [Broadcast, 'imageUrl'],
  [Notification, 'imageUrl'],
];

export const trimSlash = (url) => url.replace(/\/+$/, '');
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseArgs(argv) {
  const [oldPrefix, newPrefix] = argv.filter((a) => !a.startsWith('--'));
  return { apply: argv.includes('--apply'), oldPrefix, newPrefix };
}

// $replaceOne : ne réécrit que le préfixe, le nom du fichier est conservé.
const replaceOne = (input, find, replacement) => ({ $replaceOne: { input, find, replacement } });

async function fixUploadUrls() {
  const { apply, oldPrefix, newPrefix } = parseArgs(process.argv.slice(2));
  const oldUrl = trimSlash(oldPrefix || OLD_DEFAULT);
  const newUrl = trimSlash(newPrefix || env.publicApiUrl);

  if (!newUrl) throw new Error('PUBLIC_API_URL est vide : passe la nouvelle adresse en 2e argument');
  if (newUrl === oldUrl) {
    throw new Error(
      `nouvelle adresse identique à l'ancienne (${newUrl}) : le conteneur api n'a pas été recréé, ` +
        'ou passe la nouvelle adresse en 2e argument',
    );
  }

  const matches = { $regex: `^${escapeRegex(oldUrl)}` };
  console.log(`[urls] ${oldUrl} → ${newUrl} (${apply ? 'écriture' : 'aperçu, ajouter --apply'})`);

  let remaining = 0;
  for (const [model, field] of FIELDS) {
    const name = `${model.collection.name}.${field}`;
    const before = await model.countDocuments({ [field]: matches });
    if (before && apply) {
      const r = await model.updateMany({ [field]: matches }, [{ $set: { [field]: replaceOne(`$${field}`, oldUrl, newUrl) } }]);
      console.log(`[urls] ${name} : ${r.modifiedCount} corrigé(s)`);
      remaining += await model.countDocuments({ [field]: matches });
    } else {
      console.log(`[urls] ${name} : ${before} à corriger`);
      remaining += before;
    }
  }

  // Galerie d'événement : tableau de chaînes, chaque élément doit être réécrit.
  const photos = `${Event.collection.name}.photos`;
  const before = await Event.countDocuments({ photos: matches });
  if (before && apply) {
    const r = await Event.updateMany({ photos: matches }, [
      { $set: { photos: { $map: { input: '$photos', in: replaceOne('$$this', oldUrl, newUrl) } } } },
    ]);
    console.log(`[urls] ${photos} : ${r.modifiedCount} corrigé(s)`);
    remaining += await Event.countDocuments({ photos: matches });
  } else {
    console.log(`[urls] ${photos} : ${before} à corriger`);
    remaining += before;
  }

  if (!apply) {
    console.log(`[urls] aperçu : ${remaining} valeur(s) concernée(s)`);
    return;
  }
  if (remaining) throw new Error(`${remaining} valeur(s) portent encore l'ancien préfixe`);
}

if (process.argv[1]?.endsWith('fixUploadUrls.js')) {
  connectDb()
    .then(fixUploadUrls)
    .then(() => mongoose.disconnect())
    .then(() => console.log('[urls] terminé ✔'))
    .catch(async (err) => {
      console.error('[urls] erreur :', err.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}

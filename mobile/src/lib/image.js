// 5.11 — Images d'événement : 1 Mo maximum. Redimensionnées (1600 px de large) et compressées en JPEG
// sur le téléphone avant l'envoi.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export async function shrinkImage(uri, { maxWidth = 1600, compress = 0.72 } = {}) {
  try {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width: maxWidth });
    const image = await ctx.renderAsync();
    const result = await image.saveAsync({ compress, format: SaveFormat.JPEG });
    return { uri: result.uri, mimeType: 'image/jpeg' };
  } catch {
    return { uri, mimeType: undefined }; // échec du redimensionnement : envoi tel quel (le serveur vérifie 1 Mo)
  }
}

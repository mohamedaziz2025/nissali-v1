// Adhans diffusés par Aladhan / Islamic Network (mêmes fichiers que le lecteur aladhan.com/play).
// L'enregistrement tiré de la « Messe pour la paix » de Karl Jenkins (a3) est volontairement écarté.
const CDN = 'https://cdn.aladhan.com/audio/adhans';

export const ADHANS = [
  { key: 'a9', label: 'Mishary Rashid Alafasy', detail: 'Koweït', url: `${CDN}/a9.mp3` },
  { key: 'a7', label: 'Mishary Rashid Alafasy (2)', detail: 'Koweït', url: `${CDN}/a7.mp3` },
  { key: 'a4', label: 'Mishary Rashid Alafasy (Dubaï One TV)', detail: 'Émirats', url: `${CDN}/a4.mp3` },
  { key: 'a11', label: 'Mansour Al-Zahrani', detail: 'Arabie saoudite', url: `${CDN}/a11-mansour-al-zahrani.mp3` },
  { key: 'a1', label: 'Ahmad al-Nafees', detail: 'Koweït', url: `${CDN}/a1.mp3` },
  { key: 'a2', label: 'Hafiz Mustafa Özcan', detail: 'Turquie', url: `${CDN}/a2.mp3` },
];
export const DEFAULT_ADHAN = 'a9';
export const ADHAN_KEYS = ADHANS.map((a) => a.key);

/** Adhan choisi par l'utilisatrice (null si le son est désactivé). */
export function adhanFor(prefs = {}) {
  if (prefs.adhan === false || prefs.adhanMode === 'notification') return null;
  return ADHANS.find((a) => a.key === prefs.adhanVoice) || ADHANS.find((a) => a.key === DEFAULT_ADHAN);
}

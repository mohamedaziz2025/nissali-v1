// Adhan à l'heure de la prière : enregistrements Aladhan (cdn.aladhan.com), lus avec expo-audio.
// Déclenché par la notification de prière (appli ouverte, ou notification touchée).
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let player = null;
let current = null;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(current));

/** S'abonne à l'adhan en cours ({ prayer, time, label, url } ou null). */
export function onAdhan(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export function stopAdhan() {
  try {
    player?.pause();
    player?.remove();
  } catch {
    // lecteur déjà libéré
  }
  player = null;
  current = null;
  emit();
}

/** Joue l'adhan ({ url, label, prayer, time }). Un seul à la fois. */
export async function playAdhan(adhan) {
  if (!adhan?.url) return;
  stopAdhan();
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'duckOthers' });
  } catch {
    // web : pas de mode audio
  }
  player = createAudioPlayer({ uri: adhan.url });
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) stopAdhan();
  });
  current = adhan;
  emit();
  player.play();
}

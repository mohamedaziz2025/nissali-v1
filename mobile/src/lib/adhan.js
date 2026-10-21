// Adhan à l'heure de la prière : enregistrements fournis avec l'appli, lus avec expo-audio.
// Déclenché par la notification de prière (appli ouverte, ou notification touchée).
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Voix de /prayers/adhans : les mêmes fichiers que les notifications, aucun téléchargement.
const FILES = {
  a9: require('../../assets/sounds/adhan_full.mp3'),
  a7: require('../../assets/sounds/adhan_a7.mp3'),
  a4: require('../../assets/sounds/adhan_a4.mp3'),
  a11: require('../../assets/sounds/adhan_a11.mp3'),
  a1: require('../../assets/sounds/adhan_a1.mp3'),
  a2: require('../../assets/sounds/adhan_a2.mp3'),
};

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

/** Joue l'adhan de la voix choisie ({ key, label, prayer, time }). Un seul à la fois. */
export async function playAdhan(adhan) {
  if (!adhan) return;
  stopAdhan();
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'duckOthers' });
  } catch {
    // web : pas de mode audio
  }
  player = createAudioPlayer(FILES[adhan.key] || FILES.a9);
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) stopAdhan();
  });
  current = adhan;
  emit();
  player.play();
}

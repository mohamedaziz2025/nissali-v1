// Notifications locales (fonctionnent dans Expo Go) : prières, dhikr (matin, soir, vendredi), rappels discrets (RG-17).
// Elles sont reprogrammées à chaque ouverture de l'appli et à chaque saisie des règles,
// pour que la pause pendant les règles (RG-15) soit immédiate.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { tr } from './i18n';
import { addDays } from './format';
import { writeJson } from './storage';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    // Appli ouverte : les messages et annonces s'affichent dans le bandeau de l'appli (InAppNotifier),
    // les rappels (prières, dhikr…) en notification système.
    handleNotification: async (n) => {
      const data = n?.request?.content?.data || {};
      const inApp = data.kind === 'message' || Boolean(data.notificationId);
      const adhan = data.kind === 'prayer' && Boolean(data.adhanVoice); // l'adhan local remplace le son de la notification
      // Test de l'adhan : le son du téléphone est joué même appli ouverte.
      if (data.kind === 'adhanTest') return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
      return { shouldShowBanner: !inApp, shouldShowList: true, shouldPlaySound: !inApp && !adhan, shouldSetBadge: false };
    },
  });
}

const DISCREET = { title: 'Nissali', body: tr("Petit rappel du jour") };

// Adhan joué par le système du téléphone (appli fermée ou téléphone verrouillé) : son de notification intégré
// à l'appli compilée (EAS). En entier sur Android (un canal par voix, volume Alarme), 30 premières secondes
// sur iPhone (limite d'Apple).
// Expo Go n'accepte pas de son personnalisé : la notification y garde le son standard.
export const SYSTEM_ADHAN = Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient';
// Fichiers de assets/sounds, déclarés dans app.json › expo-notifications › sounds (copiés dans l'appli au build).
const ADHAN_SOUNDS = {
  a9: { android: 'adhan_full.mp3', ios: 'adhan_a9_30.caf' },
  a7: { android: 'adhan_a7.mp3', ios: 'adhan_a7_30.caf' },
  a4: { android: 'adhan_a4.mp3', ios: 'adhan_a4_30.caf' },
  a11: { android: 'adhan_a11.mp3', ios: 'adhan_a11_30.caf' },
  a1: { android: 'adhan_a1.mp3', ios: 'adhan_a1_30.caf' },
  a2: { android: 'adhan_a2.mp3', ios: 'adhan_a2_30.caf' },
};
// Voix inconnue (nouvelle voix côté API) : la voix par défaut, jamais le silence.
const voiceOf = (v) => (ADHAN_SOUNDS[v] ? v : 'a9');
const voiceChannel = (v) => `adhan_voix_${voiceOf(v)}`;
// iPhone : « urgente » (Time Sensitive), l'adhan passe aussi en mode Concentration (pas en mode silencieux).
const URGENT = Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' } : {};
// Android : un canal par voix, joué sur le volume « Alarme » (entendu même en mode vibreur). Le son d'un canal
// ne change plus une fois créé : on change d'identifiant en changeant de voix et on supprime les anciens canaux.
const ADHAN_SHORT_CHANNEL = 'adhan_court';
const SILENT_CHANNEL = 'prieres_silencieux';
const isAdhanChannel = (id) => id === 'adhan' || id === 'adhan_alarme' || id.startsWith('adhan_voix_');

async function ensureAdhanChannel(voice) {
  if (Platform.OS !== 'android' || !SYSTEM_ADHAN) return;
  const id = voiceChannel(voice);
  for (const c of await Notifications.getNotificationChannelsAsync().catch(() => [])) {
    if (isAdhanChannel(c.id) && c.id !== id) await Notifications.deleteNotificationChannelAsync(c.id).catch(() => {});
  }
  await Notifications.setNotificationChannelAsync(id, {
    name: 'Adhan',
    description: tr("L’adhan de la voix choisie, à l’heure de la prière"),
    importance: Notifications.AndroidImportance.MAX,
    sound: ADHAN_SOUNDS[voiceOf(voice)].android,
    audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM, contentType: Notifications.AndroidAudioContentType.SONIFICATION },
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

const LABELS = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

export async function ensurePermission() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('rappels', { name: tr("Rappels"), importance: Notifications.AndroidImportance.DEFAULT });
    await Notifications.setNotificationChannelAsync('prieres', { name: tr("Prières"), importance: Notifications.AndroidImportance.HIGH });
    await Notifications.setNotificationChannelAsync('annonces', { name: tr("Annonces et messages"), importance: Notifications.AndroidImportance.HIGH });
    if (SYSTEM_ADHAN) {
      // 4.5 · 4.2 — « Adhan court » : les 29 premières secondes, dans la voix par défaut (Android).
      await Notifications.setNotificationChannelAsync(ADHAN_SHORT_CHANNEL, {
        name: tr("Adhan court"),
        description: tr("Le début de l’adhan à l’heure de la prière"),
        importance: Notifications.AndroidImportance.MAX,
        sound: 'adhan_short.wav',
        audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM, contentType: Notifications.AndroidAudioContentType.SONIFICATION },
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    // « Silencieux » : la notification s'affiche sans son ni vibration.
    await Notifications.setNotificationChannelAsync(SILENT_CHANNEL, { name: tr("Prières (silencieux)"), importance: Notifications.AndroidImportance.LOW, enableVibrate: false });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

const at = (day, time) => {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
};

async function schedule(date, content, channelId = 'rappels') {
  if (date.getTime() <= Date.now() + 30_000) return;
  await Notifications.scheduleNotificationAsync({
    content: { sound: true, ...content },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId },
  });
}

/**
 * Reprogramme toutes les notifications locales à partir de l'état du jour.
 * today : réponse de /today ; user : profil.
 */
export async function rescheduleAll(today, user) {
  if (Platform.OS === 'web' || !today || !user) return;
  if (!(await ensurePermission())) return;
  await Notifications.cancelAllScheduledNotificationsAsync();

  const prefs = user.notificationPrefs || {};
  const prayerPrefs = user.prayerSettings || {};
  const voice = voiceOf(prayerPrefs.adhanVoice);
  await ensureAdhanChannel(voice);

  // Prières (API Aladhan, à la position de l'utilisatrice) : à l'heure de chaque prière, sauf pendant
  // les règles (RG-15) où l'option dhikr la remplace. Rappels de dhikr : matin, soir et vendredi.
  try {
    const range = await api.get(`/prayers/range?days=3`);
    for (const [i, t] of range.days.entries()) {
      const paused = today.prayers.paused && (i === 0 || today.cycle?.kind === 'regles' || today.cycle?.kind === 'nifas');
      if (prayerPrefs.notifications !== false) {
        for (const p of Object.keys(LABELS)) {
          // 4.5 · 4.2 — une ligne par prière : interrupteur + son (adhan complet, adhan court, bip, silencieux).
          if (prayerPrefs.notifyPrayers?.[p] === false) continue;
          const label = LABELS[p];
          const time = t[p];
          const instant = t.instants[p];
          // « Me prévenir » : à l'heure, 10 ou 15 min avant.
          const offset = [10, 15].includes(prayerPrefs.notifyOffset) ? prayerPrefs.notifyOffset : 0;
          const date = new Date(new Date(instant).getTime() - offset * 60_000);
          const when = offset ? tr("dans {0} min", [offset]) : tr("maintenant");
          if (paused) {
            // Pendant les règles : rappels coupés par défaut ; gardés sur demande, sans adhan et avec un texte neutre.
            if (prayerPrefs.keepRemindersDuringPeriod) await schedule(date, { title: 'Nissali', body: tr("Petit rappel") }, SILENT_CHANNEL);
            else if (range.periodDhikr) await schedule(date, { title: 'Nissali', body: range.periodDhikr }, 'prieres');
            continue;
          }
          const adhanFor = Boolean(range.adhan) && (!range.adhan.prayers || range.adhan.prayers.includes(p));
          const sound = prayerPrefs.prayerSound?.[p] || (adhanFor ? 'complet' : 'bip');
          const wantsAdhan = (sound === 'complet' || sound === 'court') && adhanFor;
          const system = wantsAdhan && SYSTEM_ADHAN && !offset;
          const adhan = wantsAdhan && !offset ? range.adhan : null;
          const content = {
            title: `${label} · ${time}`,
            body: offset ? `${label} ${when}` : adhan ? tr("C’est l’heure de {0} · l’adhan retentit", [label]) : tr("C’est l’heure de {0}", [label]),
            ...(system ? { sound: ADHAN_SOUNDS[voice][Platform.OS === 'ios' ? 'ios' : 'android'], ...URGENT } : sound === 'silencieux' ? { sound: false } : {}),
            data: { kind: 'prayer', prayer: p, prayerLabel: label, time, at: instant, ...(adhan ? { adhanVoice: voice, adhanLabel: adhan.label } : {}), ...(system ? { systemAdhan: Platform.OS === 'ios' || sound === 'court' ? 'extrait' : 'complet' } : {}) },
          };
          await schedule(date, content, system ? (sound === 'court' ? ADHAN_SHORT_CHANNEL : voiceChannel(voice)) : sound === 'silencieux' ? SILENT_CHANNEL : 'prieres');
        }
        // Vendredi, mosquée choisie : rappel de la Jumu'a à l'heure publiée par la mosquée.
        if (!paused && t.jumua?.times?.length) {
          for (const [k, time] of t.jumua.times.entries()) {
            await schedule(new Date(t.jumua.instants[k]), { title: `Jumu’a · ${time}`, body: tr("{0} à {1}", [k ? tr("2ᵉ Jumu’a") : tr("Jumu’a"), t.jumua.mosque]) }, 'prieres');
          }
        }
      }
      for (const r of t.reminders || []) await schedule(new Date(r.instant), { title: r.title, body: r.body }, 'prieres');
    }
  } catch {
    // hors connexion : les notifications déjà programmées sont perdues, elles reviendront au retour du réseau
  }

  // 5.7 bis — rappel de dhikr quotidien (facultatif, heure au choix).
  // 4.5 · 4.2 — « Garder le rappel de dhikr » pendant les règles (oui par défaut).
  const dhikrPaused = today.prayers?.paused && prayerPrefs.keepDhikrDuringPeriod === false;
  if (user.dhikr?.reminder && !dhikrPaused) {
    for (let i = 0; i < 3; i += 1) await schedule(at(addDays(today.today, i), user.dhikr.reminderTime || '20:30'), { title: 'Nissali', body: tr("Un moment pour le dhikr"), data: { kind: 'dhikr', link: '/dhikr' } }, 'prieres');
  }

  // 5.2 bis — rappels des notes (RG-35 : aperçu masqué « Rappel Nissali » si elle le souhaite).
  try {
    const notes = await api.get('/notes/reminders');
    const hide = prefs.hideNotePreview;
    for (const n of notes.items || []) {
      await schedule(at(n.day, n.time), hide ? { title: 'Nissali', body: tr("Rappel Nissali"), data: { link: '/notes' } } : { title: tr("Rappel"), body: `${n.text} · ${n.time}`, data: { link: '/notes' } });
    }
  } catch {
    // hors connexion : rappels reprogrammés au retour du réseau
  }

  // 4.2 · 1.4 — prières à accomplir après le ghusl : un rappel 45 min avant le Fajr suivant si elles ne sont pas cochées.
  const pur = today.purification;
  const owed = (pur?.prayers || []).filter((p) => !p.done);
  if (prayerPrefs.purificationReminders !== false && owed.length && today.prayers?.tomorrowFajr) {
    const fajr = at(addDays(today.today, 1), today.prayers.tomorrowFajr);
    await schedule(new Date(fajr.getTime() - 45 * 60_000), { title: 'Nissali', body: tr("Pense à accomplir {0} avant Fajr", [owed.map((p) => p.label).join(' et ')]), data: { link: '/ghusl' } }, 'prieres');
  }

  // Rappels discrets
  if (prefs.dailyReminder !== false) await schedule(at(today.tomorrow, '08:30'), DISCREET);
  if (prefs.periodSoon !== false && today.cycle?.kind === 'prochaines' && today.cycle.nextDate) {
    await schedule(at(addDays(today.cycle.nextDate, -2), '09:00'), DISCREET);
  }
  if (prefs.periodEndQuestion !== false && today.cycle?.kind === 'regles' && !today.cycle.askPeriodEnded) {
    const day = addDays(today.cycle.start, today.cycle.periodLength);
    await schedule(at(day, '10:00'), DISCREET);
  }
  // 5.8 — la veille au soir (21:00 par défaut, pour penser au suhur) : rattrapages et jeûnes volontaires
  // programmés ; jamais pendant les règles prévues (RG-33, jours écartés par le serveur).
  const fastEves = new Set();
  if (prefs.fastMakeup !== false) {
    for (const d of today.fasts?.planNext || (today.fasts?.nextPlanned ? [today.fasts.nextPlanned] : [])) fastEves.add(`${d}|${today.fasts?.reminderTime || '21:00'}`);
  }
  if (prefs.fastPlanned !== false) {
    for (const d of today.fasts?.voluntaryNext || []) if (![...fastEves].some((k) => k.startsWith(`${d}|`))) fastEves.add(`${d}|${today.fasts?.voluntaryReminderTime || '21:00'}`);
  }
  for (const k of fastEves) {
    const [d, time] = k.split('|');
    await schedule(at(addDays(d, -1), time), DISCREET);
  }
  if (prefs.whiteDays !== false && today.whiteDays?.days?.[0]) {
    await schedule(at(addDays(today.whiteDays.days[0].day, -1), '18:00'), DISCREET);
  }
  if (user.contraception?.pillReminder) {
    const time = user.contraception.pillTime || '21:00';
    for (let i = 0; i < 3; i += 1) await schedule(at(addDays(today.today, i), time), DISCREET);
  }
}

/** Les notifications sont-elles autorisées (et avec le son, sur iPhone) ? */
export async function notificationAccess() {
  if (Platform.OS === 'web') return { granted: false, sound: false };
  const p = await Notifications.getPermissionsAsync();
  return { granted: p.granted, canAsk: p.canAskAgain !== false, sound: Platform.OS !== 'ios' || p.ios?.allowsSound !== false };
}

/**
 * Test de l'adhan joué par le téléphone : une notification dans quelques secondes, avec le même son
 * (et la même voix) qu'à l'heure de la prière. Verrouille le téléphone pour l'entendre comme en vrai.
 */
export async function testAdhan(seconds = 10, voice = 'a9') {
  if (!(await ensurePermission())) return { ok: false, reason: 'permission' };
  const v = voiceOf(voice);
  await ensureAdhanChannel(v);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: tr("Test de l’adhan"),
      body: SYSTEM_ADHAN ? tr("Voici l’adhan tel qu’il retentira à l’heure de la prière.") : tr("Dans l’appli installée, l’adhan retentit à la place de ce son."),
      sound: SYSTEM_ADHAN ? ADHAN_SOUNDS[v][Platform.OS === 'ios' ? 'ios' : 'android'] : true,
      ...(SYSTEM_ADHAN ? URGENT : {}),
      data: { kind: 'adhanTest' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: SYSTEM_ADHAN ? voiceChannel(v) : 'prieres' },
  });
  return { ok: true };
}

export async function cancelAll() {
  if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync();
}

// --- Notifications push (envoyées par l'équipe Nissali, messages) ---------------------------------

let registered = null;

/**
 * Enregistre le jeton Expo Push de ce téléphone auprès de Nissali (une fois par session).
 * Dans Expo Go sur Android, les notifications distantes ne sont plus disponibles (SDK 53+) :
 * le bandeau et le centre de notifications de l'appli prennent alors le relais (InAppNotifier).
 */
export async function registerPushToken() {
  if (Platform.OS === 'web') return null;
  if (registered) return registered;
  try {
    if (!(await ensurePermission())) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api.post('/me/push', { token: data });
    registered = data;
    await writeJson('nissali.pushToken', data);
    return data;
  } catch {
    return null;
  }
}

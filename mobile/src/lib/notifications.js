// Notifications locales (fonctionnent dans Expo Go) : prières, dhikr (matin, soir, vendredi), rappels discrets (RG-17).
// Elles sont reprogrammées à chaque ouverture de l'appli et à chaque saisie des règles,
// pour que la pause pendant les règles (RG-15) soit immédiate.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { addDays } from './format';
import { readJson, writeJson } from './storage';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    // Appli ouverte : les messages et annonces s'affichent dans le bandeau de l'appli (InAppNotifier),
    // les rappels (prières, dhikr…) en notification système.
    handleNotification: async (n) => {
      const data = n?.request?.content?.data || {};
      const inApp = data.kind === 'message' || Boolean(data.notificationId);
      const adhan = data.kind === 'prayer' && Boolean(data.adhanUrl); // l'adhan remplace le son de la notification
      // Test de l'adhan : le son du téléphone est joué même appli ouverte.
      if (data.kind === 'adhanTest') return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
      return { shouldShowBanner: !inApp, shouldShowList: true, shouldPlaySound: !inApp && !adhan, shouldSetBadge: false };
    },
  });
}

const DISCREET = { title: 'Nissali', body: 'Petit rappel du jour' };

// Adhan joué par le système du téléphone (appli fermée ou téléphone verrouillé) : son de notification intégré
// à l'appli compilée (EAS). En entier sur Android (canal « Adhan », volume Alarme), 30 premières secondes
// sur iPhone (limite d'Apple).
// Expo Go n'accepte pas de son personnalisé : la notification y garde le son standard.
export const SYSTEM_ADHAN = Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient';
const ADHAN_SOUND = Platform.OS === 'ios' ? 'adhan_ios.caf' : 'adhan_full.mp3';
// iPhone : « urgente » (Time Sensitive), l'adhan passe aussi en mode Concentration (pas en mode silencieux).
const URGENT = Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' } : {};
// Android : canal joué sur le volume « Alarme » (entendu même en mode vibreur). Un canal ne change plus
// une fois créé : nouvel identifiant, l'ancien canal « adhan » (volume des notifications) est supprimé.
const ADHAN_CHANNEL = 'adhan_alarme';
const LABELS = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

export async function ensurePermission() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('rappels', { name: 'Rappels', importance: Notifications.AndroidImportance.DEFAULT });
    await Notifications.setNotificationChannelAsync('prieres', { name: 'Prières', importance: Notifications.AndroidImportance.HIGH });
    await Notifications.setNotificationChannelAsync('annonces', { name: 'Annonces et messages', importance: Notifications.AndroidImportance.HIGH });
    if (SYSTEM_ADHAN) {
      await Notifications.deleteNotificationChannelAsync('adhan').catch(() => {});
      await Notifications.setNotificationChannelAsync(ADHAN_CHANNEL, {
        name: 'Adhan',
        description: 'L’adhan en entier à l’heure de chaque prière, même appli fermée ou téléphone en vibreur',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'adhan_full.mp3',
        audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM, contentType: Notifications.AndroidAudioContentType.SONIFICATION },
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
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

  // Prières (API Aladhan, à la position de l'utilisatrice) : à l'heure de chaque prière, sauf pendant
  // les règles (RG-15) où l'option dhikr la remplace. Rappels de dhikr : matin, soir et vendredi.
  try {
    const range = await api.get(`/prayers/range?days=3`);
    for (const [i, t] of range.days.entries()) {
      const paused = today.prayers.paused && (i === 0 || today.cycle?.kind === 'regles' || today.cycle?.kind === 'nifas');
      if (prayerPrefs.notifications !== false) {
        for (const p of Object.keys(LABELS)) {
          const label = LABELS[p];
          const time = t[p];
          const instant = t.instants[p];
          const date = new Date(instant);
          if (paused) {
            if (range.periodDhikr) await schedule(date, { title: 'Nissali', body: range.periodDhikr }, 'prieres');
          } else {
            // 07 — adhan seulement pour les prières choisies ; jamais pendant une pause des rappels.
            const adhan = range.adhan && (!range.adhan.prayers || range.adhan.prayers.includes(p)) ? range.adhan : null;
            const system = Boolean(adhan) && SYSTEM_ADHAN;
            await schedule(
              date,
              {
                title: `${label} · ${time}`,
                body: adhan ? `C’est l’heure de ${label} · l’adhan retentit` : `C’est l’heure de ${label}`,
                ...(system ? { sound: ADHAN_SOUND, ...URGENT } : {}),
                data: { kind: 'prayer', prayer: p, prayerLabel: label, time, at: instant, ...(adhan ? { adhanUrl: adhan.url, adhanLabel: adhan.label } : {}), ...(system ? { systemAdhan: Platform.OS === 'ios' ? 'extrait' : 'complet' } : {}) },
              },
              system ? ADHAN_CHANNEL : 'prieres',
            );
          }
        }
        // Vendredi, mosquée choisie : rappel de la Jumu'a à l'heure publiée par la mosquée.
        if (!paused && t.jumua?.times?.length) {
          for (const [k, time] of t.jumua.times.entries()) {
            await schedule(new Date(t.jumua.instants[k]), { title: `Jumu’a · ${time}`, body: `${k ? '2ᵉ Jumu’a' : 'Jumu’a'} à ${t.jumua.mosque}` }, 'prieres');
          }
        }
      }
      for (const r of t.reminders || []) await schedule(new Date(r.instant), { title: r.title, body: r.body }, 'prieres');
    }
  } catch {
    // hors connexion : les notifications déjà programmées sont perdues, elles reviendront au retour du réseau
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
  if (prefs.fastMakeup !== false && today.fasts?.nextPlanned) {
    await schedule(at(addDays(today.fasts.nextPlanned, -1), '21:00'), DISCREET);
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
 * qu'à l'heure de la prière. Verrouille le téléphone pour l'entendre comme en vrai.
 */
export async function testAdhan(seconds = 10) {
  if (!(await ensurePermission())) return { ok: false, reason: 'permission' };
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test de l’adhan',
      body: SYSTEM_ADHAN ? 'Voici l’adhan tel qu’il retentira à l’heure de la prière.' : 'Dans l’appli installée, l’adhan retentit à la place de ce son.',
      sound: SYSTEM_ADHAN ? ADHAN_SOUND : true,
      ...(SYSTEM_ADHAN ? URGENT : {}),
      data: { kind: 'adhanTest' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: SYSTEM_ADHAN ? ADHAN_CHANNEL : 'prieres' },
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

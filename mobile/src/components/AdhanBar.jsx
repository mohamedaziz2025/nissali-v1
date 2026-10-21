// Adhan à l'heure de la prière : écoute les notifications de prière et affiche la barre « Adhan en cours ».
// - appli ouverte à l'heure de la prière → l'adhan se lance avec la notification ;
// - notification touchée (appli en arrière-plan ou fermée) → l'appli s'ouvre et l'adhan se lance.
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAdhan, playAdhan, stopAdhan } from '../lib/adhan';
import { openNotification } from '../lib/links';
import { colors, fonts } from '../theme';
import Icon from './Icon';

import { tr } from '../lib/i18n';
const FRESH_MS = 15 * 60_000;
const handled = new Set(); // notifications déjà ouvertes au démarrage // une notification touchée plus de 15 min après l'heure ne relance pas l'adhan

function fromNotification(notification) {
  const data = notification?.request?.content?.data;
  if (data?.kind !== 'prayer' || !data.adhanVoice) return null;
  return { key: data.adhanVoice, label: data.adhanLabel, prayer: data.prayerLabel, time: data.time, at: data.at, system: data.systemAdhan || null };
}

export default function AdhanBar() {
  const insets = useSafeAreaInsets();
  const [adhan, setAdhan] = useState(null);

  useEffect(() => onAdhan(setAdhan), []);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const received = Notifications.addNotificationReceivedListener((n) => {
      const a = fromNotification(n);
      if (a) {
        handled.add(n.request.identifier);
        playAdhan(a);
      }
    });
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => {
      const a = fromNotification(r.notification);
      if (!a) {
        // Annonce, message, rendez-vous, événement… : ouvrir directement la page concernée.
        const data = r.notification?.request?.content?.data || {};
        if (data.link || data.kind === 'message') openNotification({ link: data.link, id: data.notificationId, kind: data.kind, conversation: data.conversation, as: data.as });
        return;
      }
      handled.add(r.notification.request.identifier);
      router.navigate('/');
      if (!a.at || Date.now() - new Date(a.at).getTime() < FRESH_MS) playAdhan(a);
    });
    // Appli lancée en touchant la notification : adhan, ou page de la notification.
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (!r) return;
        const a = fromNotification(r.notification);
        if (a) {
          if (a.at && Date.now() - new Date(a.at).getTime() < FRESH_MS) playAdhan(a);
          return;
        }
        const data = r.notification?.request?.content?.data || {};
        const id = r.notification?.request?.identifier;
        if (id && handled.has(id)) return;
        if (id) handled.add(id);
        if (data.link || data.kind === 'message') setTimeout(() => openNotification({ link: data.link, id: data.notificationId, kind: data.kind, conversation: data.conversation, as: data.as }), 400);
      })
      .catch(() => {});
    // Appli rouverte sans toucher la notification : si l'heure d'une prière vient de sonner (mode adhan),
    // l'adhan se lance automatiquement et la notification est retirée du centre de notifications.
    const resume = async () => {
      try {
        const shown = await Notifications.getPresentedNotificationsAsync();
        const fresh = shown
          .map((n) => ({ n, a: fromNotification(n) }))
          // L'adhan déjà joué par le téléphone (appli compilée) n'est pas relancé à l'ouverture.
          .filter(({ n, a }) => a && !a.system && a.at && Date.now() - new Date(a.at).getTime() < FRESH_MS && !handled.has(n.request.identifier))
          .sort((x, y) => new Date(y.a.at) - new Date(x.a.at))[0];
        if (!fresh) return;
        handled.add(fresh.n.request.identifier);
        playAdhan(fresh.a);
        Notifications.dismissNotificationAsync(fresh.n.request.identifier).catch(() => {});
      } catch {
        // pas de notifications affichées
      }
    };
    resume();
    const appState = AppState.addEventListener('change', (st) => st === 'active' && resume());
    return () => {
      received.remove();
      tapped.remove();
      appState.remove();
    };
  }, []);

  if (!adhan) return null;
  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: insets.bottom + 86 }]}>
      <View style={s.bar} accessibilityLiveRegion="polite">
        <View style={s.icon}>
          <Icon name="bell" size={18} color={colors.or} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>
            {adhan.prayer ? tr("Adhan · {0}{1}", [adhan.prayer, adhan.time ? ` ${adhan.time}` : '']) : tr("Adhan")}
          </Text>
          <Text style={s.sub} numberOfLines={1}>{adhan.label}</Text>
        </View>
        <Pressable onPress={stopAdhan} accessibilityRole="button" accessibilityLabel={tr("Arrêter l’adhan")} style={s.stop} hitSlop={8}>
          <Text style={s.stopText}>{tr("Arrêter")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 520, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.prune, borderRadius: 22, paddingVertical: 12, paddingLeft: 12, paddingRight: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.rose, marginTop: 1 },
  stop: { backgroundColor: colors.or, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  stopText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.prune },
});

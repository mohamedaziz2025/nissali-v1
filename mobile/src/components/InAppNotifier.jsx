// Bandeau de notification dans l'appli ouverte (nouveau message, annonce de l'équipe, rendez-vous…) :
// apparaît en haut de l'écran, se touche pour ouvrir la bonne page. Complète le push (téléphone verrouillé)
// et le relaie quand le push distant n'est pas disponible (Expo Go sur Android).
import * as Notifications from 'expo-notifications';
import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, assetUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { openNotification } from '../lib/links';
import { readJson, writeJson } from '../lib/storage';
import { colors, fonts } from '../theme';
import Icon from './Icon';

const POLL_MS = 15000;
const SEEN_KEY = 'nissali.bannerSeen';
const ICON = { message: 'mail', annonce: 'bell', evenement: 'calendar', reservation: 'calendar' };

export default function InAppNotifier() {
  const { status } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [banner, setBanner] = useState(null);
  const y = useRef(new Animated.Value(-160)).current;
  const seen = useRef(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const hideTimer = useRef(null);

  const hide = useCallback(() => {
    Animated.timing(y, { toValue: -160, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(() => setBanner(null));
  }, [y]);

  const show = useCallback(
    (n) => {
      setBanner(n);
      y.setValue(-160);
      Animated.spring(y, { toValue: 0, useNativeDriver: Platform.OS !== 'web', friction: 8 }).start();
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, 5500);
    },
    [y, hide],
  );

  const check = useCallback(async () => {
    try {
      if (seen.current === null) seen.current = await readJson(SEEN_KEY, null);
      const { items } = await api.get('/notifications');
      const first = seen.current === null;
      const fresh = items.filter((n) => !n.read && (first ? false : new Date(n.createdAt) > new Date(seen.current)));
      seen.current = items[0]?.createdAt && (!seen.current || new Date(items[0].createdAt) > new Date(seen.current)) ? items[0].createdAt : seen.current || new Date().toISOString();
      await writeJson(SEEN_KEY, seen.current);
      // Pas de bandeau pour la conversation déjà ouverte à l'écran.
      const next = fresh.find((n) => !(n.type === 'message' && n.link && pathRef.current && n.link.startsWith(pathRef.current)));
      if (next) show(next);
    } catch {
      // hors connexion
    }
  }, [show]);

  // Push reçu pendant que l'appli est ouverte : bandeau immédiat (sans attendre le prochain tour).
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const data = n?.request?.content?.data || {};
      if (data.kind === 'message' || data.notificationId) setTimeout(check, 300);
    });
    return () => sub.remove();
  }, [check]);

  useEffect(() => {
    if (status !== 'ready') return undefined;
    check();
    let timer = setInterval(check, POLL_MS);
    const sub = AppState.addEventListener('change', (st) => {
      clearInterval(timer);
      if (st === 'active') {
        check();
        timer = setInterval(check, POLL_MS);
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [status, check]);

  if (!banner) return null;
  return (
    <Animated.View style={[s.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          hide();
          openNotification({ link: banner.link, id: banner.id });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${banner.detail || banner.body}. Ouvrir`}
        style={s.card}
      >
        <View style={s.icon}>
          <Icon name={ICON[banner.type] || 'bell'} size={20} color={colors.bordeaux} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{banner.type === 'annonce' && banner.title !== 'Nissali' ? banner.title : banner.type === 'message' ? 'Nouveau message' : 'Nissali'}</Text>
          <Text style={s.body} numberOfLines={2}>{banner.detail || banner.body}</Text>
        </View>
        {banner.imageUrl ? <Image source={{ uri: assetUrl(banner.imageUrl) }} style={s.thumb} /> : null}
        <Pressable onPress={hide} hitSlop={10} accessibilityLabel="Fermer">
          <Icon name="close" size={16} color={colors.muted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 1000, elevation: 20 },
  card: { width: '100%', maxWidth: 520, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, shadowColor: '#3E1220', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12, borderWidth: 1, borderColor: colors.line },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.prune },
  body: { fontFamily: fonts.body, fontSize: 13.5, color: colors.muted, marginTop: 1 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.blush },
});

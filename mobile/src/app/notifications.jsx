// 4.5 · 4.4 — Centre de notifications : historique des 30 derniers jours, groupé Aujourd'hui / Cette semaine /
// Plus ancien. Non lue = carte blanche + point bordeaux ; toucher = ouvre la page concernée et marque comme lue.
// « Tout marquer comme lu ». Les rappels de prière n'y sont pas gardés.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../components/Icon';
import { ErrorState, Loader, Screen, T, useToast } from '../components/ui';
import { api, assetUrl } from '../lib/api';
import { openNotification, routeFor } from '../lib/links';
import { useApi } from '../lib/useApi';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
const ICONS = { message: 'chat', annonce: 'sparkle', evenement: 'calendar', reservation: 'calendar', pro: 'briefcase', ramadan: 'moon', rattrapage: 'moon', jours_blancs: 'moon' };

function group(items) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const out = [
    { key: 'today', label: tr("Aujourd’hui"), items: [] },
    { key: 'week', label: tr("Cette semaine"), items: [] },
    { key: 'older', label: tr("Plus ancien"), items: [] },
  ];
  for (const n of items) {
    const t = new Date(n.createdAt).getTime();
    out[t >= start ? 0 : t >= start - 6 * 86_400_000 ? 1 : 2].items.push(n);
  }
  return out.filter((g) => g.items.length);
}

export default function Notifications() {
  const toast = useToast();
  const { data, setData, loading, error, reload } = useApi('/notifications');
  if (loading && !data) return <Screen back title={tr("Notifications")}><Loader /></Screen>;
  if (error && !data) return <Screen back title={tr("Notifications")}><ErrorState error={error} onRetry={reload} /></Screen>;

  const items = data.items.filter((n) => n.type !== 'priere');
  const markAll = async () => {
    setData((d) => ({ ...d, unread: 0, items: d.items.map((n) => ({ ...n, read: true })) }));
    await api.post('/notifications/read-all').catch((e) => toast(e.message, 'error'));
  };
  const open = (n) => {
    setData((d) => ({ ...d, items: d.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }));
    if (routeFor(n.link) && n.link !== '/notifications') openNotification({ link: n.link, id: n.id, kind: n.type });
    else api.post(`/notifications/${n.id}/read`, {}).catch(() => {});
  };
  const unread = items.filter((n) => !n.read).length;

  return (
    <Screen
      back
      title={tr("Notifications")}
      onRefresh={reload}
      right={
        unread ? (
          <Pressable onPress={markAll} accessibilityRole="button" hitSlop={8}>
            <Text style={s.link}>{tr("Tout marquer comme lu")}</Text>
          </Pressable>
        ) : null
      }
    >
      {items.length ? (
        group(items).map((g) => (
          <View key={g.key} style={{ marginBottom: 18, gap: 10 }}>
            <Text style={s.group}>{g.label}</Text>
            {g.items.map((n) => (
              <Pressable key={n.id} onPress={() => open(n)} accessibilityRole="button" accessibilityLabel={`${n.read ? '' : tr("Non lue. ")}${n.title !== 'Nissali' ? `${n.title}. ` : ''}${n.detail || n.body}`} style={({ pressed }) => [s.card, n.read && s.cardRead, pressed && { opacity: 0.85 }]}>
                <View style={[s.icon, n.read && { backgroundColor: colors.white }]}>
                  <Icon name={ICONS[n.type] || 'bell'} size={17} color={colors.bordeaux} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  {n.type === 'annonce' ? <Text style={s.from}>{tr("De l’équipe Nissali")}</Text> : null}
                  {n.title && n.title !== 'Nissali' && n.title !== 'Nissali Pro' ? <Text style={s.title}>{n.title}</Text> : null}
                  {n.imageUrl ? <Image source={{ uri: assetUrl(n.imageUrl) }} style={s.image} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
                  <Text style={[s.body, !n.read && { fontFamily: fonts.semi }]}>{n.detail || n.body}</Text>
                  <Text style={s.time}>{new Date(n.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                {n.read ? null : <View style={s.dot} />}
              </Pressable>
            ))}
          </View>
        ))
      ) : (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Icon name="bell" size={26} color={colors.bordeaux} />
          </View>
          <Text style={s.emptyText}>{tr("Rien de nouveau pour l’instant")}</Text>
        </View>
      )}
      <T variant="small">{tr("Historique des 30 derniers jours. Sur l’écran verrouillé, nos notifications restent discrètes.")}</T>
    </Screen>
  );
}

const s = StyleSheet.create({
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux, maxWidth: 130, textAlign: 'right' },
  group: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.orText, textTransform: 'uppercase' },
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.line },
  cardRead: { backgroundColor: colors.ivoire, borderColor: colors.ivoire },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  from: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.6, color: colors.orText, textTransform: 'uppercase' },
  title: { fontFamily: fonts.extra, fontSize: 15.5, color: colors.prune },
  body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.prune },
  time: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: colors.blush },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.bordeaux, marginTop: 4 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.bold, fontSize: 16, color: colors.prune },
});

import { useEffect } from 'react';
import { Image } from 'react-native';
import { Card, ErrorState, Gap, Label, Loader, Screen, T } from '../components/ui';
import { api, assetUrl } from '../lib/api';
import { openNotification, routeFor } from '../lib/links';
import { useApi } from '../lib/useApi';
import { colors } from '../theme';


export default function Notifications() {
  const { data, loading, error, reload } = useApi('/notifications');
  useEffect(() => {
    if (data?.unread) api.post('/notifications/read-all').catch(() => {});
  }, [data?.unread]);
  if (loading && !data) return <Screen back title="Notifications"><Loader /></Screen>;
  if (error && !data) return <Screen back title="Notifications"><ErrorState error={error} onRetry={reload} /></Screen>;
  return (
    <Screen back title="Notifications" onRefresh={reload}>
      {data.items.length ? (
        data.items.map((n) => (
          <Card key={n.id} onPress={routeFor(n.link) && n.link !== '/notifications' ? () => openNotification({ link: n.link, id: n.id }) : undefined} style={{ marginBottom: 12, gap: 6, borderLeftWidth: n.read ? 0 : 4, borderLeftColor: colors.bordeaux, overflow: 'hidden' }}>
            {n.type === 'annonce' ? <Label color={colors.or}>De l’équipe Nissali</Label> : n.type === 'message' ? <Label>Message</Label> : null}
            {n.type === 'annonce' && n.title !== 'Nissali' ? <T variant="h3">{n.title}</T> : null}
            {n.imageUrl ? <Image source={{ uri: assetUrl(n.imageUrl) }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: colors.blush }} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
            <T variant={n.type === 'annonce' ? 'body' : 'bold'}>{n.detail || n.body}</T>
            <T variant="small">{new Date(n.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</T>
          </Card>
        ))
      ) : (
        <T variant="muted">Aucune notification pour le moment.</T>
      )}
      <Gap />
      <T variant="small">Sur l’écran verrouillé, nos notifications restent discrètes : « Petit rappel du jour ».</T>
    </Screen>
  );
}

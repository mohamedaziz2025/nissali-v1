// Messagerie : liste des conversations (façon Messenger) — côté utilisatrice, ou côté praticienne (?as=pro).
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../../components/Icon';
import { Avatar, shortWhen } from '../../components/Messaging';
import { Button, Card, ErrorState, Field, Gap, Loader, Screen, T } from '../../components/ui';
import { api } from '../../lib/api';
import { colors, fonts } from '../../theme';

import { tr } from '../../lib/i18n';
export function ConversationList({ as = 'user', embedded = false }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const load = useCallback(() => {
    api
      .get(`/messages/conversations${as === 'pro' ? '?as=pro' : ''}`)
      .then((r) => {
        setItems(r);
        setError(null);
      })
      .catch(setError);
  }, [as]);
  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 8000);
      return () => clearInterval(t);
    }, [load]),
  );
  if (!items && error) return <ErrorState error={error} onRetry={load} />;
  if (!items) return <Loader />;
  const list = items.filter((c) => !q.trim() || c.other.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <View>
      {items.length > 4 ? (
        <>
          <Field value={q} onChangeText={setQ} placeholder={tr("Rechercher")} icon="search" />
          <Gap h={10} />
        </>
      ) : null}
      {list.map((c) => {
        const unread = c.unread > 0;
        return (
          <Pressable key={c.id} onPress={() => router.push(`/messages/${c.id}${as === 'pro' ? '?as=pro' : ''}`)} accessibilityRole="button" accessibilityLabel={`${c.other.name}${(unread ? tr(", {0} message{1} non lu{2}", [c.unread, c.unread > 1 ? 's' : '', c.unread > 1 ? 's' : '']) : '')}`} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.blush }]}>
            <Avatar person={c.other} size={56} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.name, unread && { fontFamily: fonts.bold }]} numberOfLines={1}>{c.other.name}</Text>
                <Text style={[s.when, unread && { color: colors.bordeaux, fontFamily: fonts.bold }]}>{c.last ? shortWhen(c.last.at) : ''}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.preview, unread && { color: colors.prune, fontFamily: fonts.bold }]} numberOfLines={1}>
                  {c.blocked ? tr("Conversation bloquée") : c.last ? `${(c.last.mine ? tr("Vous : ") : '')}${c.last.text}` : tr("Nouvelle conversation")}
                </Text>
                {unread ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{c.unread > 9 ? '9+' : c.unread}</Text>
                  </View>
                ) : null}
              </View>
              {c.other.subtitle ? <Text style={s.subtitle} numberOfLines={1}>{c.other.subtitle}</Text> : null}
            </View>
          </Pressable>
        );
      })}
      {!items.length ? (
        <Card tone="soft" style={{ alignItems: 'center', gap: 8, paddingVertical: 30, marginTop: embedded ? 0 : 8 }}>
          <Icon name="mail" size={28} color={colors.bordeaux} />
          <T variant="bold">{tr("Aucune conversation")}</T>
          <T variant="small" style={{ textAlign: 'center' }}>{as === 'pro' ? tr("Les messages de tes clientes apparaîtront ici.") : tr("Écris à une praticienne depuis sa fiche, avec le bouton « Message ».")}</T>
          {as !== 'pro' ? <Button title={tr("Trouver une praticienne")} small onPress={() => router.push('/praticiennes')} /> : null}
        </Card>
      ) : null}
    </View>
  );
}

export default function Messages() {
  const { as } = useLocalSearchParams();
  return (
    <Screen back title={tr("Messages")}>
      <ConversationList as={as === 'pro' ? 'pro' : 'user'} />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 18 },
  name: { flex: 1, fontFamily: fonts.medium, fontSize: 16.5, color: colors.prune },
  when: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  preview: { flex: 1, fontFamily: fonts.body, fontSize: 14.5, color: colors.muted },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.subtle || colors.muted },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
});

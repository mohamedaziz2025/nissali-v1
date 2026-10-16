// Mes événements : inscriptions à venir et propositions (avec leur statut de validation).
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ErrorState, Gap, Label, Loader, Screen, Segmented, T } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { colors } from '../../theme';
import { EventCard } from '../(tabs)/lifestyle';

const STATUS = { en_attente: 'En attente de validation', modification: 'Modification demandée', refuse: 'Refusé', annule: 'Annulé', publie: 'Publié' };
const TONE = { en_attente: colors.or, modification: colors.bordeaux, refuse: colors.muted, annule: colors.muted, publie: colors.success };

export default function MyEvents() {
  const { data, loading, error, reload } = useApi('/events/mine');
  const [tab, setTab] = useState('inscriptions');
  if (loading && !data) return <Screen back title="Mes événements"><Loader /></Screen>;
  if (error && !data) return <Screen back title="Mes événements"><ErrorState error={error} onRetry={reload} /></Screen>;
  const list = tab === 'inscriptions' ? data.registrations : data.proposed;
  return (
    <Screen back title="Mes événements" onRefresh={reload}>
      <Segmented items={[{ key: 'inscriptions', label: `Inscriptions (${data.registrations.length})` }, { key: 'propositions', label: `Propositions (${data.proposed.length})` }]} value={tab} onChange={setTab} />
      <Gap h={16} />
      {list.map((e) => (
        <View key={e.id}>
          {tab === 'propositions' ? <Label color={TONE[e.status]} style={{ marginBottom: 6 }}>{STATUS[e.status]}</Label> : null}
          <EventCard e={e} />
        </View>
      ))}
      {!list.length ? (
        <Card tone="soft" style={{ alignItems: 'center', gap: 8, paddingVertical: 26 }}>
          <T variant="bold">{tab === 'inscriptions' ? 'Aucune inscription pour le moment' : 'Aucune proposition'}</T>
          <Button title={tab === 'inscriptions' ? 'Voir les événements' : 'Proposer un événement'} small onPress={() => router.push(tab === 'inscriptions' ? '/lifestyle?tab=evenements' : '/evenement/proposer')} />
        </Card>
      ) : null}
    </Screen>
  );
}

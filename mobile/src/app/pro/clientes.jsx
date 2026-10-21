// Fiches clientes (CRM) — incluses dans les formules Essentiel et Premium.
// Aucune donnée de cycle ou de santé Nissali n'y figure.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SpaceSwitch } from '../../components/ProBits';
import { Button, Card, Chips, ErrorState, Field, Gap, Label, Loader, Row, Screen, T } from '../../components/ui';
import { price, shortDate } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

import { tr } from '../../lib/i18n';
const CLIENT_STATUSES = [
  { key: 'nouvelle', label: tr("Nouvelle") },
  { key: 'reguliere', label: tr("Régulière") },
  { key: 'fidele', label: tr("Fidèle") },
  { key: 'inactive', label: tr("Inactive") },
];

export default function Clients() {
  const { data, loading, error, reload } = useApi('/pro/clients');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const list = useMemo(
    () => (data || []).filter((r) => (!status || r.status === status) && (!q || `${r.client?.firstName} ${(r.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))),
    [data, q, status],
  );

  if (loading && !data) return <Screen title={tr("Clientes")}><Loader /></Screen>;
  if (error?.code === 'PLAN_UPGRADE_REQUIRED') {
    return (
      <Screen title={tr("Clientes")} right={<SpaceSwitch />}>
        <Card tone="soft" style={{ gap: 10 }}>
          <T variant="h3">{tr("Fiches clientes")}</T>
          <T>{tr("Historique, notes de séance, documents, suivi : inclus dans les formules Essentiel et Premium.")}</T>
          <Button title={tr("Voir les formules")} onPress={() => router.push('/pro/profil')} />
        </Card>
      </Screen>
    );
  }
  if (error && !data) return <Screen title={tr("Clientes")}><ErrorState error={error} onRetry={reload} /></Screen>;

  const billed = (data || []).reduce((a, r) => a + r.stats.billed, 0);
  return (
    <Screen title={tr("Clientes")} right={<SpaceSwitch />} onRefresh={reload}>
      <Row gap={12}>
        <Card style={{ flex: 1, padding: 16 }}>
          <T variant="small">{tr("Clientes")}</T>
          <T variant="h2">{data.length}</T>
        </Card>
        <Card style={{ flex: 1, padding: 16 }}>
          <T variant="small">{tr("Total facturé")}</T>
          <T variant="h2">{price(billed).replace('Gratuit', '0 €')}</T>
        </Card>
      </Row>
      <Gap />
      <Field value={q} onChangeText={setQ} placeholder={tr("Prénom, étiquette…")} icon="search" />
      <Gap h={10} />
      <Chips items={[{ key: '', label: tr("Toutes") }, ...CLIENT_STATUSES]} value={status} onChange={setStatus} scroll />
      <Gap />
      {list.length ? (
        list.map((r) => (
          <Pressable key={r.id} onPress={() => router.push(`/fiche-cliente/${r.client.id}`)} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{(r.client?.firstName || '?')[0]}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Row gap={8}>
                <T variant="bold">{r.client?.firstName}</T>
                <Label color={colors.or}>{CLIENT_STATUSES.find((x) => x.key === r.status)?.label}</Label>
              </Row>
              <T variant="small">
                {r.stats.visits} {tr("séance")}{r.stats.visits > 1 ? 's' : ''}
                {r.stats.lastVisit ? tr(" · dernière le {0}", [shortDate(r.stats.lastVisit)]) : ''}
              </T>
              {r.stats.nextBooking ? <T variant="small" color={colors.bordeaux}>{tr("Prochain RDV :")} {shortDate(r.stats.nextBooking.day)} à {r.stats.nextBooking.time}</T> : null}
            </View>
            <T variant="medium">{price(r.stats.billed).replace('Gratuit', '0 €')}</T>
          </Pressable>
        ))
      ) : (
        <T variant="muted">{data.length ? tr("Aucune cliente ne correspond.") : tr("Tes clientes apparaissent ici dès leur premier rendez-vous confirmé.")}</T>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: 22, padding: 16, marginBottom: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.title, fontSize: 20, color: colors.bordeaux },
});

// 5.11 — Lifestyle : deux onglets internes, Magazine (articles) et Événements (Nissali + proposés par des sœurs).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../../components/Icon';
import { Card, Chips, ErrorState, Field, Gap, Label, Loader, OfflineBanner, Row, Screen, Segmented, T } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

const SWATCH = { rose: colors.rose, or: colors.or, blush: colors.blush, bordeaux: colors.bordeaux };
const REVIEW = { valide_comite: 'validé par le comité', valide_sante: 'relu par une pro de santé' };
const MONTHS = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];

function ArticleRow({ a }) {
  return (
    <Card onPress={() => router.push(`/blog/${a.slug}`)} accessibilityLabel={a.title} style={{ flexDirection: 'row', gap: 14, padding: 14, marginBottom: 12 }}>
      <View style={[s.swatch, { backgroundColor: SWATCH[a.color] || colors.blush }]} />
      <View style={{ flex: 1, gap: 3 }}>
        <Label>{a.categoryLabel}</Label>
        <T variant="bold" style={{ fontSize: 16.5, lineHeight: 22 }}>{a.title}</T>
        <T variant="small">
          {a.readMinutes} min · {(a.reviewer || REVIEW[a.validation] || '').replace(/^Relu/, 'relu').replace(/^Validé/, 'validé')}
        </T>
      </View>
    </Card>
  );
}

function Magazine() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const cats = useApi('/blog/categories');
  const { data, loading, error, offline, reload } = useApi(`/blog?${new URLSearchParams({ ...(debounced ? { q: debounced } : {}), ...(category ? { category } : {}) })}`);
  const chips = [{ key: '', label: 'Tout' }, ...(cats.data || []).map((c) => ({ key: c.key, label: c.label }))];
  return (
    <>
      <OfflineBanner visible={offline} />
      <Chips items={chips} value={category} onChange={setCategory} scroll />
      <Gap h={12} />
      <Field value={q} onChangeText={setQ} placeholder="Rechercher un article" icon="search" returnKeyType="search" />
      <Gap h={16} />
      {loading && !data ? <Loader /> : null}
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : null}
      {data?.featured ? (
        <Card tone="hero" onPress={() => router.push(`/blog/${data.featured.slug}`)} style={{ gap: 10, paddingVertical: 24, marginBottom: 14 }}>
          <Label color={colors.rose}>À la une · {data.featured.categoryLabel}</Label>
          <T variant="h2" color={colors.white} style={{ fontSize: 26, lineHeight: 32 }}>{data.featured.title}</T>
          <T color={colors.rose}>
            {data.featured.validation === 'valide_comite' ? 'Le guide pas à pas · validé par le comité' : 'Relu par une professionnelle de santé'} · {data.featured.readMinutes} min
          </T>
        </Card>
      ) : null}
      {data?.daily ? (
        <Card tone="soft" onPress={() => router.push(`/blog/${data.daily.article.slug}`)} style={{ gap: 6, marginBottom: 14 }}>
          <Label color={colors.or}>Article du jour · pour ta phase</Label>
          <T variant="h3">{data.daily.article.title}</T>
        </Card>
      ) : null}
      {data?.items?.map((a) => <ArticleRow key={a.id} a={a} />)}
      {data && !data.items.length && !data.featured ? <T variant="muted">Aucun article ne correspond à ta recherche.</T> : null}
      <T variant="small" style={{ marginTop: 6 }}>Chaque article santé est relu par une professionnelle de santé ; chaque article religieux est validé par le comité.</T>
    </>
  );
}

export function DateBlock({ day, muted }) {
  const [, m, d] = day.split('-').map(Number);
  return (
    <View style={[s.dateBlock, muted && { backgroundColor: colors.line }]}>
      <Text style={s.dateDay}>{d}</Text>
      <Text style={s.dateMonth}>{MONTHS[m - 1].replace('.', '')}</Text>
    </View>
  );
}

export function EventCard({ e }) {
  const nissali = e.organizerType === 'nissali';
  return (
    <Card onPress={() => router.push(`/evenement/${e.id}`)} accessibilityLabel={e.title} style={{ flexDirection: 'row', gap: 14, padding: 14, marginBottom: 12, alignItems: 'center' }}>
      <DateBlock day={e.day} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[s.tag, { color: nissali ? colors.bordeaux : colors.or }]}>{nissali ? 'ORGANISÉ PAR NISSALI' : 'PROPOSÉ PAR UNE SŒUR'}</Text>
        <T variant="bold" style={{ fontSize: 16 }} numberOfLines={2}>{e.title}</T>
        <Row justify="space-between" gap={8}>
          <Row gap={4} style={{ flexShrink: 1 }}>
            <Icon name="pin" size={13} color={colors.muted} />
            <T variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>
              {e.location?.city || 'En ligne'}
              {e.distanceKm != null ? ` · ${String(e.distanceKm).replace('.', ',')} km` : ''}
            </T>
          </Row>
          <T variant="bold" style={{ fontSize: 14.5 }}>{e.free ? 'Gratuit' : `${String(e.price).replace('.', ',')} €`}</T>
        </Row>
        {e.registered ? <T variant="small" color={colors.success}>✓ Tu es inscrite</T> : e.placesLeft <= 5 ? <T variant="small" color={colors.bordeaux}>{e.placesLeft ? `Plus que ${e.placesLeft} place${e.placesLeft > 1 ? 's' : ''}` : 'Complet'}</T> : null}
      </View>
    </Card>
  );
}

const FILTERS = [
  { key: 'proche', label: 'Près de moi' },
  { key: 'mois', label: 'Ce mois-ci' },
  { key: 'gratuit', label: 'Gratuit' },
  { key: 'payant', label: 'Payant' },
];

function Events() {
  const [filter, setFilter] = useState('');
  const { data, loading, error, offline, reload } = useApi(`/events${filter ? `?filter=${filter}` : ''}`);
  return (
    <>
      <OfflineBanner visible={offline} />
      <Chips items={FILTERS} value={filter} onChange={(k) => setFilter((f) => (f === k ? '' : k))} scroll />
      <Gap h={14} />
      {loading && !data ? <Loader /> : null}
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : null}
      {data?.items?.map((e) => <EventCard key={e.id} e={e} />)}
      {data && !data.items.length ? (
        <Card tone="soft" style={{ alignItems: 'center', gap: 6, paddingVertical: 24, marginBottom: 12 }}>
          <Icon name="calendar" size={26} color={colors.bordeaux} />
          <T variant="bold">Aucun événement pour le moment</T>
          <T variant="small" style={{ textAlign: 'center' }}>Reviens bientôt, ou propose le tien.</T>
        </Card>
      ) : null}
      <Card tone="soft" style={{ gap: 12 }}>
        <Row gap={12} align="flex-start">
          <View style={s.plus}>
            <Icon name="plus" size={18} color={colors.bordeaux} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="h3">Tu organises un événement ?</T>
            <T variant="small">Propose-le : notre équipe le vérifie avant publication.</T>
          </View>
        </Row>
        <Pressable onPress={() => router.push('/evenement/proposer')} accessibilityRole="button" style={s.cta}>
          <Text style={s.ctaText}>Proposer un événement</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/evenement/mes-evenements')} accessibilityRole="link" style={{ alignSelf: 'center' }} hitSlop={8}>
          <T variant="medium" color={colors.bordeaux}>Mes inscriptions et propositions →</T>
        </Pressable>
      </Card>
    </>
  );
}

export default function Lifestyle() {
  const params = useLocalSearchParams();
  const [tab, setTab] = useState(params.tab === 'evenements' ? 'evenements' : 'magazine');
  useEffect(() => {
    if (params.tab === 'evenements' || params.tab === 'magazine') setTab(params.tab);
  }, [params.tab]);
  return (
    <Screen title="Lifestyle">
      <Segmented
        items={[
          { key: 'magazine', label: 'Magazine' },
          { key: 'evenements', label: 'Événements' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Gap h={16} />
      {tab === 'magazine' ? <Magazine /> : <Events />}
    </Screen>
  );
}

const s = StyleSheet.create({
  swatch: { width: 64, height: 64, borderRadius: 16 },
  dateBlock: { width: 56, height: 62, borderRadius: 16, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontFamily: fonts.title, fontSize: 24, color: colors.bordeaux, lineHeight: 28 },
  dateMonth: { fontFamily: fonts.bold, fontSize: 11, color: colors.bordeaux, letterSpacing: 0.8 },
  tag: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8 },
  plus: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  cta: { backgroundColor: colors.bordeaux, borderRadius: 999, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.bold, color: colors.white, fontSize: 15.5 },
});

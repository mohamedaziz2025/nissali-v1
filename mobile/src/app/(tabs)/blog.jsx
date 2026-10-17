// 5.11 — Blog : catégories, recherche, article à la une, article du jour (maquette, page 9).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chips, ErrorState, Field, Gap, Label, Loader, OfflineBanner, Row, Screen, T } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { colors } from '../../theme';

const SWATCH = { rose: colors.rose, or: colors.or, blush: colors.blush, bordeaux: colors.bordeaux };
const REVIEW = { valide_comite: 'validé par le comité', valide_sante: 'relu par une pro de santé' };

function ArticleRow({ a }) {
  return (
    <Card onPress={() => router.push(`/blog/${a.slug}`)} accessibilityLabel={a.title} style={{ flexDirection: 'row', gap: 16, padding: 16, marginBottom: 14 }}>
      <View style={[s.swatch, { backgroundColor: SWATCH[a.color] || colors.blush }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <Label>{a.categoryLabel}</Label>
        <T variant="bold" style={{ fontSize: 17.5, lineHeight: 23 }}>{a.title}</T>
        <T variant="muted">
          {a.readMinutes} min · {(a.reviewer || REVIEW[a.validation] || '').replace(/^Relu/, 'relu').replace(/^Validé/, 'validé')}
        </T>
      </View>
    </Card>
  );
}

export default function Blog() {
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
    <Screen title="Blog" right={<T variant="muted">Validé par des pros</T>} onRefresh={reload}>
      <OfflineBanner visible={offline} />
      <Field value={q} onChangeText={setQ} placeholder="Rechercher un article" icon="search" returnKeyType="search" />
      <Gap />
      <Chips items={chips} value={category} onChange={setCategory} scroll />
      <Gap h={18} />
      {loading && !data ? <Loader /> : null}
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : null}
      {data?.featured ? (
        <Card tone="hero" onPress={() => router.push(`/blog/${data.featured.slug}`)} style={{ gap: 12, paddingVertical: 26, marginBottom: 14 }}>
          <Label color={colors.rose}>À la une · {data.featured.categoryLabel}</Label>
          <T variant="h2" color={colors.white} style={{ fontSize: 30, lineHeight: 36 }}>{data.featured.title}</T>
          <T color={colors.white}>
            {data.featured.validation === 'valide_comite' ? 'Validé par le comité religieux' : 'Relu par une professionnelle de santé'} · {data.featured.readMinutes} min
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
      <Row style={{ marginTop: 8 }}>
        <T variant="small">Chaque article santé est relu par une professionnelle de santé ; chaque article religieux est validé par le comité.</T>
      </Row>
    </Screen>
  );
}

const s = StyleSheet.create({
  swatch: { width: 84, height: 84, borderRadius: 20 },
});

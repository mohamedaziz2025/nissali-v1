import { router, useLocalSearchParams } from 'expo-router';
import { Share, View } from 'react-native';
import { ArticleImage } from '../../components/ArticleImage';
import Markdown from '../../components/Markdown';
import { Card, ErrorState, Gap, IconButton, Label, Loader, Screen, T } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { colors } from '../../theme';

import { tr } from '../../lib/i18n';
export default function Article() {
  const { slug } = useLocalSearchParams();
  const { data, loading, error, reload } = useApi(`/blog/${slug}`);
  if (loading && !data) return <Screen back><Loader /></Screen>;
  if (error && !data) return <Screen back><ErrorState error={error} onRetry={reload} /></Screen>;
  return (
    <Screen back right={<IconButton name="share" label={tr("Partager")} onPress={() => Share.share({ message: `${data.title} — à lire sur Nissali` })} />}>
      {data.coverUrl ? (
        <View style={{ marginBottom: 18, gap: 6 }}>
          <ArticleImage article={data} variant="cover" />
          {data.coverCredit ? <T variant="small">{data.coverCredit}</T> : null}
        </View>
      ) : null}
      <View style={{ gap: 10 }}>
        <Label>{data.categoryLabel}</Label>
        <T variant="h1" style={{ fontSize: 32, lineHeight: 38 }}>{data.title}</T>
        <T variant="muted">
          {data.readMinutes} {tr("min ·")} {data.reviewer}
        </T>
      </View>
      <Gap h={20} />
      <Markdown source={data.body} />
      {data.sources?.length ? (
        <>
          <Gap h={20} />
          <Card tone="soft" style={{ gap: 6 }}>
            <Label color={colors.or}>{tr("Sources")}</Label>
            {data.sources.map((s) => (
              <T key={s} variant="small">{s}</T>
            ))}
          </Card>
        </>
      ) : null}
      {data.category === 'fiqh' ? (
        <>
          <Gap />
          <T variant="small">{tr("Avis retenu par notre comité. L’appli informe, elle ne délivre jamais de fatwa. En cas de doute, rapproche-toi d’une personne de science.")}</T>
        </>
      ) : null}
      {data.related?.length ? (
        <>
          <Gap h={24} />
          <Label>{tr("À lire aussi")}</Label>
          <Gap h={10} />
          {data.related.map((a) => (
            <Card key={a.id} onPress={() => router.push(`/blog/${a.slug}`)} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <ArticleImage article={a} size={64} />
              <View style={{ flex: 1 }}>
                <T variant="bold">{a.title}</T>
                <T variant="small">{a.readMinutes} {tr("min")}</T>
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

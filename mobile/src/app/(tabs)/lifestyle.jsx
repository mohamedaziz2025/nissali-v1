// 5.11 — Lifestyle : deux onglets internes, Magazine (articles) et Événements (Nissali + proposés par des sœurs).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArticleImage } from '../../components/ArticleImage';
import { BrandBar } from '../../components/Brand';
import Icon from '../../components/Icon';
import { Card, Chips, ErrorState, Field, Gap, Label, Loader, OfflineBanner, Row, Screen, Segmented, T } from '../../components/ui';
import { assetUrl } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

import { tr } from '../../lib/i18n';
const REVIEW = { valide_comite: tr("validé par le comité"), valide_sante: tr("relu par une pro de santé") };
const MONTHS = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];

function ArticleRow({ a }) {
  return (
    <Card onPress={() => router.push(`/blog/${a.slug}`)} accessibilityLabel={a.title} style={{ flexDirection: 'row', gap: 14, padding: 12, marginBottom: 12, alignItems: 'center' }}>
      <ArticleImage article={a} size={84} />
      <View style={{ flex: 1, gap: 3 }}>
        <Label>{a.categoryLabel}</Label>
        <T variant="bold" style={{ fontSize: 16.5, lineHeight: 22 }}>{a.title}</T>
        <T variant="small">
          {a.readMinutes} {tr("min ·")} {(a.reviewer || REVIEW[a.validation] || '').replace(/^Relu/, 'relu').replace(/^Validé/, 'validé')}
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
  const chips = [{ key: '', label: tr("Tout") }, ...(cats.data || []).map((c) => ({ key: c.key, label: c.label }))];
  return (
    <>
      <OfflineBanner visible={offline} />
      <Chips items={chips} value={category} onChange={setCategory} scroll />
      <Gap h={12} />
      <Field value={q} onChangeText={setQ} placeholder={tr("Rechercher un article")} icon="search" returnKeyType="search" />
      <Gap h={16} />
      {loading && !data ? <Loader /> : null}
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : null}
      {data?.featured ? (
        <Card tone="hero" onPress={() => router.push(`/blog/${data.featured.slug}`)} style={{ gap: 10, paddingTop: data.featured.coverUrl ? 12 : 24, paddingBottom: 24, marginBottom: 14 }}>
          {data.featured.coverUrl ? <ArticleImage article={data.featured} variant="cover" radius={18} style={{ marginBottom: 4 }} /> : null}
          <Label color={colors.rose}>{tr("À la une ·")} {data.featured.categoryLabel}</Label>
          <T variant="h2" color={colors.white} style={{ fontSize: 26, lineHeight: 32 }}>{data.featured.title}</T>
          <T color={colors.rose}>
            {data.featured.validation === 'valide_comite' ? tr("Le guide pas à pas · validé par le comité") : tr("Relu par une professionnelle de santé")} · {data.featured.readMinutes} {tr("min")}
          </T>
        </Card>
      ) : null}
      {data?.daily ? (
        <Card tone="soft" onPress={() => router.push(`/blog/${data.daily.article.slug}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, marginBottom: 14 }}>
          <ArticleImage article={data.daily.article} size={72} />
          <View style={{ flex: 1, gap: 4 }}>
            <Label color={colors.or}>{tr("Article du jour · pour ta phase")}</Label>
            <T variant="h3">{data.daily.article.title}</T>
          </View>
        </Card>
      ) : null}
      {data?.items?.map((a) => <ArticleRow key={a.id} a={a} />)}
      {data && !data.items.length && !data.featured ? <T variant="muted">{tr("Aucun article ne correspond à ta recherche.")}</T> : null}
      <T variant="small" style={{ marginTop: 6 }}>{tr("Chaque article santé est relu par une professionnelle de santé ; chaque article religieux est validé par le comité.")}</T>
    </>
  );
}

/** Bannière d'une marque du catalogue : touche-la pour l'ouvrir sur son site (l'achat se fait hors appli). */
function BrandCard({ b }) {
  const open = () => {
    if (!b.websiteUrl) return;
    (Platform.OS === 'web' ? Linking.openURL(b.websiteUrl) : WebBrowser.openBrowserAsync(b.websiteUrl)).catch(() => Linking.openURL(b.websiteUrl));
  };
  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={tr("{0}, voir le site", [b.shopName])} style={({ pressed }) => [s.brandCard, pressed && { opacity: 0.95 }]}>
      <EventImage e={{ imageUrl: b.imageUrl }} />
      <View style={s.brandOverlay} />
      <Text style={s.brandName} numberOfLines={1}>{b.shopName}</Text>
      {b.websiteUrl ? (
        <View style={s.brandBtn}>
          <Text style={s.brandBtnText}>{tr("Voir le site")}</Text>
          <Icon name="external" size={13} color={colors.bordeaux} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** 5.11 — NissaPlace : catalogue des marques (mode, bien-être) qui renvoie vers nissaplace.fr pour l'achat,
 * et demande d'ouverture de boutique pour une sœur qui a sa propre marque. */
function NissaPlace() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const cats = useApi('/nissaplace/categories');
  const { data, loading, error, offline, reload } = useApi(`/nissaplace/brands?${new URLSearchParams({ ...(debounced ? { q: debounced } : {}), ...(category ? { category } : {}) })}`);
  const chips = [{ key: '', label: tr("Tout") }, ...(cats.data?.items || []).map((c) => ({ key: c.key, label: c.label }))];
  return (
    <>
      <OfflineBanner visible={offline} />
      <Card tone="hero" style={{ marginBottom: 14 }}>
        <Row gap={12} align="center">
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="h3" color={colors.white}>{tr("Tu as une marque ?")}</T>
            <T variant="small" color={colors.rose}>{tr("Rejoins NissaPlace et fais-la découvrir à des milliers de sœurs.")}</T>
          </View>
          <Pressable onPress={() => router.push('/nissaplace/rejoindre')} accessibilityRole="button" style={s.joinBtn}>
            <Text style={s.joinBtnText}>{tr("Rejoindre")}</Text>
            <Icon name="external" size={13} color={colors.bordeaux} />
          </Pressable>
        </Row>
      </Card>
      <Card tone="soft" style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <View style={s.plus}>
          <Icon name="briefcase" size={18} color={colors.bordeaux} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="h3">{tr("Le shopping se fait sur nissaplace.fr")}</T>
          <T variant="small">{tr("Découvre les marques ici, puis touche celle qui te plaît : tu seras redirigée vers le site NissaPlace pour acheter.")}</T>
        </View>
      </Card>
      <Field value={q} onChangeText={setQ} placeholder={tr("Rechercher une marque")} icon="search" returnKeyType="search" />
      <Gap h={12} />
      <Chips items={chips} value={category} onChange={setCategory} scroll />
      <Gap h={16} />
      {loading && !data ? <Loader /> : null}
      {error && !data ? <ErrorState error={error} onRetry={reload} /> : null}
      {data?.items?.map((b) => <BrandCard key={b.id} b={b} />)}
      {data && !data.items.length ? <T variant="muted">{tr("Aucune marque pour le moment.")}</T> : null}
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

const euros = (n) => `${String(n).replace('.', ',')} €`;
const placeText = (e) => [e.location?.city || 'En ligne', e.time ? `${e.time.replace(':', 'h')}${e.endTime ? `–${e.endTime.replace(':', 'h')}` : ''}` : null, e.distanceKm != null ? `${String(e.distanceKm).replace('.', ',')} km` : null].filter(Boolean).join(' · ');

/** Image de l'événement, ou dégradé rose et bordeaux si aucune image n'a été ajoutée. */
function EventImage({ e, style }) {
  if (e.imageUrl) return <Image source={{ uri: assetUrl(e.imageUrl) }} style={[StyleSheet.absoluteFill, style]} resizeMode="cover" accessibilityIgnoresInvertColors />;
  return (
    <LinearGradient colors={['#C9566E', colors.bordeaux]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <View style={s.blobA} />
      <View style={s.blobB} />
    </LinearGradient>
  );
}

function DateBadge({ day, small }) {
  const [, m, d] = day.split('-').map(Number);
  return (
    <View style={[s.badge, small && s.badgeSmall]}>
      <Text style={[s.badgeDay, small && { fontSize: 15, lineHeight: 17 }]}>{d}</Text>
      <Text style={[s.badgeMonth, small && { fontSize: 8.5 }]}>{MONTHS[m - 1].replace('.', '')}</Text>
    </View>
  );
}

const Tag = ({ e }) => <Text style={[s.tag, { color: e.organizerType === 'nissali' ? colors.bordeaux : colors.or }]}>{e.organizerType === 'nissali' ? tr("ORGANISÉ PAR NISSALI") : tr("PROPOSÉ PAR UNE SŒUR")}</Text>;

/** Événement mis en avant : grande image, date posée dessus, prix, « Réserver sur Billetweb » (maquette 12). */
function FeaturedEvent({ e }) {
  const open = () => router.push(`/evenement/${e.id}`);
  const book = () => {
    if (!e.ticketUrl) return open();
    (Platform.OS === 'web' ? Linking.openURL(e.ticketUrl) : WebBrowser.openBrowserAsync(e.ticketUrl)).catch(() => Linking.openURL(e.ticketUrl));
  };
  const action = e.free ? (e.registered ? tr("Voir mon inscription") : tr("Je m’inscris")) : e.ticketUrl ? (/billetweb\.fr/i.test(e.ticketUrl) ? tr("Réserver sur Billetweb") : tr("Réserver ma place")) : tr("Billetterie à venir");
  return (
    <View style={s.featured}>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${e.title}, ${e.free ? 'gratuit' : euros(e.price)}`} style={({ pressed }) => pressed && { opacity: 0.95 }}>
      <View style={s.featuredImage}>
        <EventImage e={e} />
        <View style={{ position: 'absolute', top: 12, left: 12 }}>
          <DateBadge day={e.day} />
        </View>
        <View style={s.pricePill}>
          <Text style={s.pricePillText}>{e.free ? tr("Gratuit") : euros(e.price)}</Text>
        </View>
      </View>
      <View style={{ padding: 16, paddingBottom: 12, gap: 6 }}>
        <Tag e={e} />
        <Text style={s.featuredTitle} numberOfLines={2}>{e.title}</Text>
        <Row gap={4}>
          <Icon name="pin" size={13} color={colors.muted} />
          <T variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>{placeText(e)}</T>
        </Row>
        {e.registered ? <T variant="small" color={colors.success}>{tr("✓ Tu es inscrite")}</T> : null}
      </View>
      </Pressable>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Pressable onPress={e.free ? open : book} disabled={!e.free && !e.ticketUrl} accessibilityRole="button" style={({ pressed }) => [s.cta, !e.free && !e.ticketUrl && { backgroundColor: colors.blush }, pressed && { opacity: 0.9 }]}>
          <Row gap={8}>
            <Text style={[s.ctaText, !e.free && !e.ticketUrl && { color: colors.muted }]}>{action}</Text>
            {!e.free && e.ticketUrl ? <Icon name="external" size={15} color={colors.white} /> : null}
          </Row>
        </Pressable>
      </View>
    </View>
  );
}

/** Ligne d'événement : vignette avec la date posée dessus, étiquette, titre, lieu, prix (maquette 12). */
export function EventCard({ e }) {
  return (
    <Pressable onPress={() => router.push(`/evenement/${e.id}`)} accessibilityRole="button" accessibilityLabel={`${e.title}, ${e.free ? 'gratuit' : euros(e.price)}`} style={({ pressed }) => [s.row, pressed && { opacity: 0.9 }]}>
      <View style={s.thumb}>
        <EventImage e={e} />
        <View style={{ position: 'absolute', top: 6, left: 6 }}>
          <DateBadge day={e.day} small />
        </View>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Tag e={e} />
        <Text style={s.rowTitle} numberOfLines={2}>{e.title}</Text>
        <Row justify="space-between" gap={8}>
          <Row gap={4} style={{ flexShrink: 1 }}>
            <Icon name="pin" size={12} color={colors.muted} />
            <T variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>{e.location?.city || tr("En ligne")}{e.distanceKm != null ? tr(" · {0} km", [String(e.distanceKm).replace('.', ',')]) : ''}</T>
          </Row>
          <Text style={s.rowPrice}>{e.free ? tr("Gratuit") : euros(e.price)}</Text>
        </Row>
        {e.registered ? <T variant="small" color={colors.success}>{tr("✓ Tu es inscrite")}</T> : e.placesLeft <= 5 ? <T variant="small" color={colors.bordeaux}>{e.placesLeft ? tr("Plus que {0} place{1}", [e.placesLeft, e.placesLeft > 1 ? 's' : '']) : tr("Complet")}</T> : null}
      </View>
    </Pressable>
  );
}

const FILTERS = [
  { key: 'proche', label: tr("Près de moi") },
  { key: 'mois', label: tr("Ce mois-ci") },
  { key: 'gratuit', label: tr("Gratuit") },
  { key: 'payant', label: tr("Payant") },
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
      {data?.items?.length ? (
        <>
          <FeaturedEvent e={data.items.find((e) => e.organizerType === 'nissali') || data.items[0]} />
          {data.items.filter((e) => e !== (data.items.find((x) => x.organizerType === 'nissali') || data.items[0])).map((e) => <EventCard key={e.id} e={e} />)}
        </>
      ) : null}
      {data && !data.items.length ? (
        <Card tone="soft" style={{ alignItems: 'center', gap: 6, paddingVertical: 24, marginBottom: 12 }}>
          <Icon name="calendar" size={26} color={colors.bordeaux} />
          <T variant="bold">{tr("Aucun événement pour le moment")}</T>
          <T variant="small" style={{ textAlign: 'center' }}>{tr("Reviens bientôt, ou propose le tien.")}</T>
        </Card>
      ) : null}
      <Card tone="soft" style={{ gap: 12 }}>
        <Row gap={12} align="flex-start">
          <View style={s.plus}>
            <Icon name="plus" size={18} color={colors.bordeaux} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="h3">{tr("Tu organises un événement ?")}</T>
            <T variant="small">{tr("Ajoute une image et, s’il est payant, ton lien Billetweb. Notre équipe le vérifie avant publication.")}</T>
          </View>
        </Row>
        <Pressable onPress={() => router.push('/evenement/proposer')} accessibilityRole="button" style={s.cta}>
          <Text style={s.ctaText}>{tr("Proposer un événement")}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/evenement/mes-evenements')} accessibilityRole="link" style={{ alignSelf: 'center' }} hitSlop={8}>
          <T variant="medium" color={colors.bordeaux}>{tr("Mes inscriptions et propositions →")}</T>
        </Pressable>
      </Card>
    </>
  );
}

const LIFESTYLE_TABS = ['magazine', 'evenements', 'nissaplace'];

export default function Lifestyle() {
  const params = useLocalSearchParams();
  const [tab, setTab] = useState(LIFESTYLE_TABS.includes(params.tab) ? params.tab : 'magazine');
  useEffect(() => {
    if (LIFESTYLE_TABS.includes(params.tab)) setTab(params.tab);
  }, [params.tab]);
  return (
    <Screen title={tr("Lifestyle")} top={<BrandBar />}>
      <Segmented
        items={[
          { key: 'evenements', label: tr("Événements") },
          { key: 'nissaplace', label: tr("NissaPlace") },
          { key: 'magazine', label: tr("Magazine") },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Gap h={16} />
      {tab === 'magazine' ? <Magazine /> : tab === 'evenements' ? <Events /> : <NissaPlace />}
    </Screen>
  );
}

const s = StyleSheet.create({
  dateBlock: { width: 56, height: 62, borderRadius: 16, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontFamily: fonts.title, fontSize: 24, color: colors.bordeaux, lineHeight: 28 },
  dateMonth: { fontFamily: fonts.bold, fontSize: 11, color: colors.bordeaux, letterSpacing: 0.8 },
  tag: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8 },
  featured: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: colors.line },
  featuredImage: { height: 170, backgroundColor: colors.blush, overflow: 'hidden' },
  blobA: { position: 'absolute', top: -40, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.12)' },
  blobB: { position: 'absolute', bottom: -30, left: -20, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.1)' },
  featuredTitle: { fontFamily: fonts.title, fontSize: 21, lineHeight: 27, color: colors.prune },
  badge: { width: 44, height: 46, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  badgeSmall: { width: 32, height: 34, borderRadius: 9 },
  badgeDay: { fontFamily: fonts.title, fontSize: 19, lineHeight: 22, color: colors.bordeaux },
  badgeMonth: { fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 0.6, color: colors.bordeaux },
  pricePill: { position: 'absolute', top: 14, right: 14, backgroundColor: colors.bordeaux, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  pricePillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  row: { flexDirection: 'row', gap: 12, padding: 10, marginBottom: 12, alignItems: 'center', backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.line },
  thumb: { width: 84, height: 84, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.blush },
  rowTitle: { fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 20, color: colors.prune },
  rowPrice: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
  plus: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  cta: { backgroundColor: colors.bordeaux, borderRadius: 999, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.bold, color: colors.white, fontSize: 15.5 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  joinBtnText: { fontFamily: fonts.bold, color: colors.bordeaux, fontSize: 14 },
  brandCard: { height: 150, borderRadius: 22, overflow: 'hidden', marginBottom: 14, backgroundColor: colors.blush, justifyContent: 'flex-end', padding: 14 },
  brandOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  brandName: { fontFamily: fonts.title, fontSize: 20, color: colors.white },
  brandBtn: { position: 'absolute', right: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  brandBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux },
});

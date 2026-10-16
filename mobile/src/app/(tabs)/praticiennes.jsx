// 5.10 — Praticiennes. Tant que l'annuaire n'est pas ouvert : liste floutée « Bientôt disponible »
// (maquette du cahier, page 9) et seul l'encart d'inscription professionnelle reste actif.
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from '../../components/Icon';
import { CategoryTile, FeaturedCard, PractitionerCard } from '../../components/Practitioners';
import { Button, Card, Chip, ErrorState, Field, Gap, Label, Loader, Row, Screen, Segmented, Sheet, T, Toggle } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

const AVATAR_COLORS = [colors.blush, '#E6D3BC', colors.blush, colors.rose];

function PractitionerRow({ p, i, onPress, categories }) {
  const label = categories.find((c) => c.key === p.specialty)?.label || p.specialty;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" style={s.row}>
      <View style={[s.avatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>
        <Text style={s.avatarText}>{p.displayName[0]}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Row gap={6}>
          <T variant="bold" style={{ fontSize: 17 }}>{p.displayName}</T>
          {p.verified ? <Icon name="check" size={16} color={colors.success} strokeWidth={2.4} /> : null}
          {p.featured ? <Icon name="star" size={15} color={colors.or} fill={colors.or} /> : null}
        </Row>
        <T variant="muted">
          {label} · {p.city}
        </T>
        {p.reviewsCount ? <T variant="small">★ {p.rating} ({p.reviewsCount} avis)</T> : null}
      </View>
      <View style={s.rdv}>
        <Text style={s.rdvText}>RDV</Text>
      </View>
    </Pressable>
  );
}

function ProCard({ status }) {
  const { practitioner, switchSpace } = useAuth();
  return (
    <Card tone="dashed" style={{ gap: 10 }}>
      <Label color={colors.or}>Vous êtes praticienne ?</Label>
      {practitioner ? (
        <>
          <T>Ton profil professionnel « {practitioner.displayName} » est {practitioner.status === 'validee' ? 'validé' : 'en cours de validation'}.</T>
          <Button title="Accéder à mon espace pro" icon="swap" onPress={() => switchSpace('pro')} />
        </>
      ) : (
        <>
          <T>Inscrivez-vous en tant que professionnelle et choisissez la formule qui vous convient, ou contactez-nous sur</T>
          <Pressable onPress={() => Linking.openURL(`mailto:${status?.contactEmail || 'nissali@gmail.com'}`)} accessibilityRole="link">
            <T variant="bold" color={colors.bordeaux} style={{ fontSize: 18 }}>{status?.contactEmail || 'nissali@gmail.com'}</T>
          </Pressable>
          <Button title="Je m’inscris comme praticienne" onPress={() => router.push('/pro-inscription')} />
        </>
      )}
    </Card>
  );
}

const SORTS = [
  { key: 'distance', label: 'Plus proche', hint: 'de la plus proche à la plus loin' },
  { key: 'alpha', label: 'A → Z', hint: 'par ordre alphabétique' },
  { key: 'recent', label: 'Nouvelles', hint: 'les nouvelles inscrites d’abord' },
];

/** Bouton Ville / Région : ouvre la liste ; une fois choisie, la valeur s'affiche avec une croix pour l'effacer. */
function PlaceButton({ icon, placeholder, value, onPress, onClear }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={value ? `${placeholder} : ${value}` : `Choisir une ${placeholder.toLowerCase()}`} style={({ pressed }) => [s.place, value && s.placeOn, pressed && { opacity: 0.85 }]}>
      <Icon name={icon} size={17} color={value ? colors.bordeaux : colors.muted} />
      <Text style={[s.placeText, value && { color: colors.bordeaux, fontFamily: fonts.bold }]} numberOfLines={1}>{value || placeholder}</Text>
      {value ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Effacer ${placeholder.toLowerCase()}`}>
          <Icon name="close" size={16} color={colors.bordeaux} />
        </Pressable>
      ) : (
        <Icon name="chevronDown" size={16} color={colors.muted} />
      )}
    </Pressable>
  );
}

/** Liste des villes ou des régions où exercent des praticiennes, avec recherche. */
function PlaceSheet({ kind, options, value, onPick, onClose }) {
  const [q, setQ] = useState('');
  useEffect(() => setQ(''), [kind]);
  const norm = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const list = (options || []).filter((o) => !q.trim() || norm(o.name).includes(norm(q.trim())));
  const city = kind === 'city';
  return (
    <Sheet visible={Boolean(kind)} onClose={onClose} title={city ? 'Choisir une ville' : 'Choisir une région'}>
      <Field value={q} onChangeText={setQ} placeholder={city ? 'Rechercher une ville' : 'Rechercher une région'} icon="search" autoCorrect={false} />
      <View style={s.placeList}>
        <Pressable onPress={() => onPick('')} accessibilityRole="radio" accessibilityState={{ checked: !value }} style={s.placeRow}>
          <Text style={[s.placeRowText, !value && { color: colors.bordeaux, fontFamily: fonts.bold }]}>{city ? 'Toutes les villes' : 'Toutes les régions'}</Text>
          {!value ? <Icon name="check" size={18} color={colors.bordeaux} strokeWidth={2.4} /> : null}
        </Pressable>
        {list.map((o) => (
          <Pressable key={o.name} onPress={() => onPick(o.name)} accessibilityRole="radio" accessibilityState={{ checked: value === o.name }} style={s.placeRow}>
            <Text style={[s.placeRowText, value === o.name && { color: colors.bordeaux, fontFamily: fonts.bold }]} numberOfLines={1}>{o.name}</Text>
            <Text style={s.placeCount}>{o.count}</Text>
            {value === o.name ? <Icon name="check" size={18} color={colors.bordeaux} strokeWidth={2.4} /> : null}
          </Pressable>
        ))}
        {!list.length ? <T variant="muted" style={{ paddingVertical: 14 }}>Aucune praticienne dans cette {city ? 'ville' : 'région'} pour le moment.</T> : null}
      </View>
    </Sheet>
  );
}

const SHORT = { dieteticienne: 'Diététicienne' };

export default function Practitioners() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [group, setGroup] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState('distance');
  const [favOnly, setFavOnly] = useState(false);
  const [visio, setVisio] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [picker, setPicker] = useState(null); // 'city' | 'region'
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const status = useApi('/practitioners/status');
  const places = useApi('/practitioners/places');
  const unread = useApi('/messages/unread');
  const query = `/practitioners?${new URLSearchParams({ sort, ...(debounced.length > 1 ? { q: debounced } : {}), ...(group ? { group } : {}), ...(city ? { city } : {}), ...(region ? { region } : {}), ...(visio ? { visio: '1' } : {}) })}`;
  const list = useApi(query);
  const enabled = status.data?.enabled;
  const groups = status.data?.groups || [];
  const categories = status.data?.categories || [];

  if (status.loading && !status.data) return <Screen title="Praticiennes"><Loader /></Screen>;
  if (status.error && !status.data) return <Screen title="Praticiennes"><ErrorState error={status.error} onRetry={status.reload} /></Screen>;

  // Annuaire pas encore ouvert : maquette floutée « Bientôt disponible ».
  if (!enabled) {
    return (
      <Screen title="Praticiennes" right={<T variant="muted">Entre sœurs</T>}>
        <Field value={q} onChangeText={setQ} placeholder="Spécialité ou nom" icon="search" editable={false} />
        <Gap h={18} />
        <View style={{ position: 'relative' }}>
          <View style={{ opacity: 0.55 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {(list.data?.items?.length ? list.data.items : [{ id: 'a', displayName: 'Samira B.', specialty: 'psychologue', city: 'Paris 11e' }, { id: 'b', displayName: 'Khadija M.', specialty: 'hijama', city: 'Lyon' }, { id: 'c', displayName: 'Inès K.', specialty: 'sage_femme', city: 'Créteil' }])
              .slice(0, 3)
              .map((p, i) => (
                <Card key={p.id} style={{ marginBottom: 12, paddingVertical: 10 }}>
                  <PractitionerRow p={p} i={i} categories={categories} />
                </Card>
              ))}
          </View>
          <BlurView intensity={22} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: 'hidden' }]} />
          <View style={s.lockWrap} accessibilityLiveRegion="polite">
            <View style={s.lockPill}>
              <Icon name="lock" size={20} color={colors.white} />
              <Text style={s.lockText}>BIENTÔT DISPONIBLE</Text>
            </View>
            <T variant="medium" style={{ textAlign: 'center', fontSize: 17, lineHeight: 24 }}>Trouve une praticienne et contacte-la en quelques secondes.</T>
          </View>
        </View>
        <Gap h={22} />
        <ProCard status={status.data} />
      </Screen>
    );
  }

  const toggleFav = async (p) => {
    list.setData((d) => ({ ...d, items: d.items.map((x) => (x.id === p.id ? { ...x, favorite: !x.favorite } : x)) }));
    await (p.favorite ? api.delete(`/practitioners/${p.id}/favorite`) : api.post(`/practitioners/${p.id}/favorite`)).catch(() => {});
  };
  const items = (list.data?.items || []).filter((p) => !favOnly || p.favorite);
  const sortInfo = SORTS.find((x) => x.key === sort);
  const unreadCount = unread.data?.user || 0;
  const activeCount = [visio, sort !== 'distance'].filter(Boolean).length;
  const filtering = Boolean(debounced.length > 1 || group || city || region || favOnly || visio);
  const featured = filtering ? [] : [...items].sort((a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating || b.reviewsCount - a.reviewsCount).slice(0, 5);
  const labelOf = (p) => p.specialtyLabel || categories.find((c) => c.key === p.specialty)?.label || p.specialty;
  const open = (p) => router.push(`/praticienne/${p.id}`);
  const tiles = [{ key: '', label: 'Toutes' }, ...groups.map((g) => ({ key: g.key, label: g.label, short: SHORT[g.key] }))];
  const reset = () => {
    setCity('');
    setRegion('');
    setFavOnly(false);
    setVisio(false);
    setSort('distance');
  };

  return (
    <Screen
      title="Praticiennes"
      right={
        <Row gap={10}>
          <Pressable onPress={() => router.push('/messages')} accessibilityRole="button" accessibilityLabel={`Messages${unreadCount ? `, ${unreadCount} non lus` : ''}`} hitSlop={6} style={({ pressed }) => [s.topIcon, pressed && { opacity: 0.8 }]}>
            <Icon name="chat" size={24} color={colors.bordeaux} />
            {unreadCount ? <View style={s.dot}><Text style={s.dotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}
          </Pressable>
          <Pressable onPress={() => router.push('/rendez-vous')} accessibilityRole="button" accessibilityLabel="Mes rendez-vous" hitSlop={6} style={({ pressed }) => [s.topIcon, { backgroundColor: colors.bordeaux }, pressed && { opacity: 0.8 }]}>
            <Icon name="calendar" size={24} color={colors.white} />
          </Pressable>
        </Row>
      }
      onRefresh={() => {
        list.reload();
        unread.reload();
      }}
    >
      <T variant="muted" style={{ marginTop: -10, marginBottom: 14 }}>Santé, bien-être et accompagnement, entre sœurs.</T>
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Field value={q} onChangeText={setQ} placeholder="Nom ou spécialité" icon="search" returnKeyType="search" />
        </View>
        <Pressable onPress={() => setFavOnly((v) => !v)} accessibilityRole="button" accessibilityLabel="Mes favorites" accessibilityState={{ selected: favOnly }} style={[s.filterBtn, favOnly && { backgroundColor: colors.blush, borderColor: colors.rose }]}>
          <Icon name="heart" size={21} color={colors.bordeaux} fill={favOnly ? colors.bordeaux : 'none'} />
        </Pressable>
        <Pressable onPress={() => setFiltersOpen(true)} accessibilityRole="button" accessibilityLabel={`Filtres${activeCount ? `, ${activeCount} actifs` : ''}`} style={[s.filterBtn, activeCount && { backgroundColor: colors.bordeaux }]}>
          <Icon name="sliders" size={20} color={activeCount ? colors.white : colors.bordeaux} />
          {activeCount ? <View style={s.filterCount}><Text style={s.filterCountText}>{activeCount}</Text></View> : null}
        </Pressable>
      </Row>
      <Row gap={10} style={{ marginTop: 10 }}>
        <PlaceButton icon="pin" placeholder="Ville" value={city} onPress={() => setPicker('city')} onClear={() => setCity('')} />
        <PlaceButton icon="locate" placeholder="Région" value={region} onPress={() => setPicker('region')} onClear={() => setRegion('')} />
      </Row>
      <Gap h={14} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 2 }}>
        {tiles.map((t) => (
          <CategoryTile key={t.key || 'all'} item={t} selected={group === t.key} onPress={() => setGroup(t.key)} />
        ))}
      </ScrollView>

      {activeCount ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginTop: 12 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {sort !== 'distance' ? <Chip label={`Tri : ${sortInfo.label} ✕`} selected onPress={() => setSort('distance')} /> : null}
          {visio ? <Chip label="Visio ✕" selected onPress={() => setVisio(false)} /> : null}
        </ScrollView>
      ) : null}

      {featured.length > 1 ? (
        <>
          <Row justify="space-between" style={{ marginTop: 22, marginBottom: 12 }}>
            <T variant="h3" style={{ fontSize: 21 }}>À la une</T>
            <T variant="small">Les mieux notées</T>
          </Row>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingBottom: 14 }}>
            {featured.map((p) => (
              <FeaturedCard key={p.id} p={p} label={labelOf(p)} onPress={() => open(p)} onFav={() => toggleFav(p)} />
            ))}
          </ScrollView>
        </>
      ) : null}

      <Row justify="space-between" style={{ marginTop: 22, marginBottom: 12 }}>
        <T variant="h3" style={{ fontSize: 21 }}>{filtering ? 'Résultats' : 'Toutes les praticiennes'}</T>
        <T variant="small">{items.length}</T>
      </Row>
      {list.loading && !list.data ? (
        <Loader />
      ) : items.length ? (
        items.map((p) => <PractitionerCard key={p.id} p={p} label={labelOf(p)} onPress={() => open(p)} onFav={() => toggleFav(p)} />)
      ) : (
        <Card tone="soft" style={{ alignItems: 'center', gap: 6, paddingVertical: 28 }}>
          <Icon name="search" size={26} color={colors.bordeaux} />
          <T variant="bold">Aucune praticienne trouvée</T>
          <T variant="small" style={{ textAlign: 'center' }}>{favOnly ? 'Ajoute des praticiennes à tes favorites avec le cœur.' : 'Essaie une autre catégorie, ville ou région.'}</T>
          {activeCount || city || region ? <Button title="Réinitialiser les filtres" small variant="soft" onPress={reset} /> : null}
        </Card>
      )}
      <Gap h={18} />
      <ProCard status={status.data} />

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtres"
        footer={
          <Row gap={12}>
            <Pressable onPress={reset} accessibilityRole="button" style={({ pressed }) => [s.resetBtn, pressed && { opacity: 0.8 }]}>
              <Text style={s.resetText} numberOfLines={1}>Réinitialiser</Text>
            </Pressable>
            <Button title={`Voir ${items.length} résultat${items.length > 1 ? 's' : ''}`} onPress={() => setFiltersOpen(false)} style={{ flex: 1 }} />
          </Row>
        }
      >
        <Text style={s.fTitle}>Trier par</Text>
        <Segmented items={SORTS.map((o) => ({ key: o.key, label: o.label }))} value={sort} onChange={setSort} />
        <Toggle label="Consultation en visio" value={visio} onChange={setVisio} />
      </Sheet>
      <PlaceSheet
        kind={picker}
        options={picker === 'city' ? places.data?.cities : places.data?.regions}
        value={picker === 'city' ? city : region}
        onPick={(v) => {
          (picker === 'city' ? setCity : setRegion)(v);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.title, fontSize: 24, color: colors.bordeaux },
  rdv: { backgroundColor: colors.rose, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  rdvText: { fontFamily: fonts.bold, color: colors.bordeaux, fontSize: 14 },
  topIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  filterBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  filterCount: { position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.or, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ivoire },
  filterCountText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white },
  resetBtn: { minHeight: 52, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1.5, borderColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.bordeaux },
  place: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 999, paddingHorizontal: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  placeOn: { backgroundColor: colors.blush, borderColor: colors.rose },
  placeText: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.prune },
  placeList: { backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderBottomWidth: 1, borderBottomColor: colors.line },
  placeRowText: { flex: 1, fontFamily: fonts.medium, fontSize: 15.5, color: colors.prune },
  placeCount: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  fTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune, marginTop: 6 },
  dot: { position: 'absolute', top: -3, right: -3, minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ivoire },
  dotText: { fontFamily: fonts.bold, fontSize: 10, color: colors.white },
  lockWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  lockPill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bordeaux, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 14 },
  lockText: { fontFamily: fonts.bold, color: colors.white, fontSize: 16, letterSpacing: 1.5 },
});

// Annuaire des praticiennes : avatars (photo choisie ou initiales), étoiles, cartes, sélecteurs de créneaux.
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { assetUrl } from '../lib/api';
import { addDays, toDay, DAYS_SHORT as FMT_DAYS_SHORT, MONTHS_SHORT as FMT_MONTHS_SHORT } from '../lib/format';
import { colors, fonts } from '../theme';
import Icon from './Icon';

import { tr } from '../lib/i18n';
const TONES = [
  ['#F7E8EA', '#7A1F35'],
  ['#F3E6D8', '#7D5326'],
  ['#ECE7F3', '#4F3B74'],
  ['#E5F0EA', '#2F6447'],
  ['#E6EEF5', '#2F5272'],
];
const toneOf = (name = '') => TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
const DAYS = FMT_DAYS_SHORT;
const MONTHS = FMT_MONTHS_SHORT;

export const euros = (n) => `${Number(n).toLocaleString('fr-FR')} €`;

/** « Aujourd’hui 14:00 », « Demain 09:00 », « lun. 19 oct. · 10:00 » */
export function nextLabel(next) {
  if (!next) return null;
  const today = toDay(new Date());
  const [y, m, d] = next.day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (next.day === today) return tr("Aujourd’hui · {0}", [next.time]);
  if (next.day === addDays(today, 1)) return tr("Demain · {0}", [next.time]);
  return `${DAYS[date.getUTCDay()]} ${d} ${MONTHS[m - 1]} · ${next.time}`;
}

export function PractitionerAvatar({ p, size = 64, radius }) {
  const [bg, fg] = toneOf(p.displayName);
  const r = radius ?? size / 2;
  if (p.photoUrl) {
    return <Image source={{ uri: assetUrl(p.photoUrl) }} style={{ width: size, height: size, borderRadius: r, backgroundColor: bg }} accessibilityIgnoresInvertColors />;
  }
  const initials = p.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.title, fontSize: size * 0.36, color: fg }}>{initials}</Text>
    </View>
  );
}

export function Stars({ value = 0, size = 14 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={tr("{0} sur 5", [value])}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" size={size} color={colors.or} fill={n <= Math.round(value) ? colors.or : 'none'} strokeWidth={1.6} />
      ))}
    </View>
  );
}

function HeartButton({ active, onPress, light }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={active ? tr("Retirer des favorites") : tr("Ajouter aux favorites")}
      style={[s.heart, light && { backgroundColor: 'rgba(255,255,255,0.92)' }]}
    >
      <Icon name="heart" size={18} color={colors.bordeaux} fill={active ? colors.bordeaux : 'none'} />
    </Pressable>
  );
}

function Tag({ icon, label, tone = 'blush' }) {
  return (
    <View style={[s.tag, tone === 'or' && { backgroundColor: '#F5EADB' }]}>
      {icon ? <Icon name={icon} size={13} color={tone === 'or' ? '#7D5326' : colors.bordeaux} /> : null}
      <Text style={[s.tagText, tone === 'or' && { color: '#7D5326' }]}>{label}</Text>
    </View>
  );
}

/** Grande carte de la section « À la une ». */
export function FeaturedCard({ p, label, onPress, onFav }) {
  const [bg] = toneOf(p.displayName);
  return (
    <View style={{ position: 'relative' }}>
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${p.displayName}, ${label}`} style={({ pressed }) => [s.featured, pressed && { transform: [{ scale: 0.98 }] }]}>
      <View style={[s.featuredTop, { backgroundColor: bg }]}>
        {p.photoUrl ? (
          <Image source={{ uri: assetUrl(p.photoUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[bg, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <PractitionerAvatar p={p} size={84} />
          </LinearGradient>
        )}
        <View style={s.featuredBadges}>
          {p.featured ? <Tag icon="sparkle" label={tr("À la une")} tone="or" /> : null}
        </View>
      </View>
      <View style={{ padding: 14, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.name} numberOfLines={1}>
            {p.displayName}
          </Text>
          {p.verified ? <Icon name="check" size={15} color={colors.success} strokeWidth={2.6} /> : null}
          {p.diplomaVerified ? <DiplomaBadge /> : null}
        </View>
        <Text style={s.meta} numberOfLines={1}>
          {label} · {p.city}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          {p.reviewsCount ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="star" size={14} color={colors.or} fill={colors.or} />
              <Text style={s.rating}>{p.rating.toFixed(1).replace('.', ',')}</Text>
              <Text style={s.meta}>({p.reviewsCount})</Text>
            </View>
          ) : (
            <Text style={s.meta}>{tr("Nouvelle")}</Text>
          )}
          {p.minPrice != null ? <Text style={s.price}>{tr("dès")} {euros(p.minPrice)}</Text> : null}
        </View>
      </View>
    </Pressable>
      <View style={{ position: 'absolute', top: 10, right: 10 }}>
        <HeartButton active={p.favorite} onPress={onFav} light />
      </View>
    </View>
  );
}

/** RG-47 — badge doré « Diplômée » (diplôme fourni et vérifié par l'équipe). */
export function DiplomaBadge() {
  return (
    <View style={s.diploma} accessibilityLabel={tr("Diplômée")}>
      <Text style={s.diplomaText}>{tr("Diplômée")}</Text>
    </View>
  );
}

/** Carte de la liste. */
export function PractitionerCard({ p, label, onPress, onFav }) {
  const next = nextLabel(p.nextAvailable);
  return (
    <View style={{ position: 'relative', marginBottom: 12 }}>
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${p.displayName}, ${label}, ${p.city}`} style={({ pressed }) => [s.card, pressed && { opacity: 0.92 }]}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <PractitionerAvatar p={p} size={76} radius={24} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 34 }}>
            <Text style={s.name} numberOfLines={1}>
              {p.displayName}
            </Text>
            {p.verified ? <Icon name="check" size={15} color={colors.success} strokeWidth={2.6} /> : null}
            {p.diplomaVerified ? <DiplomaBadge /> : null}
          </View>
          <Text style={s.meta} numberOfLines={1}>
            {label} · {p.city}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {p.reviewsCount ? (
              <>
                <Stars value={p.rating} size={13} />
                <Text style={s.meta}>
                  {p.rating.toFixed(1).replace('.', ',')} · {p.reviewsCount} {tr("avis")}
                </Text>
              </>
            ) : (
              <Text style={s.meta}>{tr("Nouvelle sur Nissali")}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {(p.modes || []).includes('cabinet') ? <Tag icon="pin" label={tr("Cabinet")} /> : null}
            {(p.modes || []).includes('visio') && p.supportsVideo ? <Tag icon="video" label={tr("Visio")} /> : null}
            {p.atHome ? <Tag icon="home" label={tr("Domicile")} /> : null}
            {p.featured ? <Tag icon="sparkle" label={tr("À la une")} tone="or" /> : null}
          </View>
        </View>
      </View>
      <View style={s.cardFoot}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <View style={[s.dot, { backgroundColor: next ? colors.success : colors.line }]} />
          <Text style={[s.meta, next && { color: colors.prune }]} numberOfLines={1}>
            {next ? tr("Dispo {0}", [next.toLowerCase()]) : tr("Pas de créneau proche")}
          </Text>
        </View>
        {p.minPrice != null ? <Text style={s.price}>{tr("dès")} {euros(p.minPrice)}</Text> : null}
      </View>
    </Pressable>
      <View style={{ position: 'absolute', top: 12, right: 12 }}>
        <HeartButton active={p.favorite} onPress={onFav} />
      </View>
    </View>
  );
}

/** Bande horizontale de jours disponibles (réservation). */
export function DayStrip({ days, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {days.map(({ day, slots }) => {
        const [y, m, d] = day.split('-').map(Number);
        const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        const on = day === value;
        return (
          <Pressable key={day} onPress={() => onChange(day)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={tr("{0} {1} {2}, {3} créneaux", [DAYS[wd], d, MONTHS[m - 1], slots.length])} style={[s.dayPill, on && s.dayPillOn]}>
            <Text style={[s.dayWd, on && { color: colors.rose }]}>{DAYS[wd]}</Text>
            <Text style={[s.dayNum, on && { color: colors.white }]}>{d}</Text>
            <Text style={[s.dayMonth, on && { color: colors.rose }]}>{MONTHS[m - 1]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function TimeGrid({ slots, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {slots.map((sl) => {
        const on = sl.time === value;
        return (
          <Pressable key={sl.time} onPress={() => onChange(sl.time)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.time, on && s.timeOn]}>
            <Text style={[s.timeText, on && { color: colors.white }]}>{sl.time}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const shadow = { shadowColor: '#3E1220', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 };

const s = StyleSheet.create({
  diploma: { backgroundColor: colors.or, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  diplomaText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white },
  cat: { height: 36, borderRadius: 999, paddingHorizontal: 16, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: '#EAD9DD' },
  catOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  catName: { fontFamily: fonts.medium, fontSize: 14, color: colors.prune, flexShrink: 0 },
  catNameOn: { color: colors.white },
  name: { fontFamily: fonts.bold, fontSize: 17, color: colors.prune, flexShrink: 1 },
  meta: { fontFamily: fonts.body, fontSize: 13.5, color: colors.muted },
  rating: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.prune },
  price: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.bordeaux },
  heart: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  tagText: { fontFamily: fonts.medium, fontSize: 12, color: colors.bordeaux },
  featured: { width: 260, backgroundColor: colors.white, borderRadius: 26, overflow: 'hidden', ...shadow },
  featuredTop: { height: 150, alignItems: 'center', justifyContent: 'center' },
  featuredBadges: { position: 'absolute', left: 12, top: 12 },
  card: { backgroundColor: colors.white, borderRadius: 26, padding: 16, ...shadow },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dayPill: { width: 64, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', gap: 2 },
  dayPillOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  dayWd: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textTransform: 'capitalize' },
  dayNum: { fontFamily: fonts.title, fontSize: 22, color: colors.prune },
  dayMonth: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
  time: { minWidth: 76, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  timeOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  timeText: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
});

// --- Annuaire « ultra moderne » : couvertures photo ou monogramme, cartes vitrines, grille ----------------

const GRADIENTS = [
  ['#7A1F35', '#3E1220'],
  ['#B5566B', '#7A1F35'],
  ['#C49A6C', '#7D5326'],
  ['#8E5A9B', '#4F3B74'],
  ['#4F8A73', '#2F6447'],
  ['#4C7BA3', '#2F5272'],
];
const gradientOf = (name = '') => GRADIENTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length];
const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/** Couverture : la photo choisie par la praticienne, sinon un monogramme sur dégradé avec l'arche Nissali. */
export function PractitionerCover({ p, height = 160, radius = 22, children, initialsSize }) {
  const [a, b] = gradientOf(p.displayName);
  return (
    <View style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: a }}>
      {p.photoUrl ? (
        <Image source={{ uri: assetUrl(p.photoUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Svg width="100%" height="100%" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
            <Path d="M130 220V120a50 50 0 0 1 100 0v100" stroke="rgba(255,255,255,0.12)" strokeWidth="14" fill="none" />
            <Path d="M-30 220V150a40 40 0 0 1 80 0v70" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
            <Circle cx="180" cy="122" r="7" fill="rgba(255,255,255,0.14)" />
          </Svg>
          <Text style={{ fontFamily: fonts.title, fontSize: initialsSize || Math.min(64, height * 0.34), color: 'rgba(255,255,255,0.95)', letterSpacing: 1 }}>{initialsOf(p.displayName)}</Text>
        </LinearGradient>
      )}
      {p.photoUrl ? <LinearGradient colors={['transparent', 'rgba(30,8,15,0.55)']} style={[StyleSheet.absoluteFill, { top: '45%' }]} /> : null}
      {children}
    </View>
  );
}

/** Pastille de catégorie, fine : contour léger, sélection pleine bordeaux. */
export function CategoryTile({ item, selected, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={item.label} hitSlop={{ top: 6, bottom: 6 }} style={({ pressed }) => [s.cat, selected && s.catOn, pressed && { opacity: 0.8 }]}>
      <Text style={[s.catName, selected && s.catNameOn]}>{item.short || item.label}</Text>
    </Pressable>
  );
}

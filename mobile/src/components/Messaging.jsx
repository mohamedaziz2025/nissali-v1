// Éléments communs de la messagerie (liste et conversation), côté utilisatrice et côté praticienne.
import { Image, StyleSheet, Text, View } from 'react-native';
import { assetUrl } from '../lib/api';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
import { DAYS_SHORT as FMT_DAYS_SHORT, MONTHS_SHORT as FMT_MONTHS_SHORT } from '../lib/format';
const TONES = [
  ['#F7E8EA', '#7A1F35'],
  ['#F3E6D6', '#8A6236'],
  ['#E9EEF4', '#3E5470'],
  ['#EAF2EC', '#2F6B45'],
];
const tone = (name = '') => TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];

export function Avatar({ person, size = 48, online }) {
  const [bg, fg] = tone(person?.name);
  const initials = (person?.name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={{ width: size, height: size }}>
      {person?.photoUrl ? (
        <Image source={{ uri: assetUrl(person.photoUrl) }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }} />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.36, color: fg }}>{initials}</Text>
        </View>
      )}
      {online ? <View style={[s.online, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} /> : null}
    </View>
  );
}

const DAYS = FMT_DAYS_SHORT;
const MONTHS = FMT_MONTHS_SHORT;
const pad = (n) => String(n).padStart(2, '0');
export const hhmm = (d) => `${pad(new Date(d).getHours())}:${pad(new Date(d).getMinutes())}`;
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/** Horodatage court de la liste : heure aujourd'hui, « hier », jour de la semaine, puis date. */
export function shortWhen(d) {
  const date = new Date(d);
  const now = new Date();
  if (sameDay(date, now)) return hhmm(date);
  const diff = (now - date) / 86_400_000;
  if (diff < 2 && sameDay(date, new Date(now - 86_400_000))) return 'hier';
  if (diff < 7) return DAYS[date.getDay()];
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Séparateur de jour dans la conversation. */
export function dayLabel(d) {
  const date = new Date(d);
  const now = new Date();
  if (sameDay(date, now)) return tr("Aujourd’hui");
  if (sameDay(date, new Date(now - 86_400_000))) return tr("Hier");
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}${date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : ''}`;
}

export { sameDay };

const s = StyleSheet.create({
  online: { position: 'absolute', right: 0, bottom: 0, backgroundColor: '#3BA55D', borderWidth: 2, borderColor: colors.white },
});

// Champs composés : date, heure, ville (saisie automatique + position GPS).
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View, useWindowDimensions } from 'react-native';
import { api } from '../lib/api';
import { longDate, toDay } from '../lib/format';
import { colors } from '../theme';
import { DatePickerSheet } from './Calendar';
import Icon from './Icon';
import { Chip, Field, Row, T, styles as ui } from './ui';

export function DateField({ label, value, onChange, maxDay = toDay(new Date()), minDay, placeholder = 'Choisir une date', allowClear }) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  return (
    <View style={{ gap: 6 }}>
      {label ? <T variant="fieldLabel">{label}</T> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={ui.field}>
        <Icon name="calendar" size={20} color={colors.muted} />
        <T style={{ flex: 1, color: value ? colors.prune : '#A88C93' }}>{value ? longDate(value, { year: true }) : placeholder}</T>
        {allowClear && value ? (
          <Pressable hitSlop={10} onPress={() => onChange(null)} accessibilityLabel="Effacer">
            <Icon name="close" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </Pressable>
      {open ? <DatePickerSheet visible={open} onClose={() => setOpen(false)} onPick={onChange} value={value} maxDay={maxDay} minDay={minDay} title={label} width={width - 40} /> : null}
    </View>
  );
}

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Heure facultative « HH:MM » (utile pour les prières à accomplir — RG-11). */
export function TimeField({ label, value, onChange, hint, allowUnknown = true }) {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  const update = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    setText(formatted);
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(formatted)) onChange(formatted);
    else if (!formatted) onChange(null);
  };
  return (
    <View style={{ gap: 8 }}>
      <Field label={label} value={text} onChangeText={update} placeholder="HH:MM" keyboardType="number-pad" icon="clock" hint={hint} maxLength={5} />
      <Row gap={8}>
        <Chip label="Maintenant" onPress={() => onChange(nowTime())} />
        {allowUnknown ? <Chip label="Je ne sais pas" selected={!value} onPress={() => onChange(null)} /> : null}
      </Row>
    </View>
  );
}

/** Ville avec saisie automatique (Open-Meteo) ou position actuelle (GPS). */
export function CityPicker({ value, onChange, label = 'Ville' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        setResults(await api.get(`/geo/cities?q=${encodeURIComponent(query.trim())}`));
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const locate = async () => {
    setError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Autorise l’accès à ta position pour l’utiliser.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const city = await api.get(`/geo/reverse?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
      onChange({ ...city, source: 'gps' });
      setQuery('');
      setResults([]);
    } catch (e) {
      setError(e.message || 'Position indisponible');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Field
        label={label}
        value={query}
        onChangeText={setQuery}
        placeholder={value ? `${value.name}${value.country ? `, ${value.country}` : ''}` : 'Rechercher ta ville…'}
        icon="pin"
        autoCorrect={false}
        right={busy ? <ActivityIndicator color={colors.bordeaux} /> : null}
        error={error}
      />
      {value && !query ? (
        <Row gap={8}>
          <Icon name="check" size={18} color={colors.success} />
          <T variant="small" color={colors.prune}>
            {value.name}
            {value.admin ? `, ${value.admin}` : ''}
            {value.country ? ` · ${value.country}` : ''}
          </T>
        </Row>
      ) : null}
      {results.length ? (
        <View style={{ backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 16 }}>
          {results.map((c, i) => (
            <Pressable
              key={`${c.name}-${c.lat}-${i}`}
              accessibilityRole="button"
              onPress={() => {
                onChange({ ...c, source: 'manuel' });
                setQuery('');
                setResults([]);
              }}
              style={{ paddingVertical: 12, borderBottomWidth: i < results.length - 1 ? 1 : 0, borderBottomColor: colors.line }}
            >
              <T variant="medium">{c.name}</T>
              <T variant="small">{[c.admin, c.country].filter(Boolean).join(', ')}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable accessibilityRole="button" onPress={locate} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
        {locating ? <ActivityIndicator color={colors.bordeaux} /> : <Icon name="locate" size={20} color={colors.bordeaux} />}
        <T variant="medium" color={colors.bordeaux}>Utiliser ma position actuelle</T>
      </Pressable>
    </View>
  );
}

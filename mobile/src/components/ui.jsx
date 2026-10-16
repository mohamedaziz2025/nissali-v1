// Composants d'interface Nissali : cartes arrondies, beaucoup d'espace, boutons et puces.
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts, radius, space } from '../theme';
import Icon from './Icon';

// --- Typographie --------------------------------------------------------------

export function T({ style, variant = 'body', color, children, fit, ...props }) {
  const fitProps = fit && Platform.OS !== 'web' ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 } : {};
  return (
    <Text style={[styles[variant], color && { color }, style]} {...fitProps} {...props}>
      {children}
    </Text>
  );
}

/** Étiquette en capitales espacées (« PROCHAINES RÈGLES »). */
export function Label({ children, color = colors.bordeaux, style, numberOfLines }) {
  const text = Array.isArray(children) ? children.join('') : String(children);
  return <Text numberOfLines={numberOfLines} style={[styles.label, { color }, style]}>{text.toUpperCase()}</Text>;
}

// --- Écran --------------------------------------------------------------------

export function Screen({ children, title, right, subtitle, onRefresh, refreshing = false, scroll = true, back, padded = true, footer, contentStyle, scrollRef, top }) {
  const insets = useSafeAreaInsets();
  const header = (title || back) && (
    <View style={styles.header}>
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.back}>
          <Icon name="chevronLeft" size={26} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {subtitle ? <T variant="muted">{subtitle}</T> : null}
        {title ? (
          <T variant="h1" accessibilityRole="header" numberOfLines={2}>
            {title}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[padded && styles.screenPad, { paddingBottom: 32 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.bordeaux} /> : undefined}
    >
      {top}
      {header}
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && styles.screenPad, contentStyle]}>
      {top}
      {header}
      {children}
    </View>
  );
  return (
    <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
      {footer}
    </KeyboardAvoidingView>
  );
}

// --- Cartes -------------------------------------------------------------------

export function Card({ children, style, tone = 'white', onPress, accessibilityLabel }) {
  const toneStyle = tone === 'hero' ? styles.cardHero : tone === 'soft' ? styles.cardSoft : tone === 'dashed' ? styles.cardDashed : styles.cardWhite;
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.card, toneStyle, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, toneStyle, style]}>{children}</View>;
}

export function Row({ children, style, gap = 10, align = 'center', justify }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap, justifyContent: justify }, style]}>{children}</View>;
}

export function Gap({ h = space.gap }) {
  return <View style={{ height: h }} />;
}

// --- Boutons ------------------------------------------------------------------

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style, small, accessibilityLabel }) {
  const v = {
    primary: { bg: colors.bordeaux, fg: colors.white, border: colors.bordeaux },
    outline: { bg: 'transparent', fg: colors.bordeaux, border: colors.bordeaux },
    soft: { bg: colors.blush, fg: colors.bordeaux, border: colors.blush },
    light: { bg: colors.white, fg: colors.bordeaux, border: colors.white },
    ghost: { bg: 'transparent', fg: colors.bordeaux, border: 'transparent' },
    danger: { bg: 'transparent', fg: colors.danger, border: colors.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon ? <Icon name={icon} size={small ? 18 : 20} color={v.fg} /> : null}
      <Text style={[styles.buttonText, small && { fontSize: 15 }, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, color = colors.prune, bg = colors.blush, size = 44 }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
      <Icon name={name} size={size * 0.5} color={color} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon, style, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.chip, selected ? styles.chipOn : styles.chipOff, pressed && { opacity: 0.8 }, style]}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? colors.white : colors.prune} /> : null}
      <Text style={[styles.chipText, { color: selected ? colors.white : colors.prune }]}>{label}</Text>
    </Pressable>
  );
}

export function Chips({ items, value, onChange, multi = false, scroll = false, style }) {
  const isOn = (k) => (multi ? (value || []).includes(k) : value === k);
  const toggle = (k) => {
    if (!multi) return onChange(k);
    const set = new Set(value || []);
    if (set.has(k)) set.delete(k);
    else set.add(k);
    onChange([...set]);
  };
  const content = items.map((it) => <Chip key={String(it.key)} label={it.label} selected={isOn(it.key)} onPress={() => toggle(it.key)} />);
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[{ gap: 10, paddingRight: 20 }, style]}>
        {content}
      </ScrollView>
    );
  }
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, style]}>{content}</View>;
}

// --- Champs -------------------------------------------------------------------

export function Field({ label, error, hint, style, inputStyle, icon, right, ...props }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <T variant="fieldLabel">{label}</T> : null}
      <View style={[styles.field, props.multiline && { borderRadius: 20, alignItems: 'flex-start', paddingVertical: 4 }, error && { borderColor: colors.danger }]}>
        {icon ? <View style={{ flexShrink: 0 }}><Icon name={icon} size={20} color={colors.muted} /></View> : null}
        <TextInput placeholderTextColor="#A88C93" style={[styles.input, inputStyle]} accessibilityLabel={label || props.placeholder} {...props} />
        {right}
      </View>
      {error ? <T variant="small" color={colors.danger}>{error}</T> : hint ? <T variant="small">{hint}</T> : null}
    </View>
  );
}

/** Saisie d'un code OTP à 6 chiffres. */
export function CodeInput({ value, onChange, autoFocus = true }) {
  const ref = useRef(null);
  const digits = (value || '').padEnd(6, ' ').split('');
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Code à 6 chiffres">
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {digits.map((d, i) => (
          <View key={i} style={[styles.codeBox, i === (value || '').length && styles.codeBoxActive]}>
            <Text style={styles.codeDigit}>{d.trim()}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus={autoFocus}
        maxLength={6}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
    </Pressable>
  );
}

export function Checkbox({ checked, onChange, children, style }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={[{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, style]} hitSlop={6}>
      <View style={[styles.checkbox, checked && { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux }]}>{checked ? <Icon name="check" size={16} color={colors.white} strokeWidth={2.4} /> : null}</View>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <T>{children}</T> : children}</View>
    </Pressable>
  );
}

export function Toggle({ label, value, onChange, hint }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <T variant="medium">{label}</T>
        {hint ? <T variant="small">{hint}</T> : null}
      </View>
      <Switch value={Boolean(value)} onValueChange={onChange} trackColor={{ true: colors.bordeaux, false: colors.line }} thumbColor={colors.white} accessibilityLabel={label} />
    </View>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, suffix = '', label }) {
  return (
    <View style={styles.toggleRow}>
      {label ? <T variant="medium" style={{ flex: 1 }}>{label}</T> : null}
      <Row gap={14}>
        <IconButton name="chevronLeft" size={38} label="Diminuer" onPress={() => onChange(Math.max(min, Number((value - step).toFixed(2))))} />
        <T variant="number" style={{ minWidth: 56, textAlign: 'center' }}>
          {value > 0 && suffix === ' min' ? '+' : ''}
          {value}
          {suffix}
        </T>
        <IconButton name="chevronRight" size={38} label="Augmenter" onPress={() => onChange(Math.min(max, Number((value + step).toFixed(2))))} />
      </Row>
    </View>
  );
}

export function Segmented({ items, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.segment, on && { backgroundColor: colors.white }]}>
            <Text style={[styles.segmentText, on && { color: colors.bordeaux, fontFamily: fonts.bold }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Anneau de progression ------------------------------------------------------

export function Ring({ progress = 0, size = 96, stroke = 12, color = colors.rose, track = 'rgba(233,185,193,0.35)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function ProgressBar({ progress, color = colors.rose, track = 'rgba(255,255,255,0.25)', height = 12 }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

// --- États --------------------------------------------------------------------

export function Loader({ label = 'Chargement…' }) {
  return (
    <View style={{ paddingVertical: 60, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.bordeaux} size="large" />
      <T variant="muted">{label}</T>
    </View>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <Card tone="soft" style={{ alignItems: 'center', gap: 12 }}>
      <T variant="h3" style={{ textAlign: 'center' }}>Oups</T>
      <T style={{ textAlign: 'center' }}>{error?.message || 'Une erreur est survenue.'}</T>
      {onRetry ? <Button title="Réessayer" variant="outline" small onPress={onRetry} /> : null}
    </Card>
  );
}

export function OfflineBanner({ visible }) {
  if (!visible) return null;
  return (
    <View style={styles.offline} accessibilityLiveRegion="polite">
      <Icon name="info" size={18} color={colors.prune} />
      <T variant="small" color={colors.prune} style={{ flex: 1 }}>
        Hors connexion : affichage des dernières données. Tes saisies seront synchronisées.
      </T>
    </View>
  );
}

export function Notice({ children, tone = 'soft', icon = 'info', title }) {
  return (
    <Card tone={tone} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <Icon name={icon} size={22} color={tone === 'hero' ? colors.white : colors.or} />
      <View style={{ flex: 1, gap: 4 }}>
        {title ? <Label>{title}</Label> : null}
        {typeof children === 'string' ? <T>{children}</T> : children}
      </View>
    </Card>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 12 }} />;
}

export function ListItem({ title, subtitle, right, onPress, icon, last }) {
  const content = (
    <View style={[styles.listItem, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
      {icon ? <Icon name={icon} size={22} color={colors.bordeaux} /> : null}
      <View style={{ flex: 1 }}>
        <T variant="medium">{title}</T>
        {subtitle ? <T variant="small">{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevronRight" size={20} color={colors.muted} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {content}
    </Pressable>
  );
}

// --- Feuille modale (bas d'écran) -----------------------------------------------

export function Sheet({ visible, onClose, title, children, footer }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 8) }]}>
          <View style={styles.grabber} />
          <Row justify="space-between" style={{ marginBottom: 12 }}>
            <T variant="h2" style={{ flex: 1 }}>{title}</T>
            <IconButton name="close" label="Fermer" onPress={onClose} size={38} />
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ marginTop: 12 }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// --- Messages éphémères -----------------------------------------------------------

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const show = useCallback(
    (text, tone = 'info') => {
      setMessage({ text, tone });
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setMessage(null));
    },
    [opacity],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity, bottom: insets.bottom + 96 }, message.tone === 'error' && { backgroundColor: colors.danger }]} accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>{message.text}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// --- Styles -------------------------------------------------------------------

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivoire },
  screenPad: { paddingHorizontal: space.gutter, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18, marginTop: 8 },
  back: { width: 40, height: 44, justifyContent: 'center', marginLeft: -8 },

  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.prune },
  medium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.prune },
  bold: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.prune },
  muted: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted },
  small: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.prune },
  h1: { fontFamily: fonts.title, fontSize: 36, lineHeight: 42, color: colors.prune, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.title, fontSize: 26, lineHeight: 32, color: colors.prune },
  h3: { fontFamily: fonts.title, fontSize: 21, lineHeight: 27, color: colors.prune },
  hero: { fontFamily: fonts.title, fontSize: 36, lineHeight: 44, color: colors.white, letterSpacing: -0.5 },
  number: { fontFamily: fonts.display, fontSize: 19, color: colors.prune },
  quote: { fontFamily: fonts.italic, fontSize: 19, lineHeight: 27, color: colors.prune },
  label: { fontFamily: fonts.bold, fontSize: 12.5, letterSpacing: 2.2 },

  card: { borderRadius: radius.card, padding: 20 },
  cardWhite: { backgroundColor: colors.white },
  cardHero: { backgroundColor: colors.bordeaux },
  cardSoft: { backgroundColor: colors.blush },
  cardDashed: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.or, borderStyle: 'dashed' },

  button: { minHeight: 54, borderRadius: radius.pill, borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22 },
  buttonSmall: { minHeight: 44, paddingHorizontal: 16 },
  buttonText: { fontFamily: fonts.bold, fontSize: 17 },

  chip: { minHeight: 44, paddingHorizontal: 18, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5 },
  chipOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  chipOff: { backgroundColor: colors.white, borderColor: colors.line },
  chipText: { fontFamily: fonts.medium, fontSize: 15.5 },

  field: { minHeight: 54, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16.5, color: colors.prune, paddingVertical: 12 },
  codeBox: { width: 46, height: 58, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  codeBoxActive: { borderColor: colors.bordeaux },
  codeDigit: { fontFamily: fonts.title, fontSize: 26, color: colors.prune },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.8, borderColor: colors.roseDeep, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  segmented: { flexDirection: 'row', backgroundColor: colors.blush, borderRadius: radius.pill, padding: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },

  offline: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.orSoft, borderRadius: 16, padding: 12, marginBottom: 14 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, minHeight: 56 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(62,18,32,0.35)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.ivoire, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 12 },

  toast: { position: 'absolute', left: 20, right: 20, backgroundColor: colors.prune, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18 },
  toastText: { color: colors.white, fontFamily: fonts.medium, fontSize: 15, textAlign: 'center' },
});

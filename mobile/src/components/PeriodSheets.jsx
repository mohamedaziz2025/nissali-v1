// 4.2 — Le parcours des règles. 1.1 « Tes règles ont commencé ? » : quand (aujourd'hui, hier, autre date ≤ 60 j),
// flux (Moyen par défaut, pas de traces : RG-10), ce qui va se passer. 1.3 « Tes règles sont terminées ? » :
// quand, heure obligatoire (RG-19, RG-22), signe de fin ; puis écran 1.4 Ghusl et prières.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { sendOrQueue } from '../lib/api';
import { addDays, shortDate, toDay } from '../lib/format';
import { colors, fonts } from '../theme';
import { DatePickerSheet } from './Calendar';
import Icon from './Icon';
import { Button, Notice, Sheet, T, useToast } from './ui';

const FLOW_CHOICES = [
  { key: 'leger', label: 'Léger' },
  { key: 'moyen', label: 'Moyen' },
  { key: 'abondant', label: 'Abondant' },
];
const SIGNS = [
  { key: 'secheresse', label: 'Sécheresse complète' },
  { key: 'pertes_blanches', label: 'Pertes blanches' },
];

/** Heure actuelle arrondie au quart d'heure. */
function nowQuarter() {
  const d = new Date();
  const m = Math.round((d.getHours() * 60 + d.getMinutes()) / 15) * 15;
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
const shift = (t, delta) => {
  const [h, m] = t.split(':').map(Number);
  const v = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

function Section({ children }) {
  return <Text style={s.section}>{children}</Text>;
}

/** Aujourd'hui · Hier · Autre date (calendrier). */
function WhenPicker({ value, onChange, minDay, title }) {
  const today = toDay(new Date());
  const yesterday = addDays(today, -1);
  const [open, setOpen] = useState(false);
  const other = value !== today && value !== yesterday;
  const opt = (key, label, sub, onPress, on) => (
    <Pressable key={key} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[s.when, on && s.whenOn]}>
      <Text style={[s.whenLabel, on && { color: colors.white }]}>{label}</Text>
      <Text style={[s.whenSub, on && { color: colors.onBordeaux }]} numberOfLines={1}>{sub}</Text>
    </Pressable>
  );
  return (
    <>
      <View style={s.whenRow}>
        {opt('today', 'Aujourd’hui', shortDate(today), () => onChange(today), value === today)}
        {!minDay || yesterday >= minDay ? opt('yesterday', 'Hier', shortDate(yesterday), () => onChange(yesterday), value === yesterday) : null}
        {opt('other', 'Autre date', other ? shortDate(value) : 'calendrier', () => setOpen(true), other)}
      </View>
      {open ? <DatePickerSheet visible onClose={() => setOpen(false)} onPick={(d) => { onChange(d); setOpen(false); }} value={value} maxDay={today} minDay={minDay} title={title} /> : null}
    </>
  );
}

export function usePeriodActions(onChange) {
  const toast = useToast();
  const [mode, setMode] = useState(null); // start | end | istihada
  const [periodId, setPeriodId] = useState(null);
  const [periodStart, setPeriodStart] = useState(null);
  const [kind, setKind] = useState('hayd');
  const [day, setDay] = useState(toDay(new Date()));
  const [level, setLevel] = useState('moyen');
  const [time, setTime] = useState(nowQuarter());
  const [sign, setSign] = useState('secheresse');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);

  const openStart = (presetDay) => {
    setDay(typeof presetDay === 'string' ? presetDay : toDay(new Date()));
    setLevel('moyen');
    setMode('start');
  };
  const openEnd = (id, k = 'hayd', start = null) => {
    setPeriodId(id);
    setPeriodStart(start);
    setKind(k);
    setDay(toDay(new Date()));
    setTime(nowQuarter());
    setSign('secheresse');
    setMode('end');
  };
  const close = () => setMode(null);

  const start = async () => {
    setBusy(true);
    try {
      const r = await sendOrQueue('POST', '/cycle/periods/start', { day, level });
      toast(r.queued ? 'C’est noté (hors connexion, synchronisé au retour du réseau).' : 'C’est noté');
      setMode(r.data?.warnings?.length ? 'warnings' : null);
      setInfo(r.data?.warnings || null);
      onChange?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!/^\d{2}:\d{2}$/.test(time)) return toast('Indique l’heure de la purification', 'error');
    setBusy(true);
    try {
      const path = kind === 'nifas' ? '/pregnancy/nifas/end' : `/cycle/periods/${periodId}/end`;
      const r = await sendOrQueue('POST', path, { day, time, endSign: sign });
      onChange?.();
      if (r.data?.istihada) {
        setInfo(r.data.istihada);
        setMode('istihada');
      } else {
        setMode(null);
        router.push('/ghusl');
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const sheets = (
    <>
      <Sheet visible={mode === 'start'} onClose={close} title="Tes règles ont commencé ?" footer={<Button title="Confirmer" onPress={start} loading={busy} />}>
        <T variant="muted" style={{ marginTop: -10 }}>Tout se met à jour en un geste.</T>
        <Section>QUAND ?</Section>
        <WhenPicker value={day} onChange={setDay} minDay={addDays(toDay(new Date()), -60)} title="Premier jour" />
        <Section>LE FLUX</Section>
        <View style={s.whenRow}>
          {FLOW_CHOICES.map((f) => (
            <Pressable key={f.key} onPress={() => setLevel(f.key)} accessibilityRole="radio" accessibilityState={{ selected: level === f.key }} style={[s.flow, level === f.key && s.flowOn]}>
              <Text style={[s.whenLabel, level === f.key && { color: colors.white }]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
        <T variant="small">Des traces seules ne comptent pas comme le début des règles.</T>
        <View style={s.box}>
          <Text style={s.boxTitle}>Ce qui va se passer</Text>
          {[
            ['bellOff', 'Tes rappels de prière passent en silence. Les horaires restent affichés.'],
            ['check', 'Aucune prière ne sera comptée comme manquée.'],
            ['clock', 'Tes prochaines règles sont recalculées.'],
          ].map(([icon, text]) => (
            <View key={icon} style={s.boxRow}>
              <Icon name={icon} size={15} color={colors.orText} />
              <Text style={s.boxText}>{text}</Text>
            </View>
          ))}
        </View>
      </Sheet>

      <Sheet visible={mode === 'end'} onClose={close} title={kind === 'nifas' ? 'Ton nifas est terminé ?' : 'Tes règles sont terminées ?'} footer={<Button title="Confirmer" onPress={end} loading={busy} />}>
        <T variant="muted" style={{ marginTop: -10 }}>Dis-nous quand, on s’occupe du reste.</T>
        <Section>QUAND ?</Section>
        <WhenPicker value={day} onChange={setDay} minDay={periodStart || undefined} title="Dernier jour" />
        <Section>À QUELLE HEURE ?</Section>
        <View style={s.timeRow}>
          <Icon name="clock" size={18} color={colors.muted} />
          <Text style={s.timeLabel}>Heure de la purification</Text>
          <Pressable onPress={() => setTime((t) => shift(t, -15))} accessibilityLabel="15 minutes plus tôt" hitSlop={6} style={s.step}>
            <Icon name="chevronLeft" size={16} color={colors.bordeaux} />
          </Pressable>
          <TextInput value={time} onChangeText={(v) => { const d = v.replace(/\D/g, '').slice(0, 4); setTime(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d); }} keyboardType="number-pad" maxLength={5} style={s.timeValue} accessibilityLabel="Heure de la purification" />
          <Pressable onPress={() => setTime((t) => shift(t, 15))} accessibilityLabel="15 minutes plus tard" hitSlop={6} style={s.step}>
            <Icon name="chevronRight" size={16} color={colors.bordeaux} />
          </Pressable>
        </View>
        <T variant="small">L’heure sert à savoir quelles prières accomplir après le ghusl.</T>
        <Section>SIGNE DE FIN</Section>
        <View style={s.whenRow}>
          {SIGNS.map((g) => (
            <Pressable key={g.key} onPress={() => setSign(g.key)} accessibilityRole="radio" accessibilityState={{ selected: sign === g.key }} style={[s.flow, sign === g.key && s.signOn]}>
              <Text style={[s.whenLabel, { fontSize: 13 }, sign === g.key && { color: colors.white }]}>{g.label}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet visible={mode === 'istihada'} onClose={() => { close(); router.push('/ghusl'); }} title="À savoir" footer={<Button title="Continuer" onPress={() => { close(); router.push('/ghusl'); }} />}>
        <Notice title="Istihada">{info}</Notice>
        <T variant="small">En cas de doute, rapproche-toi d’une personne de science.</T>
      </Sheet>

      <Sheet visible={mode === 'warnings'} onClose={close} title="À savoir" footer={<Button title="Compris" onPress={close} />}>
        {(Array.isArray(info) ? info : []).map((w) => (
          <Notice key={w.key}>{w.text}</Notice>
        ))}
      </Sheet>
    </>
  );

  return { openStart, openEnd, sheets };
}

const s = StyleSheet.create({
  section: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.orText, marginTop: 4 },
  whenRow: { flexDirection: 'row', gap: 8 },
  when: { flex: 1, minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: colors.lineField, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  whenOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  whenLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
  whenSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  flow: { flex: 1, minHeight: 48, borderRadius: 999, borderWidth: 1, borderColor: colors.lineField, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  flowOn: { backgroundColor: colors.prune, borderColor: colors.prune },
  signOn: { backgroundColor: colors.prune, borderColor: colors.prune },
  box: { backgroundColor: colors.sable, borderRadius: 16, padding: 14, gap: 8 },
  boxTitle: { fontFamily: fonts.extra, fontSize: 14, color: colors.prune },
  boxRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  boxText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.prune },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.lineField, paddingHorizontal: 14, minHeight: 56 },
  timeLabel: { flex: 1, fontFamily: fonts.semi, fontSize: 14, color: colors.prune },
  timeValue: { fontFamily: fonts.extra, fontSize: 20, color: colors.bordeaux, minWidth: 66, textAlign: 'center', fontVariant: ['tabular-nums'] },
  step: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
});

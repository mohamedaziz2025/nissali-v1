// Mise à jour Cycle · 1.1 et 1.3 — « Tes règles ont commencé ? » : calendrier du mois dans la feuille (lundi en
// premier, aujourd'hui par défaut, jours futurs grisés, jusqu'à 60 jours en arrière), flux en gouttes de sang
// (1 = Léger, 2 = Moyen par défaut, 3 = Abondant ; pas de traces : RG-10), encart sur une ligne.
// « Tes règles sont terminées ? » : même calendrier (de J1 à aujourd'hui), heure obligatoire avec le sélecteur
// natif (RG-19, RG-22), signe de fin ; puis écran 1.4 Ghusl et prières.
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { sendOrQueue } from '../lib/api';
import { addDays, monthLabel, shiftMonth, toDay, DAYS_SHORT as FMT_DAYS_SHORT, MONTHS_LONG as FMT_MONTHS_LONG, WEEKDAYS_SHORT as FMT_WEEKDAYS_SHORT } from '../lib/format';
import { colors, fonts } from '../theme';
import { monthGrid } from './Calendar';
import { BloodDrops } from './Flow';
import Icon from './Icon';
import { Button, Notice, Sheet, T, useToast } from './ui';

import { tr } from '../lib/i18n';
const FLOW_CHOICES = [
  { key: 'leger', label: tr("Léger"), drops: 1 },
  { key: 'moyen', label: tr("Moyen"), drops: 2 },
  { key: 'abondant', label: tr("Abondant"), drops: 3 },
];
const LETTERS = FMT_WEEKDAYS_SHORT;
const DAYS_SHORT = FMT_DAYS_SHORT;
const MONTHS = FMT_MONTHS_LONG;
const SIGNS = [
  { key: 'secheresse', label: tr("Sécheresse complète") },
  { key: 'pertes_blanches', label: tr("Pertes blanches") },
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

/** « Aujourd’hui · mer. 28 octobre », « Hier · … » ou la date. */
function recap(day) {
  const today = toDay(new Date());
  const d = new Date(`${day}T12:00:00Z`);
  const label = `${DAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return day === today ? tr("Aujourd’hui · {0}", [label]) : day === addDays(today, -1) ? tr("Hier · {0}", [label]) : label.charAt(0).toUpperCase() + label.slice(1);
}

/** Calendrier du mois dans la feuille : jours hors [minDay, aujourd'hui] grisés et non cliquables. */
function SheetCalendar({ value, onChange, minDay }) {
  const today = toDay(new Date());
  const [month, setMonth] = useState(value.slice(0, 7));
  const prevOk = !minDay || shiftMonth(month, -1) >= minDay.slice(0, 7);
  const nextOk = month < today.slice(0, 7);
  return (
    <View style={{ gap: 6 }}>
      <View style={s.calHead}>
        <Text style={s.section}>{tr("QUAND ?")}</Text>
        <View style={s.monthNav}>
          <Pressable onPress={() => prevOk && setMonth(shiftMonth(month, -1))} disabled={!prevOk} accessibilityRole="button" accessibilityLabel={tr("Mois précédent")} hitSlop={8} style={[s.arrow, !prevOk && { opacity: 0.35 }]}>
            <Icon name="chevronLeft" size={15} color={colors.prune} />
          </Pressable>
          <Text style={s.monthTitle}>{monthLabel(month)}</Text>
          <Pressable onPress={() => nextOk && setMonth(shiftMonth(month, 1))} disabled={!nextOk} accessibilityRole="button" accessibilityLabel={tr("Mois suivant")} hitSlop={8} style={[s.arrow, !nextOk && { opacity: 0.35 }]}>
            <Icon name="chevronRight" size={15} color={colors.prune} />
          </Pressable>
        </View>
      </View>
      <View style={s.grid}>
        {LETTERS.map((l, i) => (
          <Text key={`l${i}`} style={s.letter}>{l}</Text>
        ))}
        {monthGrid(month).map((d, i) => {
          if (!d) return <View key={`e${i}`} style={s.cell} />;
          const off = d > today || (minDay && d < minDay);
          const on = d === value;
          return (
            <Pressable key={d} disabled={off} onPress={() => onChange(d)} accessibilityRole="button" accessibilityState={{ selected: on, disabled: off }} accessibilityLabel={recap(d)} style={s.cell}>
              <View style={[s.dayDot, on && s.dayOn, !on && d === today && s.dayToday]}>
                <Text style={[s.dayNum, on && { color: colors.white, fontFamily: fonts.extra }, off && { color: colors.caseVide }]}>{Number(d.slice(8))}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.recap}>{recap(value)}</Text>
    </View>
  );
}

/** Heure : sélecteur natif (roue iOS / horloge Android) ; repli − / + par 15 min sur le web. */
function TimePickerRow({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [h, m] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  const set = (d) => d && onChange(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  if (Platform.OS === 'web') {
    return (
      <View style={s.timeRow}>
        <Icon name="clock" size={18} color={colors.muted} />
        <Text style={s.timeLabel}>{tr("Heure de la purification")}</Text>
        <Pressable onPress={() => onChange(shift(value, -15))} accessibilityLabel={tr("15 minutes plus tôt")} hitSlop={6} style={s.step}>
          <Icon name="chevronLeft" size={16} color={colors.bordeaux} />
        </Pressable>
        <Text style={s.timeValue}>{value}</Text>
        <Pressable onPress={() => onChange(shift(value, 15))} accessibilityLabel={tr("15 minutes plus tard")} hitSlop={6} style={s.step}>
          <Icon name="chevronRight" size={16} color={colors.bordeaux} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={tr("Heure de la purification : {0}. Modifier", [value])} style={s.timeRow}>
        <Icon name="clock" size={18} color={colors.muted} />
        <Text style={s.timeLabel}>{tr("Heure de la purification")}</Text>
        <Text style={s.timeValue}>{value}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={date}
          mode="time"
          is24Hour
          minuteInterval={Platform.OS === 'ios' ? 15 : undefined}
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onValueChange={(_e, d) => {
            set(d);
            if (Platform.OS === 'android') setOpen(false);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </View>
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
      toast(r.queued ? tr("C’est noté (hors connexion, synchronisé au retour du réseau).") : tr("C’est noté"));
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
    if (!/^\d{2}:\d{2}$/.test(time)) return toast(tr("Indique l’heure de la purification"), 'error');
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
      <Sheet visible={mode === 'start'} onClose={close} title={tr("Tes règles ont commencé ?")} footer={<Button title={tr("Confirmer")} onPress={start} loading={busy} />}>
        <SheetCalendar key={`start-${mode}`} value={day} onChange={setDay} minDay={addDays(toDay(new Date()), -60)} />
        <Section>{tr("LE FLUX")}</Section>
        <View style={s.whenRow}>
          {FLOW_CHOICES.map((f) => {
            const on = level === f.key;
            return (
              <Pressable key={f.key} onPress={() => setLevel(f.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={tr("Flux {0}", [f.label])} style={[s.flow, on && s.flowOn]}>
                <BloodDrops count={f.drops} color={on ? colors.white : colors.bordeaux} size={13} />
                <Text style={[s.flowLabel, on && { color: colors.white }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <T variant="small">{tr("Des traces seules ne comptent pas comme le début des règles.")}</T>
        <View style={s.box}>
          <Icon name="bellOff" size={15} color={colors.orText} />
          <Text style={s.boxText}>{tr("Rappels de prière en silence (horaires toujours affichés), aucune prière comptée comme manquée, prévisions recalculées.")}</Text>
        </View>
      </Sheet>

      <Sheet visible={mode === 'end'} onClose={close} title={kind === 'nifas' ? tr("Ton nifas est terminé ?") : tr("Tes règles sont terminées ?")} footer={<Button title={tr("Confirmer")} onPress={end} loading={busy} />}>
        <SheetCalendar key={`end-${mode}`} value={day} onChange={setDay} minDay={periodStart || undefined} />
        <Section>{tr("À QUELLE HEURE ?")}</Section>
        <TimePickerRow value={time} onChange={setTime} />
        <T variant="small">{tr("Elle sert à savoir quelles prières accomplir après le ghusl.")}</T>
        <Section>{tr("SIGNE DE FIN")}</Section>
        <View style={s.whenRow}>
          {SIGNS.map((g) => (
            <Pressable key={g.key} onPress={() => setSign(g.key)} accessibilityRole="radio" accessibilityState={{ selected: sign === g.key }} style={[s.sign, sign === g.key && s.signOn]}>
              <Text style={[s.signLabel, sign === g.key && { color: colors.white }]}>{g.label}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet visible={mode === 'istihada'} onClose={() => { close(); router.push('/ghusl'); }} title={tr("À savoir")} footer={<Button title={tr("Continuer")} onPress={() => { close(); router.push('/ghusl'); }} />}>
        <Notice title={tr("Istihada")}>{info}</Notice>
        <T variant="small">{tr("En cas de doute, rapproche-toi d’une personne de science.")}</T>
      </Sheet>

      <Sheet visible={mode === 'warnings'} onClose={close} title={tr("À savoir")} footer={<Button title={tr("Compris")} onPress={close} />}>
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
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune, textTransform: 'capitalize', minWidth: 104, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  letter: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.semi, fontSize: 11, color: colors.muted, paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' },
  dayDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.bordeaux },
  dayToday: { borderWidth: 1.5, borderColor: colors.bordeaux },
  dayNum: { fontFamily: fonts.semi, fontSize: 15, color: colors.prune },
  recap: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
  whenRow: { flexDirection: 'row', gap: 8 },
  flow: { flex: 1, minHeight: 64, borderRadius: 18, borderWidth: 1, borderColor: colors.lineField, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 6 },
  flowOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  flowLabel: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.prune },
  sign: { flex: 1, minHeight: 48, borderRadius: 999, borderWidth: 1, borderColor: colors.lineField, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  signOn: { backgroundColor: colors.prune, borderColor: colors.prune },
  signLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.prune },
  box: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.sable, borderRadius: 16, padding: 12 },
  boxText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.prune },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.lineField, paddingHorizontal: 14, minHeight: 56 },
  timeLabel: { flex: 1, fontFamily: fonts.semi, fontSize: 14, color: colors.prune },
  timeValue: { fontFamily: fonts.extra, fontSize: 20, color: colors.bordeaux, minWidth: 66, textAlign: 'center', fontVariant: ['tabular-nums'] },
  step: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
});

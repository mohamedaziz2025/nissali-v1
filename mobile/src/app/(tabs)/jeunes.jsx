// 5.8 — Jeûnes (cahier V3.0, maquettes 8 et 9). « À rattraper » : jours restants avant le prochain Ramadan,
// mon programme (jours de la semaine, prochains jours, rappel la veille, date de fin à ce rythme), une case
// à cocher par jour, « Jeûné aujourd'hui » et « + Jour manqué » ; jours déjà rattrapés hors application et
// historique. « Volontaires » : récap de l'année, « J'ai jeûné », me programmer, derniers jours, jours blancs.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { BrandBar } from '../../components/Brand';
import { PriorSheet } from '../../components/FastsPrior';
import { DateField, TimeField } from '../../components/forms';
import Icon from '../../components/Icon';
import { Button, Card, Chip, Chips, ErrorState, Gap, Label, ListItem, Loader, Notice, OfflineBanner, Row, Screen, Segmented, Sheet, Stepper, T, useToast } from '../../components/ui';
import { api, sendOrQueue } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dayMonth, inDays, longDate, parseDay, shortDate } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

const WEEK = [
  { v: 1, l: 'L', name: 'lundi' },
  { v: 2, l: 'M', name: 'mardi' },
  { v: 3, l: 'M', name: 'mercredi' },
  { v: 4, l: 'J', name: 'jeudi' },
  { v: 5, l: 'V', name: 'vendredi' },
  { v: 6, l: 'S', name: 'samedi' },
  { v: 0, l: 'D', name: 'dimanche' },
];
const DAY_SHORT = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MISSED_REASONS = [
  { key: 'regles', label: 'Règles' },
  { key: 'maladie', label: 'Maladie' },
  { key: 'voyage', label: 'Voyage' },
  { key: 'grossesse', label: 'Grossesse' },
  { key: 'allaitement', label: 'Allaitement' },
  { key: 'autre', label: 'Autre' },
];
const VOLUNTARY = [
  { key: 'lundi_jeudi', label: 'Lundi / jeudi' },
  { key: 'jours_blancs', label: 'Jour blanc' },
  { key: 'arafat', label: 'Arafat' },
  { key: 'achoura', label: 'Achoura' },
  { key: 'chawwal', label: '6 de Chawwal' },
  { key: 'autre', label: 'Autre' },
];
const CALENDAR_FASTS = [
  { key: 'blancs', label: 'Jours blancs' },
  { key: 'arafat', label: 'Arafat' },
  { key: 'achoura', label: 'Achoura' },
  { key: 'chawwal', label: '6 de Chawwal' },
];
const plural = (n, w = 'jour') => `${n} ${w}${n > 1 ? 's' : ''}`;
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const shortDay = (day) => {
  const d = parseDay(day);
  return { wd: DAY_SHORT[d.getUTCDay()], date: `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}` };
};

function confirm(title, message, action, label = 'Supprimer') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [{ text: 'Annuler', style: 'cancel' }, { text: label, style: 'destructive', onPress: action }]);
}

/** Jours de la semaine (L M M J V S D), choix multiple. */
function WeekPicker({ value = [], onChange }) {
  return (
    <View style={s.week} accessibilityRole="radiogroup">
      {WEEK.map((d) => {
        const on = value.includes(d.v);
        return (
          <Pressable key={d.v} onPress={() => onChange(on ? value.filter((x) => x !== d.v) : [...value, d.v])} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={d.name} style={[s.weekDay, on && s.weekDayOn]}>
            <Text style={[s.weekText, on && { color: colors.white }]}>{d.l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pastilles « LUN 19 oct. » des prochains jours prévus. */
function NextDays({ days, labelOf }) {
  if (!days.length) return null;
  return (
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      {days.map((d) => {
        const x = shortDay(d.day);
        return (
          <View key={d.day} style={[s.nextDay, d.paused && { opacity: 0.55 }]} accessibilityLabel={`${longDate(d.day)}${d.paused ? ', en pause pendant les règles' : ''}`}>
            <Text style={[s.nextWd, labelOf?.(d) && { color: colors.or }]}>{labelOf?.(d) || x.wd}</Text>
            <Text style={s.nextDate}>{x.date}</Text>
            {d.paused ? <Text style={s.nextPaused}>en pause</Text> : null}
          </View>
        );
      })}
    </Row>
  );
}

// --- À rattraper -------------------------------------------------------------------------------------

function MakeUp({ data, reload }) {
  const toast = useToast();
  const { user, setSession } = useAuth();
  const [sheet, setSheet] = useState(null); // 'prior' | 'madeup' | 'missed' | 'total' | 'time' | 'history'
  const [yearKey, setYearKey] = useState(null);
  const [priorEntry, setPriorEntry] = useState(null);
  const [madeUpDay, setMadeUpDay] = useState(data.today);
  const [missed, setMissed] = useState({ reason: 'regles', count: 1, day: null, hijriYear: null });
  const [total, setTotal] = useState(0);
  const [weekdays, setWeekdays] = useState(data.plan?.active ? data.plan.weekdays : []);
  const [busy, setBusy] = useState(false);
  useEffect(() => setWeekdays(data.plan?.active ? data.plan.weekdays : []), [data.plan]);

  const { counter } = data;
  const byYear = counter.byYear || [];
  const yearList = data.years || byYear.map((y) => y.hijriYear);
  const defaultYear = (byYear.find((y) => y.remaining > 0) || byYear[byYear.length - 1])?.hijriYear || yearList[yearList.length - 1];
  const hijriYear = yearKey && yearList.includes(yearKey) ? yearKey : defaultYear;
  const year = byYear.find((y) => y.hijriYear === hijriYear) || { hijriYear, missed: 0, madeUp: 0, remaining: 0, auto: 0, prior: 0, inApp: 0 };
  const blocked = data.todayStatus.forbidden || data.todayStatus.ramadan || data.todayStatus.inPeriod;
  const reminderOn = user?.notificationPrefs?.fastMakeup !== false;
  const reminderTime = data.plan?.reminderTime || '21:00';

  const run = async (fn, message) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fn();
      if (message) toast(r?.queued ? 'Noté hors connexion' : message);
      setSheet(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const savePlan = (days, time = reminderTime) => {
    setWeekdays(days);
    return run(() => api.put('/fasts/plan', { active: days.length > 0, perWeek: Math.max(1, days.length), weekdays: days.length ? days : [1, 4], reminderTime: time }), days.length ? 'Programme enregistré' : 'Programme mis en pause');
  };
  const fastedToday = () => run(() => sendOrQueue('POST', '/fasts/made-up', { day: data.today }), 'Qu’Allah l’accepte de toi ! Compteur mis à jour.');
  const uncheck = (b) => confirm('Décocher ce jour ?', `Rattrapage du ${longDate(b.day)}`, () => run(() => api.delete(`/fasts/made-up/${b.id}`), 'Case décochée'), 'Décocher');
  const toggleReminder = async (v) => {
    try {
      await setSession(await api.patch('/me', { notificationPrefs: { fastMakeup: v } }));
      toast(v ? 'Rappel la veille activé' : 'Rappel la veille désactivé');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const history = [
    ...data.madeUp.map((m) => ({ key: `a${m.id}`, kind: 'app', day: m.day, id: m.id })),
    ...data.prior.map((p) => ({ key: `p${p.id}`, kind: 'prior', day: p.dates?.[p.dates.length - 1] || p.createdAt?.slice(0, 10), entry: p })),
  ].sort((a, b) => (a.day < b.day ? 1 : -1));
  const done = data.boxes.filter((b) => b.done).length;

  return (
    <>
      <View style={s.hero}>
        <Row gap={14} align="center">
          <Text style={s.heroBig}>{counter.remaining}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.heroText}>{counter.remaining ? `jour${counter.remaining > 1 ? 's' : ''} à rattraper` : 'Tout est rattrapé'}</Text>
            <Text style={s.heroStrong}>{counter.remaining ? `avant Ramadan ${data.nextRamadan?.hijriYear}` : 'Qu’Allah l’accepte de toi'}</Text>
          </View>
        </Row>
        {data.nextRamadan ? (
          <View style={s.heroBox}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroBoxLabel}>Prochain Ramadan</Text>
              <Text style={s.heroBoxStrong}>Vers le {dayMonth(data.nextRamadan.start)} {data.nextRamadan.start.slice(0, 4)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.heroBoxNum}>{data.nextRamadan.daysLeft}</Text>
              <Text style={s.heroBoxLabel}>jours restants</Text>
            </View>
          </View>
        ) : null}
      </View>
      <Gap />

      {counter.remaining > 0 ? (
        <>
          <Card style={{ gap: 12 }}>
            <Row justify="space-between">
              <Text style={s.cardTitle}>Mon programme</Text>
              <Pressable onPress={() => setSheet('time')} hitSlop={8} accessibilityRole="button">
                <Text style={s.link}>Modifier</Text>
              </Pressable>
            </Row>
            <T variant="small">Je jeûne les :</T>
            <WeekPicker value={weekdays} onChange={(v) => savePlan(v)} />
            {data.plan?.active && data.planDays.length ? (
              <>
                <T variant="small">Prochains jours prévus</T>
                <NextDays days={data.planDays.slice(0, 3)} />
              </>
            ) : (
              <T variant="small">Choisis tes jours : Nissali les place en évitant tes règles prévues, le Ramadan, les deux Aïd et les jours de Tachriq.</T>
            )}
            <Row gap={10}>
              <Icon name="bell" size={17} color={colors.muted} />
              <Text style={s.lineText}>Notification la veille à {reminderTime} (suhur)</Text>
              <Switch value={reminderOn} onValueChange={toggleReminder} trackColor={{ true: colors.bordeaux, false: colors.line }} thumbColor={colors.white} accessibilityLabel="Notification la veille" />
            </Row>
            {data.plan?.active && data.planEnd ? (
              <Text style={[s.rhythm, !data.planEnough && { color: colors.danger }]}>
                {data.planEnough ? `À ce rythme : terminé le ${dayMonth(data.planEnd)} ✓` : `À ce rythme, tu finirais le ${dayMonth(data.planEnd)}, après le début du Ramadan.${data.rhythm?.phrase ? ` Conseil : ${data.rhythm.phrase}.` : ''}`}
              </Text>
            ) : data.rhythm ? (
              <Text style={s.rhythm}>{data.rhythm.alert ? data.rhythm.label : `Conseil : ${data.rhythm.label[0].toLowerCase()}${data.rhythm.label.slice(1)}`}</Text>
            ) : null}
          </Card>
          <Gap />
        </>
      ) : null}

      <Row justify="space-between" style={{ marginBottom: 10 }}>
        <Text style={s.cardTitle}>Coche chaque jour rattrapé</Text>
        <Text style={s.count}>{done} / {data.boxes.length}</Text>
      </Row>
      {data.boxes.length ? (
        <View style={s.boxes}>
          {data.boxes.map((b) => (
            <Pressable
              key={b.index}
              onPress={() => (b.done ? uncheck(b) : (setMadeUpDay(data.today), setSheet('madeup')))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: b.done }}
              accessibilityLabel={b.done ? `Jour ${b.index}, rattrapé le ${longDate(b.day)}` : `Jour ${b.index}, à rattraper`}
              style={[s.box, b.done && s.boxDone]}
            >
              <View style={[s.boxCheck, b.done && s.boxCheckOn]}>{b.done ? <Icon name="check" size={13} color={colors.white} strokeWidth={3} /> : null}</View>
              <Text style={[s.boxText, b.done && { color: colors.bordeaux }]} numberOfLines={1}>{b.done ? shortDay(b.day).date : `Jour ${b.index}`}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <T variant="muted">Aucun jour à rattraper.</T>
      )}
      <Row gap={10} style={{ marginTop: 14 }}>
        <Button title="Jeûné aujourd’hui" icon="check" small onPress={fastedToday} disabled={busy || Boolean(blocked) || data.madeUpToday || !counter.remaining} style={{ flex: 1 }} />
        <Button title="+ Jour manqué" variant="outline" small onPress={() => { setMissed({ reason: 'regles', count: 1, day: null, hijriYear: hijriYear || yearList[yearList.length - 1] }); setSheet('missed'); }} style={{ flex: 1 }} />
      </Row>
      {blocked && counter.remaining ? (
        <T variant="small" style={{ marginTop: 8, textAlign: 'center' }}>
          {data.todayStatus.forbidden ? `Le jeûne n’est pas permis aujourd’hui (${data.todayStatus.forbidden}).` : data.todayStatus.ramadan ? 'Pendant Ramadan, on ne rattrape pas.' : 'Pas de jeûne pendant tes règles : tu peux cocher un jour passé.'}
        </T>
      ) : data.madeUpToday ? (
        <T variant="small" style={{ marginTop: 8, textAlign: 'center' }}>Aujourd’hui est déjà coché.</T>
      ) : null}
      <Gap />

      <Card style={{ gap: 4 }}>
        <Label>Par année</Label>
        {byYear.length ? (
          byYear.map((y, i) => (
            <ListItem key={y.hijriYear} title={`Ramadan ${y.hijriYear}`} subtitle={`${plural(y.missed)} à rattraper · ${y.madeUp} rattrapé${y.madeUp > 1 ? 's' : ''} · ${y.remaining} restant${y.remaining > 1 ? 's' : ''}`} onPress={() => { setYearKey(y.hijriYear); setTotal(y.missed); setSheet('total'); }} last={i === byYear.length - 1} />
          ))
        ) : (
          <T variant="muted" style={{ paddingVertical: 6 }}>Aucun jour manqué enregistré.</T>
        )}
        <Pressable onPress={() => { setPriorEntry(null); setSheet('prior'); }} accessibilityRole="button" style={s.secondary}>
          <Icon name="history" size={17} color={colors.bordeaux} />
          <Text style={s.secondaryText}>Ajouter des jours déjà rattrapés</Text>
        </Pressable>
        {history.length ? (
          <Pressable onPress={() => setSheet('history')} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 8 }}>
            <Text style={s.link}>Mon historique ({history.length})</Text>
          </Pressable>
        ) : null}
      </Card>
      <Gap />
      <Notice title="Fidya">{data.fidyaInfo}</Notice>

      <PriorSheet visible={sheet === 'prior'} onClose={() => setSheet(null)} year={year} years={yearList} onYear={setYearKey} entry={priorEntry} onSaved={reload} />
      <Sheet visible={sheet === 'madeup'} onClose={() => setSheet(null)} title="Cocher un jour rattrapé" footer={<Button title="Cocher ce jour" onPress={() => run(() => sendOrQueue('POST', '/fasts/made-up', { day: madeUpDay }), 'Qu’Allah l’accepte de toi ! Compteur mis à jour.')} loading={busy} disabled={busy || !madeUpDay} />}>
        <DateField label="Jour jeûné" value={madeUpDay} onChange={setMadeUpDay} />
        <T variant="small">La case cochée affiche la date du rattrapage. Un jour seulement programmé n’est jamais compté.</T>
      </Sheet>
      <Sheet
        visible={sheet === 'missed'}
        onClose={() => setSheet(null)}
        title="Jour manqué"
        footer={<Button title={`Ajouter ${plural(missed.count)}`} onPress={() => run(() => api.post('/fasts/missed', { hijriYear: missed.hijriYear, count: missed.count, reason: missed.reason, ...(missed.day ? { day: missed.day } : {}) }), 'Ajouté au compteur')} loading={busy} disabled={busy || !missed.hijriYear} />}
      >
        <T variant="fieldLabel">Raison</T>
        <Chips items={MISSED_REASONS} value={missed.reason} onChange={(v) => setMissed((m) => ({ ...m, reason: v }))} />
        <T variant="fieldLabel">Ramadan</T>
        <Chips items={[...new Set([...(yearList || []), data.ramadan.current ? data.ramadan.hijriYear : data.ramadan.hijriYear - 1])].sort().map((y) => ({ key: y, label: `Ramadan ${y}` }))} value={missed.hijriYear} onChange={(v) => setMissed((m) => ({ ...m, hijriYear: v }))} scroll />
        <Stepper label="Nombre de jours" value={missed.count} onChange={(v) => setMissed((m) => ({ ...m, count: v }))} min={1} max={30} />
        <DateField label="Date (facultatif)" value={missed.day} onChange={(v) => setMissed((m) => ({ ...m, day: v }))} allowClear />
        <T variant="small">Pendant Ramadan, les jours de règles et de nifas sont ajoutés automatiquement. Les années précédentes se rangent par Ramadan.</T>
      </Sheet>
      <Sheet visible={sheet === 'total'} onClose={() => setSheet(null)} title={`Total · Ramadan ${hijriYear}`} footer={<Button title="Enregistrer" onPress={() => run(() => api.put('/fasts/total', { hijriYear, total }), 'Total mis à jour')} loading={busy} disabled={busy} />}>
        <T variant="muted">Nombre total de jours à rattraper pour ce Ramadan. Les jours comptés automatiquement pendant tes règles ({year.auto}) sont inclus.</T>
        <Stepper label="Jours à rattraper" value={total} onChange={setTotal} min={Math.max(year.auto || 0, year.prior || 0)} max={30} />
      </Sheet>
      <Sheet visible={sheet === 'time'} onClose={() => setSheet(null)} title="Mon programme" footer={<Button title="Fermer" variant="soft" onPress={() => setSheet(null)} />}>
        <T variant="fieldLabel">Je jeûne les</T>
        <WeekPicker value={weekdays} onChange={(v) => savePlan(v)} />
        <TimeField label="Heure du rappel la veille" value={reminderTime} allowUnknown={false} onChange={(t) => t && t !== reminderTime && savePlan(weekdays, t)} hint="21:00 par défaut, pour penser au suhur" />
        <T variant="small">Pendant tes règles prévues ou en cours, aucun jour n’est placé et aucun rappel ne part.</T>
      </Sheet>
      <Sheet visible={sheet === 'history'} onClose={() => setSheet(null)} title="Mon historique">
        {history.map((h, i) => (
          <View key={h.key} style={[s.histRow, i === history.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={[s.histCheck, h.kind === 'prior' && { backgroundColor: colors.or }]}>
              <Icon name={h.kind === 'prior' ? 'history' : 'check'} size={13} color={colors.white} strokeWidth={2.6} />
            </View>
            <View style={{ flex: 1 }}>
              {h.kind === 'app' ? (
                <Text style={s.histTitle}>{longDate(h.day)} <Text style={s.histMeta}>· rattrapé</Text></Text>
              ) : (
                <>
                  <Text style={s.histTitle}>{plural(h.entry.count)} <Text style={s.histMeta}>· hors application · Ramadan {h.entry.hijriYear}</Text></Text>
                  <Text style={s.histMeta} numberOfLines={2}>{h.entry.dates?.length ? h.entry.dates.map(shortDate).join(', ') : 'Sans date'}</Text>
                </>
              )}
            </View>
            {h.kind === 'prior' ? (
              <Pressable onPress={() => { setPriorEntry(h.entry); setYearKey(h.entry.hijriYear); setSheet('prior'); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Corriger" style={s.histBtn}>
                <Icon name="edit" size={16} color={colors.bordeaux} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => (h.kind === 'app' ? uncheck({ id: h.id, day: h.day }) : confirm('Supprimer cet ajout ?', `${plural(h.entry.count)} hors application · Ramadan ${h.entry.hijriYear}`, () => run(() => api.delete(`/fasts/prior/${h.entry.id}`), 'Ajout supprimé : compteur recalculé')))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Supprimer"
              style={s.histBtn}
            >
              <Icon name="trash" size={16} color={colors.muted} />
            </Pressable>
          </View>
        ))}
        <T variant="small">Tu peux ajouter des jours rattrapés avant d’utiliser Nissali. Un jour seulement programmé n’est jamais compté comme jeûné.</T>
      </Sheet>
    </>
  );
}

// --- Volontaires --------------------------------------------------------------------------------------

function Voluntary({ fasts, onWhiteLayout, onGoMakeUp }) {
  const toast = useToast();
  const [year, setYear] = useState(null);
  const v = useApi(`/fasts/voluntary${year ? `?year=${year}` : ''}`);
  const [day, setDay] = useState(fasts.today);
  const [type, setType] = useState(null);
  const [plan, setPlan] = useState(null);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const d = v.data;
  useEffect(() => {
    if (d && !plan) setPlan({ ...d.plan, reminder: d.reminder });
    if (d && !type) setType(d.todayType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);
  const pickDay = async (x) => {
    setDay(x);
    try {
      setType((await api.get(`/fasts/voluntary/type?day=${x}`)).type);
    } catch {
      // type laissé tel quel
    }
  };

  if (v.loading && !d) return <Loader />;
  if (v.error && !d) return <ErrorState error={v.error} onRetry={v.reload} />;

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.post('/fasts/voluntary', { day, type });
      toast(r.updated ? 'Type mis à jour' : 'Qu’Allah l’accepte de toi ! Ajouté à ton récap.');
      v.reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const savePlan = async (patch) => {
    const next = { ...plan, ...patch };
    setPlan(next);
    try {
      await api.put('/fasts/voluntary/plan', next);
      v.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const remove = (x) => confirm('Retirer ce jour ?', `${longDate(x.day)} · ${x.label}`, async () => {
    await api.delete(`/fasts/voluntary/${x.id}`).catch((e) => toast(e.message, 'error'));
    v.reload();
  });

  const max = Math.max(1, ...d.byMonth);
  const groups = [
    { n: d.byType.lundi_jeudi, l: 'Lundis & jeudis' },
    { n: d.byType.jours_blancs, l: 'Jours blancs' },
    { n: d.byType.arafat + d.byType.achoura, l: 'Arafat, Achoura' },
    { n: d.byType.chawwal, l: '6 de Chawwal' },
    { n: d.byType.autre, l: 'Autre' },
  ];
  const white = fasts.whiteDays || {};
  const recent = all ? d.recent : d.recent.slice(0, 3);

  return (
    <>
      {d.obligatoryRemaining > 0 ? (
        <Pressable onPress={onGoMakeUp} accessibilityRole="button" style={s.rg34}>
          <Icon name="info" size={16} color={colors.bordeaux} />
          <Text style={s.rg34Text}>Il te reste {plural(d.obligatoryRemaining)} obligatoire{d.obligatoryRemaining > 1 ? 's' : ''} à rattraper</Text>
          <Icon name="chevronRight" size={14} color={colors.bordeaux} />
        </Pressable>
      ) : null}

      <View style={s.hero}>
        <Row justify="space-between">
          <Text style={s.heroLabel}>MON RÉCAP · {d.year}</Text>
          {d.years.length > 1 ? (
            <Pressable onPress={() => setYear(d.years[(d.years.indexOf(d.year) + 1) % d.years.length])} hitSlop={8} accessibilityRole="button" accessibilityLabel="Changer d’année">
              <Text style={s.heroLink}>Autre année</Text>
            </Pressable>
          ) : null}
        </Row>
        <Row gap={14} align="center">
          <Text style={s.heroBig}>{d.total}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.heroText}>jour{d.total > 1 ? 's' : ''} de jeûne</Text>
            <Text style={s.heroStrong}>surérogatoire{d.total > 1 ? 's' : ''} cette année</Text>
          </View>
        </Row>
        <View style={s.groups}>
          {groups.map((g) => (
            <View key={g.l} style={s.group}>
              <Text style={s.groupNum}>{g.n}</Text>
              <Text style={s.groupLabel} numberOfLines={2}>{g.l}</Text>
            </View>
          ))}
        </View>
        <View style={s.months} accessibilityLabel={`Mois par mois : ${d.byMonth.join(', ')}`}>
          {d.byMonth.map((n, i) => (
            <View key={i} style={s.monthCol}>
              <View style={s.monthTrack}>{n ? <View style={[s.monthBar, { height: `${Math.max(15, (n / max) * 100)}%` }]} /> : <View style={s.monthDash} />}</View>
              <Text style={s.monthLabel}>{MONTH_LETTERS[i]}</Text>
            </View>
          ))}
        </View>
      </View>
      <Gap />

      <Card style={{ gap: 12 }}>
        <Text style={s.cardTitle}>J’ai jeûné</Text>
        <DateField value={day} onChange={pickDay} />
        <View style={s.chips}>
          {VOLUNTARY.map((t) => (
            <Chip key={t.key} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />
          ))}
        </View>
        <Button title="Valider ce jour de jeûne" icon="check" onPress={save} loading={busy} disabled={busy || !type || !day} />
      </Card>
      <Gap />

      {plan ? (
        <Card style={{ gap: 12 }}>
          <Text style={s.cardTitle}>Me programmer</Text>
          <T variant="small">Chaque semaine :</T>
          <WeekPicker value={plan.weekdays} onChange={(w) => savePlan({ weekdays: w })} />
          <T variant="small">Jeûnes du calendrier :</T>
          <View style={s.chips}>
            {CALENDAR_FASTS.map((c) => (
              <Chip key={c.key} label={c.label} selected={Boolean(plan[c.key])} onPress={() => savePlan({ [c.key]: !plan[c.key] })} />
            ))}
          </View>
          {d.next.length ? <NextDays days={d.next.slice(0, 3)} labelOf={(x) => (x.type === 'lundi_jeudi' || x.type === 'autre' ? null : x.label.toUpperCase())} /> : <T variant="small">Choisis des jours ou des jeûnes du calendrier : ils s’affichent ici.</T>}
          {d.next.some((x) => x.paused) ? <T variant="small">Un jour tombe pendant tes règles prévues : il est en pause et aucun rappel ne part. Tu peux le décaler en notant le jour où tu jeûnes.</T> : null}
          <Row gap={10}>
            <Icon name="bell" size={17} color={colors.muted} />
            <Text style={s.lineText}>Notification la veille à {plan.reminderTime || '21:00'}</Text>
            <Switch value={plan.reminder !== false} onValueChange={(r) => savePlan({ reminder: r })} trackColor={{ true: colors.bordeaux, false: colors.line }} thumbColor={colors.white} accessibilityLabel="Notification la veille" />
          </Row>
          <T variant="small">Un jour programmé n’est jamais compté tout seul : valide-le avec « J’ai jeûné ».</T>
        </Card>
      ) : null}
      <Gap />

      <Card style={{ gap: 4 }}>
        <Row justify="space-between">
          <Text style={s.cardTitle}>Derniers jours jeûnés</Text>
          {d.recent.length > 3 ? (
            <Pressable onPress={() => setAll((x) => !x)} hitSlop={8} accessibilityRole="button">
              <Text style={s.link}>{all ? 'Réduire' : 'Tout voir'}</Text>
            </Pressable>
          ) : null}
        </Row>
        {recent.length ? (
          recent.map((x, i) => (
            <Pressable key={x.id} onLongPress={() => remove(x)} onPress={() => remove(x)} accessibilityRole="button" accessibilityHint="Retirer ce jour" style={[s.recent, i === recent.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={s.recentCheck}>
                <Icon name="check" size={12} color={colors.white} strokeWidth={3} />
              </View>
              <Text style={s.recentDay}>{longDate(x.day)}</Text>
              <View style={[s.pill, x.type === 'autre' && { backgroundColor: '#F6EBDD' }]}>
                <Text style={[s.pillText, x.type === 'autre' && { color: '#8A6235' }]}>{x.label}</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <T variant="muted" style={{ paddingVertical: 6 }}>Aucun jeûne volontaire noté cette année.</T>
        )}
      </Card>
      <Gap />

      <View onLayout={(e) => onWhiteLayout?.(e.nativeEvent.layout.y)}>
        <Card style={{ gap: 12 }}>
          <Row justify="space-between">
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Jours blancs</Text>
              <T variant="small">Jeûne recommandé : 13, 14 et 15 du mois hégirien</T>
            </View>
            <T variant="bold" color={colors.bordeaux}>{white.inProgress ? 'En cours' : inDays(white.daysUntil)}</T>
          </Row>
          <Row gap={8}>
            {(white.days || []).map((w) => (
              <View key={w.day} style={[s.white, w.day === fasts.today && { backgroundColor: colors.or }]}>
                <Text style={[s.whiteWd, w.day === fasts.today && { color: colors.white }]}>{shortDay(w.day).wd}</Text>
                <Text style={[s.whiteDay, w.day === fasts.today && { color: colors.white }]}>{shortDay(w.day).date}</Text>
                <Text style={[s.whiteHijri, w.day === fasts.today && { color: colors.white }]}>{w.hijriDay} {String(w.hijriMonth || '').split(' ')[0].slice(0, 6)}</Text>
              </View>
            ))}
          </Row>
          <Pressable onPress={() => router.push('/blog/les-jours-blancs')} accessibilityRole="link">
            <Text style={s.link}>Pourquoi jeûner les jours blancs ? →</Text>
          </Pressable>
        </Card>
      </View>
      <Gap />
      <Card style={{ gap: 4 }}>
        <Label>À venir</Label>
        {fasts.supererogatory.map((f, i, arr) => (
          <ListItem key={f.key} title={f.label} subtitle={`${f.note} · ${shortDate(f.day)}`} right={<T variant="muted">{inDays(f.daysUntil)}</T>} last={i === arr.length - 1} />
        ))}
      </Card>
    </>
  );
}

export default function Fasts() {
  const { section, tab: tabParam } = useLocalSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState(tabParam === 'volontaires' || section === 'blancs' ? 'volontaires' : 'rattraper');
  const { data, loading, error, offline, reload } = useApi('/fasts');
  const [calendar, setCalendar] = useState(null);
  const scrollRef = useRef(null);
  const whiteY = useRef(null);
  useEffect(() => {
    if (tabParam === 'volontaires' || section === 'blancs') setTab('volontaires');
  }, [section, tabParam]);

  const top = <BrandBar />;
  if (loading && !data) return <Screen top={top}><Loader /></Screen>;
  if (error && !data) return <Screen top={top}><ErrorState error={error} onRetry={reload} /></Screen>;

  const openCalendar = async () => {
    try {
      setCalendar(await api.get('/fasts/ramadan-calendar'));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Screen top={top} onRefresh={reload} scrollRef={scrollRef}>
      <T variant="h1" accessibilityRole="header" style={{ marginBottom: 14 }}>Jeûnes</T>
      <OfflineBanner visible={offline} />
      <Segmented
        items={[
          { key: 'rattraper', label: 'À rattraper' },
          { key: 'volontaires', label: 'Volontaires' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Gap h={14} />
      {tab === 'rattraper' ? (
        <MakeUp data={data} reload={reload} />
      ) : (
        <Voluntary
          fasts={data}
          onGoMakeUp={() => setTab('rattraper')}
          onWhiteLayout={(y) => {
            if (section === 'blancs' && whiteY.current === null) {
              whiteY.current = y;
              setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y + 60), animated: true }), 300);
            }
          }}
        />
      )}
      <Gap />
      <Pressable onPress={openCalendar} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 8 }}>
        <Text style={s.link}>Ramadan {data.ramadan.hijriYear} · calendrier du suhur et de l’iftar →</Text>
      </Pressable>
      <Sheet visible={Boolean(calendar)} onClose={() => setCalendar(null)} title={calendar ? `Ramadan ${calendar.hijriYear}` : ''}>
        {calendar?.days.map((d) => (
          <Row key={d.day} justify="space-between" style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <T variant="medium" style={{ width: 54 }}>J{d.hijriDay}</T>
            <T style={{ flex: 1 }}>{shortDate(d.day)}</T>
            <T variant="small">Suhur {d.suhur}</T>
            <T variant="bold" style={{ marginLeft: 12 }}>Iftar {d.iftar}</T>
          </Row>
        ))}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: colors.bordeaux, borderRadius: 26, padding: 18, gap: 12 },
  heroBig: { fontFamily: fonts.title, fontSize: 56, lineHeight: 62, color: colors.white },
  heroText: { fontFamily: fonts.medium, fontSize: 15, color: colors.rose },
  heroStrong: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  heroLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.rose },
  heroLink: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white, textDecorationLine: 'underline' },
  heroBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 14 },
  heroBoxLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.rose },
  heroBoxStrong: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  heroBoxNum: { fontFamily: fonts.title, fontSize: 26, color: colors.white },
  cardTitle: { fontFamily: fonts.title, fontSize: 19, color: colors.prune },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  count: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  weekDayOn: { backgroundColor: colors.bordeaux },
  weekText: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  nextDay: { minWidth: 92, flexGrow: 1, alignItems: 'center', backgroundColor: colors.ivoire, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.line },
  nextWd: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, color: colors.bordeaux },
  nextDate: { fontFamily: fonts.title, fontSize: 16, color: colors.prune },
  nextPaused: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.muted },
  lineText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.prune },
  rhythm: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.or },
  boxes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  box: { width: '17.6%', aspectRatio: 1, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4 },
  boxDone: { borderStyle: 'solid', borderColor: '#EAD1D6', backgroundColor: colors.blush },
  boxCheck: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.8, borderColor: colors.prune, alignItems: 'center', justifyContent: 'center' },
  boxCheckOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  boxText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.muted },
  secondary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 999, borderWidth: 1.5, borderColor: colors.bordeaux, marginTop: 10 },
  secondaryText: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderBottomWidth: 1, borderBottomColor: colors.line },
  histCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  histTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  histMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  histBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  rg34: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.blush, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  rg34Text: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.bordeaux },
  groups: { flexDirection: 'row', gap: 6 },
  group: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 8, minHeight: 64 },
  groupNum: { fontFamily: fonts.title, fontSize: 20, color: colors.white },
  groupLabel: { fontFamily: fonts.medium, fontSize: 10.5, lineHeight: 13, color: colors.rose },
  months: { flexDirection: 'row', gap: 4, height: 56 },
  monthCol: { flex: 1, alignItems: 'center', gap: 3 },
  monthTrack: { flex: 1, width: 12, justifyContent: 'flex-end', alignItems: 'center' },
  monthBar: { width: 12, borderRadius: 5, backgroundColor: colors.rose },
  monthDash: { width: 10, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  monthLabel: { fontFamily: fonts.bold, fontSize: 10, color: colors.rose },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, borderBottomWidth: 1, borderBottomColor: colors.line },
  recentCheck: { width: 22, height: 22, borderRadius: 6, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  recentDay: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.prune },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.blush },
  pillText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.bordeaux },
  white: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: '#F6EBDD', gap: 2 },
  whiteWd: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.6, color: colors.or },
  whiteDay: { fontFamily: fonts.title, fontSize: 16, color: colors.prune },
  whiteHijri: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
});

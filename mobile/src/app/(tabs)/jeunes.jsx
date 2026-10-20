// 4.8 — Jeûnes (cahier V4.1). « Obligatoires » : jours à rattraper avant Ramadan en 76 pt, progression et rythme,
// « J'ai jeûné aujourd'hui », « Tu es à jour » à zéro (RG-44), mes jours rattrapés (cases dorées), mon programme,
// rattrapage et fidya. « Surérogatoires » : rappel RG-34, prochain jeûne recommandé (jours blancs), à venir avec
// cloches, « J'ai jeûné » et historique de l'année. Pas de récapitulatif ni de graphique.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { BrandBar } from '../../components/Brand';
import { PriorSheet } from '../../components/FastsPrior';
import { DateField, TimeField } from '../../components/forms';
import Icon from '../../components/Icon';
import { Button, Card, Chip, Chips, ErrorState, Gap, Label, ListItem, Loader, OfflineBanner, Row, Screen, Segmented, Sheet, Stepper, T, useToast } from '../../components/ui';
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

  const next = data.plan?.active ? data.planDays.find((d) => !d.paused) : null;
  const chosen = (data.plan?.weekdays || []).map((v) => WEEK.find((w) => w.v === v)?.name).filter(Boolean);
  const pct = counter.missed ? Math.min(1, counter.madeUp / counter.missed) : 1;

  return (
    <>
      {/* Bloc bordeaux : jours restants en 76 pt (RG-23), Ramadan à venir (RG-24 bis), progression et rythme (RG-24 ter). */}
      <View style={s.hero}>
        {counter.remaining ? (
          <>
            <Text style={s.heroLabel}>À RATTRAPER AVANT RAMADAN</Text>
            <Row gap={12} align="flex-end">
              <Text style={s.heroBig} adjustsFontSizeToFit numberOfLines={1}>{counter.remaining}</Text>
              <Text style={[s.heroText, { marginBottom: 14 }]}>jour{counter.remaining > 1 ? 's' : ''}</Text>
            </Row>
          </>
        ) : (
          <>
            <Text style={s.heroLabel}>JEÛNES OBLIGATOIRES</Text>
            <Text style={[s.heroBig, { fontSize: 40, lineHeight: 46 }]}>Tu es à jour</Text>
            <Text style={s.heroText}>Tous tes jours sont rattrapés. Qu’Allah l’accepte de toi.</Text>
          </>
        )}
        {data.nextRamadan ? (
          <Text style={s.heroText}>
            Ramadan {data.nextRamadan.hijriYear} vers le {dayMonth(data.nextRamadan.start)} {data.nextRamadan.start.slice(0, 4)} · dans {plural(data.nextRamadan.daysLeft)}
          </Text>
        ) : null}
        {counter.missed ? (
          <View style={{ gap: 6 }}>
            <View style={s.track}>
              <View style={[s.fill, { width: `${Math.round(pct * 100)}%` }]} />
            </View>
            <Text style={s.heroSmall}>
              {counter.madeUp} rattrapé{counter.madeUp > 1 ? 's' : ''} sur {counter.missed}
              {counter.remaining && data.rhythm ? ` · ${data.rhythm.alert ? data.rhythm.label : `conseil : ${data.rhythm.label[0].toLowerCase()}${data.rhythm.label.slice(1)}`}` : ''}
            </Text>
          </View>
        ) : null}
        {counter.remaining ? (
          <Pressable onPress={fastedToday} disabled={busy || Boolean(blocked) || data.madeUpToday} accessibilityRole="button" style={[s.whiteBtn, (busy || blocked || data.madeUpToday) && { opacity: 0.55 }]}>
            <Icon name="check" size={17} color={colors.bordeaux} strokeWidth={2.6} />
            <Text style={s.whiteBtnText}>{data.madeUpToday ? 'Aujourd’hui est coché' : 'J’ai jeûné aujourd’hui'}</Text>
          </Pressable>
        ) : null}
        {blocked && counter.remaining ? (
          <Text style={[s.heroSmall, { textAlign: 'center' }]}>
            {data.todayStatus.forbidden ? `Le jeûne n’est pas permis aujourd’hui (${data.todayStatus.forbidden}).` : data.todayStatus.ramadan ? 'Pendant Ramadan, on ne rattrape pas.' : 'Pas de jeûne pendant tes règles : tu peux cocher un jour passé.'}
          </Text>
        ) : null}
      </View>
      <Gap />

      {/* Mes jours rattrapés : une case par jour, toucher = cocher (date, case dorée) ou décocher. */}
      <Card style={{ gap: 12 }}>
        <Row justify="space-between">
          <Text style={s.cardTitle}>Mes jours rattrapés</Text>
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
                <Text style={[s.boxText, b.done && { color: colors.orText }]} numberOfLines={1}>{b.done ? shortDay(b.day).date : `Jour ${b.index}`}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <T variant="muted">Aucun jour à rattraper.</T>
        )}
        <Pressable onPress={() => { setMissed({ reason: 'regles', count: 1, day: null, hijriYear: hijriYear || yearList[yearList.length - 1] }); setSheet('missed'); }} accessibilityRole="button" style={s.secondary}>
          <Icon name="plus" size={16} color={colors.bordeaux} />
          <Text style={s.secondaryText}>Jour manqué</Text>
        </Pressable>
      </Card>
      <Gap />

      {/* Mon programme : prochain jeûne en grand, jours choisis, rappel la veille, date de fin à ce rythme. */}
      {counter.remaining > 0 ? (
        <>
          <Card style={{ gap: 12 }}>
            <Row justify="space-between">
              <Text style={s.cardTitle}>Mon programme</Text>
              <Pressable onPress={() => setSheet('time')} hitSlop={8} accessibilityRole="button">
                <Text style={s.link}>Modifier</Text>
              </Pressable>
            </Row>
            {next ? (
              <View>
                <Text style={s.small}>Prochain jeûne</Text>
                <Text style={s.nextBig}>{longDate(next.day)}</Text>
              </View>
            ) : (
              <T variant="small">Choisis tes jours : Nissali les place en évitant tes règles prévues, le Ramadan, les deux Aïd et les jours de Tachriq.</T>
            )}
            {chosen.length && data.plan?.active ? <Text style={s.lineText}>Chaque {chosen.join(', ')}</Text> : null}
            <Row gap={10}>
              <Icon name="bell" size={17} color={colors.muted} />
              <Text style={s.lineText}>Rappel la veille à {reminderTime} (suhur)</Text>
              <Switch value={reminderOn} onValueChange={toggleReminder} trackColor={{ true: colors.bordeaux, false: colors.line }} thumbColor={colors.white} accessibilityLabel="Rappel la veille" />
            </Row>
            {data.plan?.active && data.planEnd ? (
              <Text style={[s.rhythm, !data.planEnough && { color: colors.danger }]}>
                {data.planEnough ? `À ce rythme : terminé le ${dayMonth(data.planEnd)} ✓` : `À ce rythme, tu finirais le ${dayMonth(data.planEnd)}, après le début du Ramadan.`}
              </Text>
            ) : null}
          </Card>
          <Gap />
        </>
      ) : null}

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
      <Pressable onPress={() => router.push('/blog/rattraper-ses-jours-de-jeune-guide-pratique')} accessibilityRole="link" style={s.article}>
        <Icon name="info" size={17} color={colors.bordeaux} />
        <Text style={[s.lineText, { fontFamily: fonts.bold }]}>Rattrapage et fidya : ce qu’il faut savoir</Text>
        <Icon name="chevronRight" size={16} color={colors.muted} />
      </Pressable>
      {data.fidyaInfo ? <T variant="small" style={{ marginTop: 8 }}>{data.fidyaInfo}</T> : null}

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

  const white = fasts.whiteDays || {};
  // Cloche d'un jeûne à venir = programmé avec le rappel de la veille.
  const BELL = { lundi: { weekday: 1 }, jeudi: { weekday: 4 }, jours_blancs: { key: 'blancs' }, arafat: { key: 'arafat' }, tasua: { key: 'achoura' }, achoura: { key: 'achoura' } };
  const bellOn = (k) => {
    const b = BELL[k];
    if (!b || !plan) return false;
    return b.weekday != null ? plan.weekdays.includes(b.weekday) : Boolean(plan[b.key]);
  };
  const toggleBell = (k) => {
    const b = BELL[k];
    if (!b) return;
    const on = bellOn(k);
    if (b.weekday != null) savePlan({ weekdays: on ? plan.weekdays.filter((x) => x !== b.weekday) : [...plan.weekdays, b.weekday], reminder: true });
    else savePlan({ [b.key]: !on, reminder: true });
    toast(on ? 'Rappel coupé' : 'Rappel la veille activé');
  };

  return (
    <>
      {d.obligatoryRemaining > 0 ? (
        <Pressable onPress={onGoMakeUp} accessibilityRole="button" style={s.rg34}>
          <Icon name="info" size={16} color={colors.bordeaux} />
          <Text style={s.rg34Text}>{plural(d.obligatoryRemaining)} obligatoire{d.obligatoryRemaining > 1 ? 's' : ''} reste{d.obligatoryRemaining > 1 ? 'nt' : ''} à rattraper</Text>
          <Icon name="chevronRight" size={14} color={colors.bordeaux} />
        </Pressable>
      ) : null}

      {/* Prochain jeûne recommandé : jours blancs (grégorien + hégirien), « Les ajouter à mon programme ». */}
      <View onLayout={(e) => onWhiteLayout?.(e.nativeEvent.layout.y)} style={s.sable}>
        <Text style={s.sableLabel}>PROCHAIN JEÛNE RECOMMANDÉ</Text>
        <Row justify="space-between">
          <Text style={s.cardTitle}>Jours blancs</Text>
          <Text style={[s.link, { color: colors.orText }]}>{white.inProgress ? 'En cours' : inDays(white.daysUntil)}</Text>
        </Row>
        <Row gap={8}>
          {(white.days || []).map((w) => (
            <View key={w.day} style={[s.white, w.day === fasts.today && { backgroundColor: colors.or }]}>
              <Text style={[s.whiteWd, w.day === fasts.today && { color: colors.white }]}>{shortDay(w.day).wd}</Text>
              <Text style={[s.whiteDay, w.day === fasts.today && { color: colors.white }]}>{shortDay(w.day).date}</Text>
              <Text style={[s.whiteHijri, w.day === fasts.today && { color: colors.white }]}>{w.hijriDay} {String(w.hijriMonth || '').split(' ')[0].slice(0, 7)}</Text>
            </View>
          ))}
        </Row>
        {plan?.blancs ? (
          <View style={[s.addProgram, s.addProgramOn]}>
            <Icon name="check" size={16} color={colors.orText} strokeWidth={2.6} />
            <Text style={[s.addProgramText, { color: colors.orText }]}>Ajoutés · rappel la veille</Text>
          </View>
        ) : (
          <Pressable onPress={() => { savePlan({ blancs: true, reminder: true }); toast('Jours blancs ajoutés à ton programme'); }} accessibilityRole="button" style={s.addProgram}>
            <Text style={s.addProgramText}>Les ajouter à mon programme</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.push('/blog/les-jours-blancs')} accessibilityRole="link">
          <Text style={s.link}>Pourquoi jeûner les jours blancs ? →</Text>
        </Pressable>
      </View>
      <Gap />

      {/* À venir : chacun avec une cloche pour activer ou couper le rappel de la veille. */}
      <Card style={{ gap: 2 }}>
        <Text style={s.cardTitle}>À venir</Text>
        {fasts.supererogatory.map((f, i, arr) => {
          const on = bellOn(f.key);
          return (
            <View key={f.key} style={[s.upRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.upTitle}>{f.label}</Text>
                <Text style={s.small}>{f.note} · {shortDate(f.day)} · {inDays(f.daysUntil).toLowerCase()}</Text>
              </View>
              {BELL[f.key] ? (
                <Pressable onPress={() => toggleBell(f.key)} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={`Rappel la veille : ${f.label}`} hitSlop={6} style={[s.bell, on && s.bellOn]}>
                  <Icon name={on ? 'bell' : 'bellOff'} size={17} color={on ? colors.white : colors.muted} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <T variant="small" style={{ marginTop: 6 }}>Un jour programmé n’est jamais compté tout seul ; pendant tes règles prévues, il est en pause et aucun rappel ne part.</T>
      </Card>
      <Gap />

      <Card style={{ gap: 12 }}>
        <Text style={s.cardTitle}>J’ai jeûné</Text>
        <DateField value={day} onChange={pickDay} />
        <View style={s.chips}>
          {VOLUNTARY.map((t) => (
            <Chip key={t.key} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />
          ))}
        </View>
        <Button title="Valider" icon="check" onPress={save} loading={busy} disabled={busy || !type || !day} />
        <Pressable onPress={() => setAll(true)} accessibilityRole="button" style={s.historyLine}>
          <Text style={s.lineText}>
            <Text style={{ fontFamily: fonts.extra }}>{plural(d.total)}</Text> jeûné{d.total > 1 ? 's' : ''} en {d.year}
          </Text>
          <Text style={s.link}>Historique</Text>
          <Icon name="chevronRight" size={14} color={colors.bordeaux} />
        </Pressable>
      </Card>

      <Sheet visible={all} onClose={() => setAll(false)} title={`Historique · ${d.year}`}>
        {d.years.length > 1 ? <Chips items={d.years.map((y) => ({ key: y, label: y }))} value={d.year} onChange={setYear} scroll /> : null}
        {d.recent.length ? (
          d.recent.map((x, i) => (
            <View key={x.id} style={[s.recent, i === d.recent.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={s.recentCheck}>
                <Icon name="check" size={12} color={colors.white} strokeWidth={3} />
              </View>
              <Text style={s.recentDay}>{longDate(x.day)}</Text>
              <View style={s.pill}>
                <Text style={s.pillText}>{x.label}</Text>
              </View>
              <Pressable onPress={() => remove(x)} accessibilityRole="button" accessibilityLabel="Retirer ce jour" hitSlop={8} style={s.histBtn}>
                <Icon name="trash" size={16} color={colors.muted} />
              </Pressable>
            </View>
          ))
        ) : (
          <T variant="muted">Aucun jeûne surérogatoire noté cette année.</T>
        )}
      </Sheet>
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
      <Row justify="space-between" style={{ marginBottom: 14 }}>
        <T variant="h1" accessibilityRole="header">Jeûnes</T>
        {data.hijri ? (
          <View style={s.hijri}>
            <Text style={s.hijriText}>{data.hijri}</Text>
          </View>
        ) : null}
      </Row>
      <OfflineBanner visible={offline} />
      <Segmented
        items={[
          { key: 'rattraper', label: 'Obligatoires' },
          { key: 'volontaires', label: 'Surérogatoires' },
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
  hero: { backgroundColor: colors.bordeaux, borderRadius: 28, padding: 20, gap: 10 },
  heroBig: { fontFamily: fonts.extra, fontSize: 76, lineHeight: 84, letterSpacing: -2.5, color: colors.white },
  heroText: { fontFamily: fonts.medium, fontSize: 15, color: colors.onBordeaux },
  heroSmall: { fontFamily: fonts.medium, fontSize: 13, color: colors.onBordeaux },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.onBordeauxSurface, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.orClair },
  whiteBtn: { flexDirection: 'row', gap: 8, minHeight: 52, borderRadius: 999, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  whiteBtnText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.bordeaux },
  small: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  nextBig: { fontFamily: fonts.extra, fontSize: 24, letterSpacing: -0.5, color: colors.prune },
  article: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.line },
  hijri: { backgroundColor: colors.sable, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  hijriText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.orText },
  sable: { backgroundColor: colors.sable, borderRadius: 24, padding: 16, gap: 12 },
  sableLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.orText },
  addProgram: { minHeight: 46, borderRadius: 999, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  addProgramOn: { backgroundColor: colors.white },
  addProgramText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.white },
  upRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  upTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  bell: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.lineField, alignItems: 'center', justifyContent: 'center' },
  bellOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  historyLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  heroLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.rose },
  cardTitle: { fontFamily: fonts.extra, fontSize: 19, letterSpacing: -0.4, color: colors.prune },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  count: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  weekDayOn: { backgroundColor: colors.bordeaux },
  weekText: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  lineText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.prune },
  rhythm: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.orText },
  boxes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  box: { width: '17.6%', aspectRatio: 1, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4 },
  boxDone: { borderStyle: 'solid', borderColor: colors.sable, backgroundColor: colors.sable },
  boxCheck: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.8, borderColor: colors.prune, alignItems: 'center', justifyContent: 'center' },
  boxCheckOn: { backgroundColor: colors.or, borderColor: colors.or },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, borderBottomWidth: 1, borderBottomColor: colors.line },
  recentCheck: { width: 22, height: 22, borderRadius: 6, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  recentDay: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.prune },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.blush },
  pillText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.bordeaux },
  white: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: colors.white, gap: 2 },
  whiteWd: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.6, color: colors.orText },
  whiteDay: { fontFamily: fonts.title, fontSize: 16, color: colors.prune },
  whiteHijri: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
});

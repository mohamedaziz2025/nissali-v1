// 4.8 — Jeûnes (cahier V4.1). « Obligatoires » : jours à rattraper avant Ramadan en 76 pt, progression et rythme,
// « J'ai jeûné aujourd'hui », « Tu es à jour » à zéro (RG-44), mes jours rattrapés (cases dorées), mon programme,
// rattrapage et fidya. « Surérogatoires » : rappel RG-34, prochain jeûne recommandé (jours blancs), à venir avec
// cloches, « J'ai jeûné » et historique de l'année. Pas de récapitulatif ni de graphique.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { BrandBar } from '../../components/Brand';
import { PriorSheet } from '../../components/FastsPrior';
import MyFasts from '../../components/MyFasts';
import { DateField, TimeField } from '../../components/forms';
import Icon from '../../components/Icon';
import { Button, Card, Chip, Chips, ErrorState, Gap, Label, ListItem, Loader, OfflineBanner, Row, Screen, Segmented, Sheet, Stepper, T, useToast } from '../../components/ui';
import { api, sendOrQueue } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { dayMonth, inDays, longDate, parseDay, shortDate, DAYS_SHORT as FMT_DAYS_SHORT, MONTHS_SHORT as FMT_MONTHS_SHORT, WEEK as FMT_WEEK } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

import { tr } from '../../lib/i18n';
const WEEK = FMT_WEEK;
const DAY_SHORT = FMT_DAYS_SHORT.map((d) => d.replace(/\.$/, '').toUpperCase());
const MISSED_REASONS = [
  { key: 'regles', label: tr("Règles") },
  { key: 'maladie', label: tr("Maladie") },
  { key: 'voyage', label: tr("Voyage") },
  { key: 'grossesse', label: tr("Grossesse") },
  { key: 'allaitement', label: tr("Allaitement") },
  { key: 'autre', label: tr("Autre") },
];
const VOLUNTARY = [
  { key: 'lundi_jeudi', label: tr("Lundi / jeudi") },
  { key: 'jours_blancs', label: tr("Jour blanc") },
  { key: 'arafat', label: tr("Arafat") },
  { key: 'achoura', label: tr("Achoura") },
  { key: 'chawwal', label: tr("6 de Chawwal") },
  { key: 'autre', label: tr("Autre") },
];
const plural = (n, w = 'jour') => `${n} ${w}${n > 1 ? 's' : ''}`;
const MONTHS_SHORT = FMT_MONTHS_SHORT;
const shortDay = (day) => {
  const d = parseDay(day);
  return { wd: DAY_SHORT[d.getUTCDay()], date: `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}` };
};

function confirm(title, message, action, label = 'Supprimer') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [{ text: tr("Annuler"), style: 'cancel' }, { text: label, style: 'destructive', onPress: action }]);
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
      if (message) toast(r?.queued ? tr("Noté hors connexion") : message);
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
  const uncheck = (b) => confirm(tr("Décocher ce jour ?"), tr("Rattrapage du {0}", [longDate(b.day)]), () => run(() => api.delete(`/fasts/made-up/${b.id}`), 'Case décochée'), 'Décocher');
  const toggleReminder = async (v) => {
    try {
      await setSession(await api.patch('/me', { notificationPrefs: { fastMakeup: v } }));
      toast(v ? tr("Rappel la veille activé") : tr("Rappel la veille désactivé"));
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
            <Text style={s.heroLabel}>{tr("À RATTRAPER AVANT RAMADAN")}</Text>
            <Row gap={12} align="flex-end">
              <Text style={s.heroBig} adjustsFontSizeToFit numberOfLines={1}>{counter.remaining}</Text>
              <Text style={[s.heroText, { marginBottom: 14 }]}>{tr("jour")}{counter.remaining > 1 ? 's' : ''}</Text>
            </Row>
          </>
        ) : (
          <>
            <Text style={s.heroLabel}>{tr("JEÛNES OBLIGATOIRES")}</Text>
            <Text style={[s.heroBig, { fontSize: 40, lineHeight: 46 }]}>{tr("Tu es à jour")}</Text>
            <Text style={s.heroText}>{tr("Tous tes jours sont rattrapés. Qu’Allah l’accepte de toi.")}</Text>
          </>
        )}
        {data.nextRamadan ? (
          <Text style={s.heroText}>
            {tr("Ramadan")} {data.nextRamadan.hijriYear} {tr("vers le")} {dayMonth(data.nextRamadan.start)} {data.nextRamadan.start.slice(0, 4)} {tr("· dans")} {plural(data.nextRamadan.daysLeft)}
          </Text>
        ) : null}
        {counter.missed ? (
          <View style={{ gap: 6 }}>
            <View style={s.track}>
              <View style={[s.fill, { width: `${Math.round(pct * 100)}%` }]} />
            </View>
            <Text style={s.heroSmall}>
              {counter.madeUp} {tr("rattrapé")}{counter.madeUp > 1 ? 's' : ''} {tr("sur")} {counter.missed}
              {counter.remaining && data.rhythm ? ` · ${(data.rhythm.alert ? data.rhythm.label : tr("conseil : {0}{1}", [data.rhythm.label[0].toLowerCase(), data.rhythm.label.slice(1)]))}` : ''}
            </Text>
          </View>
        ) : null}
        {counter.remaining ? (
          <Pressable onPress={fastedToday} disabled={busy || Boolean(blocked) || data.madeUpToday} accessibilityRole="button" style={[s.whiteBtn, (busy || blocked || data.madeUpToday) && { opacity: 0.55 }]}>
            <Icon name="check" size={17} color={colors.bordeaux} strokeWidth={2.6} />
            <Text style={s.whiteBtnText}>{data.madeUpToday ? tr("Aujourd’hui est coché") : tr("J’ai jeûné aujourd’hui")}</Text>
          </Pressable>
        ) : null}
        {blocked && counter.remaining ? (
          <Text style={[s.heroSmall, { textAlign: 'center' }]}>
            {data.todayStatus.forbidden ? tr("Le jeûne n’est pas permis aujourd’hui ({0}).", [data.todayStatus.forbidden]) : data.todayStatus.ramadan ? tr("Pendant Ramadan, on ne rattrape pas.") : tr("Pas de jeûne pendant tes règles : tu peux cocher un jour passé.")}
          </Text>
        ) : null}
      </View>
      <Gap />

      {/* Mes jours rattrapés : une case par jour, toucher = cocher (date, case dorée) ou décocher. */}
      <Card style={{ gap: 12 }}>
        <Row justify="space-between">
          <Text style={s.cardTitle}>{tr("Mes jours rattrapés")}</Text>
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
                accessibilityLabel={b.done ? tr("Jour {0}, rattrapé le {1}", [b.index, longDate(b.day)]) : tr("Jour {0}, à rattraper", [b.index])}
                style={[s.box, b.done && s.boxDone]}
              >
                <View style={[s.boxCheck, b.done && s.boxCheckOn]}>{b.done ? <Icon name="check" size={13} color={colors.white} strokeWidth={3} /> : null}</View>
                <Text style={[s.boxText, b.done && { color: colors.orText }]} numberOfLines={1}>{b.done ? shortDay(b.day).date : tr("Jour {0}", [b.index])}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <T variant="muted">{tr("Aucun jour à rattraper.")}</T>
        )}
        <Pressable onPress={() => { setMissed({ reason: 'regles', count: 1, day: null, hijriYear: hijriYear || yearList[yearList.length - 1] }); setSheet('missed'); }} accessibilityRole="button" style={s.secondary}>
          <Icon name="plus" size={16} color={colors.bordeaux} />
          <Text style={s.secondaryText}>{tr("Jour manqué")}</Text>
        </Pressable>
      </Card>
      <Gap />

      {/* Mon programme : prochain jeûne en grand, jours choisis, rappel la veille, date de fin à ce rythme. */}
      {counter.remaining > 0 ? (
        <>
          <Card style={{ gap: 12 }}>
            <Row justify="space-between">
              <Text style={s.cardTitle}>{tr("Mon programme")}</Text>
              <Pressable onPress={() => setSheet('time')} hitSlop={8} accessibilityRole="button">
                <Text style={s.link}>{tr("Modifier")}</Text>
              </Pressable>
            </Row>
            {next ? (
              <View>
                <Text style={s.small}>{tr("Prochain jeûne")}</Text>
                <Text style={s.nextBig}>{longDate(next.day)}</Text>
              </View>
            ) : (
              <T variant="small">{tr("Choisis tes jours : Nissali les place en évitant tes règles prévues, le Ramadan, les deux Aïd et les jours de Tachriq.")}</T>
            )}
            {chosen.length && data.plan?.active ? <Text style={s.lineText}>{tr("Chaque")} {chosen.join(', ')}</Text> : null}
            <Row gap={10}>
              <Icon name="bell" size={17} color={colors.muted} />
              <Text style={s.lineText}>{tr("Rappel la veille à")} {reminderTime} {tr("(suhur)")}</Text>
              <Switch value={reminderOn} onValueChange={toggleReminder} trackColor={{ true: colors.bordeaux, false: colors.line }} thumbColor={colors.white} accessibilityLabel={tr("Rappel la veille")} />
            </Row>
            {data.plan?.active && data.planEnd ? (
              <Text style={[s.rhythm, !data.planEnough && { color: colors.danger }]}>
                {data.planEnough ? tr("À ce rythme : terminé le {0} ✓", [dayMonth(data.planEnd)]) : tr("À ce rythme, tu finirais le {0}, après le début du Ramadan.", [dayMonth(data.planEnd)])}
              </Text>
            ) : null}
          </Card>
          <Gap />
        </>
      ) : null}

      <Card style={{ gap: 4 }}>
        <Label>{tr("Par année")}</Label>
        {byYear.length ? (
          byYear.map((y, i) => (
            <ListItem key={y.hijriYear} title={tr("Ramadan {0}", [y.hijriYear])} subtitle={tr("{0} à rattraper · {1} rattrapé{2} · {3} restant{4}", [plural(y.missed), y.madeUp, y.madeUp > 1 ? 's' : '', y.remaining, y.remaining > 1 ? 's' : ''])} onPress={() => { setYearKey(y.hijriYear); setTotal(y.missed); setSheet('total'); }} last={i === byYear.length - 1} />
          ))
        ) : (
          <T variant="muted" style={{ paddingVertical: 6 }}>{tr("Aucun jour manqué enregistré.")}</T>
        )}
        <Pressable onPress={() => { setPriorEntry(null); setSheet('prior'); }} accessibilityRole="button" style={s.secondary}>
          <Icon name="history" size={17} color={colors.bordeaux} />
          <Text style={s.secondaryText}>{tr("Ajouter des jours déjà rattrapés")}</Text>
        </Pressable>
        {history.length ? (
          <Pressable onPress={() => setSheet('history')} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 8 }}>
            <Text style={s.link}>{tr("Mon historique (")}{history.length})</Text>
          </Pressable>
        ) : null}
      </Card>
      <Pressable onPress={() => router.push('/blog/rattraper-ses-jours-de-jeune-guide-pratique')} accessibilityRole="link" style={s.article}>
        <Icon name="info" size={17} color={colors.bordeaux} />
        <Text style={[s.lineText, { fontFamily: fonts.bold }]}>{tr("Rattrapage et fidya : ce qu’il faut savoir")}</Text>
        <Icon name="chevronRight" size={16} color={colors.muted} />
      </Pressable>
      {data.fidyaInfo ? <T variant="small" style={{ marginTop: 8 }}>{data.fidyaInfo}</T> : null}

      <PriorSheet visible={sheet === 'prior'} onClose={() => setSheet(null)} year={year} years={yearList} onYear={setYearKey} entry={priorEntry} onSaved={reload} />
      <Sheet visible={sheet === 'madeup'} onClose={() => setSheet(null)} title={tr("Cocher un jour rattrapé")} footer={<Button title={tr("Cocher ce jour")} onPress={() => run(() => sendOrQueue('POST', '/fasts/made-up', { day: madeUpDay }), 'Qu’Allah l’accepte de toi ! Compteur mis à jour.')} loading={busy} disabled={busy || !madeUpDay} />}>
        <DateField label={tr("Jour jeûné")} value={madeUpDay} onChange={setMadeUpDay} />
        <T variant="small">{tr("La case cochée affiche la date du rattrapage. Un jour seulement programmé n’est jamais compté.")}</T>
      </Sheet>
      <Sheet
        visible={sheet === 'missed'}
        onClose={() => setSheet(null)}
        title={tr("Jour manqué")}
        footer={<Button title={tr("Ajouter {0}", [plural(missed.count)])} onPress={() => run(() => api.post('/fasts/missed', { hijriYear: missed.hijriYear, count: missed.count, reason: missed.reason, ...(missed.day ? { day: missed.day } : {}) }), 'Ajouté au compteur')} loading={busy} disabled={busy || !missed.hijriYear} />}
      >
        <T variant="fieldLabel">{tr("Raison")}</T>
        <Chips items={MISSED_REASONS} value={missed.reason} onChange={(v) => setMissed((m) => ({ ...m, reason: v }))} />
        <T variant="fieldLabel">{tr("Ramadan")}</T>
        <Chips items={[...new Set([...(yearList || []), data.ramadan.current ? data.ramadan.hijriYear : data.ramadan.hijriYear - 1])].sort().map((y) => ({ key: y, label: tr("Ramadan {0}", [y]) }))} value={missed.hijriYear} onChange={(v) => setMissed((m) => ({ ...m, hijriYear: v }))} scroll />
        <Stepper label={tr("Nombre de jours")} value={missed.count} onChange={(v) => setMissed((m) => ({ ...m, count: v }))} min={1} max={30} />
        <DateField label={tr("Date (facultatif)")} value={missed.day} onChange={(v) => setMissed((m) => ({ ...m, day: v }))} allowClear />
        <T variant="small">{tr("Pendant Ramadan, les jours de règles et de nifas sont ajoutés automatiquement. Les années précédentes se rangent par Ramadan.")}</T>
      </Sheet>
      <Sheet visible={sheet === 'total'} onClose={() => setSheet(null)} title={tr("Total · Ramadan {0}", [hijriYear])} footer={<Button title={tr("Enregistrer")} onPress={() => run(() => api.put('/fasts/total', { hijriYear, total }), 'Total mis à jour')} loading={busy} disabled={busy} />}>
        <T variant="muted">{tr("Nombre total de jours à rattraper pour ce Ramadan. Les jours comptés automatiquement pendant tes règles (")}{year.auto}{tr(") sont inclus.")}</T>
        <Stepper label={tr("Jours à rattraper")} value={total} onChange={setTotal} min={Math.max(year.auto || 0, year.prior || 0)} max={30} />
      </Sheet>
      <Sheet visible={sheet === 'time'} onClose={() => setSheet(null)} title={tr("Mon programme")} footer={<Button title={tr("Fermer")} variant="soft" onPress={() => setSheet(null)} />}>
        <T variant="fieldLabel">{tr("Je jeûne les")}</T>
        <WeekPicker value={weekdays} onChange={(v) => savePlan(v)} />
        <TimeField label={tr("Heure du rappel la veille")} value={reminderTime} allowUnknown={false} onChange={(t) => t && t !== reminderTime && savePlan(weekdays, t)} hint={tr("21:00 par défaut, pour penser au suhur")} />
        <T variant="small">{tr("Pendant tes règles prévues ou en cours, aucun jour n’est placé et aucun rappel ne part.")}</T>
      </Sheet>
      <Sheet visible={sheet === 'history'} onClose={() => setSheet(null)} title={tr("Mon historique")}>
        {history.map((h, i) => (
          <View key={h.key} style={[s.histRow, i === history.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={[s.histCheck, h.kind === 'prior' && { backgroundColor: colors.or }]}>
              <Icon name={h.kind === 'prior' ? 'history' : 'check'} size={13} color={colors.white} strokeWidth={2.6} />
            </View>
            <View style={{ flex: 1 }}>
              {h.kind === 'app' ? (
                <Text style={s.histTitle}>{longDate(h.day)} <Text style={s.histMeta}>{tr("· rattrapé")}</Text></Text>
              ) : (
                <>
                  <Text style={s.histTitle}>{plural(h.entry.count)} <Text style={s.histMeta}>{tr("· hors application · Ramadan")} {h.entry.hijriYear}</Text></Text>
                  <Text style={s.histMeta} numberOfLines={2}>{h.entry.dates?.length ? h.entry.dates.map(shortDate).join(', ') : tr("Sans date")}</Text>
                </>
              )}
            </View>
            {h.kind === 'prior' ? (
              <Pressable onPress={() => { setPriorEntry(h.entry); setYearKey(h.entry.hijriYear); setSheet('prior'); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr("Corriger")} style={s.histBtn}>
                <Icon name="edit" size={16} color={colors.bordeaux} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => (h.kind === 'app' ? uncheck({ id: h.id, day: h.day }) : confirm(tr("Supprimer cet ajout ?"), tr("{0} hors application · Ramadan {1}", [plural(h.entry.count), h.entry.hijriYear]), () => run(() => api.delete(`/fasts/prior/${h.entry.id}`), 'Ajout supprimé : compteur recalculé')))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={tr("Supprimer")}
              style={s.histBtn}
            >
              <Icon name="trash" size={16} color={colors.muted} />
            </Pressable>
          </View>
        ))}
        <T variant="small">{tr("Tu peux ajouter des jours rattrapés avant d’utiliser Nissali. Un jour seulement programmé n’est jamais compté comme jeûné.")}</T>
      </Sheet>
    </>
  );
}

// --- Volontaires --------------------------------------------------------------------------------------

const PROGRAM_TITLES = { lundi_jeudi: tr("Lundi et jeudi"), blancs: tr("Jours blancs"), chawwal: tr("6 jours de Chawwal"), arafat: tr("Arafat"), achoura: tr("Achoura"), dates: tr("Dates précises") };

function Voluntary({ fasts, onWhiteLayout, onGoMakeUp, onScrollTo }) {
  const toast = useToast();
  const [year, setYear] = useState(null);
  const v = useApi(`/fasts/voluntary${year ? `?year=${year}` : ''}`);
  const [day, setDay] = useState(fasts.today);
  const [type, setType] = useState(null);
  const [plan, setPlan] = useState(null);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stamp, setStamp] = useState(0);
  const [action, setAction] = useState(null); // jour programmé touché dans « À venir »
  const chartY = useRef(null);
  const d = v.data;
  useEffect(() => {
    if (d) setPlan({ ...d.plan, reminder: d.reminder });
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
      toast(r.updated ? tr("Type mis à jour") : tr("Qu’Allah l’accepte de toi ! Ajouté à ton récap."));
      v.reload();
      setStamp((n) => n + 1);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const savePlan = async (patch) => {
    setPlan({ ...plan, ...patch });
    try {
      // Le serveur garde les champs absents (dates, jours sautés, « Jusqu'à »…).
      await api.put('/fasts/voluntary/plan', patch);
      v.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const remove = (x) => confirm(tr("Retirer ce jour ?"), `${longDate(x.day)} · ${x.label}`, async () => {
    await api.delete(`/fasts/voluntary/${x.id}`).catch((e) => toast(e.message, 'error'));
    v.reload();
  });

  // Programme touché dans « À venir » : modifier, supprimer ce jour, supprimer tout le programme.
  const kindOf = (x) => ((d.plan?.dates || []).includes(x.day) ? 'dates' : x.type === 'jours_blancs' ? 'blancs' : x.type === 'autre' || x.type === 'lundi_jeudi' ? 'lundi_jeudi' : x.type);
  const putPlan = async (patch, message) => {
    setAction(null);
    try {
      await api.put('/fasts/voluntary/plan', patch);
      toast(message);
      v.reload();
      setStamp((n) => n + 1);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const skipDay = (x) =>
    kindOf(x) === 'dates'
      ? putPlan({ dates: (d.plan.dates || []).filter((y) => y !== x.day) }, 'Jour supprimé')
      : putPlan({ skip: [...(d.plan.skip || []), x.day] }, 'Jour supprimé');
  const removeProgram = (x) => {
    const k = kindOf(x);
    const patch = k === 'lundi_jeudi' ? { weekdays: [] } : k === 'dates' ? { dates: [] } : { [k]: false };
    confirm(tr("Supprimer tout le programme ?"), tr("{0} : les jours à venir disparaissent de « À venir ».", [PROGRAM_TITLES[k] || x.label]), () => putPlan(patch, 'Programme supprimé'));
  };

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
    toast(on ? tr("Rappel coupé") : tr("Rappel la veille activé"));
  };

  return (
    <>
      {d.obligatoryRemaining > 0 ? (
        <Pressable onPress={onGoMakeUp} accessibilityRole="button" style={s.rg34}>
          <Icon name="info" size={16} color={colors.bordeaux} />
          <Text style={s.rg34Text}>{plural(d.obligatoryRemaining)} {tr("obligatoire")}{d.obligatoryRemaining > 1 ? 's' : ''} {tr("reste")}{d.obligatoryRemaining > 1 ? 'nt' : ''} {tr("à rattraper")}</Text>
          <Icon name="chevronRight" size={14} color={colors.bordeaux} />
        </Pressable>
      ) : null}

      {/* Prochain jeûne recommandé : jours blancs (grégorien + hégirien), « Les ajouter à mon programme ». */}
      <View onLayout={(e) => onWhiteLayout?.(e.nativeEvent.layout.y)} style={s.sable}>
        <Text style={s.sableLabel}>{tr("PROCHAIN JEÛNE RECOMMANDÉ")}</Text>
        <Row justify="space-between">
          <Text style={s.cardTitle}>{tr("Jours blancs")}</Text>
          <Text style={[s.link, { color: colors.orText }]}>{white.inProgress ? tr("En cours") : inDays(white.daysUntil)}</Text>
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
            <Text style={[s.addProgramText, { color: colors.orText }]}>{tr("Ajoutés · rappel la veille")}</Text>
          </View>
        ) : (
          <Pressable onPress={() => { savePlan({ blancs: true, reminder: true }); toast(tr("Jours blancs ajoutés à ton programme")); }} accessibilityRole="button" style={s.addProgram}>
            <Text style={s.addProgramText}>{tr("Les ajouter à mon programme")}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.push('/blog/les-jours-blancs')} accessibilityRole="link">
          <Text style={s.link}>{tr("Pourquoi jeûner les jours blancs ? →")}</Text>
        </Pressable>
      </View>
      <Gap />

      {/* À venir : bouton « + Programmer » ; jours programmés (touche → modifier ou supprimer) et cloches. */}
      <Card style={{ gap: 2 }}>
        <Row justify="space-between">
          <Text style={s.cardTitle}>{tr("À venir")}</Text>
          <Pressable onPress={() => router.push('/programmer-jeune')} accessibilityRole="button" style={s.program}>
            <Icon name="plus" size={14} color={colors.white} />
            <Text style={s.programText}>{tr("Programmer")}</Text>
          </Pressable>
        </Row>
        <Text style={[s.small, { marginBottom: 4 }]}>{tr("Touche la cloche pour un rappel")}</Text>
        {(d.next || []).slice(0, 4).map((x) => (
          <Pressable key={`p${x.day}`} onPress={() => setAction(x)} accessibilityRole="button" accessibilityHint={tr("Modifier ou supprimer")} style={s.upRow}>
            <View style={s.upDate}>
              <Text style={s.upDay}>{Number(x.day.slice(8))}</Text>
              <Text style={s.upMonth}>{shortDate(x.day).split(' ').pop().replace('.', '').toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.upTitle}>{longDate(x.day).split(' ')[0]}</Text>
              <Text style={s.small}>{x.paused ? tr("Règles prévues : jour sauté") : tr("{0} · dans ton programme", [x.label])}</Text>
            </View>
            <View style={[s.bell, !x.paused && d.reminder && s.bellOn]}>
              <Icon name={!x.paused && d.reminder ? 'bell' : 'bellOff'} size={17} color={!x.paused && d.reminder ? colors.white : colors.muted} />
            </View>
          </Pressable>
        ))}
        {fasts.supererogatory.filter((f) => !(d.next || []).some((x) => x.day === f.day)).map((f, i, arr) => {
          const on = bellOn(f.key);
          return (
            <View key={f.key} style={[s.upRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={s.upDate}>
                <Text style={s.upDay}>{Number(f.day.slice(8))}</Text>
                <Text style={s.upMonth}>{shortDate(f.day).split(' ').pop().replace('.', '').toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.upTitle}>{f.label}</Text>
                <Text style={s.small}>{f.note} · {inDays(f.daysUntil).toLowerCase()}</Text>
              </View>
              {BELL[f.key] ? (
                <Pressable onPress={() => toggleBell(f.key)} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={tr("Rappel la veille : {0}", [f.label])} hitSlop={6} style={[s.bell, on && s.bellOn]}>
                  <Icon name={on ? 'bell' : 'bellOff'} size={17} color={on ? colors.white : colors.muted} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <T variant="small" style={{ marginTop: 6 }}>{tr("Un jour programmé n’est jamais compté tout seul ; pendant tes règles prévues, il est en pause et aucun rappel ne part.")}</T>
      </Card>
      <Gap />

      <Card style={{ gap: 12 }}>
        <Text style={s.cardTitle}>{tr("J’ai jeûné")}</Text>
        <DateField value={day} onChange={pickDay} />
        <View style={s.chips}>
          {VOLUNTARY.map((t) => (
            <Chip key={t.key} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />
          ))}
        </View>
        <Button title={tr("Valider")} icon="check" onPress={save} loading={busy} disabled={busy || !type || !day} />
        <Pressable onPress={() => chartY.current != null && onScrollTo?.(chartY.current)} accessibilityRole="button" style={s.historyLine}>
          <Text style={s.lineText}>
            <Text style={{ fontFamily: fonts.extra }}>{plural(d.total)}</Text> {tr("jeûné")}{d.total > 1 ? 's' : ''} {tr("en")} {d.year}
          </Text>
          <Text style={s.link}>{tr("Voir le graphique")}</Text>
          <Icon name="chevronRight" size={14} color={colors.bordeaux} />
        </Pressable>
      </Card>
      <Gap />

      <MyFasts stamp={stamp} onLayout={(e) => (chartY.current = e.nativeEvent.layout.y)} />
      <Pressable onPress={() => setAll(true)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 10 }}>
        <Text style={s.link}>{tr("Historique de l’année")}</Text>
      </Pressable>

      <Sheet visible={Boolean(action)} onClose={() => setAction(null)} title={action ? `${longDate(action.day)} · ${action.label}` : ''}>
        <Button title={tr("Modifier ce programme")} variant="outline" onPress={() => { const k = kindOf(action); setAction(null); router.push(`/programmer-jeune?type=${k}`); }} />
        <Button title={tr("Supprimer ce jour")} variant="outline" onPress={() => skipDay(action)} />
        <Button title={tr("Supprimer tout le programme")} variant="ghost" onPress={() => removeProgram(action)} />
      </Sheet>

      <Sheet visible={all} onClose={() => setAll(false)} title={tr("Historique · {0}", [d.year])}>
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
              <Pressable onPress={() => remove(x)} accessibilityRole="button" accessibilityLabel={tr("Retirer ce jour")} hitSlop={8} style={s.histBtn}>
                <Icon name="trash" size={16} color={colors.muted} />
              </Pressable>
            </View>
          ))
        ) : (
          <T variant="muted">{tr("Aucun jeûne surérogatoire noté cette année.")}</T>
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
        <T variant="h1" accessibilityRole="header">{tr("Jeûnes")}</T>
        {data.hijri ? (
          <View style={s.hijri}>
            <Text style={s.hijriText}>{data.hijri}</Text>
          </View>
        ) : null}
      </Row>
      <OfflineBanner visible={offline} />
      <Segmented
        items={[
          { key: 'rattraper', label: tr("Obligatoires") },
          { key: 'volontaires', label: tr("Surérogatoires") },
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
          onScrollTo={(y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true })}
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
        <Text style={s.link}>{tr("Ramadan")} {data.ramadan.hijriYear} {tr("· calendrier du suhur et de l’iftar →")}</Text>
      </Pressable>
      <Sheet visible={Boolean(calendar)} onClose={() => setCalendar(null)} title={calendar ? tr("Ramadan {0}", [calendar.hijriYear]) : ''}>
        {calendar?.days.map((d) => (
          <Row key={d.day} justify="space-between" style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <T variant="medium" style={{ width: 54 }}>J{d.hijriDay}</T>
            <T style={{ flex: 1 }}>{shortDate(d.day)}</T>
            <T variant="small">{tr("Suhur")} {d.suhur}</T>
            <T variant="bold" style={{ marginLeft: 12 }}>{tr("Iftar")} {d.iftar}</T>
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
  upTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune, textTransform: 'capitalize' },
  upDate: { width: 38, alignItems: 'center' },
  upDay: { fontFamily: fonts.extra, fontSize: 17, color: colors.prune },
  upMonth: { fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 0.6, color: colors.bordeaux },
  program: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bordeaux, borderRadius: 999, paddingHorizontal: 12, minHeight: 34 },
  programText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
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

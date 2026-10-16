// 08 / 09 / 10 — Mes jeûnes (maquette du 16 octobre 2026, page 4) : « À rattraper » (Ramadan, solde, historique,
// jours déjà rattrapés hors application) et « Volontaires » (jours blancs, jeûnes surérogatoires).
// Solde = total des jours à rattraper − total des jours déjà rattrapés, dans et hors application.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BrandBar } from '../../components/Brand';
import { PriorSheet } from '../../components/FastsPrior';
import { DateField } from '../../components/forms';
import Icon from '../../components/Icon';
import { Button, Card, Chips, ErrorState, Field, Gap, Label, ListItem, Loader, Notice, OfflineBanner, Row, Screen, Segmented, Sheet, Stepper, T, Toggle, useToast } from '../../components/ui';
import { api, sendOrQueue } from '../../lib/api';
import { dayMonth, inDays, longDate, shortDate, toDay, WEEKDAY_NAMES } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

const WEEKDAY_CHIPS = [1, 2, 3, 4, 5, 6, 0].map((k) => ({ key: k, label: WEEKDAY_NAMES[k].slice(0, 3) }));
const plural = (n, w = 'jour') => `${n} ${w}${n > 1 ? 's' : ''}`;

function confirm(title, message, action) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: action }]);
}

/** Lanterne au trait fin (carte Ramadan). */
function Lantern() {
  return (
    <Svg width={44} height={52} viewBox="0 0 44 52">
      <Path d="M22 2v5M15 9h14l3 6H12z" stroke={colors.bordeaux} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
      <Path d="M12 15h20v24a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" stroke={colors.bordeaux} strokeWidth={1.8} fill="rgba(122,31,53,0.08)" />
      <Path d="M22 22c-3 4-3 8 0 12 3-4 3-8 0-12z" fill={colors.or} opacity={0.85} />
      <Path d="M14 46h16" stroke={colors.bordeaux} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx="22" cy="49.5" r="1.6" fill={colors.bordeaux} />
    </Svg>
  );
}

export default function Fasts() {
  const toast = useToast();
  const { section } = useLocalSearchParams();
  const [tab, setTab] = useState(section === 'blancs' ? 'volontaires' : 'rattraper');
  const { data, loading, error, offline, reload } = useApi('/fasts');
  const [yearKey, setYearKey] = useState(null);
  const [sheet, setSheet] = useState(null); // 'prior' | 'madeup' | 'total' | 'plan'
  const [priorEntry, setPriorEntry] = useState(null);
  const [madeUpEdit, setMadeUpEdit] = useState(null); // { id, day } en correction
  const [madeUpDay, setMadeUpDay] = useState(toDay(new Date()));
  const [total, setTotal] = useState(0);
  const [plan, setPlan] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (section === 'blancs') setTab('volontaires');
  }, [section]);

  const top = <BrandBar />;
  if (loading && !data) return <Screen top={top}><Loader /></Screen>;
  if (error && !data) return <Screen top={top}><ErrorState error={error} onRetry={reload} /></Screen>;

  const { counter, ramadan } = data;
  const byYear = counter.byYear || [];
  const yearList = data.years || byYear.map((y) => y.hijriYear);
  const defaultYear = (byYear.find((y) => y.remaining > 0) || byYear[byYear.length - 1])?.hijriYear || yearList[yearList.length - 1];
  const hijriYear = yearKey && yearList.includes(yearKey) ? yearKey : defaultYear;
  const year = byYear.find((y) => y.hijriYear === hijriYear) || { hijriYear, missed: 0, madeUp: 0, remaining: 0, auto: 0, prior: 0, inApp: 0 };
  const progress = year.missed ? year.madeUp / year.missed : 0;
  const blocked = data.todayStatus.forbidden || data.todayStatus.ramadan || data.todayStatus.inPeriod;

  // Historique : jours notés dans l'appli + ajouts hors application, du plus récent au plus ancien.
  const history = [
    ...data.madeUp.map((m) => ({ key: `a${m.id}`, kind: 'app', day: m.day, id: m.id })),
    ...data.prior.map((p) => ({ key: `p${p.id}`, kind: 'prior', day: p.dates?.[p.dates.length - 1] || p.createdAt?.slice(0, 10), entry: p })),
  ].sort((a, b) => (a.day < b.day ? 1 : -1));

  const openMadeUp = (m) => {
    setMadeUpEdit(m || null);
    setMadeUpDay(m?.day || data.today);
    setSheet('madeup');
  };
  const saveMadeUp = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (madeUpEdit && madeUpEdit.day === madeUpDay) return setSheet(null);
      const r = await sendOrQueue('POST', '/fasts/made-up', { day: madeUpDay });
      if (madeUpEdit) await api.delete(`/fasts/made-up/${madeUpEdit.id}`);
      toast(r?.queued ? 'Noté hors connexion' : madeUpEdit ? 'Date corrigée' : 'Qu’Allah l’accepte de toi ! Solde mis à jour.');
      setSheet(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const removeMadeUp = (m) =>
    confirm('Supprimer ce jour rattrapé ?', longDate(m.day), async () => {
      await api.delete(`/fasts/made-up/${m.id}`).catch((e) => toast(e.message, 'error'));
      reload();
    });
  const removePrior = (p) =>
    confirm('Supprimer cet ajout ?', `${plural(p.count)} rattrapé${p.count > 1 ? 's' : ''} hors application · Ramadan ${p.hijriYear}`, async () => {
      await api.delete(`/fasts/prior/${p.id}`).catch((e) => toast(e.message, 'error'));
      toast('Ajout supprimé : solde recalculé');
      reload();
    });
  const saveTotal = async () => {
    setBusy(true);
    try {
      await api.put('/fasts/total', { hijriYear, total });
      toast('Total mis à jour');
      setSheet(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const openPlan = () => {
    setPlan({ active: data.plan?.active ?? true, perWeek: data.plan?.perWeek ?? 2, weekdays: data.plan?.weekdays ?? [1, 4], reminderTime: data.plan?.reminderTime ?? '21:00' });
    setSheet('plan');
  };
  const savePlan = async () => {
    setBusy(true);
    try {
      await api.put('/fasts/plan', { ...plan, weekdays: plan.weekdays.slice(0, plan.perWeek) });
      setSheet(null);
      toast('Plan enregistré');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const openCalendar = async () => {
    try {
      setCalendar(await api.get('/fasts/ramadan-calendar'));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Screen top={top} onRefresh={reload}>
      <T variant="h1" accessibilityRole="header" style={{ marginBottom: 14 }}>Mes jeûnes</T>
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
        <>
          {yearList.length > 1 ? (
            <>
              <Chips items={yearList.map((y) => ({ key: y, label: `Ramadan ${y}` }))} value={hijriYear} onChange={setYearKey} scroll />
              <Gap h={12} />
            </>
          ) : null}
          <View style={s.ramadan}>
            <Row gap={14} align="center">
              <View style={s.lantern}>
                <Lantern />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.ramadanLabel}>RAMADAN {hijriYear}</Text>
                <Text style={s.remaining} accessibilityLabel={`${year.remaining} jours restants`}>
                  {year.missed && !year.remaining ? 'Tout est rattrapé' : `${plural(year.remaining)} restant${year.remaining > 1 ? 's' : ''}`}
                </Text>
              </View>
            </Row>
            <Text style={s.equation}>
              {plural(year.missed)} à rattraper − {year.madeUp} déjà rattrapé{year.madeUp > 1 ? 's' : ''} = {year.remaining} restant{year.remaining > 1 ? 's' : ''}
            </Text>
            <Row gap={10}>
              <View style={s.track}>
                <View style={[s.fill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={s.ratio}>{year.madeUp} / {year.missed}</Text>
            </Row>
            {year.remaining > 0 ? (
              <>
                <Pressable onPress={() => openMadeUp(null)} disabled={busy} accessibilityRole="button" style={({ pressed }) => [s.primary, pressed && { opacity: 0.88 }]}>
                  <Icon name="plus" size={18} color={colors.white} />
                  <Text style={s.primaryText}>Noter un jour rattrapé</Text>
                </Pressable>
                <Pressable onPress={() => { setPriorEntry(null); setSheet('prior'); }} accessibilityRole="button" style={({ pressed }) => [s.secondary, pressed && { opacity: 0.88 }]}>
                  <Icon name="history" size={18} color={colors.bordeaux} />
                  <Text style={s.secondaryText}>Ajouter des jours déjà rattrapés</Text>
                </Pressable>
              </>
            ) : (
              <View style={s.allDone}>
                <Icon name="check" size={18} color={colors.success} strokeWidth={2.6} />
                <Text style={s.allDoneText}>{year.missed ? 'Tous tes jours sont rattrapés' : 'Aucun jour à rattraper pour ce Ramadan'}</Text>
              </View>
            )}
            {blocked && year.remaining > 0 ? (
              <T variant="small" style={{ textAlign: 'center' }}>
                {data.todayStatus.forbidden ? `Le jeûne n’est pas permis aujourd’hui (${data.todayStatus.forbidden}).` : data.todayStatus.ramadan ? 'Pendant Ramadan, on ne rattrape pas.' : 'Pas de jeûne pendant tes règles : tu peux noter un jour passé.'}
              </T>
            ) : null}
          </View>
          <Gap />

          <Card style={{ gap: 4 }}>
            <Text style={s.cardTitle}>Mon historique</Text>
            <Row gap={6}>
              <T variant="small">Total initial · Ramadan {hijriYear} : {plural(year.missed)}</T>
              <Pressable onPress={() => { setTotal(year.missed); setSheet('total'); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Modifier le total initial">
                <Text style={s.link}>Modifier</Text>
              </Pressable>
            </Row>
            {history.length ? (
              history.map((h, i) => (
                <View key={h.key} style={[s.histRow, i === history.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[s.histCheck, h.kind === 'prior' && { backgroundColor: colors.or }]}>
                    <Icon name={h.kind === 'prior' ? 'history' : 'check'} size={13} color={colors.white} strokeWidth={2.6} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {h.kind === 'app' ? (
                      <Text style={s.histTitle}>
                        {dayMonth(h.day)} <Text style={s.histMeta}>· Rattrapé</Text>
                      </Text>
                    ) : (
                      <>
                        <Text style={s.histTitle}>
                          {plural(h.entry.count)} <Text style={s.histMeta}>· hors application · Ramadan {h.entry.hijriYear}</Text>
                        </Text>
                        <Text style={s.histMeta} numberOfLines={2}>{h.entry.dates?.length ? h.entry.dates.map(shortDate).join(', ') : 'Sans date'}</Text>
                      </>
                    )}
                  </View>
                  <Pressable onPress={() => (h.kind === 'app' ? openMadeUp({ id: h.id, day: h.day }) : (setPriorEntry(h.entry), setYearKey(h.entry.hijriYear), setSheet('prior')))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Corriger" style={s.histBtn}>
                    <Icon name="edit" size={16} color={colors.bordeaux} />
                  </Pressable>
                  <Pressable onPress={() => (h.kind === 'app' ? removeMadeUp(h) : removePrior(h.entry))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Supprimer" style={s.histBtn}>
                    <Icon name="trash" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ))
            ) : (
              <T variant="muted" style={{ paddingVertical: 8 }}>Aucun jour rattrapé pour l’instant.</T>
            )}
            <View style={s.info}>
              <Icon name="info" size={16} color={colors.muted} />
              <T variant="small" style={{ flex: 1 }}>Tu peux ajouter des jours rattrapés avant d’utiliser Nissali. Un jour seulement planifié n’est jamais compté comme jeûné.</T>
            </View>
          </Card>
          <Gap />

          <Card tone="soft" style={{ gap: 6 }}>
            <Label color={colors.or}>Prochain Ramadan · {data.nextRamadan?.hijriYear}</Label>
            <T variant="bold">{data.nextRamadan ? `Vers le ${dayMonth(data.nextRamadan.start)} ${data.nextRamadan.start.slice(0, 4)} · ${data.nextRamadan.daysLeft} jours restants` : '—'}</T>
            {data.rhythm && counter.remaining ? <T>{data.rhythm.alert ? data.rhythm.label : `Conseil : ${data.rhythm.label[0].toLowerCase()}${data.rhythm.label.slice(1)}`}</T> : null}
          </Card>
          <Gap />

          {counter.remaining > 0 ? (
            <>
              <Row justify="space-between" style={{ marginBottom: 10 }}>
                <Label>{data.plan?.active ? `Mon plan · ${plural(data.plan.perWeek)} par semaine` : 'Mon plan de rattrapage'}</Label>
                <Pressable onPress={openPlan} hitSlop={10} accessibilityRole="button">
                  <Text style={s.link}>{data.plan ? 'Modifier' : 'Créer'}</Text>
                </Pressable>
              </Row>
              {data.plan?.active ? (
                data.planDays.slice(0, 3).map((p, i) => (
                  <Card key={p.day} style={{ marginBottom: 10, paddingVertical: 14 }}>
                    <Row justify="space-between">
                      <View style={{ flex: 1 }}>
                        <T variant="bold">{longDate(p.day)}</T>
                        <T variant="small">{i === 0 ? `Rappel la veille à ${data.plan.reminderTime}` : 'Jour prévu, non compté tant qu’il n’est pas noté'}</T>
                      </View>
                      <T variant="bold" color={colors.or}>{p.day === data.today ? 'Aujourd’hui' : 'Prévu'}</T>
                    </Row>
                  </Card>
                ))
              ) : (
                <Card tone="soft" style={{ gap: 10, marginBottom: 12 }}>
                  <T>Choisis un rythme : Nissali place tes jours en évitant tes règles prévues, le Ramadan et les jours où le jeûne est interdit.</T>
                  <Button title="Créer mon plan" small onPress={openPlan} />
                </Card>
              )}
            </>
          ) : null}
          <Notice title="Fidya">{data.fidyaInfo}</Notice>
        </>
      ) : (
        <>
          <Card style={{ gap: 12 }}>
            <Row justify="space-between">
              <View>
                <T variant="h3">Jours blancs</T>
                <T variant="small">Jeûne recommandé (13, 14 et 15 du mois hégirien)</T>
              </View>
              <T variant="bold" color={colors.bordeaux}>{data.whiteDays?.inProgress ? 'En cours' : inDays(data.whiteDays?.daysUntil)}</T>
            </Row>
            <Row gap={8}>
              {(data.whiteDays?.days || []).map((d) => (
                <View key={d.day} style={[s.white, d.day === data.today && { backgroundColor: colors.or }]}>
                  <Text style={[s.whiteDay, d.day === data.today && { color: colors.white }]}>{shortDate(d.day)}</Text>
                  <Text style={[s.whiteHijri, d.day === data.today && { color: colors.white }]}>{d.hijriDay} {String(d.hijriMonth || '').split(' ')[0].slice(0, 5)}.</Text>
                </View>
              ))}
            </Row>
            <T variant="small">Rappel la veille au soir · lundis et jeudis aussi possibles</T>
            <Pressable onPress={() => router.push('/blog/les-jours-blancs')} accessibilityRole="link">
              <Text style={s.link}>Pourquoi jeûner les jours blancs ? →</Text>
            </Pressable>
          </Card>
          <Gap />
          <Card style={{ gap: 4 }}>
            <Label>Jeûnes surérogatoires</Label>
            {data.supererogatory.map((f, i, arr) => (
              <ListItem key={f.key} title={f.label} subtitle={`${f.note} · ${shortDate(f.day)}`} right={<T variant="muted">{inDays(f.daysUntil)}</T>} last={i === arr.length - 1} />
            ))}
          </Card>
          <Gap />
          <Card tone="soft" style={{ gap: 8 }}>
            <Label color={colors.or}>Ramadan {ramadan.hijriYear}</Label>
            {ramadan.current ? <T variant="h3">Jour {ramadan.day} · encore {plural(ramadan.daysLeft)}</T> : <T variant="h3">{ramadan.daysUntil <= 45 ? inDays(ramadan.daysUntil) : `Dans environ ${ramadan.monthsUntil} mois`}</T>}
            <Pressable onPress={openCalendar} accessibilityRole="button">
              <Text style={s.link}>Calendrier du suhur et de l’iftar →</Text>
            </Pressable>
          </Card>
        </>
      )}

      <PriorSheet visible={sheet === 'prior'} onClose={() => setSheet(null)} year={year} years={yearList} onYear={setYearKey} entry={priorEntry} onSaved={reload} />
      <Sheet visible={sheet === 'madeup'} onClose={() => setSheet(null)} title={madeUpEdit ? 'Corriger la date' : 'Noter un jour rattrapé'} footer={<Button title={madeUpEdit ? 'Enregistrer' : 'Noter ce jour'} onPress={saveMadeUp} loading={busy} disabled={busy || !madeUpDay} />}>
        <DateField label="Jour jeûné" value={madeUpDay} onChange={setMadeUpDay} />
        <T variant="small">Un jour seulement planifié n’est pas compté : note-le une fois jeûné.</T>
      </Sheet>
      <Sheet visible={sheet === 'total'} onClose={() => setSheet(null)} title={`Total · Ramadan ${hijriYear}`} footer={<Button title="Enregistrer" onPress={saveTotal} loading={busy} disabled={busy} />}>
        <T variant="muted">Nombre total de jours à rattraper pour ce Ramadan. Les jours comptés automatiquement pendant tes règles ({year.auto}) sont inclus.</T>
        <Stepper label="Jours à rattraper" value={total} onChange={setTotal} min={Math.max(year.auto || 0, year.prior || 0)} max={30} />
      </Sheet>
      <Sheet visible={sheet === 'plan'} onClose={() => setSheet(null)} title="Mon plan de rattrapage" footer={<Button title="Enregistrer" onPress={savePlan} loading={busy} />}>
        {plan ? (
          <>
            <Toggle label="Plan actif" value={plan.active} onChange={(v) => setPlan((p) => ({ ...p, active: v }))} />
            <Stepper label="Jours par semaine" value={plan.perWeek} onChange={(v) => setPlan((p) => ({ ...p, perWeek: v }))} min={1} max={7} />
            <T variant="fieldLabel">Jours préférés (jusqu’à {plan.perWeek})</T>
            <Chips items={WEEKDAY_CHIPS} value={plan.weekdays} onChange={(v) => setPlan((p) => ({ ...p, weekdays: v.slice(-p.perWeek) }))} multi />
            <Field label="Heure du rappel la veille" value={plan.reminderTime} onChangeText={(v) => setPlan((p) => ({ ...p, reminderTime: v }))} placeholder="21:00" keyboardType="numbers-and-punctuation" maxLength={5} />
            <T variant="small">Les jours sont placés en évitant tes règles prévues, le Ramadan, les deux Aïd et les jours de Tachriq.</T>
          </>
        ) : null}
      </Sheet>
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
  ramadan: { backgroundColor: colors.blush, borderRadius: 26, padding: 18, gap: 12, borderWidth: 1, borderColor: '#F0D5DA' },
  lantern: { width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  ramadanLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, color: colors.bordeaux },
  remaining: { fontFamily: fonts.title, fontSize: 28, lineHeight: 34, color: colors.prune },
  equation: { fontFamily: fonts.medium, fontSize: 14, color: colors.prune },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.85)', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.bordeaux },
  ratio: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
  primary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 16, backgroundColor: colors.bordeaux },
  primaryText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.white },
  secondary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 16, borderWidth: 1.5, borderColor: colors.bordeaux, backgroundColor: 'rgba(255,255,255,0.7)' },
  secondaryText: { fontFamily: fonts.bold, fontSize: 15, color: colors.bordeaux },
  allDone: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E6F1EA', borderRadius: 16, padding: 14 },
  allDoneText: { fontFamily: fonts.bold, fontSize: 15, color: colors.success },
  cardTitle: { fontFamily: fonts.title, fontSize: 19, color: colors.prune },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux, textDecorationLine: 'underline' },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderBottomWidth: 1, borderBottomColor: colors.line },
  histCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  histTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  histMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  histBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  info: { flexDirection: 'row', gap: 8, backgroundColor: colors.ivoire, borderRadius: 14, padding: 12, marginTop: 8 },
  white: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: '#F6EBDD', gap: 2 },
  whiteDay: { fontFamily: fonts.title, fontSize: 18, color: colors.prune },
  whiteHijri: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
});

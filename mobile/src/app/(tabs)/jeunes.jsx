// 5.8 — Jeûnes : compteur automatique, plan de rattrapage, Ramadan, jeûnes surérogatoires
// (maquette du cahier, page 8).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chips, ErrorState, Field, Gap, Label, ListItem, Loader, Notice, OfflineBanner, ProgressBar, Row, Screen, Sheet, Stepper, T, Toggle, useToast } from '../../components/ui';
import { api, sendOrQueue } from '../../lib/api';
import { dayMonth, inDays, longDate, shortDate, WEEKDAY_NAMES } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

const REASONS = [
  { key: 'maladie', label: 'Maladie' },
  { key: 'voyage', label: 'Voyage' },
  { key: 'grossesse', label: 'Grossesse' },
  { key: 'allaitement', label: 'Allaitement' },
  { key: 'regles', label: 'Règles' },
  { key: 'autre', label: 'Autre' },
];
const WEEKDAY_CHIPS = [1, 2, 3, 4, 5, 6, 0].map((k) => ({ key: k, label: WEEKDAY_NAMES[k].slice(0, 3) }));

export default function Fasts() {
  const toast = useToast();
  const { section } = useLocalSearchParams();
  const scrollRef = useRef(null);
  const whiteY = useRef(0);
  const [highlight, setHighlight] = useState(false);
  const { data, loading, error, offline, reload } = useApi('/fasts');
  const [planOpen, setPlanOpen] = useState(false);
  const [plan, setPlan] = useState(null);
  const [missedOpen, setMissedOpen] = useState(false);
  const [missed, setMissed] = useState({ count: 1, reason: 'maladie', hijriYear: null, note: '' });
  const [calendar, setCalendar] = useState(null);
  const [busy, setBusy] = useState(false);

  // Depuis la carte « Jours blancs » de l'accueil : défilement direct jusqu'à la section.
  useEffect(() => {
    if (section !== 'blancs' || !data) return undefined;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, whiteY.current - 12), animated: true });
      setHighlight(true);
      setTimeout(() => setHighlight(false), 2500);
    }, 350);
    return () => clearTimeout(t);
  }, [section, data]);

  if (loading && !data) return <Screen title="Jeûnes"><Loader /></Screen>;
  if (error && !data) return <Screen title="Jeûnes"><ErrorState error={error} onRetry={reload} /></Screen>;

  const { counter, ramadan } = data;
  const progress = counter.missed ? counter.madeUp / counter.missed : 0;
  const currentYear = ramadan.current ? ramadan.hijriYear : ramadan.hijriYear - 1;

  const fastedToday = async () => {
    setBusy(true);
    try {
      const r = await sendOrQueue('POST', '/fasts/made-up', {});
      toast(r.queued ? 'Noté hors connexion' : 'Qu’Allah l’accepte de toi ! Compteur mis à jour.');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const undoToday = async () => {
    const m = data.madeUp.find((x) => x.day === data.today);
    if (!m) return;
    await api.delete(`/fasts/made-up/${m.id}`).catch(() => {});
    reload();
  };

  const openPlan = () => {
    setPlan({ active: data.plan?.active ?? true, perWeek: data.plan?.perWeek ?? 2, weekdays: data.plan?.weekdays ?? [1, 4], reminderTime: data.plan?.reminderTime ?? '21:00' });
    setPlanOpen(true);
  };

  const savePlan = async () => {
    setBusy(true);
    try {
      await api.put('/fasts/plan', { ...plan, weekdays: plan.weekdays.slice(0, plan.perWeek) });
      setPlanOpen(false);
      toast('Plan enregistré');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveMissed = async () => {
    setBusy(true);
    try {
      await api.post('/fasts/missed', { hijriYear: missed.hijriYear || currentYear, count: missed.count, reason: missed.reason, note: missed.note || undefined });
      setMissedOpen(false);
      toast('Jours ajoutés au compteur');
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

  const blocked = data.todayStatus.forbidden || data.todayStatus.ramadan || data.todayStatus.inPeriod;

  const boxes = data.boxes || [];
  const doneCount = boxes.filter((b) => b.done).length;
  const next = data.nextRamadan;
  const toggleBox = async (b) => {
    try {
      if (b.done) await api.delete(`/fasts/made-up/${b.id}`);
      else await sendOrQueue('POST', '/fasts/made-up', {});
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const short = (day) => `${Number(day.slice(8))} ${MONTHS_SHORT[Number(day.slice(5, 7)) - 1]}`;

  return (
    <Screen title="Jeûnes" onRefresh={reload} scrollRef={scrollRef}>
      <OfflineBanner visible={offline} />
      {/* 5.8 — En haut, en grand : jours à rattraper avant Ramadan, date estimée, jours restants, conseil de rythme */}
      <Card tone="hero" style={{ gap: 14 }}>
        <Row gap={14} align="center">
          <Text style={s.bigNumber} accessibilityLabel={`${counter.remaining} jours à rattraper`}>{counter.remaining}</Text>
          <View style={{ flex: 1 }}>
            <T color={colors.rose}>jour{counter.remaining > 1 ? 's' : ''} à rattraper</T>
            <T variant="bold" color={colors.white} style={{ fontSize: 18 }}>avant Ramadan {next?.hijriYear}</T>
          </View>
        </Row>
        <View style={s.nextRamadan}>
          <View style={{ flex: 1 }}>
            <T variant="small" color={colors.rose}>Prochain Ramadan</T>
            <T variant="bold" color={colors.white}>{next ? `Vers le ${dayMonth(next.start)} ${next.start.slice(0, 4)}` : '—'}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.daysLeft}>{next?.daysLeft ?? '—'}</Text>
            <T variant="small" color={colors.rose}>jours restants</T>
          </View>
        </View>
        {data.rhythm ? <T color={colors.white} style={{ fontSize: 14.5 }}>{data.rhythm.alert ? data.rhythm.label : `Conseil : ${data.rhythm.label[0].toLowerCase()}${data.rhythm.label.slice(1)}`}</T> : counter.missed ? <T color={colors.white}>Tout est rattrapé, qu’Allah l’accepte !</T> : null}
      </Card>
      <Gap h={18} />

      {/* Une case par jour à rattraper : cochée = date du rattrapage (décochable en cas d'erreur) */}
      {boxes.length ? (
        <>
          <Row justify="space-between" style={{ marginBottom: 10 }}>
            <T variant="h3">Coche chaque jour rattrapé</T>
            <T variant="bold" color={colors.bordeaux}>{doneCount} / {boxes.length}</T>
          </Row>
          <View style={s.grid}>
            {boxes.map((b) => (
              <Pressable key={b.index} onPress={() => toggleBox(b)} disabled={!b.done && (Boolean(blocked) || data.madeUpToday)} accessibilityRole="checkbox" accessibilityState={{ checked: b.done }} accessibilityLabel={b.done ? `Jour rattrapé le ${short(b.day)}, décocher` : `Jour ${b.index} à rattraper`} style={[s.box, b.done && s.boxDone]}>
                <View style={[s.check, b.done && s.checkOn]}>{b.done ? <Text style={{ color: colors.white, fontSize: 13 }}>✓</Text> : null}</View>
                <Text style={[s.boxLabel, b.done && { color: colors.bordeaux, fontFamily: fonts.bold }]} numberOfLines={1}>{b.done ? short(b.day) : `Jour ${b.index}`}</Text>
              </Pressable>
            ))}
          </View>
          <Gap h={14} />
        </>
      ) : null}
      <Row gap={10}>
        {data.madeUpToday ? (
          <Button title="Noté aujourd’hui ✓" small variant="soft" onPress={undoToday} style={{ flex: 1 }} />
        ) : (
          <Button title="Jeûné aujourd’hui" small onPress={fastedToday} loading={busy} disabled={Boolean(blocked) || counter.remaining === 0} style={{ flex: 1 }} />
        )}
        <Button title="+ Jour manqué" small variant="outline" onPress={() => setMissedOpen(true)} style={{ flex: 1 }} />
      </Row>
      {blocked ? (
        <T variant="small" style={{ textAlign: 'center', marginTop: 8 }}>
          {data.todayStatus.forbidden ? `Le jeûne n’est pas permis aujourd’hui (${data.todayStatus.forbidden}).` : data.todayStatus.ramadan ? 'Pendant Ramadan, on ne rattrape pas.' : 'Pas de jeûne pendant tes règles.'}
        </T>
      ) : null}
      <Gap h={18} />

      {/* Section Jours blancs (l'accueil y mène directement) */}
      <View onLayout={(e) => (whiteY.current = e.nativeEvent.layout.y)}>
        <Card style={[{ gap: 12 }, highlight && { borderWidth: 2, borderColor: colors.or }]}>
          <Row justify="space-between">
            <View>
              <T variant="h3">Jours blancs</T>
              <T variant="small">Jeûne recommandé</T>
            </View>
            <T variant="bold" color={colors.bordeaux}>{data.whiteDays?.inProgress ? 'En cours' : inDays(data.whiteDays?.daysUntil)}</T>
          </Row>
          <Row gap={8}>
            {(data.whiteDays?.days || []).map((d) => (
              <View key={d.day} style={[s.white, d.day === data.today && { backgroundColor: colors.or }]}>
                <Text style={[s.whiteDay, d.day === data.today && { color: colors.white }]}>{short(d.day)}</Text>
                <Text style={[s.whiteHijri, d.day === data.today && { color: colors.white }]}>{d.hijriDay} {String(d.hijriMonth || '').split(' ')[0].slice(0, 5)}.</Text>
              </View>
            ))}
          </Row>
          <T variant="small">Rappel la veille au soir · Lundis et jeudis aussi possibles</T>
          <Pressable onPress={() => router.push('/blog/les-jours-blancs')} accessibilityRole="link">
            <T variant="small" color={colors.bordeaux}>Pourquoi jeûner les jours blancs ? →</T>
          </Pressable>
        </Card>
      </View>
      <Gap h={22} />

      {counter.remaining > 0 ? (
        <>
          <Row justify="space-between" style={{ marginBottom: 12 }}>
            <Label>{data.plan?.active ? `Ton plan · ${data.plan.perWeek} jour${data.plan.perWeek > 1 ? 's' : ''} par semaine` : 'Ton plan de rattrapage'}</Label>
            <Pressable onPress={openPlan} hitSlop={10} accessibilityRole="button">
              <T variant="medium" color={colors.bordeaux}>{data.plan ? 'Modifier' : 'Créer'}</T>
            </Pressable>
          </Row>
          {data.plan?.active ? (
            data.planDays.slice(0, 4).map((p, i) => (
              <Card key={p.day} style={{ marginBottom: 10, paddingVertical: 16 }}>
                <Row justify="space-between">
                  <View style={{ flex: 1 }}>
                    <T variant="bold" style={{ fontSize: 17 }}>{longDate(p.day)}</T>
                    <T variant="muted">{i === 0 ? `Rappel la veille à ${data.plan.reminderTime}` : p.nearPeriod ? 'Hors de tes règles prévues' : [1, 4].includes(p.weekday) ? 'Jour de sunna' : 'Jour de rattrapage'}</T>
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
          <Gap h={8} />
        </>
      ) : null}

      <Card tone="soft" style={{ gap: 8 }}>
        <Label color={colors.or}>Ramadan {ramadan.hijriYear}</Label>
        {ramadan.current ? (
          <>
            <T variant="h2">Jour {ramadan.day}</T>
            <T>Encore {ramadan.daysLeft} jour{ramadan.daysLeft > 1 ? 's' : ''}. Ton compteur se remplit tout seul pendant tes règles.</T>
          </>
        ) : (
          <>
            <T variant="h2">{ramadan.daysUntil <= 45 ? inDays(ramadan.daysUntil) : `Dans environ ${ramadan.monthsUntil} mois`}</T>
            <T>Le compteur se remplira tout seul pendant tes règles.</T>
          </>
        )}
        <Pressable onPress={openCalendar} accessibilityRole="button">
          <T variant="medium" color={colors.bordeaux}>Calendrier du suhur et de l’iftar →</T>
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

      <Card style={{ gap: 4 }}>
        <Row justify="space-between">
          <Label>Détail par année</Label>
          <Pressable onPress={() => setMissedOpen(true)} hitSlop={10} accessibilityRole="button">
            <T variant="medium" color={colors.bordeaux}>+ Ajouter</T>
          </Pressable>
        </Row>
        {counter.byYear.length ? (
          counter.byYear.map((y, i, arr) => (
            <ListItem key={y.hijriYear} title={`Ramadan ${y.hijriYear}`} subtitle={`${y.missed} manqué${y.missed > 1 ? 's' : ''} (${y.auto} automatique${y.auto > 1 ? 's' : ''}, ${y.manual} ajouté${y.manual > 1 ? 's' : ''}) · ${y.madeUp} rattrapé${y.madeUp > 1 ? 's' : ''}`} right={<T variant="bold" color={y.remaining ? colors.bordeaux : colors.success}>{y.remaining}</T>} last={i === arr.length - 1} />
          ))
        ) : (
          <T variant="muted">Aucun jour manqué enregistré.</T>
        )}
        {data.manual.length ? (
          <View style={{ marginTop: 8, gap: 6 }}>
            <T variant="small">Jours ajoutés à la main :</T>
            {data.manual.map((m) => (
              <Row key={m.id} justify="space-between">
                <T variant="small" style={{ flex: 1 }}>
                  {m.count} jour{m.count > 1 ? 's' : ''} · {REASONS.find((r) => r.key === m.reason)?.label} · {m.hijriYear}
                </T>
                <Pressable onPress={() => api.delete(`/fasts/missed/${m.id}`).then(reload)} hitSlop={10} accessibilityLabel="Supprimer">
                  <T variant="small" color={colors.danger}>Supprimer</T>
                </Pressable>
              </Row>
            ))}
          </View>
        ) : null}
      </Card>
      <Gap />
      <Notice title="Fidya">{data.fidyaInfo}</Notice>

      <Sheet visible={planOpen} onClose={() => setPlanOpen(false)} title="Mon plan de rattrapage" footer={<Button title="Enregistrer" onPress={savePlan} loading={busy} />}>
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

      <Sheet visible={missedOpen} onClose={() => setMissedOpen(false)} title="Ajouter des jours manqués" footer={<Button title="Ajouter" onPress={saveMissed} loading={busy} />}>
        <Stepper label="Année hégirienne" value={missed.hijriYear || currentYear} onChange={(v) => setMissed((m) => ({ ...m, hijriYear: v }))} min={1400} max={currentYear + 1} />
        <Stepper label="Nombre de jours" value={missed.count} onChange={(v) => setMissed((m) => ({ ...m, count: v }))} min={1} max={30} />
        <T variant="fieldLabel">Raison</T>
        <Chips items={REASONS} value={missed.reason} onChange={(v) => setMissed((m) => ({ ...m, reason: v }))} />
        <Field label="Note (facultatif)" value={missed.note} onChangeText={(v) => setMissed((m) => ({ ...m, note: v }))} />
      </Sheet>

      <Sheet visible={Boolean(calendar)} onClose={() => setCalendar(null)} title={calendar ? `Ramadan ${calendar.hijriYear}` : ''}>
        {calendar?.days.map((d) => (
          <Row key={d.day} justify="space-between" style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <T variant="medium" style={{ width: 70 }}>J{d.hijriDay}</T>
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
  bigNumber: { fontFamily: fonts.display, fontSize: 84, lineHeight: 92, color: colors.white },
  nextRamadan: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 18, padding: 14 },
  daysLeft: { fontFamily: fonts.display, fontSize: 30, color: colors.white, lineHeight: 34 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  box: { width: '18%', minWidth: 56, aspectRatio: 0.92, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 6 },
  boxDone: { backgroundColor: colors.blush, borderColor: colors.blush },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.prune, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  boxLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  white: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: '#F6EBDD', gap: 2 },
  whiteDay: { fontFamily: fonts.title, fontSize: 18, color: colors.prune },
  whiteHijri: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
});

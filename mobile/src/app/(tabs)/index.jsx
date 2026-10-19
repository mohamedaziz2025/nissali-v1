// 5.2 — Accueil « Aujourd'hui » (cahier V3.0, maquette 1). Dans cet ordre : prières (Qibla, Dhikr), règles,
// jeûnes à rattraper et jours blancs, mes notes, comment tu te sens, conseil santé, petit rappel.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { FrequencyPicker } from '../../components/NotifFrequency';
import { NoteRow } from '../../components/Notes';
import { AdhanSoundSheet, useAdhanPrefs } from '../../components/AdhanSound';
import { BrandBar } from '../../components/Brand';
import { FLOW_LABEL, FlowPicker } from '../../components/Flow';
import Icon from '../../components/Icon';
import { usePeriodActions } from '../../components/PeriodSheets';
import { Button, Card, Chip, ErrorState, Gap, Label, Loader, Notice, OfflineBanner, Row, Screen, Sheet, T, useToast } from '../../components/ui';
import { kg, WeightSheet } from '../../components/Weight';
import { api, assetUrl, sendOrQueue } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { countdown, dayMonth, longDate } from '../../lib/format';
import { jumuaOf } from '../../lib/jumua';
import { syncLocation } from '../../lib/location';
import { rescheduleAll } from '../../lib/notifications';
import { localTimings } from '../../lib/prayerLocal';
import { readJson, writeJson } from '../../lib/storage';
import { useApi } from '../../lib/useApi';
import { colors, fonts, MOODS, PRAYER_LABELS, PRAYERS, SYMPTOMS } from '../../theme';

const PRAYER_ICONS = { fajr: 'sunrise', dhuhr: 'sun', asr: 'sun', maghrib: 'sunset', isha: 'moon' };
const PHASE_NAMES = { menstruelle: 'phase menstruelle', folliculaire: 'phase folliculaire', ovulatoire: 'phase ovulatoire', luteale: 'phase lutéale', grossesse: 'grossesse' };
const HOME_SYMPTOMS = ['crampes', 'fatigue', 'migraine', 'ballonnements'];

/**
 * 5.2 · 1 — Prières : prochaine prière et compte à rebours, mosquée ou ville, les 5 horaires cochables,
 * bouton Qibla bien visible et petit bouton rond Dhikr (chapelet). RG-08 bis : pendant les règles, la carte
 * se réduit à une ligne « Prières en pause » avec accès au dhikr (horaires consultables dans la page Horaires).
 */
function PrayersCard({ prayers, onToggle, onAdhanSettings }) {
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(Date.now());
  const adhan = useAdhanPrefs();
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);
  const t = prayers.timings;
  const src = prayers.sourceInfo || { mode: 'ville', label: prayers.city };
  const place = src.mode === 'mosquee' ? src.label : prayers.city;
  const nextKey = PRAYERS.find((p) => new Date(t.instants?.[p]).getTime() > now);
  const jumua = jumuaOf(src);
  const paused = prayers.paused;
  const col = (Math.min(width, 520) - 40 - 28) / 5;
  const timeSize = Math.max(14.5, Math.min(18, col / 3.4));

  const actions = (
    <Row gap={8}>
      <Pressable onPress={() => router.push('/qibla')} accessibilityRole="button" accessibilityLabel="Qibla" hitSlop={4} style={s.qiblaPill}>
        <Icon name="compass" size={16} color={colors.bordeaux} />
        <Text style={s.qiblaText}>Qibla</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/dhikr')} accessibilityRole="button" accessibilityLabel="Dhikr" hitSlop={4} style={s.dhikrBtn}>
        <Icon name="beads" size={20} color={colors.white} strokeWidth={1.7} />
      </Pressable>
    </Row>
  );

  if (paused) {
    return (
      <Card style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        <Row gap={10}>
          <Pressable onPress={() => router.push('/dhikr')} accessibilityRole="button" accessibilityLabel="Prières en pause. Ouvrir le dhikr" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={s.pausedIcon}>
              <Icon name="bellOff" size={17} color={colors.bordeaux} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.pausedTitle}>Prières en pause</Text>
              <Text style={s.placeText} numberOfLines={1}>{prayers.pauseReason === 'nifas' ? 'Pendant ton nifas' : 'Pendant tes règles'} · le dhikr reste ouvert</Text>
            </View>
          </Pressable>
          {actions}
        </Row>
        <Pressable onPress={() => router.push('/horaires')} accessibilityRole="link" hitSlop={6} style={[s.seeAll, { marginTop: 10, alignSelf: 'flex-start' }]}>
          <Text style={s.seeAllText}>Voir les horaires</Text>
          <Icon name="chevronRight" size={14} color={colors.bordeaux} />
        </Pressable>
      </Card>
    );
  }

  return (
    <Card style={{ paddingHorizontal: 14, paddingVertical: 16 }}>
      <Row justify="space-between" gap={8} style={{ paddingHorizontal: 4 }} align="flex-start">
        <Pressable onPress={() => router.push('/horaires')} accessibilityRole="button" accessibilityLabel={`${nextKey ? `${PRAYER_LABELS[nextKey]} dans ${countdown(t.instants[nextKey], now)}. ` : ''}${place}. Ouvrir les horaires`} style={{ flex: 1, gap: 2 }}>
          <Text style={s.cardTitle} numberOfLines={1}>{nextKey ? `${PRAYER_LABELS[nextKey]} dans ${countdown(t.instants[nextKey], now)}` : 'Mes prières'}</Text>
          <Row gap={4}>
            <Icon name={src.mode === 'mosquee' ? 'home' : 'pin'} size={13} color={colors.muted} />
            <Text style={s.placeText} numberOfLines={1}>{place}</Text>
            <Icon name="chevronRight" size={13} color={colors.muted} />
          </Row>
        </Pressable>
        {actions}
      </Row>
      <View style={s.prayerRow}>
        {PRAYERS.map((p) => {
          const next = p === nextKey;
          const done = prayers.checked?.[p];
          return (
            <Pressable
              key={p}
              onPress={() => onToggle(p, !done)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: Boolean(done) }}
              accessibilityLabel={`${PRAYER_LABELS[p]} ${t[p]}${done ? ', accomplie' : ''}${next ? ', prochaine prière' : ''}`}
              style={({ pressed }) => [s.prayerCol, p === 'isha' && { borderRightWidth: 0 }, pressed && { opacity: 0.7 }]}
            >
              <Icon name={PRAYER_ICONS[p]} size={21} color={next ? colors.bordeaux : colors.or} />
              <Text style={[s.prayerName, next && { color: colors.bordeaux }]} numberOfLines={1}>{PRAYER_LABELS[p]}</Text>
              <Text style={[s.prayerTime, { fontSize: timeSize }, next && { color: colors.bordeaux }]} numberOfLines={1}>{t[p]}</Text>
              <View style={[s.check, done && s.checkDone]}>{done ? <Icon name="check" size={10} color={colors.white} strokeWidth={3} /> : null}</View>
            </Pressable>
          );
        })}
      </View>
      {jumua?.today ? <T variant="small" style={{ textAlign: 'center', marginTop: 8 }}>Vendredi · Jumu’a à {jumua.times.join(' et ')}</T> : null}
      <Pressable onPress={onAdhanSettings} accessibilityRole="button" accessibilityLabel="Son de l’adhan, régler" style={s.adhanRow}>
        <Icon name="volume" size={18} color={colors.prune} />
        <Text style={s.adhanText}>Son de l’adhan</Text>
        <Text style={s.adhanState}>{adhan.on ? 'Activé' : 'Désactivé'}</Text>
        <Text style={s.seeAllText}>Régler</Text>
        <Icon name="chevronRight" size={14} color={colors.bordeaux} />
      </Pressable>
    </Card>
  );
}

const PHASE_SHORT = { menstruelle: 'Règles', folliculaire: 'Folliculaire', ovulatoire: 'Fertile', luteale: 'Lutéale' };
const PHASE_COLORS = { menstruelle: '#D9798C', folliculaire: 'rgba(255,255,255,0.35)', ovulatoire: colors.rose, luteale: colors.or };

/** Frise des 4 phases du cycle avec la position du jour (carte Règles, 5.2). */
function Frieze({ frieze, phase }) {
  const [w, setW] = useState(0);
  if (!frieze?.bounds || !frieze.cycleLength) return null;
  const order = ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale'].filter((k) => frieze.bounds[k]);
  const len = frieze.cycleLength;
  const pos = Math.min(1, Math.max(0, (frieze.cycleDay - 0.5) / len));
  return (
    <View style={{ marginTop: 12 }} accessibilityLabel={`Jour ${frieze.cycleDay} sur ${len}, ${phase ? PHASE_SHORT[phase] : ''}`}>
      <View style={s.frieze} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {order.map((k) => {
          const [a, b] = frieze.bounds[k];
          return <View key={k} style={[s.friezeSeg, { flex: Math.max(1, b - a + 1), backgroundColor: PHASE_COLORS[k] }]} />;
        })}
        {w ? <View style={[s.friezeDot, { left: Math.max(0, Math.min(w - 16, pos * w - 8)) }]} /> : null}
      </View>
      <View style={s.friezeLabels}>
        {order.map((k) => {
          const [a, b] = frieze.bounds[k];
          const on = k === phase;
          return (
            <Text key={k} style={[s.friezeLabel, { flex: Math.max(1, b - a + 1) }, on && s.friezeLabelOn]} numberOfLines={1}>
              {PHASE_SHORT[k]}{on ? ' · toi' : ''}
            </Text>
          );
        })}
        <Text style={s.friezeLabel}>J{len}</Text>
      </View>
    </View>
  );
}

/**
 * 5.2 · 2 — Règles : prochaines règles (« Dans 12 jours, vers le 27 octobre »), jour du cycle, frise des
 * 4 phases, « Mes règles ont commencé » et « Modifier ». RG-08 : pendant les règles, « Jour X des règles »,
 * flux du jour et « Mes règles sont terminées » ; en grossesse, « Semaine de grossesse ».
 */
function CycleCard({ cycle, today, onStart, onEnd, onFlowSaved }) {
  const toast = useToast();
  const [flow, setFlow] = useState(cycle.flowToday || null);
  const [saved, setSaved] = useState(cycle.flowToday || null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setFlow(cycle.flowToday || null);
    setSaved(cycle.flowToday || null);
  }, [cycle.flowToday]);
  const saveFlow = async () => {
    setBusy(true);
    try {
      await sendOrQueue('PUT', '/cycle/flow', { day: today, level: flow });
      setSaved(flow);
      toast('Flux enregistré');
      onFlowSaved?.(flow);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const modify = (
    <Pressable onPress={() => router.push('/mes-regles')} accessibilityRole="button" accessibilityLabel="Modifier mes règles" hitSlop={8} style={s.modify}>
      <Text style={s.modifyText}>Modifier</Text>
      <Icon name="chevronRight" size={12} color={colors.white} />
    </Pressable>
  );
  // Le haut de la carte (titre et date) ouvre la page Mes règles ; les boutons restent séparés.
  const shell = (head, rest, label = 'Mon cycle', open = '/mes-regles') => {
    return (
      <View style={s.cycleCard}>
        <Row justify="space-between">
          <Text style={s.cycleLabel}>{label}</Text>
          {cycle.kind === 'regles' || cycle.kind === 'prochaines' ? modify : null}
        </Row>
        <Pressable onPress={() => router.push(open)} accessibilityRole="button" accessibilityLabel={`${label}. Ouvrir`} style={({ pressed }) => pressed && { opacity: 0.85 }}>
          {head}
        </Pressable>
        {rest}
      </View>
    );
  };
  const whiteBtn = (title, onPress) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.whiteBtn, pressed && { opacity: 0.9 }]}>
      <Text style={s.whiteBtnText}>{title}</Text>
    </Pressable>
  );

  if (cycle.kind === 'grossesse') {
    return shell(
      <>
        <Text style={s.cycleTitle}>Semaine {cycle.sa?.weeks} de grossesse</Text>
        <Text style={s.cycleSub}>{cycle.sa?.weeks} SA{cycle.sa?.days ? ` + ${cycle.sa.days} j` : ''} · {cycle.trimester}e trimestre · terme le {dayMonth(cycle.dueDate)}</Text>
      </>,
      null,
      'Ma grossesse',
      '/grossesse',
    );
  }
  if (cycle.kind === 'nifas') {
    return shell(
      <>
        <Text style={s.cycleTitle}>Jour {cycle.day} du nifas</Text>
        <Text style={s.cycleSub}>{cycle.exceeded ? 'Au-delà de la durée maximale : la prière reprend (istihada).' : 'Tes rappels de prière sont en pause.'}</Text>
      </>,
      whiteBtn('Mes saignements sont terminés', () => onEnd(null, 'nifas')),
      'Post-partum',
    );
  }
  if (cycle.kind === 'regles') {
    return shell(
      <>
        <Text style={s.cycleTitle}>Jour {cycle.periodDay} des règles</Text>
        <Text style={s.cycleSub}>Flux du jour</Text>
      </>,
      <>
        <View style={{ marginTop: 6 }}>
          <FlowPicker value={flow} onChange={setFlow} compact />
        </View>
        {flow && flow !== saved ? <Button title="Enregistrer mon flux" variant="light" small onPress={saveFlow} loading={busy} disabled={busy} style={{ marginTop: 10 }} /> : null}
        {saved && flow === saved ? <Text style={s.flowSaved}>✓ Flux {FLOW_LABEL[saved]} enregistré</Text> : null}
        {whiteBtn('Mes règles sont terminées', () => onEnd(cycle.periodId))}
      </>,
      'Mes règles',
    );
  }
  if (cycle.kind === 'vide' || cycle.kind === 'postpartum') {
    return shell(
      <>
        <Text style={s.cycleTitle}>{cycle.kind === 'vide' ? 'Note tes prochaines règles' : 'Retour des règles imprévisible'}</Text>
        <Text style={s.cycleSub}>{cycle.kind === 'vide' ? 'Les prévisions démarrent dès ta première saisie.' : 'Pas de prévision tant que deux cycles n’ont pas été enregistrés.'}</Text>
      </>,
      whiteBtn('Mes règles ont commencé', onStart),
    );
  }
  const late = cycle.lateDays > 0;
  const d = cycle.daysUntil;
  return shell(
    <>
      <Text style={s.cycleTitle}>{late ? `${cycle.lateDays} jour${cycle.lateDays > 1 ? 's' : ''} de retard` : d === 0 ? 'Aujourd’hui' : d === 1 ? 'Demain' : `Dans ${d} jours`}</Text>
      <Text style={s.cycleSub}>
        {late ? `prévues le ${dayMonth(cycle.nextDate)}` : `vers le ${dayMonth(cycle.nextDate)}`} · jour {cycle.cycleDay} du cycle{cycle.isDefault ? ' · estimation' : ''}
      </Text>
      <Frieze frieze={cycle.frieze} phase={cycle.phase?.key} />
    </>,
    whiteBtn('Mes règles ont commencé', onStart),
    'Prochaines règles',
  );
}

/** Visages d'humeur. */
function MoodFace({ mood, size = 44, on }) {
  const stroke = on ? colors.white : colors.bordeaux;
  const mouths = { sereine: 'M15 27 Q23 33 31 27', bien: 'M14 26 Q23 35 32 26', fatiguee: 'M16 29 L30 29', irritable: 'M16 30 Q23 26 30 30', triste: 'M15 31 Q23 24 31 31' };
  const eyes =
    mood === 'fatiguee' ? ['M14 19 L19 19', 'M27 19 L32 19'] : mood === 'sereine' ? ['M14 19 Q16.5 21 19 19', 'M27 19 Q29.5 21 32 19'] : mood === 'irritable' ? ['M13 16 L19 19', 'M33 16 L27 19'] : null;
  return (
    <Svg width={size} height={size} viewBox="0 0 46 46">
      <Circle cx="23" cy="23" r="21.5" fill={on ? colors.bordeaux : colors.white} stroke={on ? colors.bordeaux : stroke} strokeWidth={1.5} />
      {eyes ? eyes.map((d) => <Path key={d} d={d} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />) : (
        <>
          <Circle cx="17" cy="19" r="2" fill={stroke} />
          <Circle cx="29" cy="19" r="2" fill={stroke} />
        </>
      )}
      <Path d={mouths[mood]} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** 5.2 · 3 et 4 — Tuiles « Jeûnes à rattraper » et « Jours blancs » (la seconde ouvre la section Jours blancs). */
function FastTiles({ fasts, ramadan, whiteDays }) {
  const n = fasts.remaining;
  const w = whiteDays || {};
  const days = (w.days || []).map((d) => Number(d.day.slice(8)));
  const month = w.days?.[0] ? dayMonth(w.days[0].day).split(' ').slice(1).join(' ') : '';
  return (
    <Row gap={12} align="stretch">
      <Pressable onPress={() => router.push('/jeunes')} accessibilityRole="button" accessibilityLabel={`Jeûnes à rattraper : ${n} jours`} style={({ pressed }) => [s.tile, pressed && { opacity: 0.85 }]}>
        <Row justify="space-between">
          <Text style={s.tileLabel}>Jeûnes à rattraper</Text>
          <Icon name="chevronRight" size={13} color={colors.muted} />
        </Row>
        <Text style={s.tileValue}>{n ? `${n} jour${n > 1 ? 's' : ''}` : 'À jour'}</Text>
        <Text style={s.tileSub} numberOfLines={2}>{ramadan.current ? `Ramadan · jour ${ramadan.day}` : ramadan.daysUntil != null ? `avant Ramadan · ${ramadan.daysUntil} j restants` : 'Tout est rattrapé'}</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/jeunes?tab=volontaires&section=blancs')} accessibilityRole="button" accessibilityLabel="Jours blancs" style={({ pressed }) => [s.tile, pressed && { opacity: 0.85 }]}>
        <Row justify="space-between">
          <Text style={s.tileLabel}>Jours blancs</Text>
          <Icon name="chevronRight" size={13} color={colors.muted} />
        </Row>
        <Text style={s.tileValue}>{w.inProgress ? 'En cours' : w.daysUntil === 0 ? 'Aujourd’hui' : w.daysUntil === 1 ? 'Demain' : w.daysUntil != null ? `Dans ${w.daysUntil} jours` : '—'}</Text>
        <Text style={s.tileSub} numberOfLines={2}>{days.length ? `Jeûne recommandé les ${days.slice(0, -1).join(', ')} et ${days[days.length - 1]} ${month}` : 'Jeûne recommandé'}</Text>
      </Pressable>
    </Row>
  );
}

/** 5.2 · 5 — Mes notes : prochaines notes et rappels, « Ajouter une note », « Voir mon calendrier », « Tout voir ». */
function NotesCard({ notes }) {
  return (
    <Card style={{ gap: 4 }}>
      <Row justify="space-between">
        <Text style={s.cardTitle}>Mes notes</Text>
        <Pressable onPress={() => router.push('/notes')} accessibilityRole="link" hitSlop={8}>
          <Text style={s.seeAllText}>Tout voir</Text>
        </Pressable>
      </Row>
      {notes?.length ? (
        notes.map((n, i) => <NoteRow key={`${n.noteId}-${n.day}`} n={n} compact last={i === notes.length - 1} onPress={() => router.push(`/notes/nouvelle?id=${n.noteId}`)} />)
      ) : (
        <T variant="small" style={{ paddingVertical: 6 }}>Médicament, cours, rendez-vous… note-le à n’importe quelle date, avec un rappel si tu veux.</T>
      )}
      <Row gap={8} style={{ marginTop: 8 }}>
        <Pressable onPress={() => router.push('/notes/nouvelle')} accessibilityRole="button" style={[s.pillBtn, s.pillBtnOn]}>
          <Icon name="plus" size={15} color={colors.white} />
          <Text style={[s.pillBtnText, { color: colors.white }]} numberOfLines={1} adjustsFontSizeToFit>Ajouter une note</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/calendrier')} accessibilityRole="button" style={s.pillBtn}>
          <Icon name="calendar" size={15} color={colors.bordeaux} />
          <Text style={s.pillBtnText} numberOfLines={1} adjustsFontSizeToFit>Voir mon calendrier</Text>
        </Pressable>
      </Row>
    </Card>
  );
}

/** 5.2 · 6 — Comment tu te sens ? Humeur (5 visages), symptômes en un geste, bouton bordeaux « Suivi santé ». */
function FeelCard({ health, onMood, onSymptom, onWeight }) {
  const last = health.lastWeight;
  return (
    <Card style={{ gap: 14 }}>
      <Text style={s.cardTitle}>Comment tu te sens ?</Text>
      <Row gap={2} justify="space-between">
        {MOODS.map((m) => {
          const on = health.mood === m.key;
          return (
            <Pressable key={m.key} onPress={() => onMood(on ? null : m.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={m.label} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
              <MoodFace mood={m.key} on={on} size={42} />
              <Text style={[s.moodLabel, on && { color: colors.bordeaux, fontFamily: fonts.bold }]} numberOfLines={1}>{m.label}</Text>
            </Pressable>
          );
        })}
      </Row>
      <View style={s.symptoms}>
        {HOME_SYMPTOMS.map((k) => {
          const on = health.symptoms?.includes(k);
          return <Chip key={k} label={SYMPTOMS[k]} selected={on} onPress={() => onSymptom(k, !on)} />;
        })}
      </View>
      <Pressable onPress={onWeight} accessibilityRole="button" accessibilityLabel={last ? `Mon poids : ${kg(last.weight)} kilos. Modifier` : 'Ajouter mon poids'} style={s.weightLine}>
        <Icon name="scale" size={17} color={colors.bordeaux} />
        <Text style={s.weightLabel}>Mon poids</Text>
        <Text style={last ? s.weightValue : s.weightAdd}>{last ? `${kg(last.weight)} kg` : 'Ajouter'}</Text>
        <Icon name="chevronRight" size={14} color={colors.muted} />
      </Pressable>
      <Button title="Suivi santé" icon="heart" onPress={() => router.push('/sante')} />
    </Card>
  );
}

/** 5.2 · 7 — Conseil santé adapté à la phase (RG-08 ter) ; ouvre l'article lié, sinon le détail. */
function TipCard({ tip, onOpen }) {
  if (!tip) return null;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Conseil santé : ${tip.title}`} style={({ pressed }) => [s.tipCard, pressed && { opacity: 0.9 }]}>
      <Row gap={12} align="flex-start">
        <View style={s.tipIcon}>
          <Icon name="bulb" size={18} color={colors.or} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.tipLabel}>Conseil santé · {PHASE_NAMES[tip.phase] || 'aujourd’hui'}</Text>
          <Text style={s.tipTitle}>{tip.title}</Text>
        </View>
      </Row>
      <T style={{ lineHeight: 22 }} numberOfLines={5}>{tip.text}</T>
      <T variant="small">{tip.reviewed ? 'Relu par une sage-femme' : 'Conseil Nissali'}{tip.article ? ' · lire l’article' : ''}</T>
    </Pressable>
  );
}

/** 5.2 · 8 — Petit rappel : verset, hadith ou invocation du jour, validé par le comité. */
function ReminderCard({ reminder }) {
  if (!reminder?.text) return null;
  return (
    <View style={s.reminder} accessibilityRole="text">
      <Text style={s.reminderLabel}>Petit rappel</Text>
      <Text style={s.reminderText}>{reminder.text}</Text>
      {reminder.source ? <Text style={s.reminderSource}>{reminder.kind === 'verset' ? '' : 'Rapporté par '}{reminder.source}</Text> : null}
    </View>
  );
}

/** 15 — Conseil santé autonome ; « En savoir plus » seulement si un article approfondit le même sujet. */
function TipSheet({ tip, weatherTips, visible, onClose }) {
  if (!tip) return null;
  const a = tip.article;
  return (
    <Sheet visible={visible} onClose={onClose} title="Mon conseil santé">
      <Text style={s.tipLabel}>Conseil santé · {PHASE_NAMES[tip.phase] || 'aujourd’hui'}</Text>
      <T variant="h3" style={{ fontSize: 20 }}>{tip.title}</T>
      <T style={{ lineHeight: 24 }}>{tip.text}</T>
      {weatherTips?.[0] ? <T variant="small">{weatherTips[0].text}</T> : null}
      <T variant="small">{tip.reviewed ? 'Relu par une sage-femme' : 'Conseil Nissali'}</T>
      {a ? (
        <Pressable
          onPress={() => {
            onClose();
            router.push(`/blog/${a.slug}`);
          }}
          accessibilityRole="link"
          accessibilityLabel={`En savoir plus : ${a.title}`}
          style={({ pressed }) => [s.moreCard, pressed && { opacity: 0.85 }]}
        >
          {a.coverUrl ? <Image source={{ uri: assetUrl(a.coverUrl) }} style={s.moreImg} resizeMode="cover" accessibilityLabel={a.coverAlt || a.title} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.moreLabel}>En savoir plus{a.readMinutes ? ` · ${a.readMinutes} min` : ''}</Text>
            <Text style={s.moreTitle} numberOfLines={2}>{a.title}</Text>
          </View>
          <Icon name="chevronRight" size={18} color={colors.bordeaux} />
        </Pressable>
      ) : null}
    </Sheet>
  );
}

export default function Today() {
  const { user, setSession } = useAuth();
  const toast = useToast();
  const { data, setData, loading, error, offline, reload } = useApi('/today');
  const { openStart, openEnd, sheets } = usePeriodActions(reload);
  const scheduled = useRef(null);
  const [adhanOpen, setAdhanOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [freqClosed, setFreqClosed] = useState(false);
  const userRef = useRef(user);
  userRef.current = user;

  // 6.8 — Horaires (API Aladhan) et qibla à la position exacte : la position est envoyée à l'ouverture
  // et au retour dans l'appli ; si elle a changé, l'écran et les notifications sont recalculés.
  const locate = async ({ ask = false, force = false } = {}) => {
    const session = await syncLocation(userRef.current, { ask, force });
    if (session) {
      await setSession(session);
      reload();
    }
    return session;
  };
  useEffect(() => {
    (async () => {
      const asked = await readJson('nissali.locationAsked', false);
      if (!asked) await writeJson('nissali.locationAsked', true);
      await locate({ ask: !asked });
    })();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && locate());
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notifications locales : reprogrammées à chaque nouvel état (pause pendant les règles, position, horaires, son).
  useEffect(() => {
    if (!data || offline) return;
    const loc = data.prayers.location;
    const ps = user?.prayerSettings || {};
    const key = `${data.today}-${data.prayers.paused}-${data.cycle.kind}-${data.fasts.nextPlanned}-${loc?.lat},${loc?.lng}-${data.prayers.timings.fajr}-${data.prayers.sourceInfo?.label}-${(data.prayers.reminders || []).length}-${ps.notifications}-${ps.adhanMode}-${ps.adhan}-${JSON.stringify(ps.adhanPrayers || {})}-${ps.adhanVoice}-${JSON.stringify(ps.notifyPrayers || {})}-${data.notesStamp}-${(data.fasts.planNext || []).join(',')}-${(data.fasts.voluntaryNext || []).join(',')}-${data.fasts.reminderTime}-${data.fasts.voluntaryReminderTime}-${user?.notificationPrefs?.fastPlanned}-${user?.notificationPrefs?.fastMakeup}-${JSON.stringify(user?.dhikr || {})}-${user?.notificationPrefs?.hideNotePreview}`;
    if (scheduled.current === key) return;
    scheduled.current = key;
    rescheduleAll(data, user).catch(() => {});
  }, [data, offline, user]);

  if (loading && !data) return <Screen><Loader /></Screen>;
  if (error && !data) {
    if (error.code === 'HEALTH_CONSENT_REQUIRED') {
      router.replace('/consentement');
      return null;
    }
    return <Screen title="Aujourd’hui"><ErrorState error={error} onRetry={reload} /></Screen>;
  }

  // Hors connexion et cache d'un autre jour : horaires recalculés localement.
  let prayers = data.prayers;
  const nowDate = new Date();
  const localDay = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
  if (offline && data.today !== localDay && user?.city) {
    const t = localTimings(user.city, nowDate, data.prayers.method);
    if (t) prayers = { ...prayers, timings: { ...t, day: localDay }, checked: {} };
  }

  const togglePrayer = async (p, done) => {
    setData((d) => ({ ...d, prayers: { ...d.prayers, checked: { ...d.prayers.checked, [p]: done } } }));
    await sendOrQueue('PUT', '/prayers/check', { day: data.today, prayer: p, done }).catch((e) => toast(e.message, 'error'));
  };
  const saveMood = async (mood) => {
    setData((d) => ({ ...d, health: { ...d.health, mood } }));
    await sendOrQueue('PUT', `/health-log/day/${data.today}`, { mood }).catch((e) => toast(e.message, 'error'));
  };
  const saveSymptom = async (k, on) => {
    const symptoms = on ? [...new Set([...(data.health.symptoms || []), k])] : (data.health.symptoms || []).filter((x) => x !== k);
    setData((d) => ({ ...d, health: { ...d.health, symptoms } }));
    await sendOrQueue('PUT', `/health-log/day/${data.today}`, { symptoms }).catch((e) => toast(e.message, 'error'));
  };
  const openTip = () => {
    const a = data.healthTip?.article;
    if (a?.slug) router.push(`/blog/${a.slug}`);
    else setTipOpen(true);
  };
  const answerPeriodEnded = async (ended) => {
    if (ended) return openEnd(data.cycle.periodId);
    setData((d) => ({ ...d, cycle: { ...d.cycle, askPeriodEnded: false } }));
  };

  const c = data.cycle;
  const last = data.health.lastWeight;
  return (
    <Screen onRefresh={reload} refreshing={false} top={<BrandBar unread={data.notificationsUnread} />}>
      <View style={{ marginBottom: 16 }}>
        <T variant="h1" accessibilityRole="header" fit>Salam, {user?.firstName}</T>
        <T variant="muted">
          {longDate(data.today)}
          {data.hijri?.label ? ` · ${data.hijri.label}` : ''}
        </T>
      </View>
      <OfflineBanner visible={offline} />

      {/* 1 · Prières */}
      <PrayersCard prayers={prayers} onToggle={togglePrayer} onAdhanSettings={() => setAdhanOpen(true)} />
      <Gap />

      {data.ramadan.current ? (
        <>
          <Card tone="soft" style={{ gap: 6 }}>
            <Label color={colors.or}>Ramadan · jour {data.ramadan.day}</Label>
            <Row justify="space-between">
              <T variant="h3">Suhur {prayers.timings.fajr}</T>
              <T variant="h3">Iftar {prayers.timings.maghrib}</T>
            </Row>
          </Card>
          <Gap />
        </>
      ) : null}

      {/* 2 · Règles */}
      <CycleCard cycle={c} today={data.today} onStart={openStart} onEnd={openEnd} onFlowSaved={(level) => setData((d) => ({ ...d, cycle: { ...d.cycle, flowToday: level } }))} />
      <Gap />

      {c.askPeriodEnded ? (
        <>
          <Card tone="soft" style={{ gap: 12 }}>
            <T variant="h3">Tes règles sont-elles terminées ?</T>
            <Row>
              <Button title="Oui" small onPress={() => answerPeriodEnded(true)} style={{ flex: 1 }} />
              <Button title="Pas encore" small variant="outline" onPress={() => answerPeriodEnded(false)} style={{ flex: 1 }} />
            </Row>
          </Card>
          <Gap />
        </>
      ) : null}
      {c.istihada && c.istihadaInfo ? (
        <>
          <Notice title="Istihada">{c.istihadaInfo}</Notice>
          <Gap />
        </>
      ) : null}
      {c.askPregnancy ? (
        <>
          <Card tone="soft" style={{ gap: 12 }}>
            <T variant="h3">Tes règles ont {c.lateDays} jours de retard. Es-tu enceinte ?</T>
            <T variant="muted">Un test de grossesse peut te le confirmer.</T>
            <Button title="Oui, je suis enceinte" small onPress={() => router.push('/grossesse')} />
          </Card>
          <Gap />
        </>
      ) : null}
      {data.purification ? (
        <>
          <Card tone="soft" style={{ gap: 8 }}>
            <Label>Après ton ghusl</Label>
            {data.purification.prayers?.length ? (
              <T variant="h3">{data.purification.prayers.map((p) => PRAYER_LABELS[p]).join(' et ')} à accomplir</T>
            ) : data.purification.prayers ? (
              <T>Reprends tes prières à leur heure.</T>
            ) : (
              <T>Tes prières reprennent. Indique l’heure de fin de tes règles pour savoir quelles prières accomplir.</T>
            )}
            <Pressable onPress={() => router.push('/blog/comment-faire-mes-grandes-ablutions-ghusl')}>
              <T variant="medium" color={colors.bordeaux}>Comment faire mon ghusl →</T>
            </Pressable>
          </Card>
          <Gap />
        </>
      ) : null}

      {/* 3 et 4 · Jeûnes à rattraper, jours blancs */}
      <FastTiles fasts={data.fasts} ramadan={data.ramadan} whiteDays={data.whiteDays} />
      <Gap />

      {/* 5 · Mes notes */}
      <NotesCard notes={data.notes} />
      <Gap />

      {/* 6 · Comment tu te sens ? */}
      <FeelCard health={data.health} onMood={saveMood} onSymptom={saveSymptom} onWeight={() => setWeightOpen(true)} />
      <Gap />

      {/* 7 · Conseil santé */}
      {data.healthTip ? (
        <>
          <TipCard tip={data.healthTip} onOpen={openTip} />
          <Gap />
        </>
      ) : null}

      {/* 8 · Petit rappel */}
      <ReminderCard reminder={data.reminder} />

      <TipSheet tip={data.healthTip} weatherTips={data.tips} visible={tipOpen} onClose={() => setTipOpen(false)} />
      <WeightSheet
        visible={weightOpen}
        onClose={() => setWeightOpen(false)}
        entry={last && last.day === data.today ? last : null}
        lastWeight={last?.weight}
        onSaved={(m) => {
          if (m) setData((d) => ({ ...d, health: { ...d.health, lastWeight: !d.health.lastWeight || m.day >= d.health.lastWeight.day ? m : d.health.lastWeight } }));
          else reload();
        }}
      />
      <AdhanSoundSheet visible={adhanOpen} onClose={() => setAdhanOpen(false)} paused={prayers.paused} />
      {/* 5.12 — fréquence des notifications, proposée une fois après l'inscription */}
      <Sheet
        visible={Boolean(user && user.notificationPrefs && !user.notificationPrefs.frequencyAsked && !freqClosed)}
        onClose={() => {
          setFreqClosed(true);
          api.patch('/me', { notificationPrefs: { frequencyAsked: true } }).then(setSession).catch(() => {});
        }}
        title="Combien de notifications ?"
      >
        <T variant="muted">Choisis combien de conseils et d’actualités tu reçois. Tu pourras changer à tout moment dans ton profil.</T>
        <FrequencyPicker
          value={user?.notificationPrefs?.frequency || 'faible'}
          onChange={async (v) => {
            setFreqClosed(true);
            try {
              await setSession(await api.patch('/me', { notificationPrefs: { frequency: v, frequencyAsked: true } }));
              toast('Fréquence enregistrée');
            } catch (e) {
              toast(e.message, 'error');
            }
          }}
        />
      </Sheet>
      {sheets}
    </Screen>
  );
}

const s = StyleSheet.create({
  cardTitle: { fontFamily: fonts.title, fontSize: 19, color: colors.prune },
  placeText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, flexShrink: 1 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  pausedIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  pausedTitle: { fontFamily: fonts.title, fontSize: 18, color: colors.prune },
  qiblaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1.5, borderColor: '#EAD1D6', backgroundColor: colors.blush },
  qiblaText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  dhikrBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  prayerRow: { flexDirection: 'row', marginTop: 12 },
  prayerCol: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4, paddingVertical: 6, borderRightWidth: 1, borderRightColor: colors.line },
  prayerName: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  prayerTime: { fontFamily: fonts.bold, color: colors.prune },
  check: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.rose, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.or, borderColor: colors.or },
  adhanRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: colors.line },
  adhanText: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.prune },
  adhanState: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  cycleCard: { backgroundColor: colors.bordeaux, borderRadius: 26, padding: 20, gap: 4, overflow: 'hidden' },
  cycleLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.rose },
  cycleTitle: { fontFamily: fonts.title, fontSize: 30, lineHeight: 36, color: colors.white, marginTop: 2 },
  cycleSub: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.rose },
  modify: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  modifyText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  frieze: { flexDirection: 'row', height: 8, gap: 4, alignItems: 'center' },
  friezeSeg: { height: 8, borderRadius: 4 },
  friezeDot: { position: 'absolute', top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.or },
  friezeLabels: { flexDirection: 'row', gap: 4, marginTop: 8 },
  friezeLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.rose },
  friezeLabelOn: { fontFamily: fonts.bold, color: colors.white },
  whiteBtn: { marginTop: 16, borderRadius: 999, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  whiteBtnText: { fontFamily: fonts.bold, fontSize: 15, color: colors.bordeaux },
  flowSaved: { fontFamily: fonts.bold, fontSize: 13, color: colors.white, marginTop: 8 },
  tile: { flex: 1, backgroundColor: colors.white, borderRadius: 22, padding: 14, gap: 4, borderWidth: 1, borderColor: colors.line },
  tileLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  tileValue: { fontFamily: fonts.title, fontSize: 22, color: colors.prune },
  tileSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  pillBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, borderRadius: 999, borderWidth: 1.5, borderColor: colors.bordeaux, paddingHorizontal: 8 },
  pillBtnOn: { backgroundColor: colors.bordeaux },
  pillBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.bordeaux, flexShrink: 1 },
  moodLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted },
  symptoms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weightLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  weightLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.prune },
  weightValue: { fontFamily: fonts.title, fontSize: 17, color: colors.prune },
  weightAdd: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  tipCard: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.line },
  tipIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F6EBDD', alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontFamily: fonts.title, fontSize: 18, lineHeight: 23, color: colors.prune },
  reminder: { backgroundColor: colors.blush, borderRadius: 24, padding: 18, gap: 8, marginTop: 16, borderWidth: 1, borderColor: '#F0D5DA' },
  reminderLabel: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.bordeaux },
  reminderText: { fontFamily: fonts.title, fontStyle: 'italic', fontSize: 17, lineHeight: 25, color: colors.prune },
  reminderSource: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  tipLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.or, letterSpacing: 0.4 },
  moreCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.blush, borderRadius: 18, padding: 10, paddingRight: 14 },
  moreImg: { width: 72, height: 54, borderRadius: 12, backgroundColor: colors.line },
  moreLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.bordeaux, textTransform: 'uppercase' },
  moreTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.prune },
});

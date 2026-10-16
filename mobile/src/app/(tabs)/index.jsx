// 01 — Accueil « Aujourd'hui » (maquette du 16 octobre 2026, page 4). Dans cet ordre : prières, cycle et flux,
// solde de jeûnes, santé avec humeur et poids, accès au conseil santé. Logo Nissali en haut à gauche.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { AdhanSoundSheet, useAdhanPrefs } from '../../components/AdhanSound';
import { BrandBar } from '../../components/Brand';
import { FLOW_LABEL, FlowPicker } from '../../components/Flow';
import Icon from '../../components/Icon';
import { usePeriodActions } from '../../components/PeriodSheets';
import { Button, Card, ErrorState, Gap, Label, Loader, Notice, OfflineBanner, Row, Screen, Sheet, T, useToast } from '../../components/ui';
import { kg, WeightSheet } from '../../components/Weight';
import { assetUrl, sendOrQueue } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { countdown, dayMonth, longDate } from '../../lib/format';
import { jumuaOf } from '../../lib/jumua';
import { syncLocation } from '../../lib/location';
import { rescheduleAll } from '../../lib/notifications';
import { localTimings } from '../../lib/prayerLocal';
import { readJson, writeJson } from '../../lib/storage';
import { useApi } from '../../lib/useApi';
import { colors, fonts, PRAYER_LABELS, PRAYERS } from '../../theme';

const PRAYER_ICONS = { fajr: 'sunrise', dhuhr: 'sun', asr: 'sun', maghrib: 'sunset', isha: 'moon' };
const PHASE_NAMES = { menstruelle: 'phase menstruelle', folliculaire: 'phase folliculaire', ovulatoire: 'phase ovulatoire', luteale: 'phase lutéale', grossesse: 'grossesse' };
const HOME_MOODS = [
  { key: 'bien', label: 'Bien' },
  { key: 'fatiguee', label: 'Fatiguée' },
  { key: 'sereine', label: 'Sereine' },
];

/** 06 — Mes prières : les 5 horaires restent lisibles pendant les règles (« Rappels en pause », sans griser). */
function PrayersCard({ prayers, onToggle, onOpenDhikr, onAdhanSettings }) {
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

  return (
    <Card style={{ paddingHorizontal: 14, paddingVertical: 16 }}>
      <Row justify="space-between" gap={8} style={{ paddingHorizontal: 4 }}>
        <Pressable onPress={() => router.push('/horaires')} accessibilityRole="button" accessibilityLabel={`Mes prières à ${place}. Ouvrir les horaires`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.cardTitle}>Mes prières</Text>
          <Text style={s.placeText} numberOfLines={1}>· {place}</Text>
          <Icon name={src.mode === 'mosquee' ? 'home' : 'pin'} size={14} color={colors.muted} />
        </Pressable>
        <Pressable onPress={() => router.push('/horaires')} accessibilityRole="link" hitSlop={8} style={s.seeAll}>
          <Text style={s.seeAllText}>Voir tout</Text>
          <Icon name="chevronRight" size={14} color={colors.bordeaux} />
        </Pressable>
      </Row>
      {paused ? (
        <Pressable onPress={onOpenDhikr} accessibilityRole="button" style={s.pausedRow}>
          <Icon name="bellOff" size={15} color={colors.muted} />
          <Text style={s.pausedText}>Rappels en pause{prayers.pauseReason === 'nifas' ? ' pendant ton nifas' : ''} · dhikr</Text>
        </Pressable>
      ) : nextKey ? (
        <Text style={s.nextText}>{PRAYER_LABELS[nextKey]} dans {countdown(t.instants[nextKey], now)}</Text>
      ) : null}
      <View style={s.prayerRow}>
        {PRAYERS.map((p) => {
          const next = p === nextKey;
          const done = prayers.checked?.[p];
          return (
            <Pressable
              key={p}
              onPress={() => (paused ? router.push('/horaires') : onToggle(p, !done))}
              accessibilityRole={paused ? 'button' : 'checkbox'}
              accessibilityState={paused ? undefined : { checked: Boolean(done) }}
              accessibilityLabel={`${PRAYER_LABELS[p]} ${t[p]}${done ? ', accomplie' : ''}${next ? ', prochaine prière' : ''}`}
              style={({ pressed }) => [s.prayerCol, p === 'isha' && { borderRightWidth: 0 }, pressed && { opacity: 0.7 }]}
            >
              <Icon name={PRAYER_ICONS[p]} size={21} color={next ? colors.bordeaux : colors.or} />
              <Text style={[s.prayerName, next && { color: colors.bordeaux }]} numberOfLines={1}>{PRAYER_LABELS[p]}</Text>
              <Text style={[s.prayerTime, { fontSize: timeSize }, next && { color: colors.bordeaux }]} numberOfLines={1}>{t[p]}</Text>
              {!paused ? <View style={[s.check, done && s.checkDone]}>{done ? <Icon name="check" size={10} color={colors.white} strokeWidth={3} /> : null}</View> : null}
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

/** Décor de vagues de la carte « Mon cycle ». */
function Waves() {
  return (
    <Svg width={170} height={90} viewBox="0 0 170 90" style={s.waves} pointerEvents="none">
      <Path d="M20 0c20 26 46 34 80 24s58-2 70 18V0z" fill={colors.rose} opacity={0.35} />
      <Path d="M60 0c14 20 36 26 62 18s40 0 48 14V0z" fill={colors.rose} opacity={0.45} />
    </Svg>
  );
}

/** 02 · Mon cycle : jour des règles et flux du jour (aucun choix pré-coché), ou prochaines règles. */
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
      <Icon name="chevronRight" size={13} color={colors.bordeaux} />
    </Pressable>
  );
  const shell = (children, label = 'Mon cycle') => (
    <View style={s.cycleCard}>
      <Waves />
      <Row justify="space-between">
        <Text style={s.cycleLabel}>{label.toUpperCase()}</Text>
        {cycle.kind === 'regles' || cycle.kind === 'prochaines' ? modify : null}
      </Row>
      {children}
    </View>
  );

  if (cycle.kind === 'grossesse') {
    return shell(
      <Pressable onPress={() => router.push('/grossesse')} accessibilityRole="button" style={{ gap: 4 }}>
        <Text style={s.cycleTitle}>{cycle.sa?.weeks} SA{cycle.sa?.days ? ` + ${cycle.sa.days} j` : ''}</Text>
        <T>{cycle.trimester}e trimestre · terme le {dayMonth(cycle.dueDate)}</T>
      </Pressable>,
      'Ma grossesse',
    );
  }
  if (cycle.kind === 'nifas') {
    return shell(
      <>
        <Text style={s.cycleTitle}>Jour {cycle.day} du nifas</Text>
        <T>{cycle.exceeded ? 'Au-delà de la durée maximale : la prière reprend (istihada).' : 'Tes rappels de prière sont en pause.'}</T>
        <Pressable onPress={() => onEnd(null, 'nifas')} accessibilityRole="button" style={s.outlineBtn}>
          <Text style={s.outlineText}>Mes saignements sont terminés</Text>
        </Pressable>
      </>,
      'Post-partum',
    );
  }
  if (cycle.kind === 'regles') {
    return shell(
      <>
        <Pressable onPress={() => router.push('/mes-regles')} accessibilityRole="button">
          <Text style={s.cycleTitle}>Jour {cycle.periodDay} des règles</Text>
        </Pressable>
        <Text style={s.flowLabel}>Flux du jour</Text>
        <FlowPicker value={flow} onChange={setFlow} compact />
        {flow && flow !== saved ? <Button title="Enregistrer mon flux" small onPress={saveFlow} loading={busy} disabled={busy} style={{ marginTop: 10 }} /> : null}
        {saved && flow === saved ? <Text style={s.flowSaved}>✓ Flux {FLOW_LABEL[saved]} enregistré</Text> : null}
        <Pressable onPress={() => onEnd(cycle.periodId)} accessibilityRole="button" style={s.outlineBtn}>
          <Text style={s.outlineText}>Mes règles sont terminées</Text>
        </Pressable>
      </>,
    );
  }
  if (cycle.kind === 'vide' || cycle.kind === 'postpartum') {
    return shell(
      <>
        <Text style={s.cycleTitle}>{cycle.kind === 'vide' ? 'Note tes prochaines règles' : 'Retour des règles imprévisible'}</Text>
        <T>{cycle.kind === 'vide' ? 'Les prévisions démarrent dès ta première saisie.' : 'Pas de prévision tant que deux cycles n’ont pas été enregistrés.'}</T>
        <Pressable onPress={onStart} accessibilityRole="button" style={s.outlineBtn}>
          <Text style={s.outlineText}>Mes règles ont commencé</Text>
        </Pressable>
      </>,
    );
  }
  const late = cycle.lateDays > 0;
  return shell(
    <>
      <Pressable onPress={() => router.push('/cycle')} accessibilityRole="button" accessibilityLabel={`Jour ${cycle.cycleDay} du cycle. Ouvrir mon cycle`}>
        <Text style={s.cycleTitle}>Jour {cycle.cycleDay} du cycle</Text>
        <T>
          {late ? `Règles en retard de ${cycle.lateDays} jour${cycle.lateDays > 1 ? 's' : ''}` : `Prochaines règles autour du ${dayMonth(cycle.nextDate)}`}
        </T>
        <Row gap={5} style={{ marginTop: 4 }}>
          <Icon name="info" size={13} color={colors.muted} />
          <T variant="small">Estimation indicative</T>
        </Row>
      </Pressable>
      <Pressable onPress={onStart} accessibilityRole="button" style={s.outlineBtn}>
        <Text style={s.outlineText}>Mes règles ont commencé</Text>
      </Pressable>
    </>,
  );
}

/** Visages d'humeur. */
function MoodFace({ mood, size = 44, on }) {
  const stroke = on ? colors.white : mood === 'fatiguee' ? colors.or : mood === 'bien' ? colors.success : colors.bordeaux;
  const mouths = { sereine: 'M15 27 Q23 33 31 27', bien: 'M14 26 Q23 35 32 26', fatiguee: 'M16 29 L30 29' };
  const eyes = mood === 'fatiguee' ? ['M14 19 L19 19', 'M27 19 L32 19'] : mood === 'sereine' ? ['M14 19 Q16.5 21 19 19', 'M27 19 Q29.5 21 32 19'] : null;
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

/** 02 · Ma santé aujourd'hui : humeur et poids (carte entière cliquable, jamais de valeur fictive), conseil santé. */
function HealthCard({ health, onMood, onWeight, onTip, hasTip }) {
  const last = health.lastWeight;
  return (
    <Card style={{ gap: 14 }}>
      <Row justify="space-between">
        <Text style={s.cardTitle}>Ma santé aujourd’hui</Text>
        <Pressable onPress={() => router.push('/sante')} accessibilityRole="link" hitSlop={8} style={s.seeAll}>
          <Text style={s.seeAllText}>Suivi</Text>
          <Icon name="chevronRight" size={14} color={colors.bordeaux} />
        </Pressable>
      </Row>
      <Row gap={10} align="stretch">
        <Row gap={2} style={{ flex: 1.45 }} justify="space-between">
          {HOME_MOODS.map((m) => {
            const on = health.mood === m.key;
            return (
              <Pressable key={m.key} onPress={() => onMood(on ? null : m.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={m.label} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                <MoodFace mood={m.key} on={on} size={40} />
                <Text style={[s.moodLabel, on && { color: colors.bordeaux, fontFamily: fonts.bold }]} numberOfLines={1}>{m.label}</Text>
              </Pressable>
            );
          })}
        </Row>
        <Pressable onPress={onWeight} accessibilityRole="button" accessibilityLabel={last ? `Mon poids : ${kg(last.weight)} kilos. Modifier` : 'Ajouter mon poids'} style={({ pressed }) => [s.weightBox, pressed && { opacity: 0.85 }]}>
          <Row gap={6}>
            <Icon name="scale" size={18} color={colors.bordeaux} />
            <Text style={s.weightLabel}>Mon poids</Text>
          </Row>
          {last ? (
            <Row gap={6}>
              <Text style={s.weightValue}>{kg(last.weight)} kg</Text>
              <Icon name="edit" size={14} color={colors.bordeaux} />
              <Icon name="chevronRight" size={14} color={colors.muted} />
            </Row>
          ) : (
            <Row gap={4}>
              <Text style={s.weightAdd}>Ajouter mon poids</Text>
              <Icon name="chevronRight" size={14} color={colors.bordeaux} />
            </Row>
          )}
        </Pressable>
      </Row>
      {hasTip ? (
        <Pressable onPress={onTip} accessibilityRole="button" style={s.tipLinkRow}>
          <Icon name="bulb" size={18} color={colors.or} />
          <Text style={s.seeAllText}>Mon conseil santé</Text>
          <Icon name="chevronRight" size={14} color={colors.bordeaux} />
        </Pressable>
      ) : null}
    </Card>
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
  const [dhikrOpen, setDhikrOpen] = useState(false);
  const [adhanOpen, setAdhanOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
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
    const key = `${data.today}-${data.prayers.paused}-${data.cycle.kind}-${data.fasts.nextPlanned}-${loc?.lat},${loc?.lng}-${data.prayers.timings.fajr}-${data.prayers.sourceInfo?.label}-${(data.prayers.reminders || []).length}-${ps.notifications}-${ps.adhanMode}-${ps.adhan}-${JSON.stringify(ps.adhanPrayers || {})}-${ps.adhanVoice}`;
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
      <PrayersCard prayers={prayers} onToggle={togglePrayer} onOpenDhikr={() => setDhikrOpen(true)} onAdhanSettings={() => setAdhanOpen(true)} />
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

      {/* 2 · Cycle et flux */}
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

      {/* 3 · Solde de jeûnes */}
      <Pressable onPress={() => router.push('/jeunes')} accessibilityRole="button" accessibilityLabel={`Jeûnes à rattraper : ${data.fasts.remaining} jours restants`} style={({ pressed }) => [s.fastsRow, pressed && { opacity: 0.85 }]}>
        <Icon name="calendar" size={20} color={colors.bordeaux} />
        <Text style={s.fastsTitle} numberOfLines={1}>Jeûnes à rattraper</Text>
        <Text style={s.fastsValue}>{data.fasts.remaining ? `${data.fasts.remaining} jour${data.fasts.remaining > 1 ? 's' : ''} restant${data.fasts.remaining > 1 ? 's' : ''}` : 'Tout est rattrapé'}</Text>
        <Icon name="chevronRight" size={16} color={colors.muted} />
      </Pressable>
      <Gap />

      {/* 4 · Santé avec humeur et poids — 5 · accès au conseil santé */}
      <HealthCard health={data.health} onMood={saveMood} onWeight={() => setWeightOpen(true)} onTip={() => setTipOpen(true)} hasTip={Boolean(data.healthTip)} />

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
      <Sheet visible={dhikrOpen} onClose={() => setDhikrOpen(false)} title="Pendant ta pause">
        <T>Tes horaires restent consultables ; les rappels de prière sont en pause et aucune prière n’est comptée comme manquée. Le dhikr et les invocations restent accessibles à tout moment.</T>
        <Card tone="soft" style={{ gap: 6 }}>
          <Label color={colors.or}>Dhikr</Label>
          <T variant="quote">{data.prayers.dhikr || 'SubhanAllah, Alhamdulillah, Allahu akbar.'}</T>
        </Card>
        <Button title="Voir les horaires" variant="soft" small onPress={() => { setDhikrOpen(false); router.push('/horaires'); }} />
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
  pausedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 4 },
  pausedText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  nextText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 6, paddingHorizontal: 4 },
  prayerRow: { flexDirection: 'row', marginTop: 12 },
  prayerCol: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4, paddingVertical: 6, borderRightWidth: 1, borderRightColor: colors.line },
  prayerName: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  prayerTime: { fontFamily: fonts.bold, color: colors.prune },
  check: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.rose, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.or, borderColor: colors.or },
  adhanRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: colors.line },
  adhanText: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.prune },
  adhanState: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  cycleCard: { backgroundColor: colors.blush, borderRadius: 26, padding: 20, gap: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#F0D5DA' },
  waves: { position: 'absolute', top: 0, right: 0 },
  cycleLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, color: colors.bordeaux },
  cycleTitle: { fontFamily: fonts.title, fontSize: 26, lineHeight: 32, color: colors.prune, marginTop: 2 },
  modify: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  modifyText: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux },
  flowLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.prune, marginTop: 8, marginBottom: 2 },
  flowSaved: { fontFamily: fonts.bold, fontSize: 13, color: colors.bordeaux, marginTop: 8 },
  outlineBtn: { marginTop: 12, borderRadius: 999, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.bordeaux, backgroundColor: 'rgba(255,255,255,0.6)' },
  outlineText: { fontFamily: fonts.bold, fontSize: 15, color: colors.bordeaux },
  fastsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 22, paddingHorizontal: 16, minHeight: 58, borderWidth: 1, borderColor: colors.line },
  fastsTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 15.5, color: colors.prune },
  fastsValue: { fontFamily: fonts.medium, fontSize: 14, color: colors.prune, flexShrink: 0 },
  moodLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  weightBox: { flex: 1, backgroundColor: colors.ivoire, borderRadius: 18, padding: 12, gap: 8, justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  weightLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  weightValue: { fontFamily: fonts.title, fontSize: 21, color: colors.prune },
  weightAdd: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux },
  tipLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  tipLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.or, letterSpacing: 0.4 },
  moreCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.blush, borderRadius: 18, padding: 10, paddingRight: 14 },
  moreImg: { width: 72, height: 54, borderRadius: 12, backgroundColor: colors.line },
  moreLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.bordeaux, textTransform: 'uppercase' },
  moreTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.prune },
});

// 5.2 — Tableau de bord « Aujourd'hui » (maquette V3, page 8). Dans cet ordre : prières, règles, jeûnes à
// rattraper et jours blancs, « Comment tu te sens ? », conseil santé, petit rappel. Toutes les cartes sont cliquables.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import AccountButton from '../../components/AccountSwitcher';
import Icon from '../../components/Icon';
import { usePeriodActions } from '../../components/PeriodSheets';
import { Button, Card, Chip, Chips, ErrorState, Gap, Label, Loader, Notice, OfflineBanner, Row, Screen, Sheet, Stepper, T, useToast } from '../../components/ui';
import { onAdhan, playAdhan, stopAdhan } from '../../lib/adhan';
import { sendOrQueue } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { countdown, dayMonth, longDate } from '../../lib/format';
import { locationPermission, syncLocation } from '../../lib/location';
import { jumuaOf } from '../../lib/jumua';
import { rescheduleAll } from '../../lib/notifications';
import { localTimings } from '../../lib/prayerLocal';
import { readJson, writeJson } from '../../lib/storage';
import { useApi } from '../../lib/useApi';
import { colors, fonts, MOODS, PRAYER_LABELS, PRAYERS, SYMPTOMS } from '../../theme';

const QUICK_SYMPTOMS = ['crampes', 'fatigue', 'migraine', 'ballonnements'];
const PHASE_NAMES = { menstruelle: 'phase menstruelle', folliculaire: 'phase folliculaire', ovulatoire: 'phase ovulatoire', luteale: 'phase lutéale', grossesse: 'grossesse' };
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function Header({ data, user }) {
  return (
    <Row align="flex-start" style={{ marginTop: 8, marginBottom: 16 }}>
      <View style={{ flex: 1 }}>
        <T variant="small" style={{ fontSize: 13.5 }}>
          {longDate(data.today)} · {data.hijri?.label}
        </T>
        <T variant="h1" accessibilityRole="header" fit>
          Salam, {user?.firstName}
        </T>
      </View>
      <Row gap={10}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Notifications${data.notificationsUnread ? `, ${data.notificationsUnread} non lues` : ''}`} onPress={() => router.push('/notifications')} style={s.round}>
          <Icon name="bell" size={22} color={colors.bordeaux} />
          {data.notificationsUnread ? <View style={s.badge} /> : null}
        </Pressable>
        <AccountButton />
      </Row>
    </Row>
  );
}

/** 1 — Prières : prochaine prière et compte à rebours, mosquée ou ville choisie, 5 horaires cochables, Qibla. */
function PrayersCard({ prayers, onToggle, onOpenDhikr }) {
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(Date.now());
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => onAdhan((a) => setPlaying(Boolean(a))), []);
  const src = prayers.sourceInfo || { mode: 'ville', label: prayers.city };
  const t = prayers.timings;
  const jumua = jumuaOf(src);
  const nextKey = PRAYERS.find((p) => new Date(t.instants[p]).getTime() > now);
  const place = src.mode === 'mosquee' ? src.label : prayers.city;

  // RG-08 bis — pendant les règles : une seule ligne « Prières en pause », avec accès au dhikr.
  if (prayers.paused) {
    return (
      <Card onPress={onOpenDhikr} accessibilityLabel="Prières en pause, accéder au dhikr" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18 }}>
        <View style={s.pauseIcon}>
          <Icon name="moon" size={20} color={colors.or} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="bold" style={{ fontSize: 17 }}>Prières en pause</T>
          <T variant="small">{prayers.pauseReason === 'nifas' ? 'Pendant ton nifas' : 'Pendant tes règles'} · accès au dhikr</T>
        </View>
        <Icon name="chevronRight" size={20} color={colors.muted} />
      </Card>
    );
  }

  const col = (Math.min(width, 520) - 40 - 32 - 4 * 4) / 5;
  const nameSize = Math.max(10.5, Math.min(13.5, col / 4.3));
  const timeSize = Math.max(14, Math.min(18, col / 3.2));
  return (
    <Card style={{ paddingHorizontal: 16 }}>
      <Row justify="space-between" gap={10} style={{ paddingHorizontal: 4, marginBottom: 14 }} align="flex-start">
        <Pressable onPress={() => router.push('/horaires')} accessibilityRole="button" accessibilityLabel={`Prières · ${place}. Ouvrir les horaires de prière`} style={{ flex: 1 }}>
          <T variant="h2" style={{ fontSize: 22 }}>{nextKey ? `${PRAYER_LABELS[nextKey]} dans ${countdown(t.instants[nextKey], now)}` : 'Prières du jour accomplies ?'}</T>
          <Row gap={5} style={{ marginTop: 3 }}>
            <Icon name={src.mode === 'mosquee' ? 'home' : 'pin'} size={13} color={colors.or} />
            <Text style={s.placeText} numberOfLines={1}>{place}</Text>
            <Icon name="chevronRight" size={14} color={colors.or} />
          </Row>
        </Pressable>
        <Row gap={8}>
          {prayers.adhan && nextKey ? (
            <Pressable onPress={() => (playing ? stopAdhan() : playAdhan({ ...prayers.adhan, prayer: PRAYER_LABELS[nextKey], time: t[nextKey] }))} accessibilityRole="button" accessibilityLabel={playing ? 'Arrêter l’adhan' : 'Écouter l’adhan'} hitSlop={6} style={s.chipBtn}>
              <Icon name={playing ? 'stop' : 'volume'} size={16} color={colors.bordeaux} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push('/qibla')} accessibilityRole="button" accessibilityLabel={`Qibla ${Math.round(prayers.qibla.direction)} degrés`} hitSlop={6} style={[s.chipBtn, { paddingHorizontal: 12 }]}>
            <Icon name="compass" size={16} color={colors.bordeaux} />
            <Text style={s.chipText}>Qibla</Text>
          </Pressable>
        </Row>
      </Row>
      <View style={s.prayerRow}>
        {PRAYERS.map((p) => {
          const active = p === nextKey;
          const done = prayers.checked[p];
          return (
            <Pressable
              key={p}
              onPress={() => onToggle(p, !done)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel={`${PRAYER_LABELS[p]} ${t[p]}${done ? ', accomplie' : ''}`}
              style={({ pressed }) => [s.prayerCol, active && s.prayerActive, pressed && { opacity: 0.7 }]}
            >
              <Text style={[s.prayerName, { fontSize: nameSize }, active && { color: colors.rose }]} numberOfLines={1} {...(Platform.OS !== 'web' ? { adjustsFontSizeToFit: true, minimumFontScale: 0.8 } : {})}>
                {PRAYER_LABELS[p]}
              </Text>
              <Text style={[s.prayerTime, { fontSize: timeSize }, active && { color: colors.white }]} numberOfLines={1}>
                {t[p]}
              </Text>
              <View style={[s.dot, done ? s.dotDone : active ? s.dotActive : s.dotTodo]}>{done ? <Icon name="check" size={13} color={colors.white} strokeWidth={3} /> : null}</View>
            </Pressable>
          );
        })}
      </View>
      {jumua?.today ? (
        <T variant="small" style={{ textAlign: 'center', marginTop: 10 }}>
          Vendredi · Jumu’a à {jumua.times.join(' et ')} · {src.label}
        </T>
      ) : null}
      {src.fallback ? <T variant="small" style={{ textAlign: 'center', marginTop: 8 }}>Horaires de la mosquée indisponibles aujourd’hui : horaires calculés.</T> : null}
      {t.source === 'local' ? <T variant="small" style={{ textAlign: 'center', marginTop: 6 }}>Horaires calculés sur ton téléphone (hors connexion).</T> : null}
    </Card>
  );
}

/** Frise des 4 phases avec la position du jour (carte Règles). */
function Frieze({ frieze }) {
  if (!frieze?.bounds) return null;
  const total = frieze.cycleLength || 28;
  const b = frieze.bounds;
  const pct = (d) => `${Math.max(0, Math.min(100, ((d - 0.5) / total) * 100))}%`;
  const seg = (from, to) => Math.max(0, (to ?? from) - from + 1);
  const fertileFrom = frieze.fertile?.[0] || b.ovulatoire?.[0];
  const fertileTo = frieze.fertile?.[1] || b.ovulatoire?.[1];
  const parts = [
    { key: 'r', flex: seg(1, b.menstruelle[1]), color: '#C26A7E' },
    { key: 'f', flex: Math.max(0, fertileFrom - b.menstruelle[1] - 1), color: 'rgba(255,255,255,0.25)' },
    { key: 'o', flex: seg(fertileFrom, fertileTo), color: colors.rose },
    { key: 'l', flex: Math.max(0, total - fertileTo), color: colors.or },
  ].filter((p) => p.flex > 0);
  const day = Math.min(frieze.cycleDay || 1, total);
  const phase = day <= b.menstruelle[1] ? 'Règles' : day >= fertileFrom && day <= fertileTo ? 'Fertile' : day > fertileTo ? 'Lutéale' : 'Folliculaire';
  return (
    <View style={{ marginTop: 14 }} accessibilityLabel={`Jour ${day} sur ${total}, ${phase.toLowerCase()}`}>
      <View style={s.frieze}>
        {parts.map((p) => (
          <View key={p.key} style={{ flex: p.flex, backgroundColor: p.color }} />
        ))}
      </View>
      <View style={[s.marker, { left: pct(day) }]} />
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <Text style={[s.friezeLabel, { flex: seg(1, b.menstruelle[1]) + Math.max(0, fertileFrom - b.menstruelle[1] - 1) }]} numberOfLines={1}>Règles</Text>
        <Text style={[s.friezeLabel, { flex: seg(fertileFrom, fertileTo) }]} numberOfLines={1}>Fertile</Text>
        <Text style={[s.friezeLabel, { flex: Math.max(1, total - fertileTo) - 2, color: phase === 'Lutéale' ? colors.white : colors.rose, fontFamily: phase === 'Lutéale' ? fonts.bold : fonts.body }]} numberOfLines={1}>
          Lutéale{phase === 'Lutéale' ? ' · toi' : ''}
        </Text>
        <Text style={[s.friezeLabel, { width: 30, textAlign: 'right' }]}>J{total}</Text>
      </View>
    </View>
  );
}

/** 2 — Règles (RG-08) : prochaines règles et frise, règles en cours, grossesse, nifas. Ouvre « Mes règles ». */
function CycleHero({ cycle, onStart, onEnd, onFlow }) {
  const heroText = { color: colors.white };
  const modify = (
    <Pressable onPress={() => router.push('/mes-regles')} accessibilityRole="button" accessibilityLabel="Modifier mes règles" hitSlop={8} style={s.modify}>
      <Text style={s.modifyText}>Modifier</Text>
      <Icon name="chevronRight" size={14} color={colors.white} />
    </Pressable>
  );
  if (cycle.kind === 'grossesse') {
    return (
      <Card tone="hero" onPress={() => router.push('/grossesse')} accessibilityLabel="Ma grossesse" style={{ gap: 4 }}>
        <Label color={colors.rose}>Semaine de grossesse</Label>
        <T variant="hero">{cycle.sa?.weeks} SA{cycle.sa?.days ? ` + ${cycle.sa.days} j` : ''}</T>
        <T style={heroText}>{cycle.trimester}e trimestre · {cycle.month}e mois · terme le {dayMonth(cycle.dueDate)}</T>
        <View style={[s.frieze, { marginTop: 14 }]}>
          <View style={{ flex: Math.max(0.01, cycle.progress), backgroundColor: colors.rose }} />
          <View style={{ flex: Math.max(0.01, 1 - cycle.progress), backgroundColor: 'rgba(255,255,255,0.2)' }} />
        </View>
      </Card>
    );
  }
  if (cycle.kind === 'nifas') {
    return (
      <Card tone="hero" style={{ gap: 6 }}>
        <Label color={colors.rose}>Post-partum · nifas</Label>
        <T variant="hero">Jour {cycle.day}</T>
        <T style={heroText}>{cycle.exceeded ? 'Au-delà de la durée maximale : la prière reprend (istihada).' : 'Tes rappels de prière sont en pause.'}</T>
        <Button title="Mes saignements sont terminés" variant="light" small onPress={() => onEnd(null, 'nifas')} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      </Card>
    );
  }
  if (cycle.kind === 'regles') {
    return (
      <Card tone="hero" style={{ gap: 4 }}>
        <Row justify="space-between">
          <Label color={colors.rose}>Règles en cours</Label>
          {modify}
        </Row>
        <Pressable onPress={() => router.push('/mes-regles')} accessibilityRole="button" accessibilityLabel="Mes règles">
          <T variant="hero" fit>Jour {cycle.periodDay} des règles</T>
          <T style={heroText}>{cycle.istihada ? 'Durée maximale dépassée' : 'Pause des prières pendant tes règles'}</T>
        </Pressable>
        <Label color={colors.rose} style={{ marginTop: 12 }}>Flux du jour</Label>
        <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 4 }}>
          {[
            ['traces', 'Traces'],
            ['leger', 'Léger'],
            ['moyen', 'Moyen'],
            ['abondant', 'Abondant'],
          ].map(([k, l]) => (
            <Pressable key={k} onPress={() => onFlow(k)} accessibilityRole="button" style={s.flowChip}>
              <Text style={s.flowText}>{l}</Text>
            </Pressable>
          ))}
        </Row>
        <Pressable onPress={() => onEnd(cycle.periodId)} accessibilityRole="button" style={s.heroCta}>
          <Text style={s.heroCtaText}>Mes règles sont terminées</Text>
        </Pressable>
      </Card>
    );
  }
  if (cycle.kind === 'vide' || cycle.kind === 'postpartum') {
    return (
      <Card tone="hero" style={{ gap: 6 }}>
        <Label color={colors.rose}>{cycle.kind === 'vide' ? 'Ton cycle' : 'Post-partum'}</Label>
        <T variant="h2" color={colors.white}>{cycle.kind === 'vide' ? 'Note tes prochaines règles' : 'Retour des règles imprévisible'}</T>
        <T style={heroText}>{cycle.kind === 'vide' ? 'Les prédictions démarrent dès ta première saisie.' : 'Pas de prédiction tant que deux cycles n’ont pas été enregistrés.'}</T>
        <Pressable onPress={onStart} accessibilityRole="button" style={s.heroCta}>
          <Text style={s.heroCtaText}>Mes règles ont commencé</Text>
        </Pressable>
      </Card>
    );
  }
  const late = cycle.lateDays > 0;
  const title = late ? `${cycle.lateDays} jour${cycle.lateDays > 1 ? 's' : ''} de retard` : cycle.daysUntil === 0 ? 'Aujourd’hui' : cycle.daysUntil === 1 ? 'Demain' : `Dans ${cycle.daysUntil} jours`;
  const when = cycle.rangeStart ? `entre le ${dayMonth(cycle.rangeStart)} et le ${dayMonth(cycle.rangeEnd)}` : `vers le ${dayMonth(cycle.nextDate)}`;
  return (
    <Card tone="hero" style={{ gap: 2 }}>
      <Row justify="space-between">
        <Label color={colors.rose}>Prochaines règles</Label>
        {modify}
      </Row>
      <Pressable onPress={() => router.push('/mes-regles')} accessibilityRole="button" accessibilityLabel={`Prochaines règles ${title}, ${when}. Ouvrir mes règles`}>
        <T variant="hero" fit>{title}</T>
        <T style={{ color: colors.rose }}>
          {when} · jour {cycle.cycleDay} du cycle
        </T>
        <Frieze frieze={cycle.frieze} />
      </Pressable>
      <Pressable onPress={onStart} accessibilityRole="button" style={s.heroCta}>
        <Text style={s.heroCtaText}>Mes règles ont commencé</Text>
      </Pressable>
      {cycle.isDefault ? <T variant="small" color={colors.rose} style={{ marginTop: 8 }}>Tes prédictions s’affineront au fil des cycles.</T> : null}
    </Card>
  );
}

/** Visages d'humeur (5 choix). */
function MoodFace({ mood, size = 46, on }) {
  const stroke = on ? colors.white : colors.bordeaux;
  const mouths = {
    sereine: 'M15 27 Q23 33 31 27',
    bien: 'M14 26 Q23 35 32 26',
    fatiguee: 'M16 29 L30 29',
    irritable: 'M15 30 Q23 25 31 30',
    triste: 'M15 31 Q23 24 31 31',
  };
  const eyes = mood === 'fatiguee' ? ['M14 19 L19 19', 'M27 19 L32 19'] : mood === 'irritable' ? ['M13 17 L19 19', 'M33 17 L27 19'] : null;
  return (
    <Svg width={size} height={size} viewBox="0 0 46 46">
      <Circle cx="23" cy="23" r="22" fill={on ? colors.bordeaux : colors.blush} />
      {eyes ? eyes.map((d) => <Path key={d} d={d} stroke={stroke} strokeWidth={2} strokeLinecap="round" />) : (
        <>
          <Circle cx="17" cy="19" r="2" fill={stroke} />
          <Circle cx="29" cy="19" r="2" fill={stroke} />
        </>
      )}
      <Path d={mouths[mood] || mouths.bien} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** 5 — Comment tu te sens ? Humeur, symptômes en un geste, bouton bordeaux « Suivi santé ». */
function HealthCard({ health, onSave }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ symptoms: health.symptoms, sleepHours: health.sleepHours ?? 7, weight: health.weight });
  useEffect(() => setDraft({ symptoms: health.symptoms, sleepHours: health.sleepHours ?? 7, weight: health.weight }), [health]);
  const shown = [...new Set([...health.symptoms, ...QUICK_SYMPTOMS])].slice(0, 4);
  return (
    <Card>
      <T variant="h2" style={{ fontSize: 22, marginBottom: 14 }}>Comment tu te sens ?</T>
      <Row justify="space-between">
        {MOODS.map((m) => {
          const on = health.mood === m.key;
          return (
            <Pressable key={m.key} onPress={() => onSave({ mood: on ? null : m.key })} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={m.label} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
              <MoodFace mood={m.key} on={on} />
              <Text style={[s.moodLabel, on && { color: colors.bordeaux, fontFamily: fonts.bold }]} numberOfLines={1}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {health.symptoms.slice(0, 3).map((k) => (
          <Chip key={k} label={SYMPTOMS[k] || k} selected onPress={() => onSave({ symptoms: health.symptoms.filter((x) => x !== k) })} />
        ))}
        {health.symptoms.length < 3
          ? shown
              .filter((k) => !health.symptoms.includes(k))
              .slice(0, 3 - health.symptoms.length)
              .map((k) => <Chip key={k} label={SYMPTOMS[k]} onPress={() => onSave({ symptoms: [...health.symptoms, k] })} />)
          : null}
        <Chip label="+ Ajouter" onPress={() => setOpen(true)} />
      </View>
      <Pressable onPress={() => router.push('/sante')} accessibilityRole="button" style={s.healthCta}>
        <Icon name="heart" size={18} color={colors.white} />
        <Text style={s.healthCtaText}>Suivi santé</Text>
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Ma santé du jour"
        footer={
          <Button
            title="Enregistrer"
            onPress={() => {
              onSave(draft);
              setOpen(false);
            }}
          />
        }
      >
        <Label>Symptômes</Label>
        <Chips items={Object.entries(SYMPTOMS).map(([key, label]) => ({ key, label }))} value={draft.symptoms} onChange={(v) => setDraft((d) => ({ ...d, symptoms: v }))} multi />
        <Stepper label="Sommeil" value={draft.sleepHours} onChange={(v) => setDraft((d) => ({ ...d, sleepHours: v }))} min={0} max={14} step={0.5} suffix=" h" />
        <Stepper label="Poids" value={draft.weight ?? 60} onChange={(v) => setDraft((d) => ({ ...d, weight: v }))} min={30} max={200} step={0.1} suffix=" kg" />
      </Sheet>
    </Card>
  );
}

/** 6 — Conseil santé du jour, adapté à la phase (RG-08 ter) ; ouvre l'article lié dans Lifestyle. */
function TipCard({ tip, weatherTips }) {
  if (!tip) return null;
  return (
    <Card style={{ gap: 8 }}>
      <Row gap={12} align="flex-start">
        <View style={s.tipIcon}>
          <Icon name="sparkle" size={18} color={colors.or} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.tipLabel}>Conseil santé · {PHASE_NAMES[tip.phase] || 'aujourd’hui'}</Text>
          <T variant="h3" style={{ fontSize: 18 }}>{tip.title}</T>
        </View>
      </Row>
      <T>{tip.text}</T>
      {weatherTips?.[0] ? <T variant="small">☀️ {weatherTips[0].text}</T> : null}
      <T variant="small">{tip.reviewed ? 'Relu par une sage-femme' : 'Conseil Nissali'}</T>
      {tip.articleSlug ? (
        <Pressable onPress={() => router.push(`/blog/${tip.articleSlug}`)} accessibilityRole="link" accessibilityLabel={`Lire l’article : ${tip.articleTitle || tip.title}`} style={({ pressed }) => [s.tipLink, pressed && { opacity: 0.85 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.tipLinkLabel}>Lire l’article{tip.articleMinutes ? ` · ${tip.articleMinutes} min` : ''}</Text>
            {tip.articleTitle ? <Text style={s.tipLinkTitle} numberOfLines={2}>{tip.articleTitle}</Text> : null}
          </View>
          <View style={s.tipLinkArrow}>
            <Icon name="chevronRight" size={18} color={colors.white} />
          </View>
        </Pressable>
      ) : null}
    </Card>
  );
}

function shortDays(days) {
  if (!days?.length) return '';
  const months = [...new Set(days.map((d) => Number(d.day.slice(5, 7))))];
  const nums = days.map((d) => Number(d.day.slice(8)));
  if (months.length === 1) return `${nums.slice(0, -1).join(', ')}${nums.length > 1 ? ' et ' : ''}${nums[nums.length - 1]} ${MONTHS_SHORT[months[0] - 1]}`;
  return days.map((d) => `${Number(d.day.slice(8))} ${MONTHS_SHORT[Number(d.day.slice(5, 7)) - 1]}`).join(', ');
}

export default function Today() {
  const { user, setSession } = useAuth();
  const toast = useToast();
  const { data, setData, loading, error, offline, reload } = useApi('/today');
  const { openStart, openEnd, sheets } = usePeriodActions(reload);
  const scheduled = useRef(null);
  const [dhikrOpen, setDhikrOpen] = useState(false);
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

  // Notifications locales : reprogrammées à chaque nouvel état (pause pendant les règles, position, horaires).
  useEffect(() => {
    if (!data || offline) return;
    const loc = data.prayers.location;
    const key = `${data.today}-${data.prayers.paused}-${data.cycle.kind}-${data.fasts.nextPlanned}-${loc?.lat},${loc?.lng}-${data.prayers.timings.fajr}-${data.prayers.sourceInfo?.label}-${(data.prayers.reminders || []).length}-${user?.prayerSettings?.notifications}-${user?.prayerSettings?.adhanMode}-${user?.prayerSettings?.adhan}`;
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
  const saveHealth = async (patch) => {
    setData((d) => ({ ...d, health: { ...d.health, ...patch, symptoms: patch.symptoms ?? d.health.symptoms } }));
    await sendOrQueue('PUT', `/health-log/day/${data.today}`, patch).catch((e) => toast(e.message, 'error'));
  };
  const setFlow = async (level) => {
    try {
      await sendOrQueue('PUT', '/cycle/flow', { day: data.today, level });
      toast('Flux enregistré');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const answerPeriodEnded = async (ended) => {
    if (ended) return openEnd(data.cycle.periodId);
    setData((d) => ({ ...d, cycle: { ...d.cycle, askPeriodEnded: false } }));
  };

  const c = data.cycle;
  const daysToRamadan = data.ramadan.current ? null : data.ramadan.daysUntil;
  return (
    <Screen onRefresh={reload} refreshing={false}>
      <Header data={data} user={user} />
      <OfflineBanner visible={offline} />

      {/* 1 · Prières */}
      <PrayersCard prayers={prayers} onToggle={togglePrayer} onOpenDhikr={() => setDhikrOpen(true)} />
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
      <CycleHero cycle={c} onStart={openStart} onEnd={openEnd} onFlow={setFlow} />
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

      {/* 3 · Jeûnes à rattraper — 4 · Jours blancs */}
      <Row gap={12} align="stretch">
        <Card style={{ flex: 1, gap: 4, padding: 16 }} onPress={() => router.push('/jeunes')} accessibilityLabel={`${data.fasts.remaining} jours à rattraper`}>
          <Row justify="space-between">
            <Text style={s.smallLabel}>Jeûnes à rattraper</Text>
            <Icon name="chevronRight" size={14} color={colors.muted} />
          </Row>
          <T variant="h2" style={{ fontSize: 24 }} color={colors.bordeaux}>
            {data.fasts.remaining} jour{data.fasts.remaining > 1 ? 's' : ''}
          </T>
          <T variant="small">{data.fasts.remaining ? `avant Ramadan${daysToRamadan != null ? ` · ${daysToRamadan} j restants` : ''}` : 'Tout est rattrapé'}</T>
        </Card>
        <Card style={{ flex: 1, gap: 4, padding: 16 }} onPress={() => router.push('/jeunes?section=blancs')} accessibilityLabel="Jours blancs, ouvrir la section">
          <Row justify="space-between">
            <Text style={s.smallLabel}>Jours blancs</Text>
            <Icon name="chevronRight" size={14} color={colors.muted} />
          </Row>
          <T variant="h2" style={{ fontSize: 24 }} color={colors.bordeaux} fit>
            {data.whiteDays.inProgress ? 'En cours' : data.whiteDays.daysUntil === 1 ? 'Demain' : `Dans ${data.whiteDays.daysUntil} jours`}
          </T>
          <T variant="small">Jeûne recommandé les {shortDays(data.whiteDays.days)}</T>
        </Card>
      </Row>
      <Gap />

      {/* 5 · Comment tu te sens ? */}
      <HealthCard health={data.health} onSave={saveHealth} />
      <Gap />

      {/* 6 · Conseil santé */}
      <TipCard tip={data.healthTip} weatherTips={data.tips} />
      {data.healthTip ? <Gap /> : null}

      {/* 7 · Petit rappel */}
      {data.reminder ? (
        <Card tone="soft" style={{ gap: 8 }}>
          <Label>Petit rappel</Label>
          <T variant="quote">{data.reminder.text}</T>
          <T variant="muted">{data.reminder.source}</T>
        </Card>
      ) : null}

      <Sheet visible={dhikrOpen} onClose={() => setDhikrOpen(false)} title="Pendant ta pause">
        <T>Tes prières sont en pause : aucune n’est comptée comme manquée. Le dhikr et les invocations restent accessibles à tout moment.</T>
        <Card tone="soft" style={{ gap: 6 }}>
          <Label color={colors.or}>Dhikr</Label>
          <T variant="quote">{data.prayers.dhikr || 'SubhanAllah, Alhamdulillah, Allahu akbar.'}</T>
        </Card>
        <Button title="Rappel de dhikr à l’heure des prières" variant="soft" small onPress={() => { setDhikrOpen(false); router.push('/profil'); }} />
      </Sheet>
      {sheets}
    </Screen>
  );
}

const s = StyleSheet.create({
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, right: 11, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.bordeaux, borderWidth: 2, borderColor: colors.blush },
  placeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.or, flexShrink: 1 },
  chipBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 9, minHeight: 34, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  pauseIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F6EBDD', alignItems: 'center', justifyContent: 'center' },
  prayerRow: { flexDirection: 'row', gap: 4 },
  prayerCol: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5, paddingVertical: 11, borderRadius: 16 },
  prayerActive: { backgroundColor: colors.prune },
  prayerName: { fontFamily: fonts.bold, color: colors.muted, letterSpacing: -0.2 },
  prayerTime: { fontFamily: fonts.display, color: colors.prune },
  dot: { width: 22, height: 22, borderRadius: 11, marginTop: 3, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.or },
  dotActive: { borderWidth: 2, borderColor: colors.white },
  dotTodo: { borderWidth: 2, borderColor: colors.rose },
  modify: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  modifyText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  frieze: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 3 },
  marker: { position: 'absolute', top: -5, width: 18, height: 18, marginLeft: -9, borderRadius: 9, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.or },
  friezeLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.rose },
  heroCta: { marginTop: 16, backgroundColor: colors.white, borderRadius: 999, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  heroCtaText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.bordeaux },
  flowChip: { borderWidth: 1.5, borderColor: colors.rose, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  flowText: { fontFamily: fonts.medium, color: colors.white, fontSize: 14.5 },
  smallLabel: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.prune },
  moodLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  healthCta: { marginTop: 16, flexDirection: 'row', gap: 8, backgroundColor: colors.bordeaux, borderRadius: 999, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  healthCtaText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.white },
  tipLink: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.blush, borderRadius: 18, paddingVertical: 12, paddingLeft: 16, paddingRight: 12, marginTop: 4 },
  tipLinkLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.bordeaux, textTransform: 'uppercase' },
  tipLinkTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.prune, marginTop: 2 },
  tipLinkArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center' },
  tipIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F6EBDD', alignItems: 'center', justifyContent: 'center' },
  tipLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.or },
});

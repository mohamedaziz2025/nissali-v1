// 4.1 — Accueil « Aujourd'hui » (cahier V4.1). Dans cet ordre : carte contextuelle (si utile), Prières, Dhikr
// (compteur sur l'accueil), Règles, Mes notes, Petit rappel. Jeûnes, jours blancs, humeur, poids et conseil
// santé ont quitté l'accueil (onglets Jeûnes et Cycle).
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdhanSoundSheet, useAdhanPrefs } from '../../components/AdhanSound';
import { BrandBar } from '../../components/Brand';
import ContextCard from '../../components/ContextCard';
import DhikrCard from '../../components/DhikrCard';
import { FlowDrop } from '../../components/Flow';
import Icon from '../../components/Icon';
import { noteDate } from '../../components/Notes';
import { FrequencyPicker } from '../../components/NotifFrequency';
import { usePeriodActions } from '../../components/PeriodSheets';
import { Button, ErrorState, Gap, Loader, Notice, OfflineBanner, Row, Screen, Sheet, T, useToast } from '../../components/ui';
import WhiteDaysCard from '../../components/WhiteDaysCard';
import { api, sendOrQueue } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { countdown, dayMonth, longDate } from '../../lib/format';
import { jumuaOf } from '../../lib/jumua';
import { syncLocation } from '../../lib/location';
import { rescheduleAll } from '../../lib/notifications';
import { localTimings } from '../../lib/prayerLocal';
import { readJson, writeJson } from '../../lib/storage';
import { useApi } from '../../lib/useApi';
import { colors, fonts, PRAYER_LABELS, PRAYERS, tnum } from '../../theme';

import { tr } from '../../lib/i18n';
const NOTE_DOTS = { medicament: colors.bordeaux, cours: colors.or, rendez_vous: colors.prune, symptome: colors.rose, autre: colors.caseVide };
const HOME_FLOWS = [
  { key: 'traces', label: tr("Traces") },
  { key: 'leger', label: tr("Léger") },
  { key: 'moyen', label: tr("Moyen") },
  { key: 'abondant', label: tr("Abondant") },
];

const toMin = (t) => (/^\d{2}:\d{2}/.test(t || '') ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
/** Vrai dans les 30 minutes qui suivent l'une des 5 prières du jour. */
function justAfterPrayer(timings = {}, time) {
  const now = toMin(time);
  if (now == null) return false;
  return PRAYERS.some((p) => {
    const t = toMin(timings[p]);
    return t != null && now >= t && now - t <= 30;
  });
}

function CardHead({ title, right }) {
  return (
    <Row justify="space-between" gap={8}>
      <Text style={s.cardTitle}>{title}</Text>
      {right}
    </Row>
  );
}

/**
 * 4.1 · Prières — « PROCHAINE PRIÈRE », nom et heure en grand, compte à rebours, mosquée ou ville, bouton Qibla
 * carré, 5 cases cochables, ligne Adhan. Pendant les règles (RG-08 bis) : horaires gardés, pas de cases,
 * badge « En pause pendant tes règles » et ligne « Rappels de prière · Coupés · Régler » ; ou une seule ligne
 * si elle l'a choisi dans Prières et adhan.
 */
function PrayersCard({ prayers, ramadan, onToggle, onAdhanSettings }) {
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
  const why = prayers.pauseReason === 'nifas' ? 'ton nifas' : 'tes règles';
  const settings = () => router.push('/reglages/prieres');

  if (paused && prayers.periodHome === 'ligne') {
    return (
      <Pressable onPress={() => router.push('/horaires')} accessibilityRole="button" accessibilityLabel={tr("Prières en pause pendant {0}. Voir les horaires", [why])} style={[s.card, s.lineCard]}>
        <View style={s.roundIcon}>
          <Icon name="bellOff" size={17} color={colors.bordeaux} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.lineTitle}>{tr("Prières en pause")}</Text>
          <Text style={s.muted} numberOfLines={1}>{tr("Pendant")} {why} {tr("· voir les horaires")}</Text>
        </View>
        <Icon name="chevronRight" size={16} color={colors.muted} />
      </Pressable>
    );
  }

  const shown = nextKey || 'fajr';
  const shownTime = nextKey ? t[nextKey] : prayers.tomorrowFajr || t.fajr;
  return (
    <View style={s.card}>
      <Row gap={12} align="flex-start">
        <Pressable onPress={() => router.push('/horaires')} accessibilityRole="button" accessibilityLabel={tr("Prochaine prière : {0} à {1}{2}. {3}. Ouvrir les horaires", [PRAYER_LABELS[shown], shownTime, (nextKey ? tr(", dans {0}", [countdown(t.instants[nextKey], now)]) : tr(", demain")), place])} style={{ flex: 1, gap: 6 }}>
          <Text style={s.surtitle}>{paused ? tr("HORAIRES DU JOUR") : tr("PROCHAINE PRIÈRE")}</Text>
          <Row gap={10} style={{ flexWrap: 'wrap' }}>
            <Text style={[s.nextName, tnum]} numberOfLines={1}>
              {PRAYER_LABELS[shown]} <Text style={{ color: colors.bordeaux }}>{shownTime}</Text>
            </Text>
            {paused ? (
              <View style={s.badge}>
                <Text style={s.badgeText}>{tr("En pause pendant")} {why}</Text>
              </View>
            ) : (
              <View style={s.badge}>
                <Text style={[s.badgeText, tnum]}>{nextKey ? `dans ${countdown(t.instants[nextKey], now)}` : 'demain'}</Text>
              </View>
            )}
          </Row>
          <Row gap={5}>
            <Icon name={src.mode === 'mosquee' ? 'home' : 'pin'} size={13} color={colors.muted} />
            <Text style={s.muted} numberOfLines={1}>{place}</Text>
          </Row>
        </Pressable>
        <Pressable onPress={() => router.push('/qibla')} accessibilityRole="button" accessibilityLabel={tr("Qibla")} style={({ pressed }) => [s.qibla, pressed && { opacity: 0.85 }]}>
          <Icon name="compass" size={22} color={colors.bordeaux} />
          <Text style={s.qiblaText}>{tr("Qibla")}</Text>
        </Pressable>
      </Row>

      {paused ? <Text style={s.pauseText}>{tr("Aucune prière n’est due pendant")} {why} {tr(": rien ne sera compté comme manqué. Le dhikr reste ouvert.")}</Text> : null}

      <View style={s.tiles}>
        {PRAYERS.map((p) => {
          const next = !paused && p === nextKey;
          const done = prayers.checked?.[p];
          const Comp = paused ? View : Pressable;
          return (
            <Comp
              key={p}
              {...(paused
                ? { accessibilityLabel: `${PRAYER_LABELS[p]} ${t[p]}` }
                : {
                    onPress: () => onToggle(p, !done),
                    accessibilityRole: 'checkbox',
                    accessibilityState: { checked: Boolean(done) },
                    accessibilityLabel: `${PRAYER_LABELS[p]} ${t[p]}${done ? ', accomplie' : ''}${next ? ', prochaine prière' : ''}`,
                  })}
              style={[s.tile, next && s.tileNext, done && !next && s.tileDone]}
            >
              <Text style={[s.tileName, next && { color: colors.onBordeaux }]} numberOfLines={1}>{PRAYER_LABELS[p]}</Text>
              <Text style={[s.tileTime, tnum, next && { color: colors.white }]} numberOfLines={1} adjustsFontSizeToFit>{t[p]}</Text>
              {paused ? null : (
                <View style={[s.check, done && s.checkDone, next && !done && { borderColor: colors.onBordeaux }]}>
                  {done ? <Icon name="check" size={10} color={colors.white} strokeWidth={3} /> : null}
                </View>
              )}
            </Comp>
          );
        })}
      </View>

      {ramadan?.current && !paused ? (
        <Text style={[s.small, { textAlign: 'center' }]}>
          {tr("Ramadan · jour")} {ramadan.day} {tr("· Suhur avant")} {t.fajr} {tr("· Iftar")} {t.maghrib}
        </Text>
      ) : null}
      {jumua?.today && !paused ? <Text style={[s.small, { textAlign: 'center' }]}>{tr("Vendredi · Jumu’a à")} {jumua.times.join(' et ')}</Text> : null}

      {paused ? (
        <Pressable onPress={settings} accessibilityRole="button" accessibilityLabel={tr("Rappels de prière {0}. Régler", [(prayers.remindersDuringPeriod ? tr("gardés") : tr("coupés"))])} style={s.footRow}>
          <Icon name={prayers.remindersDuringPeriod ? 'bell' : 'bellOff'} size={17} color={colors.prune} />
          <Text style={s.footText}>{tr("Rappels de prière")}</Text>
          <Text style={s.footState}>{prayers.remindersDuringPeriod ? tr("Gardés") : tr("Coupés")}</Text>
          <Text style={s.link}>{tr("Régler")}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onAdhanSettings} accessibilityRole="button" accessibilityLabel={tr("Adhan {0}. Régler", [(adhan.on ? tr("activé") : tr("désactivé"))])} style={s.footRow}>
          <Icon name="volume" size={17} color={colors.prune} />
          <Text style={s.footText}>{tr("Adhan")}</Text>
          <Text style={s.footState}>{adhan.on ? tr("Activé") : tr("Désactivé")}</Text>
          <Text style={s.link}>{tr("Régler")}</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * 4.1 · Règles — « Dans X jours » en grand, date prévue, « Mes règles ont commencé ». Pendant les règles (4.2 · 1.2) :
 * Jour X, fin prévue, 4 boutons de flux enregistrés au toucher, ligne Ramadan, « Mes règles sont terminées ».
 */
function RulesCard({ cycle, today, ramadan, onStart, onEnd, onFlow }) {
  const toast = useToast();
  const [flow, setFlow] = useState(cycle.flowToday || null);
  useEffect(() => setFlow(cycle.flowToday || null), [cycle.flowToday]);
  const pickFlow = async (level) => {
    const prev = flow;
    setFlow(level);
    try {
      await sendOrQueue('PUT', '/cycle/flow', { day: today, level });
      onFlow?.(level);
    } catch (e) {
      setFlow(prev);
      toast(e.message, 'error');
    }
  };
  const head = (label, open = '/mes-regles') => (
    <Row justify="space-between">
      <Text style={s.rulesLabel}>{label}</Text>
      <Pressable onPress={() => router.push(open)} accessibilityRole="button" accessibilityLabel={tr("{0}, modifier", [label])} hitSlop={8} style={s.modify}>
        <Text style={s.modifyText}>{tr("Modifier")}</Text>
        <Icon name="chevronRight" size={12} color={colors.white} />
      </Pressable>
    </Row>
  );
  const whiteBtn = (title, onPress) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.whiteBtn, pressed && { opacity: 0.9 }]}>
      <Text style={s.whiteBtnText}>{title}</Text>
    </Pressable>
  );

  if (cycle.kind === 'grossesse') {
    return (
      <View style={s.rules}>
        {head('Ma grossesse', '/grossesse')}
        <Text style={s.rulesBig}>{tr("Semaine")} {cycle.sa?.weeks}</Text>
        <Text style={s.rulesSub}>{cycle.sa?.weeks} {tr("SA")}{cycle.sa?.days ? ` + ${cycle.sa.days} j` : ''} · {cycle.trimester}{tr("e trimestre · terme le")} {dayMonth(cycle.dueDate)}</Text>
      </View>
    );
  }
  if (cycle.kind === 'nifas') {
    return (
      <View style={s.rules}>
        {head('Post-partum', '/grossesse')}
        <Text style={s.rulesBig}>{tr("Jour")} {cycle.day}</Text>
        <Text style={s.rulesSub}>{cycle.exceeded ? tr("Au-delà de la durée maximale : la prière reprend (istihada).") : tr("Nifas · tes rappels de prière sont en pause.")}</Text>
        {whiteBtn('Mes saignements sont terminés', () => onEnd(null, 'nifas'))}
      </View>
    );
  }
  if (cycle.kind === 'regles') {
    return (
      <View style={s.rules}>
        {head('Mes règles')}
        <Text style={s.rulesBig}>{tr("Jour")} {cycle.periodDay}</Text>
        {cycle.expectedEnd ? <Text style={s.rulesSub}>{tr("Fin prévue vers le")} {dayMonth(cycle.expectedEnd)}</Text> : null}
        <Text style={[s.rulesSub, { marginTop: 14, color: colors.white, fontFamily: fonts.bold }]}>{tr("Flux du jour")}</Text>
        <View style={s.flows}>
          {HOME_FLOWS.map((f) => {
            const on = flow === f.key;
            return (
              <Pressable key={f.key} onPress={() => pickFlow(f.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={tr("Flux {0}", [f.label])} style={[s.flowBtn, on && s.flowOn]}>
                {f.key === 'traces' ? <View style={[s.traceDot, on && { backgroundColor: colors.bordeaux }]} /> : <FlowDrop level={f.key} color={on ? colors.bordeaux : colors.white} size={20} />}
                <Text style={[s.flowText, on && { color: colors.bordeaux }]} numberOfLines={1}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {ramadan?.current ? (
          <View style={s.ramadanLine}>
            <Icon name="moon" size={14} color={colors.orClair} />
            <Text style={s.ramadanText}>{tr("Ramadan : les jours de règles s’ajoutent à tes jeûnes à rattraper.")}</Text>
          </View>
        ) : null}
        {whiteBtn('Mes règles sont terminées', () => onEnd(cycle.periodId, 'hayd', cycle.start))}
      </View>
    );
  }
  if (cycle.kind === 'vide' || cycle.kind === 'postpartum') {
    return (
      <View style={s.rules}>
        {head('Mes règles')}
        <Text style={[s.rulesBig, { fontSize: 28, lineHeight: 34 }]}>{cycle.kind === 'vide' ? tr("Note tes prochaines règles") : tr("Retour imprévisible")}</Text>
        <Text style={s.rulesSub}>{cycle.kind === 'vide' ? tr("Les prévisions démarrent dès ta première saisie.") : tr("Pas de prévision tant que deux cycles n’ont pas été enregistrés.")}</Text>
        {whiteBtn('Mes règles ont commencé', onStart)}
      </View>
    );
  }
  const late = cycle.lateDays > 0;
  const d = cycle.daysUntil;
  return (
    <View style={s.rules}>
      {head('Prochaines règles')}
      <Pressable onPress={() => router.push('/cycle')} accessibilityRole="button" accessibilityLabel={tr("Ouvrir mon cycle")}>
        <Text style={s.rulesBig}>{late ? tr("{0} jour{1} de retard", [cycle.lateDays, cycle.lateDays > 1 ? 's' : '']) : d === 0 ? tr("Aujourd’hui") : d === 1 ? tr("Demain") : tr("Dans {0} jours", [d])}</Text>
        <Text style={s.rulesSub}>
          {late ? tr("Prévues le {0}", [dayMonth(cycle.nextDate)]) : tr("Vers le {0}", [dayMonth(cycle.nextDate)])} {tr("· jour")} {cycle.cycleDay} {tr("du cycle")}{cycle.isDefault ? tr(" · estimation") : ''}
        </Text>
      </Pressable>
      {whiteBtn('Mes règles ont commencé', onStart)}
    </View>
  );
}

/** 4.1 · Mes notes — icône, calendrier et crayon ; 3 prochaines notes (pastille de couleur, cloche si rappel). */
function NotesWidget({ notes }) {
  const iconBtn = (icon, label, to) => (
    <Pressable onPress={() => router.push(to)} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={s.iconBtn}>
      <Icon name={icon} size={17} color={colors.bordeaux} />
    </Pressable>
  );
  return (
    <View style={s.card}>
      <Row gap={10}>
        <View style={s.roundIcon}>
          <Icon name="note" size={17} color={colors.bordeaux} />
        </View>
        <Text style={[s.cardTitle, { flex: 1 }]}>{tr("Mes notes")}</Text>
        {iconBtn('calendar', 'Voir mon calendrier', '/calendrier')}
        {iconBtn('edit', 'Ajouter une note', '/notes/nouvelle')}
      </Row>
      {notes?.length ? (
        <>
          <View>
            {notes.map((n, i) => (
              <Pressable key={`${n.noteId}-${n.day}`} onPress={() => router.push(`/notes/nouvelle?id=${n.noteId}`)} accessibilityRole="button" accessibilityLabel={`${n.text}, ${noteDate(n.day)}${n.time ? ` à ${n.time}` : ''}${(n.remind ? tr(", avec rappel") : '')}`} style={[s.noteRow, i < notes.length - 1 && s.noteLine]}>
                <View style={[s.noteDot, { backgroundColor: NOTE_DOTS[n.type] || NOTE_DOTS.autre }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.noteTitle} numberOfLines={1}>{n.text}</Text>
                  <Text style={s.small} numberOfLines={1}>{noteDate(n.day)}{n.time ? ` · ${n.time}` : ''}{n.repeat && n.repeat !== 'once' ? ` · ${n.repeatLabel}` : ''}</Text>
                </View>
                {n.remind ? <Icon name="bell" size={15} color={colors.orText} /> : null}
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => router.push('/notes')} accessibilityRole="link" style={s.footRow}>
            <Text style={[s.link, { flex: 1 }]}>{tr("Toutes mes notes")}</Text>
            <Icon name="chevronRight" size={14} color={colors.bordeaux} />
          </Pressable>
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <Text style={s.muted}>{tr("Rien de prévu pour l’instant")}</Text>
          <Pressable onPress={() => router.push('/notes/nouvelle')} accessibilityRole="button" style={s.addNote}>
            <Icon name="plus" size={15} color={colors.white} />
            <Text style={s.addNoteText}>{tr("Ajouter ma première note")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** 4.1 · Petit rappel — verset, hadith ou invocation validé par le comité ; source ou « L'équipe Nissali ». */
function ReminderCard({ reminder }) {
  if (!reminder?.text) return null;
  return (
    <View style={s.reminder} accessibilityRole="text">
      <Text style={s.surtitle}>{tr("PETIT RAPPEL")}</Text>
      <Text style={s.reminderText}>{reminder.text}</Text>
      <Text style={s.small}>{reminder.source ? `${(reminder.kind === 'hadith' ? tr("Rapporté par ") : '')}${reminder.source}` : tr("L’équipe Nissali")}</Text>
    </View>
  );
}

export default function Today() {
  const { user, setSession } = useAuth();
  const toast = useToast();
  const { data, setData, loading, error, offline, reload } = useApi('/today');
  const { openStart, openEnd, sheets } = usePeriodActions(reload);
  const scheduled = useRef(null);
  const [adhanOpen, setAdhanOpen] = useState(false);
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
    const key = `${data.today}-${data.prayers.paused}-${data.cycle.kind}-${data.fasts.nextPlanned}-${loc?.lat},${loc?.lng}-${data.prayers.timings.fajr}-${data.prayers.sourceInfo?.label}-${(data.prayers.reminders || []).length}-${ps.notifications}-${ps.adhanMode}-${ps.adhan}-${JSON.stringify(ps.adhanPrayers || {})}-${ps.adhanVoice}-${JSON.stringify(ps.notifyPrayers || {})}-${JSON.stringify(ps.prayerSound || {})}-${ps.notifyOffset}-${ps.keepRemindersDuringPeriod}-${ps.keepDhikrDuringPeriod}-${data.notesStamp}-${(data.fasts.planNext || []).join(',')}-${(data.fasts.voluntaryNext || []).join(',')}-${data.fasts.reminderTime}-${data.fasts.voluntaryReminderTime}-${user?.notificationPrefs?.fastPlanned}-${user?.notificationPrefs?.fastMakeup}-${JSON.stringify(user?.dhikr || {})}-${user?.notificationPrefs?.hideNotePreview}-${data.purification?.done}-${ps.purificationReminders}`;
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
    return <Screen title={tr("Aujourd’hui")}><ErrorState error={error} onRetry={reload} /></Screen>;
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
  const answerPeriodEnded = (ended) => {
    if (ended) return openEnd(data.cycle.periodId, 'hayd', data.cycle.start);
    setData((d) => ({ ...d, cycle: { ...d.cycle, askPeriodEnded: false } }));
  };

  const c = data.cycle;
  return (
    <Screen onRefresh={reload} refreshing={false} top={<BrandBar unread={data.notificationsUnread} />}>
      <View style={{ marginBottom: 16 }}>
        <T variant="h1" accessibilityRole="header" fit>{tr("Salam,")} {user?.firstName}</T>
        <T variant="muted">
          {longDate(data.today)}
          {data.hijri?.label ? ` · ${data.hijri.label}` : ''}
        </T>
      </View>
      <OfflineBanner visible={offline} />

      {/* Carte contextuelle : une seule, seulement si utile (RG-46) */}
      {data.contexts?.length ? (
        <View style={{ marginBottom: 16 }}>
          <ContextCard cards={data.contexts} today={data.today} onStartPeriod={() => openStart()} onChanged={reload} />
        </View>
      ) : null}

      {/* 1 · Prières */}
      <PrayersCard prayers={prayers} ramadan={data.ramadan} onToggle={togglePrayer} onAdhanSettings={() => setAdhanOpen(true)} />
      <Gap />

      {/* 2 · Dhikr : « Après la prière » par défaut dans les 30 min qui suivent une prière */}
      <DhikrCard afterPrayer={justAfterPrayer(prayers.timings, data.time)} />
      <Gap />

      {/* 3 · Règles */}
      <RulesCard cycle={c} today={data.today} ramadan={data.ramadan} onStart={() => openStart()} onEnd={openEnd} onFlow={(level) => setData((d) => ({ ...d, cycle: { ...d.cycle, flowToday: level } }))} />
      <Gap />

      {/* Mise à jour Accueil (page 7) — Jours blancs, sous Règles */}
      <WhiteDaysCard whiteDays={data.whiteDays} inPeriod={c.kind === 'regles' || c.kind === 'nifas'} today={data.today} onChanged={reload} />
      <Gap />

      {c.askPeriodEnded ? (
        <>
          <View style={[s.card, { backgroundColor: colors.blush, borderColor: colors.blush }]}>
            <Text style={s.cardTitle}>{tr("Tes règles sont-elles terminées ?")}</Text>
            <Row>
              <Button title={tr("Oui")} small onPress={() => answerPeriodEnded(true)} style={{ flex: 1 }} />
              <Button title={tr("Pas encore")} small variant="outline" onPress={() => answerPeriodEnded(false)} style={{ flex: 1 }} />
            </Row>
          </View>
          <Gap />
        </>
      ) : null}
      {c.istihada && c.istihadaInfo ? (
        <>
          <Notice title={tr("Istihada")}>{c.istihadaInfo}</Notice>
          <Gap />
        </>
      ) : null}
      {c.askPregnancy ? (
        <>
          <View style={[s.card, { backgroundColor: colors.blush, borderColor: colors.blush }]}>
            <Text style={s.cardTitle}>{tr("Tes règles ont")} {c.lateDays} {tr("jours de retard. Es-tu enceinte ?")}</Text>
            <T variant="muted">{tr("Un test de grossesse peut te le confirmer.")}</T>
            <Button title={tr("Oui, je suis enceinte")} small onPress={() => router.push('/grossesse')} />
          </View>
          <Gap />
        </>
      ) : null}

      {/* 4 · Mes notes */}
      <NotesWidget notes={data.notes} />

      {/* 5 · Petit rappel */}
      <ReminderCard reminder={data.reminder} />

      <AdhanSoundSheet visible={adhanOpen} onClose={() => setAdhanOpen(false)} paused={prayers.paused} />
      {/* 5.12 — fréquence des notifications, proposée une fois après l'inscription */}
      <Sheet
        visible={Boolean(user && user.notificationPrefs && !user.notificationPrefs.frequencyAsked && !freqClosed)}
        onClose={() => {
          setFreqClosed(true);
          api.patch('/me', { notificationPrefs: { frequencyAsked: true } }).then(setSession).catch(() => {});
        }}
        title={tr("Combien de notifications ?")}
      >
        <T variant="muted">{tr("Choisis combien de conseils et d’actualités tu reçois. Tu pourras changer à tout moment dans ton profil.")}</T>
        <FrequencyPicker
          value={user?.notificationPrefs?.frequency || 'faible'}
          onChange={async (v) => {
            setFreqClosed(true);
            try {
              await setSession(await api.patch('/me', { notificationPrefs: { frequency: v, frequencyAsked: true } }));
              toast(tr("Fréquence enregistrée"));
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
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.line },
  cardTitle: { fontFamily: fonts.extra, fontSize: 19, letterSpacing: -0.4, color: colors.prune },
  surtitle: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.orText },
  muted: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, flexShrink: 1 },
  small: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  lineCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  lineTitle: { fontFamily: fonts.extra, fontSize: 17, color: colors.prune },
  roundIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  nextName: { fontFamily: fonts.extra, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: colors.prune },
  badge: { backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.bordeaux },
  qibla: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', gap: 2 },
  qiblaText: { fontFamily: fonts.bold, fontSize: 12, color: colors.bordeaux },
  pauseText: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.prune },
  tiles: { flexDirection: 'row', gap: 6 },
  tile: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.ivoire, borderWidth: 1, borderColor: colors.line },
  tileNext: { backgroundColor: colors.bordeaux, borderColor: colors.bordeaux },
  tileDone: { backgroundColor: colors.sable, borderColor: colors.sable },
  tileName: { fontFamily: fonts.semi, fontSize: 11.5, color: colors.muted },
  tileTime: { fontFamily: fonts.extra, fontSize: 15.5, color: colors.prune },
  check: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.caseVide, marginTop: 3, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.or, borderColor: colors.or },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  footText: { flex: 1, fontFamily: fonts.semi, fontSize: 14, color: colors.prune },
  footState: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  rules: { backgroundColor: colors.bordeaux, borderRadius: 28, padding: 20, gap: 4, overflow: 'hidden' },
  rulesLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.onBordeaux, textTransform: 'uppercase' },
  rulesBig: { fontFamily: fonts.extra, fontSize: 40, lineHeight: 46, letterSpacing: -1.2, color: colors.white, marginTop: 6 },
  rulesSub: { fontFamily: fonts.medium, fontSize: 14, color: colors.onBordeaux },
  modify: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.onBordeauxSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  modifyText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  flows: { flexDirection: 'row', gap: 6, marginTop: 8 },
  flowBtn: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.onBordeauxSurface },
  flowOn: { backgroundColor: colors.white },
  flowText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  traceDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.white, marginVertical: 6.5 },
  ramadanLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  ramadanText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.onBordeaux },
  whiteBtn: { marginTop: 16, borderRadius: 999, minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  whiteBtnText: { fontFamily: fonts.bold, fontSize: 15, color: colors.bordeaux },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.lineField, alignItems: 'center', justifyContent: 'center' },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  noteLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  noteDot: { width: 10, height: 10, borderRadius: 5 },
  noteTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  addNote: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bordeaux, borderRadius: 999, paddingHorizontal: 18, minHeight: 44 },
  addNoteText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  reminder: { backgroundColor: colors.sable, borderRadius: 24, padding: 18, gap: 8, marginTop: 16 },
  reminderText: { fontFamily: fonts.italic, fontSize: 17, lineHeight: 25, color: colors.prune },
});

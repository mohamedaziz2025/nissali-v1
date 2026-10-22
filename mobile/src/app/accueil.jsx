// 4.4 — Questionnaire d'accueil (après la création du compte) : 3.9 dernières règles (90 jours max, « Je ne sais
// plus »), 3.10 durées (cycle 15–60, règles 1–15, « Je ne sais pas » → 28 et 5), 3.11 objectif (mariées seulement,
// RG-05 ter), 3.11 bis « Es-tu aussi praticienne ? » (RG-50), 3.12 notifications (2 interrupteurs, niveau Faible),
// 3.13 « C'est prêt ». Réponses gardées au fur et à mesure : on reprend où on s'était arrêtée.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CalendarGrid, MonthNav } from '../components/Calendar';
import Icon from '../components/Icon';
import { ChoiceCard, NumberWheel, SignupShell } from '../components/Signup';
import { Checkbox, Loader, T, Toggle } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { addDays, dayMonth, longDate, today as serverToday } from '../lib/format';
import { ensurePermission } from '../lib/notifications';
import { readJson, writeJson } from '../lib/storage';
import { colors, fonts, PRAYER_LABELS } from '../theme';

import { tr } from '../lib/i18n';
const SAVED = 'nissali.onboarding';
const ESSENTIALS = ['periodSoon', 'fertileWindow', 'periodEndQuestion', 'fastMakeup', 'fastPlanned', 'ramadan', 'whiteDays', 'messages', 'events', 'dailyReminder'];

export default function Onboarding() {
  const { step: stepParam } = useLocalSearchParams();
  const { user, setSession } = useAuth();
  const { width } = useWindowDimensions();
  const married = user?.situation === 'mariee';
  const today = serverToday();
  const [a, setA] = useState({ lastPeriod: null, unknownLast: false, month: today.slice(0, 7), cycleLength: 28, periodLength: 5, unknownLengths: false, goal: married ? null : 'suivre', pro: null, prayers: true, essentials: true, submitted: false });
  const [key, setKey] = useState('regles');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const set = (k) => (v) => setA((x) => ({ ...x, [k]: v }));

  const steps = ['regles', 'durees', ...(married ? ['objectif'] : []), 'praticienne', 'notifications', 'pret'];
  useEffect(() => {
    readJson(SAVED, null)
      .then((saved) => {
        if (saved?.a) setA((x) => ({ ...x, ...saved.a }));
        const start = typeof stepParam === 'string' && steps.includes(stepParam) ? stepParam : saved?.key && steps.includes(saved.key) ? saved.key : 'regles';
        setKey(start);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (loaded) writeJson(SAVED, { key, a }).catch(() => {});
  }, [loaded, key, a]);
  useEffect(() => {
    if (key !== 'pret') return;
    api.get('/today').then(setSummary).catch(() => setSummary({}));
  }, [key]);

  // Les réponses du cycle sont envoyées dès qu'elles sont complètes (avant les notifications).
  const submit = async () => {
    if (a.submitted) return true;
    const r = await api.post('/me/onboarding', {
      lastPeriodStart: a.unknownLast ? null : a.lastPeriod,
      cycleLength: a.unknownLengths ? null : a.cycleLength,
      periodLength: a.unknownLengths ? null : a.periodLength,
      goal: a.goal || 'suivre',
      pastPeriods: [],
      pregnancy: a.goal === 'enceinte' ? { lmp: a.unknownLast ? undefined : a.lastPeriod || undefined } : undefined,
    });
    await setSession(r);
    setA((x) => ({ ...x, submitted: true }));
    return true;
  };
  const go = (k) => {
    setError(null);
    setKey(k);
  };
  const idx = steps.indexOf(key);
  const nextKey = steps[idx + 1];

  const next = async () => {
    setError(null);
    if (key === 'praticienne') {
      setBusy(true);
      try {
        await submit();
        if (a.pro === 'oui') return router.push('/devenir-praticienne?from=inscription');
        go(nextKey);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (key === 'notifications') {
      setBusy(true);
      try {
        if (a.prayers || a.essentials) await ensurePermission().catch(() => false); // refus : on continue quand même
        await setSession(await api.patch('/me', { prayerSettings: { notifications: a.prayers }, notificationPrefs: { ...Object.fromEntries(ESSENTIALS.map((k) => [k, a.essentials])), frequency: 'faible', frequencyAsked: true } }));
        go(nextKey);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (key === 'pret') {
      await writeJson(SAVED, null).catch(() => {});
      return router.replace(a.goal === 'enceinte' ? '/grossesse' : '/(tabs)');
    }
    go(nextKey);
  };
  const back = () => (idx > 0 ? go(steps[idx - 1]) : null);

  const cycleSteps = steps.filter((k) => ['regles', 'durees', 'objectif'].includes(k));
  const lastSteps = steps.filter((k) => ['praticienne', 'notifications', 'pret'].includes(k));
  const section = cycleSteps.includes(key) ? { section: tr("Ton cycle"), index: cycleSteps.indexOf(key) + 1, count: cycleSteps.length } : { section: tr("Dernière étape"), index: lastSteps.indexOf(key) + 1, count: lastSteps.length };

  const valid = {
    regles: a.unknownLast || Boolean(a.lastPeriod),
    durees: true,
    objectif: Boolean(a.goal),
    praticienne: Boolean(a.pro),
    notifications: true,
    pret: true,
  }[key];

  const s9 = a.lastPeriod && !a.unknownLast;
  const content = {
    regles: (
      <>
        <View style={s.card}>
          <MonthNav month={a.month} onChange={(m) => m <= today.slice(0, 7) && m >= addDays(today, -90).slice(0, 7) && set('month')(m)} />
          <CalendarGrid month={a.month} days={s9 ? [{ day: a.lastPeriod, period: 'reelle' }] : []} width={Math.min(width, 520) - 40 - 28} selected={s9 ? a.lastPeriod : null} maxDay={today} minDay={addDays(today, -90)} onDayPress={(d) => setA((x) => ({ ...x, lastPeriod: d, unknownLast: false }))} />
        </View>
        {s9 ? <Text style={s.picked}>{tr("Premier jour :")} {longDate(a.lastPeriod)}</Text> : null}
        <Checkbox checked={a.unknownLast} onChange={(v) => setA((x) => ({ ...x, unknownLast: v, lastPeriod: v ? null : x.lastPeriod }))}>{tr("Je ne sais plus")}</Checkbox>
        {a.unknownLast ? <T variant="small">{tr("Pas de souci : tes prédictions démarreront à tes prochaines règles.")}</T> : null}
      </>
    ),
    durees: (
      <>
        <Text style={s.label}>{tr("Durée du cycle")}</Text>
        <NumberWheel min={15} max={60} value={a.cycleLength} onChange={(v) => setA((x) => ({ ...x, cycleLength: v, unknownLengths: false }))} suffix=" jours" />
        <Text style={s.label}>{tr("Durée des règles")}</Text>
        <NumberWheel min={1} max={15} value={a.periodLength} onChange={(v) => setA((x) => ({ ...x, periodLength: v, unknownLengths: false }))} suffix=" jours" />
        <Checkbox checked={a.unknownLengths} onChange={(v) => setA((x) => ({ ...x, unknownLengths: v, ...(v ? { cycleLength: 28, periodLength: 5 } : {}) }))}>{tr("Je ne sais pas")}</Checkbox>
        {a.unknownLengths ? <T variant="small">{tr("Nous partons de 28 jours de cycle et 5 jours de règles. Tes prédictions s’affineront au fil des cycles.")}</T> : null}
      </>
    ),
    objectif: (
      <>
        <ChoiceCard title={tr("Suivre mon cycle")} text={tr("Règles, phases, prières et jeûnes")} icon="cycle" selected={a.goal === 'suivre'} onPress={() => set('goal')('suivre')} />
        <ChoiceCard title={tr("Avoir un enfant")} text={tr("Fenêtre fertile, glaire et température")} icon="heart" selected={a.goal === 'enfant'} onPress={() => set('goal')('enfant')} />
        <ChoiceCard title={tr("Je suis enceinte")} text={tr("Suivi semaine par semaine")} icon="baby" selected={a.goal === 'enceinte'} onPress={() => set('goal')('enceinte')} />
      </>
    ),
    praticienne: (
      <>
        <ChoiceCard title={tr("Oui")} text={tr("Diététicienne, naturopathe, hijama, coach, doula…")} icon="briefcase" selected={a.pro === 'oui'} onPress={() => set('pro')('oui')} />
        <ChoiceCard title={tr("Non")} icon="user" selected={a.pro === 'non'} onPress={() => set('pro')('non')} />
        {a.pro === 'oui' ? (
          <View style={s.note}>
            <Icon name="lock" size={17} color={colors.orText} />
            <Text style={s.noteText}>{tr("Tes deux espaces restent séparés : aucune donnée personnelle (cycle, notes, prières) n’est visible côté pro.")}</Text>
          </View>
        ) : null}
      </>
    ),
    notifications: (
      <>
        <View style={s.card}>
          <Toggle label={tr("Rappels de prière")} hint={tr("À l’heure de chaque prière, en pause pendant tes règles")} value={a.prayers} onChange={set('prayers')} />
          <Toggle label={tr("Rappels essentiels")} hint={tr("Règles prévues, jeûnes programmés, Ramadan, messages…")} value={a.essentials} onChange={set('essentials')} />
        </View>
        <View style={s.note}>
          <Icon name="sliders" size={17} color={colors.orText} />
          <Text style={s.noteText}>{tr("Niveau Faible : aucun conseil ni actualité, seulement les rappels que tu as choisis. Discrets sur l’écran verrouillé.")}</Text>
        </View>
      </>
    ),
    pret: !summary ? (
      <Loader />
    ) : (
      <>
        <View style={s.ready}>
          <Icon name="drop" size={20} color={colors.bordeaux} />
          <View style={{ flex: 1 }}>
            <Text style={s.readyLabel}>{tr("Prochaines règles")}</Text>
            <Text style={s.readyValue}>
              {summary.cycle?.kind === 'prochaines' && summary.cycle.nextDate ? tr("Vers le {0}", [dayMonth(summary.cycle.nextDate)]) : summary.cycle?.kind === 'regles' ? tr("En cours · jour {0}", [summary.cycle.periodDay]) : summary.cycle?.kind === 'grossesse' ? tr("Suivi de grossesse") : tr("Dès ta prochaine saisie")}
            </Text>
          </View>
        </View>
        <View style={s.ready}>
          <Icon name="sun" size={20} color={colors.bordeaux} />
          <View style={{ flex: 1 }}>
            <Text style={s.readyLabel}>{tr("Prochaine prière à")} {summary.prayers?.city || user?.city?.name}</Text>
            <Text style={s.readyValue}>{summary.prayers?.next ? `${PRAYER_LABELS[summary.prayers.next.key]} · ${summary.prayers.next.time || summary.prayers.tomorrowFajr || ''}${summary.prayers.next.tomorrow ? tr(" (demain)") : ''}` : '—'}</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/horaires')} accessibilityRole="link" style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
          <Text style={s.link}>{tr("Choisir ma mosquée (facultatif) →")}</Text>
        </Pressable>
      </>
    ),
  }[key];

  const titles = {
    regles: [tr("Tes dernières règles"), tr("Touche le premier jour. Les 90 derniers jours sont accessibles.")],
    durees: [tr("Tes durées habituelles"), tr("En moyenne : la durée de ton cycle et de tes règles.")],
    objectif: [tr("Ton objectif"), tr("Tu pourras le changer dans ton profil.")],
    praticienne: [tr("Es-tu aussi praticienne ?"), tr("Tu peux proposer tes services dans Nissali, maintenant ou plus tard.")],
    notifications: [tr("Tes notifications"), tr("Le bouton ci-dessous demande l’autorisation du téléphone.")],
    pret: [tr("C’est prêt, {0} !", [user?.firstName || '']), tr("Voici ce qui t’attend.")],
  }[key];

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.ivoire }} />;
  return (
    <SignupShell
      {...section}
      title={titles[0]}
      subtitle={titles[1]}
      onBack={idx > 0 && key !== 'pret' ? back : null}
      onNext={next}
      nextLabel={key === 'notifications' ? (a.prayers || a.essentials ? tr("Activer mes notifications") : tr("Continuer")) : key === 'pret' ? tr("Découvrir Nissali") : key === 'praticienne' && a.pro === 'oui' ? tr("Configurer mon profil praticienne") : tr("Continuer")}
      canNext={valid}
      busy={busy}
      error={error}
      secondary={
        key === 'praticienne' && a.pro === 'oui' ? (
          <Pressable onPress={async () => { setBusy(true); try { await submit(); await api.put('/pro-profile/draft', { step: 1, later: true }).catch(() => {}); go(nextKey); } catch (e) { setError(e.message); } finally { setBusy(false); } }} accessibilityRole="button" style={s.later}>
            <Text style={s.laterText}>{tr("Plus tard")}</Text>
          </Pressable>
        ) : null
      }
    >
      {content}
    </SignupShell>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.line },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.orText, textTransform: 'uppercase' },
  picked: { fontFamily: fonts.bold, fontSize: 15, color: colors.bordeaux },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.sable, borderRadius: 18, padding: 14 },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.prune },
  ready: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.line },
  readyLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  readyValue: { fontFamily: fonts.extra, fontSize: 19, color: colors.prune },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux },
  later: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  laterText: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
});

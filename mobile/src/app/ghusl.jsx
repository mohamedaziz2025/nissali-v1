// 4.2 · 1.4 — « Ghusl et prières » (plein écran). Trois étapes : le ghusl, les prières à accomplir (RG-16,
// RG-19 : selon l'heure de fin), la reprise des prières à leur heure. L'écran reste proposé (carte contextuelle D)
// jusqu'à ce que tout soit coché, ou jusqu'au Fajr qui suit la fin des règles.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { Button, ErrorState, Loader, Notice, T, Toggle, useToast } from '../components/ui';
import { api, sendOrQueue } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dayMonth } from '../lib/format';
import { useApi } from '../lib/useApi';
import { colors, fonts, PRAYER_LABELS, tnum } from '../theme';

import { tr } from '../lib/i18n';
function Step({ n, title, done, children, last }) {
  return (
    <View style={s.step}>
      <View style={{ alignItems: 'center' }}>
        <View style={[s.num, done && s.numDone]}>
          {done ? <Icon name="check" size={14} color={colors.white} strokeWidth={3} /> : <Text style={s.numText}>{n}</Text>}
        </View>
        {last ? null : <View style={s.rail} />}
      </View>
      <View style={{ flex: 1, gap: 10, paddingBottom: last ? 0 : 22 }}>
        <Text style={s.stepTitle}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

function CheckRow({ label, sub, done, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: done, disabled }} accessibilityLabel={`${label}${sub ? `, ${sub}` : ''}`} style={({ pressed }) => [s.check, done && s.checkOn, pressed && { opacity: 0.85 }, disabled && { opacity: 0.55 }]}>
      <View style={[s.box, done && s.boxOn]}>{done ? <Icon name="check" size={12} color={colors.white} strokeWidth={3} /> : null}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.checkLabel}>{label}</Text>
        {sub ? <Text style={[s.checkSub, tnum]}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function Ghusl() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, setSession } = useAuth();
  const { data, setData, loading, error, reload } = useApi('/today');
  const [busy, setBusy] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const header = (sub) => (
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={tr("Fermer")} hitSlop={10} style={s.close}>
        <Icon name="close" size={18} color={colors.white} />
      </Pressable>
      <Text style={s.surtitle}>{tr("APRÈS TES RÈGLES")}</Text>
      <Text style={s.title} accessibilityRole="header">{tr("Ghusl et prières")}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );

  if (loading && !data) return <View style={s.screen}>{header()}<Loader /></View>;
  if (error && !data) return <View style={s.screen}>{header()}<ErrorState error={error} onRetry={reload} /></View>;
  const p = data.purification;
  if (!p) {
    return (
      <View style={s.screen}>
        {header()}
        <View style={{ padding: 20, gap: 14 }}>
          <T>{tr("Rien à faire pour l’instant. Cet écran s’ouvre quand tu notes la fin de tes règles.")}</T>
          <Button title={tr("Retour à l’accueil")} onPress={() => router.replace('/')} />
        </View>
      </View>
    );
  }

  const save = async (patch, local) => {
    setBusy(true);
    setData((d) => ({ ...d, purification: { ...d.purification, ...local(d.purification) } }));
    try {
      await sendOrQueue('PUT', `/cycle/periods/${p.periodId}/after`, patch);
    } catch (e) {
      toast(e.message, 'error');
      reload();
    } finally {
      setBusy(false);
    }
  };
  const recount = (pp) => (pp.ghusl ? 1 : 0) + pp.prayers.filter((x) => x.done).length;
  const toggleGhusl = () =>
    save({ ghusl: !p.ghusl }, (pp) => {
      const next = { ...pp, ghusl: !pp.ghusl };
      return { ...next, done: recount(next) };
    });
  const togglePrayer = (key) => {
    const prayers = p.prayers.map((x) => (x.key === key ? { ...x, done: !x.done } : x));
    save({ prayersDone: prayers.filter((x) => x.done).map((x) => x.key) }, (pp) => {
      const next = { ...pp, prayers };
      return { ...next, done: recount(next) };
    });
  };
  const reminders = user?.prayerSettings?.purificationReminders !== false;
  const setReminders = async (v) => {
    try {
      await setSession(await api.patch('/me', { prayerSettings: { purificationReminders: v } }));
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const allDone = p.done >= p.total;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {header(`Règles du ${dayMonth(p.start)} au ${dayMonth(p.end)}${p.endTime ? `, fin à ${p.endTime}` : ''} · ${p.days} jour${p.days > 1 ? 's' : ''}`)}
        <View style={s.progressWrap}>
          <View style={s.progressCard}>
            <Text style={[s.progressText, tnum]}>{p.done} {tr("sur")} {p.total} {tr("fait")}</Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${Math.round((p.done / Math.max(1, p.total)) * 100)}%` }]} />
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 22 }}>
          <Step n={1} title={tr("Ton ghusl")} done={p.ghusl}>
            <CheckRow label={tr("J’ai fait mon ghusl")} done={p.ghusl} onPress={toggleGhusl} disabled={busy} />
            <Pressable onPress={() => router.push('/blog/comment-faire-mes-grandes-ablutions-ghusl')} accessibilityRole="link" style={s.linkRow}>
              <Text style={s.link}>{tr("Comment faire mon ghusl")}</Text>
              <Icon name="chevronRight" size={14} color={colors.bordeaux} />
            </Pressable>
          </Step>

          <Step n={2} title={tr("Les prières à accomplir")} done={p.prayers.length > 0 && p.prayers.every((x) => x.done)}>
            {!p.endTime ? (
              <Notice>{tr("Indique l’heure de fin de tes règles (Mes règles › Modifier) pour savoir quelles prières accomplir.")}</Notice>
            ) : p.prayers.length ? (
              p.prayers.map((x) => <CheckRow key={x.key} label={x.label} sub={x.due ? tr("{0} · à accomplir", [x.time]) : tr("{0} · à son heure", [x.time])} done={x.done} onPress={() => togglePrayer(x.key)} disabled={busy} />)
            ) : (
              <T variant="muted">{tr("Aucune prière à rattraper : reprends tes prières à leur heure.")}</T>
            )}
            <Text style={s.rule}>{p.ruleText}</Text>
          </Step>

          <Step n={3} title={tr("Tes prières reprennent")} done={allDone} last>
            <T variant="muted">{p.next ? tr("Prochaine prière à son heure : {0}. ", [PRAYER_LABELS[p.next]]) : ''}{tr("Tes rappels de prière sont réactivés.")}</T>
            <View style={s.toggleCard}>
              <Toggle label={tr("Me rappeler les prières à accomplir")} hint={tr("Avant le Fajr suivant, si elles ne sont pas cochées.")} value={reminders} onChange={setReminders} />
            </View>
          </Step>

          {allDone ? (
            <View style={s.doneCard}>
              <Icon name="sparkle" size={18} color={colors.orText} />
              <Text style={s.doneText}>{tr("Tout est fait. Qu’Allah accepte tes prières.")}</Text>
            </View>
          ) : null}
          <Button title={allDone ? tr("Terminer") : tr("Plus tard")} variant={allDone ? 'primary' : 'outline'} onPress={close} style={{ marginTop: 22 }} />
          <T variant="small" style={{ textAlign: 'center', marginTop: 10 }}>{tr("En cas de doute, rapproche-toi d’une personne de science.")}</T>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivoire },
  header: { backgroundColor: colors.bordeaux, paddingHorizontal: 20, paddingBottom: 46, gap: 6, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  close: { alignSelf: 'flex-end', width: 36, height: 36, borderRadius: 18, backgroundColor: colors.onBordeauxSurface, alignItems: 'center', justifyContent: 'center' },
  surtitle: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.orClair },
  title: { fontFamily: fonts.extra, fontSize: 32, letterSpacing: -1, color: colors.white },
  sub: { fontFamily: fonts.medium, fontSize: 14, color: colors.onBordeaux },
  progressWrap: { paddingHorizontal: 20, marginTop: -28 },
  progressCard: { backgroundColor: colors.white, borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.line },
  progressText: { fontFamily: fonts.extra, fontSize: 17, color: colors.prune },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.blush, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.or },
  step: { flexDirection: 'row', gap: 14 },
  num: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  numDone: { backgroundColor: colors.or, borderColor: colors.or },
  numText: { fontFamily: fonts.extra, fontSize: 14, color: colors.bordeaux },
  rail: { flex: 1, width: 2, backgroundColor: colors.line, marginTop: 4 },
  stepTitle: { fontFamily: fonts.extra, fontSize: 18, color: colors.prune, marginTop: 3 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14 },
  checkOn: { backgroundColor: colors.sable, borderColor: colors.sable },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.caseVide, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.or, borderColor: colors.or },
  checkLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  checkSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  rule: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.muted },
  toggleCard: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 4 },
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.sable, borderRadius: 16, padding: 14, marginTop: 22 },
  doneText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
});

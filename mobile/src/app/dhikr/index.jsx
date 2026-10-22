// 4.6 · 5.1 — Page Dhikr (même langage visuel que Jeûnes) : bloc bordeaux (total du jour, série, barre en segments
// = un segment doré par objectif atteint, semaine en 7 ronds), deux tuiles Tasbih (libre / après la prière),
// Mes dhikr du jour (anneau, « 83 / 100 », arabe en Amiri ; appui long → objectif, ordre, retirer), « + Ajouter » (5.4).
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TimeField } from '../../components/forms';
import Icon from '../../components/Icon';
import { Button, Chip, ErrorState, Field, Label, Loader, OfflineBanner, Ring, Row, Screen, Sheet, T, Toggle, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { plural, useDhikrData } from '../../lib/dhikr';
import { colors, fonts, tnum } from '../../theme';

import { tr } from '../../lib/i18n';
const confirm = (title, text, action, label) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${text}`)) action(); // eslint-disable-line no-alert
    return;
  }
  Alert.alert(title, text, [
    { text: tr("Annuler"), style: 'cancel' },
    { text: label, style: 'destructive', onPress: action },
  ]);
};

/** Semaine en 7 ronds : doré coché = au moins un objectif atteint, blanc = aujourd'hui, pointillé sinon. */
function WeekDots({ week, todayReached }) {
  return (
    <View style={s.week}>
      {week.map((w) => {
        const reached = w.today ? todayReached : w.reached;
        return (
          <View key={w.day} style={s.weekCol} accessibilityLabel={`${w.label} : ${reached ? tr("objectif atteint") : (w.future ? tr("à venir") : tr("sans objectif"))}`}>
            <View style={[s.dot, reached ? s.dotGold : w.today ? s.dotToday : s.dotDashed]}>
              {reached ? <Icon name="check" size={13} color={colors.white} strokeWidth={3} /> : null}
            </View>
            <Text style={[s.weekLabel, w.today && { color: colors.white }]}>{w.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function DhikrCard({ d, onPress, onLongPress }) {
  const reached = d.count >= d.goal;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} accessibilityRole="button" accessibilityLabel={tr("{0}, {1} sur {2}{3}{4}", [d.name, d.count, d.goal, (reached ? tr(", objectif atteint") : ''), (d.personal ? tr(", personnel") : '')])} accessibilityHint={tr("Appui long pour l’objectif, l’ordre ou le retirer")} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
      <Ring progress={d.count / d.goal} size={50} stroke={4} color={reached ? colors.or : colors.bordeaux} track={colors.line}>
        {reached ? <Icon name="check" size={20} color={colors.or} strokeWidth={2.8} /> : <Text style={[s.ringText, tnum]}>{Math.round(Math.min(1, d.count / d.goal) * 100)}%</Text>}
      </Ring>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Row gap={6}>
          <Text style={s.rowName} numberOfLines={1}>{d.name}</Text>
          {d.personal ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{tr("Personnel")}</Text>
            </View>
          ) : null}
        </Row>
        {d.meaning ? <Text style={s.rowMeta} numberOfLines={1}>{d.meaning}</Text> : null}
        <Text style={[s.rowCount, tnum]}>{d.count} / {d.goal}</Text>
      </View>
      {d.arabic ? <Text style={s.arabic} numberOfLines={1}>{d.arabic}</Text> : null}
    </Pressable>
  );
}

export default function Dhikr() {
  const toast = useToast();
  const { user, setSession } = useAuth();
  const { data, error, loading, offline, reload, counts } = useDhikrData();
  const [edit, setEdit] = useState(null); // { key, goal, free, name, personal, arabic }
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [create, setCreate] = useState({ name: '', arabic: '', goal: 33 });
  const [query, setQuery] = useState('');
  const [pickGoal, setPickGoal] = useState(null); // dhikr du catalogue en cours d'ajout
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Screen back title={tr("Dhikr")}><Loader /></Screen>;
  if (error && !data) return <Screen back title={tr("Dhikr")}><ErrorState error={error} onRetry={reload} /></Screen>;

  const list = data.list.map((d) => ({ ...d, count: counts[d.key] || 0 }));
  const total = Object.values(counts).reduce((n, c) => n + c, 0);
  const reachedCount = list.filter((d) => d.count >= d.goal).length;
  const settings = user?.dhikr || data.settings || {};
  const max = data.max || 20;
  const full = list.length >= max;

  const saveList = async (next, message) => {
    try {
      await api.put('/dhikr/list', { list: next.map(({ key, goal }) => ({ key, goal })) });
      if (message) toast(message);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const saveSettings = async (patch, message) => {
    try {
      const r = await api.patch('/dhikr/settings', patch);
      await setSession({ user: r.user });
      if (message) toast(message);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const move = (key, delta) => {
    const i = list.findIndex((d) => d.key === key);
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    saveList(next);
  };
  const remove = (d) =>
    confirm(d.personal ? tr("Supprimer ce dhikr ?") : tr("Retirer ce dhikr ?"), d.personal ? tr("Ton dhikr personnel est supprimé.") : tr("Il disparaît de tes dhikr du jour ; tu pourras le rajouter."), async () => {
      setEdit(null);
      if (d.personal) {
        await api.delete(`/dhikr/custom/${d.key}`).then(() => toast(tr("Dhikr supprimé"))).catch((e) => toast(e.message, 'error'));
        reload();
      } else saveList(list.filter((x) => x.key !== d.key), 'Dhikr retiré');
    }, d.personal ? 'Supprimer' : 'Retirer');
  const saveEdit = async () => {
    const e = edit;
    setEdit(null);
    if (e.personal) {
      try {
        await api.patch(`/dhikr/custom/${e.key}`, { name: e.name, arabic: e.arabic || null, goal: e.goal });
        toast(tr("Dhikr enregistré"));
        reload();
      } catch (err) {
        toast(err.message, 'error');
      }
    } else saveList(list.map((d) => (d.key === e.key ? { ...d, goal: e.goal } : d)), 'Objectif enregistré');
  };
  const createDhikr = async () => {
    setBusy(true);
    try {
      await api.post('/dhikr/custom', { name: create.name.trim(), arabic: create.arabic.trim() || null, goal: create.goal });
      toast(tr("Ton dhikr est ajouté"));
      setCreate({ name: '', arabic: '', goal: 33 });
      setAdding(false);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const q = query.trim().toLowerCase();
  const catalog = data.catalog.filter((c) => !q || `${c.name} ${c.meaning}`.toLowerCase().includes(q));
  const editing = edit && list.find((d) => d.key === edit.key);
  const idx = editing ? list.indexOf(editing) : -1;

  return (
    <Screen back title={tr("Dhikr")} onRefresh={reload} right={<Pressable onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel={tr("Réglages du dhikr")} hitSlop={8} style={s.round}><Icon name="settings" size={20} color={colors.bordeaux} /></Pressable>}>
      <OfflineBanner visible={offline} />
      <View style={s.hero}>
        <Row justify="space-between" align="flex-start">
          <Text style={s.heroLabel}>{tr("AUJOURD’HUI")}</Text>
          {data.streak ? (
            <View style={s.streak}>
              <Icon name="sparkle" size={13} color={colors.orClair} />
              <Text style={s.streakText}>{plural(data.streak, 'jour')} {tr("d’affilée")}</Text>
            </View>
          ) : null}
        </Row>
        <Row gap={8} align="flex-end">
          <Text style={[s.heroTotal, tnum]} adjustsFontSizeToFit numberOfLines={1}>{total}</Text>
          <Text style={s.heroUnit}>{tr("dhikr")}</Text>
        </Row>
        <View style={s.segments} accessibilityLabel={tr("{0} objectifs atteints sur {1}", [reachedCount, list.length])}>
          {list.map((d) => (
            <View key={d.key} style={[s.segment, d.count >= d.goal && { backgroundColor: colors.orClair }]} />
          ))}
        </View>
        <Text style={s.heroSub}>{reachedCount} {tr("objectif")}{reachedCount > 1 ? 's' : ''} {tr("atteint")}{reachedCount > 1 ? 's' : ''} {tr("sur")} {list.length}</Text>
        <WeekDots week={data.week} todayReached={reachedCount > 0} />
        {data.inPeriod ? <Text style={s.heroNote}>{tr("Pendant tes règles, ta série n’est jamais cassée : le dhikr reste recommandé, rien n’est imposé.")}</Text> : null}
      </View>

      <Row gap={12} align="stretch" style={{ marginTop: 14 }}>
        <Pressable onPress={() => router.push('/dhikr/libre')} accessibilityRole="button" style={({ pressed }) => [s.tile, s.tileFree, pressed && { opacity: 0.9 }]}>
          <View style={[s.tileIcon, { backgroundColor: colors.onBordeauxSurface }]}>
            <Icon name="beads" size={20} color={colors.white} />
          </View>
          <Text style={[s.tileTitle, { color: colors.white }]}>{tr("Tasbih libre")}</Text>
          <Text style={[s.tileSub, { color: colors.onBordeaux }]}>{tr("Sans objectif, n’importe quand : dans le bus, en marchant…")}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/dhikr/compteur?mode=tasbih')} accessibilityRole="button" style={({ pressed }) => [s.tile, s.tilePrayer, pressed && { opacity: 0.9 }]}>
          <View style={[s.tileIcon, { backgroundColor: colors.white }]}>
            <Icon name="moon" size={20} color={colors.bordeaux} />
          </View>
          <Text style={s.tileTitle}>{tr("Après la prière")}</Text>
          <Text style={s.tileSub}>{tr("33 · 33 · 33 puis la tahlila pour faire 100")}</Text>
        </Pressable>
      </Row>

      <Row justify="space-between" style={{ marginTop: 22, marginBottom: 10 }}>
        <Text style={s.section}>{tr("Mes dhikr du jour")}</Text>
        <Pressable onPress={() => setAdding(true)} accessibilityRole="button" hitSlop={8}>
          <Text style={s.link}>{tr("+ Ajouter")}</Text>
        </Pressable>
      </Row>
      <View style={{ gap: 10 }}>
        {list.map((d) => (
          <DhikrCard key={d.key} d={d} onPress={() => router.push(`/dhikr/compteur?key=${d.key}`)} onLongPress={() => setEdit({ key: d.key, goal: d.goal, name: d.name, arabic: d.arabic, personal: d.personal, free: !data.goalChoices.includes(d.goal) })} />
        ))}
      </View>
      <T variant="small" style={{ marginTop: 12 }}>{tr("Appui long sur un dhikr : objectif, ordre (le même que sur l’accueil) ou le retirer. Les compteurs repartent à zéro chaque jour à minuit.")}</T>
      <T variant="small" style={{ marginTop: 6 }}>{tr("Textes arabes, phonétique et sens validés par le comité religieux. Les dhikr « Personnel » ne sont vus que par toi.")}</T>

      {/* Appui long : objectif, ordre, retirer (et texte pour un dhikr personnel) */}
      <Sheet visible={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.personal ? tr("Mon dhikr") : edit?.name || ''} footer={<Button title={tr("Enregistrer")} disabled={!edit?.goal || (edit?.personal && (edit.name || '').trim().length < 2)} onPress={saveEdit} />}>
        {edit?.personal ? (
          <>
            <Field label={tr("Texte")} value={edit.name} onChangeText={(v) => setEdit((e) => ({ ...e, name: v.slice(0, 80) }))} />
            <Field label={tr("En arabe (facultatif)")} value={edit.arabic || ''} onChangeText={(v) => setEdit((e) => ({ ...e, arabic: v }))} />
          </>
        ) : null}
        <Label>{tr("Objectif")}</Label>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {data.goalChoices.map((g) => (
            <Chip key={g} label={String(g)} selected={!edit?.free && edit?.goal === g} onPress={() => setEdit((e) => ({ ...e, goal: g, free: false }))} />
          ))}
          <Chip label={tr("Autre nombre")} selected={Boolean(edit?.free)} onPress={() => setEdit((e) => ({ ...e, free: true }))} />
        </Row>
        {edit?.free ? <Field label={tr("Nombre")} keyboardType="number-pad" value={edit.goal ? String(edit.goal) : ''} onChangeText={(v) => setEdit((e) => ({ ...e, goal: Math.min(10000, Number(v.replace(/\D/g, '')) || 0) }))} /> : null}
        <Label>{tr("Ordre")}</Label>
        <Row gap={10}>
          <Button title={tr("Monter")} small variant="outline" icon="arrowUp" disabled={idx <= 0} onPress={() => { move(edit.key, -1); setEdit(null); }} style={{ flex: 1 }} />
          <Button title={tr("Descendre")} small variant="outline" disabled={idx < 0 || idx >= list.length - 1} onPress={() => { move(edit.key, 1); setEdit(null); }} style={{ flex: 1 }} />
        </Row>
        {list.length > 1 || edit?.personal ? <Button title={edit?.personal ? tr("Supprimer ce dhikr") : tr("Retirer de ma liste")} variant="ghost" onPress={() => remove(editing || edit)} /> : null}
      </Sheet>

      {/* 5.4 — Ajouter ou créer un dhikr */}
      <Sheet visible={adding} onClose={() => setAdding(false)} title={tr("Ajouter un dhikr")}>
        <View style={s.createBox}>
          <Text style={s.createTitle}>{tr("Créer mon dhikr")}</Text>
          <Field label={tr("Texte")} value={create.name} onChangeText={(v) => setCreate((c) => ({ ...c, name: v.slice(0, 80) }))} placeholder={tr("Ton invocation ou ton dhikr")} hint={`${create.name.length} / 80`} />
          <Field label={tr("En arabe (facultatif)")} value={create.arabic} onChangeText={(v) => setCreate((c) => ({ ...c, arabic: v }))} />
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {data.goalChoices.map((g) => (
              <Chip key={g} label={String(g)} selected={create.goal === g} onPress={() => setCreate((c) => ({ ...c, goal: g }))} />
            ))}
          </Row>
          <Button title={tr("Créer")} small loading={busy} disabled={full || create.name.trim().length < 2 || busy} onPress={createDhikr} />
          <T variant="small">{tr("Il apparaît avec la mention « Personnel ». Vu par toi seule, jamais publié.")}</T>
        </View>
        <Text style={s.createTitle}>{tr("Les plus connus")}</Text>
        <View style={s.search}>
          <Icon name="search" size={17} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder={tr("Rechercher (phonétique ou sens)")} placeholderTextColor={colors.muted} style={s.searchInput} accessibilityLabel={tr("Rechercher un dhikr")} />
        </View>
        {full ? <T variant="small" color={colors.bordeaux}>{max} {tr("dhikr au maximum dans ta liste : retires-en un pour en ajouter.")}</T> : null}
        {catalog.map((c) => {
          const added = list.some((d) => d.key === c.key);
          return (
            <View key={c.key} style={s.catRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rowName} numberOfLines={2}>{c.name}</Text>
                <Text style={s.rowMeta} numberOfLines={2}>{c.meaning}</Text>
              </View>
              {added ? (
                <Pressable onPress={() => list.length > 1 && saveList(list.filter((d) => d.key !== c.key), `${c.name} retiré`)} accessibilityRole="button" accessibilityLabel={tr("{0} ajouté. Retirer", [c.name])} style={[s.addBtn, s.added]}>
                  <Icon name="check" size={14} color={colors.orText} strokeWidth={2.6} />
                  <Text style={[s.addText, { color: colors.orText }]}>{tr("Ajouté")}</Text>
                </Pressable>
              ) : (
                <Pressable disabled={full} onPress={() => setPickGoal({ ...c })} accessibilityRole="button" accessibilityLabel={tr("Ajouter {0}", [c.name])} style={[s.addBtn, full && { opacity: 0.4 }]}>
                  <Icon name="plus" size={16} color={colors.white} />
                </Pressable>
              )}
            </View>
          );
        })}
      </Sheet>

      <Sheet visible={Boolean(pickGoal)} onClose={() => setPickGoal(null)} title={pickGoal?.name || ''} footer={<Button title={tr("Ajouter")} onPress={() => { const c = pickGoal; setPickGoal(null); saveList([...list, { key: c.key, goal: c.goal }], `${c.name} ajouté`); }} />}>
        <Label>{tr("Objectif")}</Label>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {[...new Set([...data.goalChoices, pickGoal?.goal].filter(Boolean))].sort((a, b) => a - b).map((g) => (
            <Chip key={g} label={String(g)} selected={pickGoal?.goal === g} onPress={() => setPickGoal((p) => ({ ...p, goal: g }))} />
          ))}
        </Row>
      </Sheet>

      <Sheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} title={tr("Réglages du dhikr")}>
        <Toggle label={tr("Vibration au comptage")} hint={tr("Une petite vibration à chaque dhikr, plus longue à l’objectif")} value={settings.haptics !== false} onChange={(v) => saveSettings({ haptics: v })} />
        <Toggle label={tr("Rappel de dhikr chaque jour")} hint={settings.reminder ? tr("Chaque jour à {0}", [settings.reminderTime || '20:30']) : tr("Facultatif, à l’heure de ton choix")} value={Boolean(settings.reminder)} onChange={(v) => saveSettings({ reminder: v }, v ? 'Rappel de dhikr activé' : 'Rappel de dhikr désactivé')} />
        {settings.reminder ? <TimeField label={tr("Heure du rappel")} value={settings.reminderTime || '20:30'} allowUnknown={false} onChange={(t) => t && saveSettings({ reminderTime: t }, `Rappel à ${t}`)} /> : null}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.bordeaux, borderRadius: 28, padding: 20, gap: 8 },
  heroLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.onBordeaux },
  heroTotal: { fontFamily: fonts.extra, fontSize: 72, lineHeight: 78, letterSpacing: -2, color: colors.white, maxWidth: '75%' },
  heroUnit: { fontFamily: fonts.semi, fontSize: 16, color: colors.onBordeaux, marginBottom: 14 },
  heroSub: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.onBordeaux },
  heroNote: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.onBordeaux, marginTop: 4 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.onBordeauxSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  streakText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.onBordeauxSurface },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  weekCol: { alignItems: 'center', gap: 5, flex: 1 },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dotGold: { backgroundColor: colors.or },
  dotToday: { backgroundColor: colors.white },
  dotDashed: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.45)' },
  weekLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.onBordeaux },
  tile: { flex: 1, borderRadius: 24, padding: 16, gap: 6 },
  tileFree: { backgroundColor: colors.bordeaux, shadowColor: '#7A1E35', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  tilePrayer: { backgroundColor: colors.sable },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileTitle: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
  tileSub: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.muted },
  section: { fontFamily: fonts.extra, fontSize: 19, letterSpacing: -0.4, color: colors.prune },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 12, paddingRight: 14, borderWidth: 1, borderColor: colors.line },
  ringText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.bordeaux },
  rowName: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune, flexShrink: 1 },
  rowMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  rowCount: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.bordeaux },
  badge: { backgroundColor: colors.sable, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.orText },
  arabic: { fontSize: 20, lineHeight: 34, color: colors.bordeaux, maxWidth: '36%', writingDirection: 'rtl', fontFamily: fonts.arabic },
  createBox: { backgroundColor: colors.sable, borderRadius: 20, padding: 14, gap: 10 },
  createTitle: { fontFamily: fonts.extra, fontSize: 16, color: colors.prune },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 999, borderWidth: 1, borderColor: colors.lineField, paddingHorizontal: 14, minHeight: 46 },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.prune, paddingVertical: 8 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  addBtn: { minWidth: 36, height: 36, borderRadius: 18, backgroundColor: colors.bordeaux, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  added: { backgroundColor: colors.sable, paddingHorizontal: 10 },
  addText: { fontFamily: fonts.bold, fontSize: 12.5 },
});

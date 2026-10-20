// 5.7 bis · 3 — Dhikr : bloc du jour (total, objectifs, série, semaine), tasbih après la prière,
// mes dhikr du jour (anneau ou coche, phonétique, sens, objectif, texte arabe), ajout depuis la liste validée.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { TimeField } from '../../components/forms';
import Icon from '../../components/Icon';
import { Button, Chip, ErrorState, Field, Label, Loader, OfflineBanner, Ring, Row, Screen, Sheet, T, Toggle, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { plural, useDhikrData } from '../../lib/dhikr';
import { colors, fonts } from '../../theme';

function WeekBars({ week }) {
  const max = Math.max(1, ...week.map((w) => w.total || 0));
  return (
    <View style={s.week} accessibilityLabel={`Semaine : ${week.map((w) => `${w.total ?? 0}`).join(', ')}`}>
      {week.map((w) => (
        <View key={w.day} style={s.weekCol}>
          <View style={s.weekTrack}>
            {w.total ? <View style={[s.weekBar, { height: `${Math.max(12, (w.total / max) * 100)}%` }]} /> : <View style={s.weekDash} />}
          </View>
          <Text style={s.weekLabel}>{w.label}</Text>
        </View>
      ))}
    </View>
  );
}

function DhikrRow({ d, count, onPress, onLongPress }) {
  const reached = count >= d.goal;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityLabel={`${d.name}, ${count} sur ${d.goal}${reached ? ', objectif atteint' : ''}`} accessibilityHint="Appui long pour changer l’objectif" style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
      <Ring progress={count / d.goal} size={44} stroke={3.5} color={reached ? colors.or : colors.bordeaux} track={colors.line}>
        {reached ? <Icon name="check" size={18} color={colors.or} strokeWidth={2.6} /> : <Text style={s.ringText}>{count}</Text>}
      </Ring>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowName} numberOfLines={1}>{d.name}</Text>
        <Text style={s.rowMeta} numberOfLines={2}>{d.meaning} · objectif {d.goal}</Text>
      </View>
      <Text style={s.arabic} numberOfLines={1}>{d.arabic}</Text>
    </Pressable>
  );
}

export default function Dhikr() {
  const toast = useToast();
  const { user, setSession } = useAuth();
  const { data, error, loading, offline, reload, counts } = useDhikrData();
  const [edit, setEdit] = useState(null); // { key, goal, free }
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (loading && !data) return <Screen back title="Dhikr"><Loader /></Screen>;
  if (error && !data) return <Screen back title="Dhikr"><ErrorState error={error} onRetry={reload} /></Screen>;

  const list = data.list.map((d) => ({ ...d, count: counts[d.key] || 0 }));
  const total = Object.values(counts).reduce((n, c) => n + c, 0);
  const reachedCount = list.filter((d) => d.count >= d.goal).length;
  const settings = user?.dhikr || data.settings || {};

  const saveList = async (next, message) => {
    try {
      await api.put('/dhikr/list', { list: next.map(({ key, goal }) => ({ key, goal })) });
      toast(message);
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
  const remove = (key) =>
    Alert.alert('Retirer ce dhikr ?', 'Il disparaît de tes dhikr du jour ; tu pourras le rajouter.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => { setEdit(null); saveList(list.filter((d) => d.key !== key), 'Dhikr retiré'); } },
    ]);
  const available = data.catalog.filter((c) => !list.some((d) => d.key === c.key));

  return (
    <Screen back title="Dhikr" onRefresh={reload} right={<Pressable onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel="Réglages du dhikr" hitSlop={8} style={s.round}><Icon name="settings" size={20} color={colors.bordeaux} /></Pressable>}>
      <OfflineBanner visible={offline} />
      <View style={s.hero}>
        <Row justify="space-between" align="flex-start">
          <Text style={s.heroLabel}>AUJOURD’HUI</Text>
          {data.streak ? (
            <View style={s.streak}>
              <Icon name="sparkle" size={13} color={colors.white} />
              <Text style={s.streakText}>{plural(data.streak, 'jour')} d’affilée</Text>
            </View>
          ) : null}
        </Row>
        <Row gap={8} align="flex-end">
          <Text style={s.heroTotal}>{total}</Text>
          <Text style={s.heroUnit}>dhikr</Text>
        </Row>
        <Text style={s.heroSub}>{reachedCount} objectif{reachedCount > 1 ? 's' : ''} atteint{reachedCount > 1 ? 's' : ''} sur {list.length}</Text>
        <WeekBars week={data.week.map((w) => (w.day === data.day ? { ...w, total } : w))} />
        <Text style={s.heroSub}>Cette semaine : {data.weekTotal - (data.total || 0) + total} dhikr</Text>
        {data.inPeriod ? <Text style={s.heroNote}>Pendant tes règles, ta série n’est jamais cassée : le dhikr reste recommandé, rien n’est imposé.</Text> : null}
      </View>

      <View style={s.tasbih}>
        <Row gap={12} align="flex-start">
          <View style={s.tasbihIcon}>
            <Icon name="beads" size={22} color={colors.bordeaux} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.tasbihTitle}>Tasbih après la prière</Text>
            <T variant="small">33 SubhanAllah · 33 Alhamdulillah · 33 Allahu akbar, puis la tahlila pour faire 100</T>
          </View>
        </Row>
        <Button title="Commencer" onPress={() => router.push('/dhikr/compteur?mode=tasbih')} />
      </View>

      <Row justify="space-between" style={{ marginTop: 22, marginBottom: 10 }}>
        <Text style={s.section}>Mes dhikr du jour</Text>
        {available.length ? (
          <Pressable onPress={() => setAdding(true)} accessibilityRole="button" hitSlop={8}>
            <Text style={s.link}>+ Ajouter</Text>
          </Pressable>
        ) : null}
      </Row>
      <View style={{ gap: 10 }}>
        {list.map((d) => (
          <DhikrRow key={d.key} d={d} count={d.count} onPress={() => router.push(`/dhikr/compteur?key=${d.key}`)} onLongPress={() => setEdit({ key: d.key, goal: d.goal, name: d.name, free: !data.goalChoices.includes(d.goal) })} />
        ))}
      </View>
      <T variant="small" style={{ marginTop: 12 }}>
        Objectifs proposés : 33 · 99 · 100 · ou un nombre libre (appui long sur un dhikr). Les dhikr se remettent à zéro chaque jour après Fajr.
      </T>
      <T variant="small" style={{ marginTop: 6 }}>Textes arabes, phonétique et sens validés par le comité religieux de Nissali.</T>

      <Sheet visible={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.name || ''} footer={<Button title="Enregistrer l’objectif" disabled={!edit?.goal} onPress={() => { const next = list.map((d) => (d.key === edit.key ? { ...d, goal: edit.goal } : d)); setEdit(null); saveList(next, 'Objectif enregistré'); }} />}>
        <Label>Objectif</Label>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {data.goalChoices.map((g) => (
            <Chip key={g} label={String(g)} selected={!edit?.free && edit?.goal === g} onPress={() => setEdit((e) => ({ ...e, goal: g, free: false }))} />
          ))}
          <Chip label="Libre" selected={Boolean(edit?.free)} onPress={() => setEdit((e) => ({ ...e, free: true }))} />
        </Row>
        {edit?.free ? <Field label="Nombre libre" keyboardType="number-pad" value={edit.goal ? String(edit.goal) : ''} onChangeText={(v) => setEdit((e) => ({ ...e, goal: Math.min(10000, Number(v.replace(/\D/g, '')) || 0) }))} /> : null}
        {list.length > 1 ? <Button title="Retirer ce dhikr" variant="ghost" onPress={() => remove(edit.key)} /> : null}
      </Sheet>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Ajouter un dhikr">
        <T variant="small">Liste validée par le comité religieux.</T>
        {available.map((c) => (
          <Pressable key={c.key} onPress={() => { setAdding(false); saveList([...list, { key: c.key, goal: c.goal }], `${c.name} ajouté`); }} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.rowName} numberOfLines={2}>{c.name}</Text>
              <Text style={s.rowMeta} numberOfLines={3}>{c.meaning} · objectif {c.goal}</Text>
            </View>
            <Icon name="plus" size={20} color={colors.bordeaux} />
          </Pressable>
        ))}
      </Sheet>

      <Sheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} title="Réglages du dhikr">
        <Toggle label="Vibration au comptage" hint="Une petite vibration à chaque dhikr, plus longue à l’objectif" value={settings.haptics !== false} onChange={(v) => saveSettings({ haptics: v })} />
        <Toggle label="Rappel de dhikr chaque jour" hint={settings.reminder ? `Chaque jour à ${settings.reminderTime || '20:30'} (« Petit rappel du jour »)` : 'Facultatif, à l’heure de ton choix'} value={Boolean(settings.reminder)} onChange={(v) => saveSettings({ reminder: v }, v ? 'Rappel de dhikr activé' : 'Rappel de dhikr désactivé')} />
        {settings.reminder ? <TimeField label="Heure du rappel" value={settings.reminderTime || '20:30'} allowUnknown={false} onChange={(t) => t && saveSettings({ reminderTime: t }, `Rappel à ${t}`)} /> : null}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.bordeaux, borderRadius: 26, padding: 20, gap: 6 },
  heroLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, color: colors.rose },
  heroTotal: { fontFamily: fonts.title, fontSize: 52, lineHeight: 58, color: colors.white },
  heroUnit: { fontFamily: fonts.medium, fontSize: 16, color: colors.rose, marginBottom: 10 },
  heroSub: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.rose },
  heroNote: { fontFamily: fonts.body, fontSize: 12.5, color: colors.rose, marginTop: 4 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  streakText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  week: { flexDirection: 'row', gap: 10, height: 72, marginVertical: 8 },
  weekCol: { flex: 1, alignItems: 'center', gap: 4 },
  weekTrack: { flex: 1, width: 16, justifyContent: 'flex-end', alignItems: 'center' },
  weekBar: { width: 16, borderRadius: 6, backgroundColor: colors.rose },
  weekDash: { width: 12, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  weekLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.rose },
  tasbih: { backgroundColor: colors.blush, borderRadius: 24, padding: 16, gap: 14, marginTop: 14, borderWidth: 1, borderColor: '#F0D5DA' },
  tasbihIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  tasbihTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.prune, marginBottom: 2 },
  section: { fontFamily: fonts.title, fontSize: 19, color: colors.prune },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 12, paddingRight: 14, borderWidth: 1, borderColor: colors.line },
  ringText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.bordeaux },
  rowName: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  rowMeta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  arabic: { fontSize: 19, color: colors.bordeaux, maxWidth: '38%', writingDirection: 'rtl', fontFamily: fonts.arabic },
});

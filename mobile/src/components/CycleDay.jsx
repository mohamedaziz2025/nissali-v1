// 11 — Journal d'une journée (humeur, symptômes, note) et détail d'une date du calendrier.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { dayMonth, shortDate } from '../lib/format';
import { colors, fonts, MOODS, SYMPTOMS } from '../theme';
import Icon from './Icon';
import { Button, Chips, Label, Sheet, T, useToast } from './ui';
import { kg } from './Weight';

/** Journal du jour : humeur, symptômes et note (Ajouter une note). */
export function JournalSheet({ visible, day, focus, onClose, onSaved }) {
  const toast = useToast();
  const [log, setLog] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible || !day) return;
    setLog(null);
    api
      .get(`/health-log/day/${day}`)
      .then((l) => setLog({ mood: l.mood || null, symptoms: l.symptoms || [], notes: l.notes || '' }))
      .catch((e) => toast(e.message, 'error'));
  }, [visible, day, toast]);
  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/health-log/day/${day}`, { mood: log.mood, symptoms: log.symptoms, notes: log.notes.trim() || null });
      toast('Journal enregistré');
      onSaved?.(log);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={`Mon journal · ${day ? dayMonth(day) : ''}`} footer={<Button title="Enregistrer" onPress={save} loading={busy} disabled={!log || busy} />}>
      {!log ? (
        <ActivityIndicator color={colors.bordeaux} style={{ marginVertical: 20 }} />
      ) : (
        <>
          {focus !== 'note' ? (
            <>
              <Label>Humeur</Label>
              <Chips items={MOODS} value={log.mood} onChange={(v) => setLog((l) => ({ ...l, mood: l.mood === v ? null : v }))} />
              <Label>Symptômes</Label>
              <Chips items={Object.entries(SYMPTOMS).map(([key, label]) => ({ key, label }))} value={log.symptoms} onChange={(v) => setLog((l) => ({ ...l, symptoms: v }))} multi />
            </>
          ) : null}
          <Label>Note</Label>
          <TextInput
            value={log.notes}
            onChangeText={(v) => setLog((l) => ({ ...l, notes: v }))}
            placeholder="Ce que tu veux retenir de ta journée…"
            placeholderTextColor="#A88C93"
            multiline
            maxLength={1000}
            autoFocus={focus === 'note'}
            accessibilityLabel="Note du jour"
            style={s.note}
          />
        </>
      )}
    </Sheet>
  );
}

/** Statut d'une date : observé ou estimé (les prévisions restent indiquées comme estimatives). */
export function dayStatus(info) {
  if (!info) return 'Aucun évènement';
  return (
    [
      info.period === 'reelle' && 'Règles notées',
      info.period === 'nifas' && 'Nifas',
      info.period === 'prevue' && 'Règles prévues (estimation)',
      info.ovulation && 'Ovulation (estimation)',
      info.fertile && !info.ovulation && 'Fenêtre fertile (estimation)',
    ]
      .filter(Boolean)
      .join(' · ') || 'Aucun évènement'
  );
}

/** Jour du cycle d'une date : depuis le début des dernières règles notées avant elle. */
export function cycleDayOf(day, periods = []) {
  const start = periods.map((p) => p.start).filter((s) => s <= day).sort().pop();
  if (!start) return null;
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1;
}

/** Détail d'une journée (bas de « Mon calendrier ») : journal, flux, poids, historique. */
export function DayPanel({ day, info, periods, weight, today, onJournal, onFlow, onWeight, onHistory }) {
  const n = cycleDayOf(day, periods);
  const past = day <= today;
  const inPeriod = info?.period === 'reelle' || info?.period === 'nifas';
  return (
    <View style={s.panel}>
      <View style={s.grabber} />
      <Text style={s.panelTitle}>
        {dayMonth(day)}
        {n ? ` · Jour ${n}` : ''}
      </Text>
      <T variant="small">{dayStatus(info)}</T>
      {past ? (
        <>
          <Text style={s.panelSub}>Mon journal du jour</Text>
          <View style={s.chipsRow}>
            <Pressable onPress={() => onJournal('humeur')} accessibilityRole="button" style={s.chip}>
              <Icon name="sparkle" size={15} color={colors.bordeaux} />
              <Text style={s.chipText}>Humeur</Text>
            </Pressable>
            <Pressable onPress={() => onJournal('symptomes')} accessibilityRole="button" style={s.chip}>
              <Icon name="drop" size={15} color={colors.bordeaux} />
              <Text style={s.chipText}>Symptômes</Text>
            </Pressable>
            <Pressable onPress={() => onJournal('note')} accessibilityRole="button" style={s.chip}>
              <Icon name="plus" size={15} color={colors.bordeaux} />
              <Text style={s.chipText}>Ajouter</Text>
            </Pressable>
          </View>
          {inPeriod ? (
            <Pressable onPress={onFlow} accessibilityRole="button" style={s.row}>
              <Icon name="drop" size={18} color={colors.bordeaux} />
              <Text style={s.rowText}>Flux du jour</Text>
              <Text style={s.rowValue}>{info?.flow && info.flow !== 'traces' ? { leger: 'Léger', moyen: 'Moyen', abondant: 'Abondant' }[info.flow] : 'À noter'}</Text>
              <Icon name="chevronRight" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
          <Pressable onPress={onWeight} accessibilityRole="button" style={s.row}>
            <Icon name="scale" size={18} color={colors.bordeaux} />
            <Text style={s.rowText}>Poids</Text>
            <Text style={s.rowValue}>{weight != null ? `${kg(weight)} kg` : 'Ajouter'}</Text>
            <Icon name="edit" size={14} color={colors.bordeaux} />
            <Icon name="chevronRight" size={16} color={colors.muted} />
          </Pressable>
        </>
      ) : (
        <T variant="muted" style={{ marginTop: 8 }}>Journée à venir : les prévisions sont indicatives.</T>
      )}
      {/* 5.2 bis — notes de ce jour (affichées dans le calendrier) et ajout d'une note à cette date */}
      {(info?.notes || []).map((n) => (
        <Pressable key={`${n.id}-${day}`} onPress={() => router.push(`/notes/nouvelle?id=${n.id}`)} accessibilityRole="button" style={s.row}>
          <Icon name="note" size={18} color={colors.or} />
          <Text style={s.rowText} numberOfLines={1}>{n.text}</Text>
          {n.time ? <Text style={s.rowValue}>{n.time}</Text> : null}
          <Icon name="chevronRight" size={16} color={colors.muted} />
        </Pressable>
      ))}
      <Pressable onPress={() => router.push(`/notes/nouvelle?day=${day}`)} accessibilityRole="button" style={s.row}>
        <Icon name="note" size={18} color={colors.bordeaux} />
        <Text style={s.rowText}>Ajouter une note ce jour</Text>
        <Icon name="plus" size={16} color={colors.bordeaux} />
      </Pressable>
      <Pressable onPress={onHistory} accessibilityRole="button" style={[s.row, { borderBottomWidth: 0 }]}>
        <Icon name="chart" size={18} color={colors.bordeaux} />
        <Text style={s.rowText}>Historique de mes cycles</Text>
        <Icon name="chevronRight" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}

/** Historique des cycles (durées, règles). */
export function HistorySheet({ visible, onClose, history = [], averages }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Historique de mes cycles">
      {averages ? (
        <View style={s.avg}>
          <View style={{ flex: 1 }}>
            <Text style={s.avgValue}>{averages.cycleLength} j</Text>
            <T variant="small">cycle moyen</T>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.avgValue}>{averages.periodLength} j</Text>
            <T variant="small">règles</T>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.avgValue}>{averages.spread != null ? `± ${averages.spread}` : '—'}</Text>
            <T variant="small">{averages.irregular ? 'irrégulier' : 'régularité'}</T>
          </View>
        </View>
      ) : null}
      {history.length ? (
        history.slice(0, 24).map((c) => (
          <View key={c.start} style={s.histRow}>
            <T style={{ flex: 1 }}>
              {shortDate(c.start)} → {shortDate(c.end)}
            </T>
            <T variant="bold">{c.length} j</T>
            <T variant="small">{c.periodLength ? `règles ${c.periodLength} j` : ''}{c.excluded ? ' · écarté' : ''}</T>
          </View>
        ))
      ) : (
        <T variant="muted">Ton historique apparaîtra après ton premier cycle complet.</T>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  note: { minHeight: 110, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, padding: 14, fontFamily: fonts.body, fontSize: 15.5, color: colors.prune, textAlignVertical: 'top' },
  panel: { backgroundColor: colors.white, borderRadius: 26, padding: 18, gap: 6, borderWidth: 1, borderColor: colors.line },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 6 },
  panelTitle: { fontFamily: fonts.title, fontSize: 22, color: colors.prune },
  panelSub: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.prune, marginTop: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 14, minHeight: 38 },
  chipText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.prune },
  rowValue: { fontFamily: fonts.bold, fontSize: 15, color: colors.prune },
  avg: { flexDirection: 'row', backgroundColor: colors.blush, borderRadius: 18, padding: 14 },
  avgValue: { fontFamily: fonts.title, fontSize: 22, color: colors.prune },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, borderBottomWidth: 1, borderBottomColor: colors.line },
});

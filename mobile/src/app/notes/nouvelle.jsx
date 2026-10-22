// 5.2 bis · 7 — Nouvelle note (depuis l'accueil) : n'importe quelle date, type, heure facultative,
// répétition (une fois, chaque jour, chaque semaine sur des jours choisis, chaque mois) avec date de fin,
// affichage dans le calendrier, rappel. ?id= : modification d'une note existante.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { DatePickerSheet } from '../../components/Calendar';
import { TimeField } from '../../components/forms';
import Icon from '../../components/Icon';
import { NOTE_REPEATS, NOTE_TYPES, NOTE_WEEKDAYS, noteDate, NoteRow } from '../../components/Notes';
import { Button, Chip, Loader, Sheet, Screen, T, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { addDays, parseDay, today as serverToday } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

import { tr } from '../../lib/i18n';
const EMPTY = { text: '', type: 'medicament', day: null, time: null, repeat: 'once', weekdays: [], until: null, showInCalendar: true, remind: false };

function Line({ icon, label, value, onPress, last }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} : ${value}`} style={[s.line, !last && s.lineBorder]}>
      <Icon name={icon} size={18} color={colors.muted} />
      <Text style={s.lineLabel}>{label}</Text>
      <View style={s.value}>
        <Text style={s.valueText}>{value}</Text>
      </View>
    </Pressable>
  );
}

function SwitchLine({ icon, label, value, onChange, last }) {
  return (
    <View style={[s.line, !last && s.lineBorder]}>
      <Icon name={icon} size={18} color={colors.muted} />
      <Text style={s.lineLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.bordeaux, false: colors.line }} thumbColor={colors.white} accessibilityLabel={label} />
    </View>
  );
}

export default function NewNote() {
  const { id, day: dayParam, type: typeParam } = useLocalSearchParams();
  const toast = useToast();
  const today = serverToday();
  const list = useApi('/notes');
  const existing = useApi(id ? `/notes/${id}` : null);
  const [form, setForm] = useState({ ...EMPTY, day: dayParam || today, ...(NOTE_TYPES.some((t) => t.key === typeParam) ? { type: typeParam } : {}) });
  const [loaded, setLoaded] = useState(!id);
  const [picker, setPicker] = useState(null); // 'day' | 'until' | 'time'
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (id && existing.data && !loaded) {
      const n = existing.data;
      setForm({ text: n.text, type: n.type, day: n.day, time: n.time, repeat: n.repeat, weekdays: n.weekdays || [], until: n.until, showInCalendar: n.showInCalendar, remind: n.remind });
      setLoaded(true);
    }
  }, [id, existing.data, loaded]);

  if (!loaded) return <Screen back title={tr("Modifier la note")}><Loader /></Screen>;

  const weekdays = form.repeat === 'weekly' && !form.weekdays.length ? [parseDay(form.day).getUTCDay()] : form.weekdays;
  const toggleDay = (v) => {
    const next = weekdays.includes(v) ? weekdays.filter((x) => x !== v) : [...weekdays, v];
    if (next.length) set({ weekdays: next });
  };
  const repeatText =
    form.repeat === 'weekly'
      ? `chaque ${NOTE_WEEKDAYS.filter((d) => weekdays.includes(d.v)).map((d) => d.name).join(', ')}`
      : form.repeat === 'daily'
        ? tr("chaque jour")
        : form.repeat === 'monthly'
          ? tr("chaque mois, le {0}", [parseDay(form.day).getUTCDate()])
          : noteDate(form.day).toLowerCase();

  const save = async () => {
    if (!form.text.trim()) return toast(tr("Écris ta note"), 'error');
    if (form.remind && !form.time) return toast(tr("Choisis une heure pour le rappel"), 'error');
    setBusy(true);
    try {
      const body = { ...form, text: form.text.trim(), weekdays: form.repeat === 'weekly' ? weekdays : [], until: form.repeat === 'once' ? null : form.until };
      if (id) await api.patch(`/notes/${id}`, body);
      else await api.post('/notes', body);
      toast(id ? tr("Note modifiée") : tr("Note enregistrée"));
      router.back();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const upcoming = (list.data?.upcoming || []).filter((n) => !n.paused).slice(0, 5);

  return (
    <Screen back title={id ? tr("Modifier la note") : tr("Nouvelle note")}>
      <TextInput
        value={form.text}
        onChangeText={(text) => set({ text })}
        placeholder={tr("Prendre mon comprimé de fer")}
        placeholderTextColor="#A88C93"
        multiline
        maxLength={300}
        style={s.input}
        accessibilityLabel={tr("Texte de la note")}
        autoFocus={!id}
      />
      <View style={s.chips}>
        {NOTE_TYPES.map((t) => (
          <Chip key={t.key} label={t.label} selected={form.type === t.key} onPress={() => set({ type: t.key })} />
        ))}
      </View>

      <View style={s.card}>
        <Line icon="calendar" label={tr("Date")} value={noteDate(form.day)} onPress={() => setPicker('day')} />
        <Line icon="clock" label={tr("Heure")} value={form.time || 'Aucune'} onPress={() => setPicker('time')} />
        <View style={{ paddingVertical: 12, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="repeat" size={18} color={colors.muted} />
            <Text style={s.lineLabel}>{tr("Répétition")}</Text>
          </View>
          <View style={s.chips}>
            {NOTE_REPEATS.map((r) => (
              <Chip key={r.key} label={r.label} selected={form.repeat === r.key} onPress={() => set({ repeat: r.key })} />
            ))}
          </View>
          {form.repeat === 'weekly' ? (
            <View style={s.days} accessibilityRole="radiogroup">
              {NOTE_WEEKDAYS.map((d) => {
                const on = weekdays.includes(d.v);
                return (
                  <Pressable key={d.v} onPress={() => toggleDay(d.v)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={d.name} style={[s.day, on && s.dayOn]}>
                    <Text style={[s.dayText, on && { color: colors.white }]}>{d.l}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {form.repeat !== 'once' ? (
            <Pressable onPress={() => setPicker('until')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[s.lineLabel, { marginLeft: 0 }]}>{tr("Jusqu’au")}</Text>
              <View style={s.value}>
                <Text style={s.valueText}>{form.until ? noteDate(form.until) : tr("Sans fin")}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={s.card}>
        <SwitchLine icon="calendar" label={tr("Afficher dans le calendrier")} value={form.showInCalendar} onChange={(v) => set({ showInCalendar: v })} />
        <SwitchLine icon="bell" label={tr("Me rappeler (notification)")} value={form.remind} onChange={(v) => set({ remind: v, time: v && !form.time ? '08:00' : form.time })} last />
        {form.remind ? <T variant="small" style={{ paddingBottom: 12 }}>{tr("Rappel à")} {form.time}, {repeatText}.</T> : null}
      </View>

      <Button title={id ? tr("Enregistrer les modifications") : tr("Enregistrer la note")} icon="check" onPress={save} loading={busy} disabled={busy || !form.text.trim()} />

      {!id && upcoming.length ? (
        <View style={[s.card, { marginTop: 18, paddingTop: 12 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.section}>{tr("Mes notes à venir")}</Text>
            <Pressable onPress={() => router.replace('/notes')} accessibilityRole="link" hitSlop={8}>
              <Text style={s.link}>{tr("Tout voir")}</Text>
            </Pressable>
          </View>
          {upcoming.map((n, i) => (
            <NoteRow key={`${n.noteId}-${n.day}`} n={n} last={i === upcoming.length - 1} onPress={() => router.replace(`/notes/nouvelle?id=${n.noteId}`)} />
          ))}
        </View>
      ) : null}

      {picker === 'day' || picker === 'until' ? (
        <DatePickerSheet
          visible
          onClose={() => setPicker(null)}
          onPick={(d) => {
            if (picker === 'day') set({ day: d, until: form.until && form.until < d ? null : form.until });
            else set({ until: d });
            setPicker(null);
          }}
          value={picker === 'day' ? form.day : form.until || addDays(form.day, 30)}
          minDay={picker === 'until' ? form.day : addDays(today, -365 * 2)}
          maxDay={addDays(today, 365 * 3)}
          title={picker === 'day' ? tr("Date de la note") : tr("Jusqu’au")}
        />
      ) : null}
      <Sheet visible={picker === 'time'} onClose={() => setPicker(null)} title={tr("Heure")} footer={<Button title={tr("Valider")} onPress={() => setPicker(null)} />}>
        <TimeField label={tr("Heure (facultative)")} value={form.time} onChange={(t) => set({ time: t, remind: t ? form.remind : false })} allowUnknown />
        <T variant="small">{tr("« Je ne sais pas » : la note n’a pas d’heure (pas de rappel).")}</T>
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  input: { minHeight: 64, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontFamily: fonts.body, fontSize: 16, color: colors.prune, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  card: { backgroundColor: colors.white, borderRadius: 22, paddingHorizontal: 16, marginTop: 14, borderWidth: 1, borderColor: colors.line },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 },
  lineBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  lineLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.prune },
  value: { backgroundColor: colors.blush, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  valueText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.bordeaux },
  dayText: { fontFamily: fonts.bold, fontSize: 14, color: colors.prune },
  section: { fontFamily: fonts.title, fontSize: 18, color: colors.prune },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.bordeaux },
});

// 5.2 bis — Mes notes à venir : chaque note peut être modifiée, mise en pause ou supprimée
// (une occurrence ou toute la série). RG-35 : notes chiffrées, jamais visibles par une praticienne.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { noteDate, NoteRow } from '../../components/Notes';
import { Button, ErrorState, Loader, OfflineBanner, Screen, Sheet, T, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { colors, fonts } from '../../theme';

import { tr } from '../../lib/i18n';
export default function Notes() {
  const toast = useToast();
  const { data, error, loading, offline, reload } = useApi('/notes');
  const [open, setOpen] = useState(null); // occurrence choisie

  if (loading && !data) return <Screen back title={tr("Mes notes")}><Loader /></Screen>;
  if (error && !data) return <Screen back title={tr("Mes notes")}><ErrorState error={error} onRetry={reload} /></Screen>;

  const run = async (fn, message) => {
    setOpen(null);
    try {
      await fn();
      toast(message);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const confirmDelete = (n, one) =>
    Alert.alert(one ? tr("Supprimer cette fois ?") : tr("Supprimer la note ?"), one ? tr("Seule l’occurrence du {0} est supprimée.", [noteDate(n.day)]) : n.repeat === 'once' ? tr("La note est supprimée.") : tr("Toute la série est supprimée."), [
      { text: tr("Annuler"), style: 'cancel' },
      { text: tr("Supprimer"), style: 'destructive', onPress: () => run(() => api.delete(`/notes/${n.noteId}${one ? `?day=${n.day}` : ''}`), one ? tr("Occurrence supprimée") : tr("Note supprimée")) },
    ]);

  const upcoming = data.upcoming || [];
  const active = new Set(upcoming.map((n) => n.noteId));
  const past = (data.notes || []).filter((n) => !active.has(n.id));

  return (
    <Screen back title={tr("Mes notes")} onRefresh={reload} footer={<View style={{ padding: 20 }}><Button title={tr("Ajouter une note")} icon="plus" onPress={() => router.push('/notes/nouvelle')} /></View>}>
      <OfflineBanner visible={offline} />
      <T variant="muted">{tr("Tes notes sont chiffrées sur ton compte : jamais visibles par une praticienne, jamais utilisées pour la publicité.")}</T>
      <Text style={s.section}>{tr("À venir")}</Text>
      <View style={s.card}>
        {upcoming.length ? (
          upcoming.slice(0, 60).map((n, i) => <NoteRow key={`${n.noteId}-${n.day}`} n={n} last={i === Math.min(upcoming.length, 60) - 1} onPress={() => setOpen(n)} />)
        ) : (
          <T variant="muted" style={{ paddingVertical: 14 }}>{tr("Aucune note à venir.")}</T>
        )}
      </View>
      {past.length ? (
        <>
          <Text style={s.section}>{tr("Passées ou terminées")}</Text>
          <View style={s.card}>
            {past.slice(0, 40).map((n, i) => (
              <NoteRow key={n.id} n={{ ...n, noteId: n.id }} last={i === Math.min(past.length, 40) - 1} onPress={() => setOpen({ ...n, noteId: n.id })} />
            ))}
          </View>
        </>
      ) : null}

      <Sheet visible={Boolean(open)} onClose={() => setOpen(null)} title={open?.text || ''}>
        {open ? (
          <>
            <T variant="muted">
              {noteDate(open.day)}
              {open.time ? ` · ${open.time}` : ''} · {open.repeatLabel}
              {open.remind ? tr(" · rappel activé") : ''}
            </T>
            <Button title={tr("Modifier")} variant="soft" icon="edit" onPress={() => { setOpen(null); router.push(`/notes/nouvelle?id=${open.noteId}`); }} />
            <Button title={open.paused ? tr("Reprendre") : tr("Mettre en pause")} variant="outline" onPress={() => run(() => api.patch(`/notes/${open.noteId}`, { paused: !open.paused }), open.paused ? tr("Note reprise") : tr("Note en pause"))} />
            {open.repeat !== 'once' ? <Button title={tr("Supprimer cette fois")} variant="ghost" onPress={() => confirmDelete(open, true)} /> : null}
            <Button title={open.repeat !== 'once' ? tr("Supprimer toute la série") : tr("Supprimer la note")} variant="danger" onPress={() => confirmDelete(open, false)} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  section: { fontFamily: fonts.title, fontSize: 19, color: colors.prune, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: colors.white, borderRadius: 22, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line },
});

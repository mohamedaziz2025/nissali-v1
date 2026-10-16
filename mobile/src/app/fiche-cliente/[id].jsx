// Fiche cliente (espace pro mobile) : indicateurs, informations, suivi, notes de séance,
// historique et documents privés (ouverts via un lien temporaire).
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { DateField } from '../../components/forms';

import { Button, Card, Chips, ErrorState, Field, Gap, Label, ListItem, Loader, Row, Screen, Segmented, T, useToast } from '../../components/ui';
import { api, API_URL, request } from '../../lib/api';
import { dayMonth, longDate, price } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { BOOKING_STATUS, colors, fonts } from '../../theme';

const HISTORY_TONE = { rdv: colors.bordeaux, seance: colors.or, note: colors.rose, document: colors.muted, avis: colors.or, message: colors.success, fiche: colors.prune };

const STATUSES = [
  { key: 'nouvelle', label: 'Nouvelle' },
  { key: 'reguliere', label: 'Régulière' },
  { key: 'fidele', label: 'Fidèle' },
  { key: 'inactive', label: 'Inactive' },
];
const REFERRALS = [
  { key: 'annuaire', label: 'Annuaire Nissali' },
  { key: 'bouche_a_oreille', label: 'Bouche-à-oreille' },
  { key: 'reseaux', label: 'Réseaux sociaux' },
  { key: 'medecin', label: 'Médecin' },
  { key: 'autre', label: 'Autre' },
];
const MODES = [
  { key: 'cabinet', label: 'Cabinet' },
  { key: 'visio', label: 'Visio' },
  { key: 'indifferent', label: 'Indifférent' },
];

function Stat({ label, value, hint }) {
  return (
    <Card style={{ flex: 1, padding: 14, gap: 2 }}>
      <T variant="small">{label}</T>
      <T variant="h3">{value}</T>
      {hint ? <T variant="small">{hint}</T> : null}
    </Card>
  );
}

export default function ClientFile() {
  const { id } = useLocalSearchParams();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/pro/clients/${id}`);
  const [tab, setTab] = useState('historique');
  const [info, setInfo] = useState(null);
  const [tags, setTags] = useState('');
  const [note, setNote] = useState({ kind: 'seance', title: '', content: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setInfo({ profile: { ...(data.profile || {}) }, care: { ...(data.care || {}) } });
    setTags((data.tags || []).join(', '));
  }, [data]);

  if (loading && !data) return <Screen back><Loader /></Screen>;
  if (error && !data) return <Screen back><ErrorState error={error} onRetry={reload} /></Screen>;
  if (!info) return null;

  const c = data.client;
  const st = data.stats;
  const run = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      if (message) toast(message);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const setP = (group, key) => (v) => setInfo((x) => ({ ...x, [group]: { ...x[group], [key]: v } }));
  const openFile = (f) =>
    run(async () => {
      const { token } = await api.get(`/pro/clients/${id}/files/${f.id}/link`);
      await WebBrowser.openBrowserAsync(`${API_URL}/files/${token}`);
    });
  const addFile = () =>
    run(async () => {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (r.canceled) return;
      const a = r.assets[0];
      const form = new FormData();
      form.append('file', { uri: a.uri, name: a.name || 'document', type: a.mimeType || 'application/octet-stream' });
      await request('POST', `/pro/clients/${id}/files`, form, { timeout: 60000 });
      toast('Document ajouté');
    });

  return (
    <Screen back>
      <Row gap={14}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{c.firstName?.[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <T variant="h2">{c.firstName}</T>
          <T variant="small">{[c.city, data.consent?.given ? 'consentement recueilli' : null].filter(Boolean).join(' · ')}</T>
        </View>
      </Row>
      <Gap h={12} />
      <Row gap={10} style={{ flexWrap: 'wrap' }}>
        <Button title="Message" icon="mail" small onPress={() => run(async () => { const conv = await api.post('/messages/conversations', { clientId: id, as: 'pro' }); router.push(`/messages/${conv.id}?as=pro`); })} />
        {c.phone ? <Button title="Appeler" icon="phone" small variant="soft" onPress={() => Linking.openURL(`tel:${c.phone}`)} /> : null}
        {c.email ? <Button title="E-mail" icon="mail" small variant="soft" onPress={() => Linking.openURL(`mailto:${c.email}`)} /> : null}
      </Row>
      <Gap />
      <Row gap={10}>
        <Stat label="Séances" value={st.visits} hint={st.firstVisit ? `depuis le ${dayMonth(st.firstVisit)}` : null} />
        <Stat label="Rendez-vous" value={data.bookings.length} hint={`${data.bookings.filter((b) => ['en_attente', 'confirmee'].includes(b.status)).length} à venir`} />
      </Row>
      <Gap h={10} />
      <Row gap={10}>
        <Stat label="Prochain RDV" value={st.nextBooking ? dayMonth(st.nextBooking.day) : '—'} hint={st.nextBooking?.time} />
        <Stat label="Fréquence" value={st.averageGapDays ? `${st.averageGapDays} j` : '—'} hint={`${st.noShows} abs. · ${st.cancellations} annul.`} />
      </Row>
      <Gap />
      <Chips items={STATUSES} value={data.status} onChange={(v) => run(() => api.patch(`/pro/clients/${id}`, { status: v }), 'Statut mis à jour')} scroll />
      <Gap />
      <Segmented
        items={[
          { key: 'historique', label: 'Historique' },
          { key: 'notes', label: 'Notes' },
          { key: 'infos', label: 'Infos' },
          { key: 'suivi', label: 'Suivi' },
          { key: 'histo', label: 'RDV' },
          { key: 'docs', label: 'Docs' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Gap />

      {tab === 'notes' ? (
        <View style={{ gap: 12 }}>
          <Card style={{ gap: 10 }}>
            <Chips items={[{ key: 'seance', label: 'Compte rendu de séance' }, { key: 'note', label: 'Note' }]} value={note.kind} onChange={(v) => setNote((n) => ({ ...n, kind: v }))} />
            <Field value={note.title} onChangeText={(v) => setNote((n) => ({ ...n, title: v }))} placeholder="Titre (facultatif)" />
            <Field value={note.content} onChangeText={(v) => setNote((n) => ({ ...n, content: v }))} placeholder="Déroulé, observations, suite à donner…" multiline inputStyle={{ minHeight: 90, textAlignVertical: 'top' }} />
            <Button
              title="Ajouter"
              small
              loading={busy}
              disabled={!note.content.trim()}
              onPress={() =>
                run(async () => {
                  await api.post(`/pro/clients/${id}/notes`, { kind: note.kind, title: note.title || undefined, content: note.content });
                  setNote({ kind: 'seance', title: '', content: '' });
                }, 'Note ajoutée')
              }
            />
          </Card>
          {data.notes.map((n) => (
            <Card key={n._id} tone={n.kind === 'seance' ? 'soft' : 'white'} style={{ gap: 6 }}>
              <Row justify="space-between">
                <Label color={n.kind === 'seance' ? colors.bordeaux : colors.or}>{n.kind === 'seance' ? 'Séance' : 'Note'}</Label>
                <T variant="small">{new Date(n.at).toLocaleDateString('fr-FR')}</T>
              </Row>
              {n.title ? <T variant="bold">{n.title}</T> : null}
              <T>{n.content}</T>
              <Pressable onPress={() => Alert.alert('Supprimer cette note ?', '', [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => run(() => api.delete(`/pro/clients/${id}/notes/${n._id}`)) }])} style={{ alignSelf: 'flex-end' }} hitSlop={10}>
                <T variant="small" color={colors.danger}>Supprimer</T>
              </Pressable>
            </Card>
          ))}
        </View>
      ) : null}

      {tab === 'infos' ? (
        <Card style={{ gap: 12 }}>
          <DateField label="Date de naissance" value={info.profile.birthDate || null} onChange={setP('profile', 'birthDate')} allowClear />
          <Field label="Adresse" value={info.profile.address || ''} onChangeText={setP('profile', 'address')} />
          <Field label="Profession" value={info.profile.occupation || ''} onChangeText={setP('profile', 'occupation')} />
          <Field label="Contact d’urgence" value={info.profile.emergencyContact || ''} onChangeText={setP('profile', 'emergencyContact')} placeholder="Nom, lien, téléphone" />
          <T variant="fieldLabel">Comment elle t’a connue</T>
          <Chips items={REFERRALS} value={info.profile.referral} onChange={setP('profile', 'referral')} />
          <T variant="fieldLabel">Préférence</T>
          <Chips items={MODES} value={info.profile.preferredMode} onChange={setP('profile', 'preferredMode')} />
          <Field label="Créneaux préférés" value={info.profile.preferredTimes || ''} onChangeText={setP('profile', 'preferredTimes')} />
          <Field label="Étiquettes (séparées par des virgules)" value={tags} onChangeText={setTags} />
          <Button
            title="Enregistrer"
            loading={busy}
            onPress={() => run(() => api.patch(`/pro/clients/${id}`, { profile: info.profile, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) }), 'Informations enregistrées')}
          />
          <Button
            title={data.consent?.given ? 'Consentement recueilli ✓ (retirer)' : 'La cliente consent à la conservation de sa fiche'}
            variant={data.consent?.given ? 'soft' : 'outline'}
            small
            onPress={() => run(() => api.patch(`/pro/clients/${id}`, { consent: !data.consent?.given }), 'Consentement mis à jour')}
          />
        </Card>
      ) : null}

      {tab === 'suivi' ? (
        <Card style={{ gap: 12 }}>
          <T variant="small">Dossier professionnel confidentiel, visible par toi seule.</T>
          <Field label="Motif de consultation" value={info.care.reason || ''} onChangeText={setP('care', 'reason')} multiline />
          <Field label="Antécédents" value={info.care.history || ''} onChangeText={setP('care', 'history')} multiline />
          <Field label="Allergies et contre-indications" value={info.care.allergies || ''} onChangeText={setP('care', 'allergies')} />
          <Field label="Traitements en cours" value={info.care.treatments || ''} onChangeText={setP('care', 'treatments')} />
          <Field label="Objectifs de l’accompagnement" value={info.care.goals || ''} onChangeText={setP('care', 'goals')} multiline />
          <Button title="Enregistrer" loading={busy} onPress={() => run(() => api.patch(`/pro/clients/${id}`, { care: info.care }), 'Suivi enregistré')} />
        </Card>
      ) : null}

      {tab === 'histo' ? (
        <Card style={{ paddingVertical: 6 }}>
          {data.bookings.length ? (
            data.bookings.map((b, i, arr) => (
              <ListItem
                key={b.id}
                title={`${longDate(b.day)} · ${b.time}`}
                subtitle={`${b.serviceName} · ${b.mode === 'visio' ? 'visio' : 'cabinet'}`}
                right={<T variant="small" color={BOOKING_STATUS[b.status]?.color}>{BOOKING_STATUS[b.status]?.label}</T>}
                last={i === arr.length - 1}
              />
            ))
          ) : (
            <T variant="muted" style={{ padding: 12 }}>Aucun rendez-vous.</T>
          )}
        </Card>
      ) : null}

      {tab === 'historique' ? (
        <Card style={{ paddingVertical: 12, gap: 0 }}>
          {(data.history || []).map((h, i, arr) => (
            <View key={`${h.kind}-${h.at}-${i}`} style={s.timelineRow}>
              <View style={{ alignItems: 'center', width: 26 }}>
                <View style={[s.timelineDot, { backgroundColor: HISTORY_TONE[h.kind] || colors.rose }]} />
                {i < arr.length - 1 ? <View style={s.timelineLine} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 16 }}>
                <T variant="small">{new Date(h.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}{h.time ? ` · ${h.time}` : ''}</T>
                <T variant="bold" color={h.kind === 'rdv' ? BOOKING_STATUS[h.status]?.color || colors.prune : colors.prune}>{h.title}</T>
                {h.detail ? <T variant="small" numberOfLines={3}>{h.detail}</T> : null}
                {h.conversationId ? (
                  <Pressable onPress={() => router.push(`/messages/${h.conversationId}?as=pro`)} hitSlop={6}>
                    <T variant="small" color={colors.bordeaux}>Ouvrir la conversation →</T>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          {!data.history?.length ? <T variant="muted" style={{ padding: 12 }}>Aucun historique pour le moment.</T> : null}
        </Card>
      ) : null}

      {tab === 'docs' ? (
        <View style={{ gap: 12 }}>
          <Button title="Ajouter un document" icon="plus" variant="outline" onPress={addFile} loading={busy} />
          <T variant="small">PDF ou image, 10 Mo maximum. Documents privés, visibles par toi seule.</T>
          {data.files.length ? (
            <Card style={{ paddingVertical: 6 }}>
              {data.files.map((f, i, arr) => (
                <ListItem key={f.id} icon="share" title={f.name} subtitle={`${Math.max(1, Math.round(f.size / 1000))} Ko · ${new Date(f.at).toLocaleDateString('fr-FR')}`} onPress={() => openFile(f)} last={i === arr.length - 1} />
              ))}
            </Card>
          ) : (
            <T variant="muted">Aucun document.</T>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  timelineRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 6 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.line, marginTop: 4 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.title, fontSize: 28, color: colors.bordeaux },
});


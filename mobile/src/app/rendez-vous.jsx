// Mes rendez-vous avec les praticiennes : à venir / passés, visio (Jitsi), annulation, avis.
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../components/Icon';
import { euros, PractitionerAvatar } from '../components/Practitioners';
import { Button, Card, ErrorState, Field, Loader, Row, Screen, Segmented, Sheet, T, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { BOOKING_STATUS, colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
const MONTHS = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];
const DAYS = [tr("Dimanche"), tr("Lundi"), tr("Mardi"), tr("Mercredi"), tr("Jeudi"), tr("Vendredi"), tr("Samedi")];

function DateBlock({ day, tone }) {
  const [y, m, d] = day.split('-').map(Number);
  const bg = tone === 'pending' ? colors.or : tone === 'past' ? colors.line : colors.bordeaux;
  const fg = tone === 'past' ? colors.muted : colors.white;
  return (
    <View style={[s.dateBlock, { backgroundColor: bg }]}>
      <Text style={[s.dateMonth, { color: fg }]}>{MONTHS[m - 1]}</Text>
      <Text style={[s.dateDay, { color: fg }]}>{d}</Text>
      <Text style={[s.dateYear, { color: fg }]}>{y}</Text>
    </View>
  );
}

function BookingCard({ b, onCancel, onReview }) {
  const st = BOOKING_STATUS[b.status];
  const past = !['en_attente', 'confirmee'].includes(b.status) || new Date(`${b.day}T${b.endTime}`) < new Date();
  const [y, m, d] = b.day.split('-').map(Number);
  const weekday = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <DateBlock day={b.day} tone={past ? 'past' : b.status === 'en_attente' ? 'pending' : 'ok'} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={s.service} numberOfLines={1}>
              {b.serviceName}
            </Text>
            <View style={[s.pill, { backgroundColor: `${st?.color}1A` }]}>
              <Text style={[s.pillText, { color: st?.color }]}>{st?.label}</Text>
            </View>
          </View>
          <T variant="small">
            {weekday} · {b.time}–{b.endTime}
          </T>
          <Pressable onPress={() => b.practitioner && router.push(`/praticienne/${b.practitioner.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {b.practitioner ? <PractitionerAvatar p={b.practitioner} size={26} /> : null}
            <T variant="medium" style={{ fontSize: 14.5 }}>{b.practitioner?.displayName}</T>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <View style={s.meta}>
              <Icon name={b.mode === 'visio' ? 'video' : 'pin'} size={14} color={colors.muted} />
              <Text style={s.metaText}>{b.mode === 'visio' ? tr("Visio") : b.practitioner?.city || tr("Cabinet")}</Text>
            </View>
            <View style={s.meta}>
              <Text style={s.metaText}>{tr("Tarif indicatif")} {euros(b.price)}</Text>
            </View>
          </View>
        </View>
      </View>
      {b.videoUrl || b.canCancel || b.canReview || past ? (
        <View style={s.actions}>
          {b.videoUrl ? <Button title={tr("Rejoindre")} icon="video" small onPress={() => WebBrowser.openBrowserAsync(b.videoUrl)} style={{ flex: 1 }} /> : null}
          {b.canReview ? <Button title={tr("Laisser un avis")} icon="star" small variant="soft" onPress={() => onReview(b)} style={{ flex: 1 }} /> : null}
          {b.canCancel ? <Button title={tr("Annuler")} small variant="outline" onPress={() => onCancel(b)} style={{ flex: b.videoUrl ? 0.8 : 1 }} /> : null}
          {past && b.practitioner && !b.canReview ? <Button title={tr("Reprendre RDV")} small variant="soft" onPress={() => router.push(`/praticienne/${b.practitioner.id}`)} style={{ flex: 1 }} /> : null}
        </View>
      ) : null}
    </View>
  );
}

export default function MyBookings() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/practitioners/bookings/mine');
  const [tab, setTab] = useState('avenir');
  const [review, setReview] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  if (loading && !data) return <Screen back title={tr("Mes rendez-vous")}><Loader /></Screen>;
  if (error && !data) return <Screen back title={tr("Mes rendez-vous")}><ErrorState error={error} onRetry={reload} /></Screen>;

  const now = new Date();
  const upcoming = data.filter((b) => ['en_attente', 'confirmee'].includes(b.status) && new Date(`${b.day}T${b.endTime}`) >= now).sort((a, b) => (`${a.day}${a.time}` < `${b.day}${b.time}` ? -1 : 1));
  const past = data.filter((b) => !upcoming.includes(b));
  const list = tab === 'avenir' ? upcoming : past;

  const cancel = async (b) => {
    try {
      await api.post(`/practitioners/bookings/${b.id}/cancel`, {});
      toast(tr("Rendez-vous annulé"));
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const sendReview = async () => {
    try {
      await api.post(`/practitioners/bookings/${review.id}/review`, { rating, comment });
      toast(tr("Merci pour ton avis !"));
      setReview(null);
      setComment('');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Screen back title={tr("Mes rendez-vous")} onRefresh={reload}>
      <Segmented
        items={[
          { key: 'avenir', label: tr("À venir ({0})", [upcoming.length]) },
          { key: 'passes', label: tr("Passés ({0})", [past.length]) },
        ]}
        value={tab}
        onChange={setTab}
      />
      <View style={{ height: 16 }} />
      {list.length ? (
        list.map((b) => <BookingCard key={b.id} b={b} onCancel={cancel} onReview={setReview} />)
      ) : (
        <Card tone="soft" style={{ alignItems: 'center', gap: 8, paddingVertical: 30 }}>
          <Icon name="calendar" size={28} color={colors.bordeaux} />
          <T variant="bold">{tab === 'avenir' ? tr("Aucun rendez-vous à venir") : tr("Aucun rendez-vous passé")}</T>
          {tab === 'avenir' ? <Button title={tr("Trouver une praticienne")} small onPress={() => router.push('/praticiennes')} /> : null}
        </Card>
      )}
      <Sheet visible={Boolean(review)} onClose={() => setReview(null)} title={tr("Ton avis")} footer={<Button title={tr("Publier mon avis")} onPress={sendReview} />}>
        <T variant="muted">{review ? `${review.serviceName} avec ${review.practitioner?.displayName}` : ''}</T>
        <Row gap={6} style={{ justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="button" accessibilityLabel={tr("{0} étoile{1}", [n, n > 1 ? 's' : ''])} hitSlop={6}>
              <Icon name="star" size={38} color={colors.or} fill={n <= rating ? colors.or : 'none'} strokeWidth={1.4} />
            </Pressable>
          ))}
        </Row>
        <Field label={tr("Commentaire (facultatif)")} value={comment} onChangeText={setComment} multiline placeholder={tr("Qu’as-tu apprécié ?")} />
      </Sheet>
    </Screen>
  );
}

const shadow = { shadowColor: '#3E1220', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 };

const s = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, marginBottom: 12, ...shadow },
  dateBlock: { width: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  dateMonth: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1 },
  dateDay: { fontFamily: fonts.title, fontSize: 28, lineHeight: 32 },
  dateYear: { fontFamily: fonts.body, fontSize: 11, opacity: 0.85 },
  service: { fontFamily: fonts.bold, fontSize: 16, color: colors.prune, flexShrink: 1 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontFamily: fonts.bold, fontSize: 11.5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
});

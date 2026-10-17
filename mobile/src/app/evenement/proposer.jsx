// 5.11 — « Proposer un événement » : titre, date, lieu, description, image, places, gratuit ou payant, prix.
// La commission de 15 % est indiquée avant envoi (RG-29) ; l'équipe valide avant publication (RG-28).
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { DateField, TimeField } from '../../components/forms';
import { PhotoEditor } from '../../components/EventPhotos';
import Icon from '../../components/Icon';
import { Button, Card, Field, Gap, Label, Loader, Row, Screen, Segmented, Stepper, T, useToast } from '../../components/ui';
import { api, assetUrl, uploadImage } from '../../lib/api';
import { addDays, toDay } from '../../lib/format';
import { colors } from '../../theme';

const COMMISSION = 0.15;

export default function ProposeEvent() {
  const { id } = useLocalSearchParams();
  const toast = useToast();
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: '', description: '', programme: '', day: addDays(toDay(new Date()), 14), time: '14:00', endTime: '', name: '', address: '', city: '', capacity: 20, paid: false, price: '10', ticketUrl: '', imageUrl: null, photos: [] });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!id) return;
    api
      .get(`/events/${id}`)
      .then((e) => setF({ title: e.title, description: e.description, programme: e.programme || '', day: e.day, time: e.time, endTime: e.endTime || '', name: e.location?.name || '', address: e.location?.address || '', city: e.location?.city || '', capacity: e.capacity, paid: !e.free, price: String(e.price || 10), ticketUrl: e.ticketUrl || '', imageUrl: e.imageUrl, photos: e.photos || [] }))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [id, toast]);

  const price = Number(String(f.price).replace(',', '.')) || 0;
  // 17 / 18 — lien de billetterie externe sécurisé (https) : « billetweb.fr/… » est complété, « http:// » est refusé.
  const ticketUrl = /^[a-z]+:\/\//i.test(f.ticketUrl.trim()) ? f.ticketUrl.trim() : f.ticketUrl.trim() ? `https://${f.ticketUrl.trim()}` : '';
  const ticketOk = /^https:\/\/[^\s.]+\.[^\s]{2,}$/i.test(ticketUrl);
  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
    if (r.canceled) return;
    try {
      setBusy(true);
      const { url } = await uploadImage('/events/image', 'image', r.assets[0].uri);
      set('imageUrl')(url);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        title: f.title,
        description: f.description,
        programme: f.programme,
        day: f.day,
        time: f.time,
        ...(f.endTime ? { endTime: f.endTime } : {}),
        location: { name: f.name, address: f.address, city: f.city },
        capacity: f.capacity,
        price: f.paid ? price : 0,
        ...(f.paid ? { ticketUrl } : {}),
        ...(f.imageUrl ? { imageUrl: f.imageUrl } : {}),
        photos: f.photos,
      };
      const e = id ? await api.patch(`/events/${id}`, body) : await api.post('/events', body);
      toast('Merci ! Notre équipe vérifie ton événement avant publication.');
      router.replace(`/evenement/${e.id}`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Screen back title="Proposer un événement"><Loader /></Screen>;
  const valid = f.title.trim().length >= 3 && f.description.trim().length >= 10 && f.city.trim() && f.day && f.time && (!f.paid || (price > 0 && ticketOk));

  return (
    <Screen back title={id ? 'Modifier mon événement' : 'Proposer un événement'}>
      <T variant="muted" style={{ marginTop: -8, marginBottom: 16 }}>Notre équipe vérifie chaque événement avant publication. Tu seras prévenue par notification.</T>
      <Pressable onPress={pickImage} accessibilityRole="button" accessibilityLabel="Ajouter une image" style={s.image} disabled={Platform.OS === 'web'}>
        {f.imageUrl ? <Image source={{ uri: assetUrl(f.imageUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        {!f.imageUrl ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={24} color={colors.bordeaux} />
            <T variant="medium" color={colors.bordeaux}>{Platform.OS === 'web' ? 'Image disponible sur le téléphone' : 'Ajouter une image'}</T>
          </View>
        ) : null}
      </Pressable>
      <Gap />
      <PhotoEditor photos={f.photos} onChange={set('photos')} />
      <Gap />
      <Field label="Titre" value={f.title} onChangeText={set('title')} placeholder="Ex. Brunch entre sœurs" />
      <Gap h={12} />
      <Field label="Description" value={f.description} onChangeText={set('description')} multiline placeholder="Présente ton événement en quelques lignes" />
      <Gap h={12} />
      <Field label="Programme (facultatif)" value={f.programme} onChangeText={set('programme')} multiline placeholder="10 h : accueil…" />
      <Gap h={12} />
      <DateField label="Date" value={f.day} onChange={set('day')} minDay={toDay(new Date())} maxDay={addDays(toDay(new Date()), 365)} />
      <Gap h={12} />
      <Row gap={12} align="flex-start">
        <View style={{ flex: 1 }}>
          <TimeField label="Début" value={f.time} onChange={set('time')} allowUnknown={false} />
        </View>
        <View style={{ flex: 1 }}>
          <TimeField label="Fin (facultatif)" value={f.endTime} onChange={set('endTime')} />
        </View>
      </Row>
      <Gap h={12} />
      <Field label="Lieu" value={f.name} onChangeText={set('name')} placeholder="Nom de la salle, du café…" />
      <Gap h={12} />
      <Field label="Adresse" value={f.address} onChangeText={set('address')} placeholder="Numéro et rue" />
      <Gap h={12} />
      <Field label="Ville" value={f.city} onChangeText={set('city')} placeholder="Ex. Nanterre" icon="pin" />
      <Gap h={12} />
      <Stepper label="Nombre de places" value={f.capacity} onChange={set('capacity')} min={1} max={500} step={1} />
      <Gap h={12} />
      <Label>Participation</Label>
      <Gap h={8} />
      <Segmented items={[{ key: 'gratuit', label: 'Gratuit' }, { key: 'payant', label: 'Payant' }]} value={f.paid ? 'payant' : 'gratuit'} onChange={(k) => set('paid')(k === 'payant')} />
      {f.paid ? (
        <>
          <Gap h={12} />
          <Field label="Prix du billet (€)" value={f.price} onChangeText={(v) => set('price')(v.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" />
          <Gap h={12} />
          <Field
            label="Lien de billetterie externe"
            value={f.ticketUrl}
            onChangeText={set('ticketUrl')}
            placeholder="https://www.billetweb.fr/…"
            icon="external"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            hint="Obligatoire pour un événement payant : la page Billetweb (ou HelloAsso, Weezevent…) où les sœurs réservent et paient leur place."
            error={f.ticketUrl.trim() && !ticketOk ? (/^http:\/\//i.test(f.ticketUrl.trim()) ? 'Le lien doit être sécurisé (https://)' : 'Lien invalide') : undefined}
          />
          <Card tone="soft" style={{ marginTop: 12, gap: 4 }}>
            <Label color={colors.or}>Commission Nissali : 15 %</Label>
            <T variant="small">
              Sur un billet à {price.toFixed(2).replace('.', ',')} €, la commission Nissali est de {(price * COMMISSION).toFixed(2).replace('.', ',')} € par billet vendu via Nissali, réglée après l’événement. Rien n’est prélevé sur les événements gratuits.
            </T>
          </Card>
        </>
      ) : null}
      <Gap h={20} />
      <Button title={id ? 'Renvoyer pour validation' : 'Envoyer ma proposition'} onPress={submit} loading={busy} disabled={!valid || busy} />
      <Gap h={24} />
    </Screen>
  );
}

const s = StyleSheet.create({
  image: { height: 170, borderRadius: 24, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: colors.rose, borderStyle: 'dashed' },
});

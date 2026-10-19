// 5.11 — « Proposer un événement » : image (paysage, 1 Mo maximum), titre, description, date, lieu, places,
// gratuit ou payant avec prix et lien Billetweb obligatoire (RG-30). La commission de 15 % est indiquée et
// acceptée avant l'envoi (RG-29) ; l'équipe valide avant publication (RG-28).
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { PhotoEditor } from '../../components/EventPhotos';
import { DateField, TimeField } from '../../components/forms';
import Icon from '../../components/Icon';
import { Button, Checkbox, Field, Gap, Loader, Row, Screen, Segmented, Stepper, T, useToast } from '../../components/ui';
import { api, assetUrl, uploadImage } from '../../lib/api';
import { addDays, toDay } from '../../lib/format';
import { shrinkImage } from '../../lib/image';
import { colors, fonts } from '../../theme';

const COMMISSION = 0.15;
const BILLETWEB = /^https:\/\/(www\.)?billetweb\.fr\/\S+/i;

/** « billetweb.fr/… » est complété en « https://www.billetweb.fr/… ». */
const normalizeTicket = (raw) => {
  const v = raw.trim();
  if (!v) return '';
  if (/^[a-z]+:\/\//i.test(v)) return v;
  return `https://${/^www\./i.test(v) ? '' : /^billetweb\./i.test(v) ? 'www.' : ''}${v}`;
};

function Section({ title, icon, children }) {
  return (
    <View style={s.section}>
      <Row gap={8}>
        <View style={s.sectionIcon}>
          <Icon name={icon} size={16} color={colors.bordeaux} />
        </View>
        <Text style={s.sectionTitle}>{title}</Text>
      </Row>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

export default function ProposeEvent() {
  const { id } = useLocalSearchParams();
  const toast = useToast();
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [f, setF] = useState({ title: '', description: '', programme: '', day: addDays(toDay(new Date()), 14), time: '14:00', endTime: '', name: '', address: '', city: '', capacity: 20, paid: false, price: '10', ticketUrl: '', imageUrl: null, photos: [], commission: false });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!id) return;
    api
      .get(`/events/${id}`)
      .then((e) => setF({ title: e.title, description: e.description, programme: e.programme || '', day: e.day, time: e.time, endTime: e.endTime || '', name: e.location?.name || '', address: e.location?.address || '', city: e.location?.city || '', capacity: e.capacity, paid: !e.free, price: String(e.price || 10), ticketUrl: e.ticketUrl || '', imageUrl: e.imageUrl, photos: e.photos || [], commission: !e.free }))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [id, toast]);

  const price = Number(String(f.price).replace(',', '.')) || 0;
  const ticketUrl = normalizeTicket(f.ticketUrl);
  const ticketOk = BILLETWEB.test(ticketUrl);

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (r.canceled) return;
    setUploading(true);
    try {
      const img = await shrinkImage(r.assets[0].uri);
      const { url } = await uploadImage('/events/image', 'image', img.uri, img.mimeType);
      set('imageUrl')(url);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
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
        ...(f.paid ? { ticketUrl, commissionAccepted: f.commission } : {}),
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
  const missing = [
    f.title.trim().length < 3 && 'un titre',
    f.description.trim().length < 10 && 'une description',
    !f.city.trim() && 'la ville',
    f.paid && !(price > 0) && 'le prix',
    f.paid && !ticketOk && 'le lien Billetweb',
    f.paid && !f.commission && 'l’accord sur la commission',
  ].filter(Boolean);

  return (
    <Screen back title={id ? 'Modifier mon événement' : 'Proposer un événement'}>
      <T variant="muted" style={{ marginTop: -8, marginBottom: 16 }}>Notre équipe vérifie chaque événement (image et lien compris) avant publication. Tu es prévenue par notification.</T>

      <Pressable onPress={pickImage} accessibilityRole="button" accessibilityLabel={f.imageUrl ? 'Changer l’image' : 'Ajouter une image'} style={s.image} disabled={uploading}>
        {f.imageUrl ? <Image source={{ uri: assetUrl(f.imageUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        {f.imageUrl ? (
          <View style={s.imageBadge}>
            <Icon name="edit" size={14} color={colors.white} />
            <Text style={s.imageBadgeText}>{uploading ? 'Envoi…' : 'Changer'}</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View style={s.imagePlus}>
              <Icon name="plus" size={22} color={colors.bordeaux} />
            </View>
            <Text style={s.imageText}>{uploading ? 'Envoi de l’image…' : 'Ajouter l’image de couverture'}</Text>
          </View>
        )}
      </Pressable>
      <T variant="small" style={{ marginTop: 6 }}>Format paysage, 1 Mo maximum (redimensionnée automatiquement), sans visage reconnaissable sans accord.</T>
      <Gap />

      <Section title="L’événement" icon="sparkle">
        <Field label="Titre" value={f.title} onChangeText={set('title')} placeholder="Ex. Brunch entre sœurs" maxLength={120} />
        <Field label="Description" value={f.description} onChangeText={set('description')} multiline placeholder="Présente ton événement en quelques lignes" />
        <Field label="Programme (facultatif)" value={f.programme} onChangeText={set('programme')} multiline placeholder="10 h : accueil…" />
      </Section>

      <Section title="Date et lieu" icon="calendar">
        <DateField label="Date" value={f.day} onChange={set('day')} minDay={toDay(new Date())} maxDay={addDays(toDay(new Date()), 365)} />
        <TimeField label="Début" value={f.time} onChange={set('time')} allowUnknown={false} />
        <TimeField label="Fin (facultatif)" value={f.endTime} onChange={set('endTime')} />
        <Field label="Lieu" value={f.name} onChangeText={set('name')} placeholder="Nom de la salle, du café…" />
        <Field label="Adresse" value={f.address} onChangeText={set('address')} placeholder="Numéro et rue" />
        <Field label="Ville" value={f.city} onChangeText={set('city')} placeholder="Ex. Nanterre" icon="pin" />
      </Section>

      <Section title="Places et participation" icon="users">
        <Stepper label="Nombre de places" value={f.capacity} onChange={set('capacity')} min={1} max={500} step={1} />
        <Segmented items={[{ key: 'gratuit', label: 'Gratuit' }, { key: 'payant', label: 'Payant' }]} value={f.paid ? 'payant' : 'gratuit'} onChange={(k) => set('paid')(k === 'payant')} />
        {f.paid ? (
          <>
            <Field label="Prix du billet (€)" value={f.price} onChangeText={(v) => set('price')(v.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" hint="Le même prix que sur ta billetterie Billetweb." />
            <Field
              label="Lien Billetweb"
              value={f.ticketUrl}
              onChangeText={set('ticketUrl')}
              placeholder="https://www.billetweb.fr/…"
              icon="external"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              hint="Obligatoire : la vente des billets se fait sur Billetweb, pas dans l’appli."
              error={f.ticketUrl.trim() && !ticketOk ? 'Le lien doit commencer par https://www.billetweb.fr/' : undefined}
            />
            <View style={s.commission}>
              <Text style={s.commissionTitle}>Commission Nissali : 15 %</Text>
              <T variant="small">
                Sur un billet à {price.toFixed(2).replace('.', ',')} €, Nissali perçoit {(price * COMMISSION).toFixed(2).replace('.', ',')} €. Après l’événement, tu envoies l’export des ventes Billetweb et Nissali te facture 15 % du montant vendu. Rien sur les événements gratuits.
              </T>
              <Checkbox checked={f.commission} onChange={set('commission')}>
                <T variant="medium">J’accepte la commission de 15 % sur chaque billet vendu</T>
              </Checkbox>
            </View>
          </>
        ) : (
          <T variant="small">Événement gratuit : les sœurs s’inscrivent dans l’appli, aucun frais.</T>
        )}
      </Section>

      <Section title="Photos (facultatif)" icon="sparkle">
        <PhotoEditor photos={f.photos} onChange={set('photos')} />
      </Section>

      {missing.length ? <T variant="small" style={{ textAlign: 'center', marginBottom: 10 }}>Il manque : {missing.join(', ')}.</T> : null}
      <Button title={id ? 'Renvoyer pour validation' : 'Envoyer ma proposition'} icon="check" onPress={submit} loading={busy} disabled={missing.length > 0 || busy || uploading} />
      <Gap h={24} />
    </Screen>
  );
}

const s = StyleSheet.create({
  image: { height: 190, borderRadius: 24, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: colors.rose, borderStyle: 'dashed' },
  imagePlus: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  imageText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.bordeaux },
  imageBadge: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(62,18,32,0.75)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  imageBadgeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  section: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.line },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: fonts.title, fontSize: 18, color: colors.prune },
  commission: { backgroundColor: '#F6EBDD', borderRadius: 18, padding: 14, gap: 10 },
  commissionTitle: { fontFamily: fonts.bold, fontSize: 14, color: '#8A6235' },
});

// Profil pro : profil public, photo, formule d'abonnement, avis, disponibilités, bascule.
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import PlanCard from '../../components/PlanCard';
import { SpaceSwitch } from '../../components/ProBits';
import { Button, Card, Chips, ErrorState, Field, Gap, Label, ListItem, Loader, Row, Screen, Segmented, Sheet, Stepper, T, Toggle, useToast } from '../../components/ui';
import { api, assetUrl, uploadImage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { colors } from '../../theme';

export default function ProProfile() {
  const toast = useToast();
  const { refresh, signOut, switchSpace } = useAuth();
  const me = useApi('/pro/me');
  const plans = useApi('/pro/plans');
  const status = useApi('/practitioners/status');
  const reviews = useApi('/pro/reviews');
  const [form, setForm] = useState(null);
  const [billing, setBilling] = useState('mensuel');
  const [planSheet, setPlanSheet] = useState(false);
  const [reply, setReply] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = me.data?.practitioner;
    if (p) {
      setForm({
        displayName: p.displayName,
        specialty: p.specialty,
        city: p.location?.city || '',
        address: p.location?.address || '',
        description: p.description || '',
        siret: p.legal?.siret || '',
        inPerson: p.inPerson,
        supportsVideo: p.supportsVideo,
        minNoticeHours: p.minNoticeHours ?? 12,
        autoConfirm: p.autoConfirm,
        phone: p.phone || '',
        showPhone: Boolean(p.showPhone),
        diplomas: (p.diplomas || []).join('\n'),
        professionalId: p.professionalId || '',
      });
    }
  }, [me.data]);

  if (me.loading && !me.data) return <Screen title="Profil"><Loader /></Screen>;
  if (me.error && !me.data) return <Screen title="Profil"><ErrorState error={me.error} onRetry={me.reload} /></Screen>;
  const p = me.data.practitioner;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/pro/me', { ...form, diplomas: form.diplomas.split('\n').map((d) => d.trim()).filter((d) => d.length >= 2).slice(0, 10) });
      toast('Profil enregistré');
      me.reload();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (r.canceled) return;
    try {
      await uploadImage('/pro/photo', 'photo', r.assets[0].uri);
      toast('Photo mise à jour');
      me.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const choosePlan = async (key) => {
    try {
      const r = await api.post('/pro/subscription', { plan: key, billing });
      toast(r.message);
      setPlanSheet(false);
      me.reload();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const sendReply = async () => {
    try {
      await api.post(`/pro/reviews/${reply.id}/reply`, { reply: reply.text });
      setReply(null);
      reviews.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Screen title="Profil pro" right={<SpaceSwitch />}>
      <Row gap={16}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Changer la photo">
          {p.photoUrl ? (
            <Image source={{ uri: assetUrl(p.photoUrl) }} style={{ width: 84, height: 84, borderRadius: 42 }} />
          ) : (
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' }}>
              <T variant="h1" color={colors.bordeaux}>{p.displayName[0]}</T>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <T variant="h3">{p.displayName}</T>
          <T variant="small">{{ en_attente: 'En cours de validation', validee: 'Profil validé', refusee: 'Inscription refusée', suspendue: 'Suspendu' }[p.status]}</T>
          <Pressable onPress={pickPhoto}>
            <T variant="medium" color={colors.bordeaux}>Changer la photo</T>
          </Pressable>
        </View>
      </Row>
      <Gap />

      <Card style={{ gap: 8 }}>
        <Row justify="space-between">
          <Label>Ma formule</Label>
          <Pressable onPress={() => setPlanSheet(true)} hitSlop={10}>
            <T variant="medium" color={colors.bordeaux}>Changer</T>
          </Pressable>
        </Row>
        <T variant="h3">{me.data.plan?.name}</T>
        {me.data.subscription?.endsAt ? <T variant="small">Active jusqu’au {new Date(me.data.subscription.endsAt).toLocaleDateString('fr-FR')}</T> : null}
        {me.data.pendingSubscription ? (
          <T variant="small" color={colors.or}>
            Demande « {me.data.pendingSubscription.plan} » en attente de règlement (réf. {me.data.pendingSubscription.paymentReference})
          </T>
        ) : null}
      </Card>
      <Gap />

      <ListItem icon="briefcase" title="Mes prestations" subtitle="Séances, durées et tarifs indicatifs" onPress={() => router.push('/pro/prestations')} />
      <ListItem icon="clock" title="Mes disponibilités" subtitle="Horaires de la semaine et congés" onPress={() => router.push('/pro/disponibilites')} />
      <ListItem icon="lock" title="Connexion et sécurité" subtitle="Code ou mot de passe" onPress={() => router.push('/securite')} />
      <Gap />

      {form ? (
        <Card style={{ gap: 12 }}>
          <Label>Profil public</Label>
          <Field label="Nom affiché" value={form.displayName} onChangeText={set('displayName')} />
          <T variant="fieldLabel">Spécialité</T>
          <Chips items={status.data?.categories || []} value={form.specialty} onChange={set('specialty')} />
          <Field label="Ville" value={form.city} onChangeText={set('city')} />
          <Field label="Adresse" value={form.address} onChangeText={set('address')} />
          <Field label="Présentation" value={form.description} onChangeText={set('description')} multiline />
          <Field label="Diplômes et certifications (un par ligne)" value={form.diplomas} onChangeText={set('diplomas')} multiline placeholder="Diplôme d’État de sage-femme" />
          <Field label="Numéro ADELI ou RPPS (profession réglementée)" value={form.professionalId} onChangeText={set('professionalId')} hint="Visible par l’équipe Nissali seulement (RG-25)." />
          <Field label="SIRET" value={form.siret} onChangeText={set('siret')} keyboardType="number-pad" />
          <Label style={{ marginTop: 6 }}>Contact</Label>
          <Field label="Numéro professionnel" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="06 12 34 56 78" icon="phone" />
          <Toggle label="Afficher mon numéro sur ma fiche" value={form.showPhone} onChange={set('showPhone')} hint="Les utilisatrices pourront t’appeler. La messagerie reste toujours disponible." />
          <Toggle label="Consultations au cabinet" value={form.inPerson} onChange={set('inPerson')} />
          <Toggle label="Consultations en visio" value={form.supportsVideo} onChange={set('supportsVideo')} hint={me.data.plan?.features?.video ? null : 'Proposée aux utilisatrices dès que ta formule inclut la visio (Essentiel, Premium)'} />
          <Toggle label="Confirmer automatiquement les demandes" value={form.autoConfirm} onChange={set('autoConfirm')} />
          <Stepper label="Délai minimum avant un RDV" value={form.minNoticeHours} onChange={set('minNoticeHours')} min={0} max={72} step={1} suffix=" h" />
          <Button title="Enregistrer" onPress={save} loading={busy} />
        </Card>
      ) : null}
      <Gap />

      <Card style={{ gap: 8 }}>
        <Label>Avis reçus</Label>
        {reviews.data?.length ? (
          reviews.data.map((r) => (
            <View key={r.id} style={{ gap: 4, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <Row justify="space-between">
                <T variant="bold">{r.author}</T>
                <T color={colors.or}>{'★'.repeat(r.rating)}</T>
              </Row>
              {r.comment ? <T>{r.comment}</T> : null}
              {r.reply ? <T variant="small">Ta réponse : {r.reply}</T> : <Button title="Répondre" small variant="ghost" onPress={() => setReply({ id: r.id, text: '' })} />}
            </View>
          ))
        ) : (
          <T variant="muted">Pas encore d’avis.</T>
        )}
      </Card>
      <Gap />
      <Button title="Basculer vers mon espace personnel" icon="swap" variant="outline" onPress={() => switchSpace('personnel')} />
      <Gap h={10} />
      <Button title="Me déconnecter" variant="ghost" onPress={signOut} />

      <Sheet visible={planSheet} onClose={() => setPlanSheet(false)} title="Formules">
        <Segmented items={[{ key: 'mensuel', label: 'Mensuel' }, { key: 'annuel', label: 'Annuel' }]} value={billing} onChange={setBilling} />
        {(plans.data?.plans || []).map((pl) => (
          <PlanCard key={pl.key} plan={pl} billing={billing} current={plans.data.current === pl.key} selected={false} onPress={() => choosePlan(pl.key)} />
        ))}
        <T variant="small">Les formules payantes sont activées après règlement auprès de l’équipe Nissali.</T>
      </Sheet>
      <Sheet visible={Boolean(reply)} onClose={() => setReply(null)} title="Répondre à l’avis" footer={<Button title="Publier" onPress={sendReply} disabled={!reply?.text?.trim()} />}>
        <Field value={reply?.text || ''} onChangeText={(v) => setReply((r) => ({ ...r, text: v }))} multiline placeholder="Merci pour ton retour…" />
      </Sheet>
    </Screen>
  );
}

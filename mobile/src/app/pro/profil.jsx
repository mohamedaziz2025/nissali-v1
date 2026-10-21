// Profil pro : profil public, photo, formule d'abonnement, avis, disponibilités, bascule.
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
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

import { tr } from '../../lib/i18n';
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
        atHome: Boolean(p.atHome),
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

  if (me.loading && !me.data) return <Screen title={tr("Profil")}><Loader /></Screen>;
  if (me.error && !me.data) return <Screen title={tr("Profil")}><ErrorState error={me.error} onRetry={me.reload} /></Screen>;
  const p = me.data.practitioner;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/pro/me', { ...form, diplomas: form.diplomas.split('\n').map((d) => d.trim()).filter((d) => d.length >= 2).slice(0, 10) });
      toast(tr("Profil enregistré"));
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
      toast(tr("Photo mise à jour"));
      me.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const choosePlan = async (key) => {
    try {
      const r = await api.post('/pro/subscription', { plan: key, billing });
      setPlanSheet(false);
      if (r.checkoutUrl) {
        toast(tr("Termine le paiement pour activer ta formule"));
        await WebBrowser.openBrowserAsync(r.checkoutUrl);
        me.reload();
        refresh();
        return;
      }
      toast(r.message);
      me.reload();
      refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const openPortal = async () => {
    try {
      const r = await api.post('/pro/subscription/portal');
      await WebBrowser.openBrowserAsync(r.url);
      me.reload();
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
    <Screen title={tr("Profil pro")} right={<SpaceSwitch />}>
      <Row gap={16}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={tr("Changer la photo")}>
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
          <T variant="small">{{ en_attente: tr("En cours de validation"), validee: tr("Profil validé"), refusee: tr("Inscription refusée"), suspendue: tr("Suspendu") }[p.status]}</T>
          {me.data.completion && me.data.completion.percent < 100 ? <T variant="small" color={colors.bordeaux}>{tr("Profil complété à")} {me.data.completion.percent} %</T> : null}
          <Pressable onPress={pickPhoto}>
            <T variant="medium" color={colors.bordeaux}>{tr("Changer la photo")}</T>
          </Pressable>
        </View>
      </Row>
      <Gap />

      <Card style={{ gap: 8 }}>
        <Row justify="space-between">
          <Label>{tr("Ma formule")}</Label>
          <Pressable onPress={() => setPlanSheet(true)} hitSlop={10}>
            <T variant="medium" color={colors.bordeaux}>{tr("Changer")}</T>
          </Pressable>
        </Row>
        <T variant="h3">{me.data.plan?.name}</T>
        {me.data.subscription?.endsAt ? <T variant="small">{tr("Active jusqu’au")} {new Date(me.data.subscription.endsAt).toLocaleDateString('fr-FR')}</T> : null}
        {me.data.pendingSubscription ? (
          <T variant="small" color={colors.or}>
            {tr("Demande «")} {me.data.pendingSubscription.plan} {tr("» en attente de règlement (réf.")} {me.data.pendingSubscription.paymentReference}) · {me.data.billing?.online ? tr("termine le paiement en ligne") : tr("l’équipe Nissali te contacte")}
          </T>
        ) : null}
        {me.data.billing?.online && me.data.billing?.portal ? <Button title={tr("Gérer mon moyen de paiement")} variant="ghost" small onPress={openPortal} /> : null}
      </Card>
      <Gap />

      <ListItem icon="briefcase" title={tr("Mes prestations")} subtitle={tr("Séances, durées et tarifs indicatifs")} onPress={() => router.push('/pro/prestations')} />
      <ListItem icon="clock" title={tr("Mes disponibilités")} subtitle={tr("Horaires de la semaine et congés")} onPress={() => router.push('/pro/disponibilites')} />
      <ListItem icon="lock" title={tr("Connexion et sécurité")} subtitle={tr("Code ou mot de passe")} onPress={() => router.push('/securite')} />
      <Gap />

      {form ? (
        <Card style={{ gap: 12 }}>
          <Label>{tr("Profil public")}</Label>
          <Field label={tr("Nom affiché")} value={form.displayName} onChangeText={set('displayName')} />
          <T variant="fieldLabel">{tr("Spécialité")}</T>
          <Chips items={status.data?.categories || []} value={form.specialty} onChange={set('specialty')} />
          <Field label={tr("Ville")} value={form.city} onChangeText={set('city')} />
          <Field label={tr("Adresse")} value={form.address} onChangeText={set('address')} />
          <Field label={tr("Présentation")} value={form.description} onChangeText={set('description')} multiline />
          <Field label={tr("Diplômes et certifications (un par ligne)")} value={form.diplomas} onChangeText={set('diplomas')} multiline placeholder={tr("Diplôme d’État de sage-femme")} />
          <Field label={tr("Numéro ADELI ou RPPS (profession réglementée)")} value={form.professionalId} onChangeText={set('professionalId')} hint={tr("Visible par l’équipe Nissali seulement (RG-25).")} />
          <Field label={tr("SIRET")} value={form.siret} onChangeText={set('siret')} keyboardType="number-pad" />
          <Label style={{ marginTop: 6 }}>{tr("Contact")}</Label>
          <Field label={tr("Numéro professionnel")} value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="06 12 34 56 78" icon="phone" />
          <Toggle label={tr("Afficher mon numéro sur ma fiche")} value={form.showPhone} onChange={set('showPhone')} hint={tr("Les utilisatrices pourront t’appeler. La messagerie reste toujours disponible.")} />
          <Toggle label={tr("Consultations au cabinet")} value={form.inPerson} onChange={set('inPerson')} />
          <Toggle label={tr("Consultations à domicile")} hint={tr("Étiquette « Domicile » sur ta fiche")} value={Boolean(form.atHome)} onChange={set('atHome')} />
          <Toggle label={tr("Consultations en visio")} value={form.supportsVideo} onChange={set('supportsVideo')} hint={me.data.plan?.features?.video ? null : tr("Proposée aux utilisatrices dès que ta formule inclut la visio (Essentiel, Premium)")} />
          <Toggle label={tr("Confirmer automatiquement les demandes")} value={form.autoConfirm} onChange={set('autoConfirm')} />
          <Stepper label={tr("Délai minimum avant un RDV")} value={form.minNoticeHours} onChange={set('minNoticeHours')} min={0} max={72} step={1} suffix=" h" />
          <Button title={tr("Enregistrer")} onPress={save} loading={busy} />
        </Card>
      ) : null}
      <Gap />

      <Card style={{ gap: 8 }}>
        <Label>{tr("Avis reçus")}</Label>
        {reviews.data?.length ? (
          reviews.data.map((r) => (
            <View key={r.id} style={{ gap: 4, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <Row justify="space-between">
                <T variant="bold">{r.author}</T>
                <T color={colors.or}>{'★'.repeat(r.rating)}</T>
              </Row>
              {r.comment ? <T>{r.comment}</T> : null}
              {r.reply ? <T variant="small">{tr("Ta réponse :")} {r.reply}</T> : <Button title={tr("Répondre")} small variant="ghost" onPress={() => setReply({ id: r.id, text: '' })} />}
            </View>
          ))
        ) : (
          <T variant="muted">{tr("Pas encore d’avis.")}</T>
        )}
      </Card>
      <Gap />
      <Button title={tr("Basculer vers mon espace personnel")} icon="swap" variant="outline" onPress={() => switchSpace('personnel')} />
      <Gap h={10} />
      <Button title={tr("Me déconnecter")} variant="ghost" onPress={signOut} />

      <Sheet visible={planSheet} onClose={() => setPlanSheet(false)} title={tr("Formules")}>
        <Segmented items={[{ key: 'mensuel', label: tr("Mensuel") }, { key: 'annuel', label: tr("Annuel") }]} value={billing} onChange={setBilling} />
        {(plans.data?.plans || []).map((pl) => (
          <PlanCard key={pl.key} plan={pl} billing={billing} current={plans.data.current === pl.key} selected={false} onPress={() => choosePlan(pl.key)} />
        ))}
        <T variant="small">{plans.data?.online ? tr("Paiement sécurisé par carte : ta formule s’active après le règlement.") : tr("Les formules payantes sont activées après règlement auprès de l’équipe Nissali.")}</T>
      </Sheet>
      <Sheet visible={Boolean(reply)} onClose={() => setReply(null)} title={tr("Répondre à l’avis")} footer={<Button title={tr("Publier")} onPress={sendReply} disabled={!reply?.text?.trim()} />}>
        <Field value={reply?.text || ''} onChangeText={(v) => setReply((r) => ({ ...r, text: v }))} multiline placeholder={tr("Merci pour ton retour…")} />
      </Sheet>
    </Screen>
  );
}

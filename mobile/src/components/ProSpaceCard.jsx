// Profil › Espace professionnel : vérifie (en direct) si le compte porte un profil praticienne.
// Sinon, l'utilisatrice peut vérifier l'e-mail de son compte pro : un code y est envoyé et le profil
// est rattaché à ce compte, pour basculer entre les deux espaces sans se déconnecter.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, fonts } from '../theme';
import Icon from './Icon';
import { PractitionerAvatar } from './Practitioners';
import { Button, Card, CodeInput, Field, Label, Row, T, useToast } from './ui';

const STATUS = {
  validee: { label: 'Validée', color: colors.success, text: 'Profil visible dans l’annuaire' },
  en_attente: { label: 'En attente', color: colors.or, text: 'En cours de validation par l’équipe' },
  refusee: { label: 'Refusée', color: colors.bordeaux, text: 'Profil à corriger' },
  suspendue: { label: 'Suspendue', color: colors.muted, text: 'Profil masqué de l’annuaire' },
};
const SUB = { active: 'active', en_attente: 'en attente d’activation', expiree: 'expirée', annulee: 'annulée' };

function InfoRow({ icon, label, value, color }) {
  return (
    <Row gap={10} style={{ paddingVertical: 6 }}>
      <Icon name={icon} size={17} color={colors.muted} />
      <T variant="small" style={{ flex: 1 }}>{label}</T>
      <T variant="medium" style={{ fontSize: 14, color: color || colors.prune, flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>
        {value}
      </T>
    </Row>
  );
}

export default function ProSpaceCard() {
  const { user, practitioner, refresh, setSession, switchSpace, signOut } = useAuth();
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState(null); // null | { status, displayName, target }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  // Vérification en direct à l'ouverture du profil (profil pro créé entre-temps sur le web, validation…).
  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const account = user?.email || user?.phone || '—';

  const check = async (value = identifier || user?.email || '') => {
    if (value.trim().length < 3) return toast('Indique l’e-mail de ton compte praticienne', 'error');
    setBusy(true);
    try {
      const r = await api.post('/me/pro-link/check', { identifier: value.trim() });
      setStep({ ...r, identifier: value.trim() });
      setCode('');
      if (r.status === 'linked') await refresh();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    setBusy(true);
    try {
      const r = await api.post('/me/pro-link/verify', { identifier: step.identifier, code: value });
      await setSession(r.session);
      setStep(null);
      toast(`Profil « ${r.session.practitioner?.displayName} » rattaché à ton compte`);
    } catch (e) {
      toast(e.message, 'error');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  if (practitioner) {
    const st = STATUS[practitioner.status] || STATUS.en_attente;
    return (
      <Card style={{ gap: 6 }}>
        <Row justify="space-between">
          <Label color={colors.or}>Espace professionnel</Label>
          <View style={[s.pill, { backgroundColor: `${st.color}1F` }]}>
            <Text style={[s.pillText, { color: st.color }]}>Praticienne · {st.label}</Text>
          </View>
        </Row>
        <Row gap={12} style={{ marginTop: 6, marginBottom: 4 }}>
          <PractitionerAvatar p={practitioner} size={52} />
          <View style={{ flex: 1 }}>
            <T variant="bold" style={{ fontSize: 17 }}>{practitioner.displayName}</T>
            <T variant="small">{st.text}</T>
          </View>
        </Row>
        <InfoRow icon="mail" label="Compte vérifié" value={account} />
        <InfoRow icon="star" label="Formule" value={`${practitioner.plan?.name || 'Découverte'}${practitioner.subscriptionStatus && practitioner.subscriptionStatus !== 'active' ? ` · ${SUB[practitioner.subscriptionStatus] || practitioner.subscriptionStatus}` : ''}`} />
        {practitioner.pendingBookings ? <InfoRow icon="calendar" label="Demandes à traiter" value={String(practitioner.pendingBookings)} color={colors.bordeaux} /> : null}
        <Button title="Basculer en espace pro" icon="swap" onPress={() => switchSpace('pro')} style={{ marginTop: 8 }} />
        <T variant="small" style={{ textAlign: 'center' }}>Même compte, même session : tu reviens à ton espace personnel en un geste.</T>
      </Card>
    );
  }

  return (
    <Card tone="dashed" style={{ gap: 10 }}>
      <Row justify="space-between">
        <Label color={colors.or}>Espace professionnel</Label>
        {checking ? <ActivityIndicator color={colors.or} size="small" /> : <View style={[s.pill, { backgroundColor: colors.blush }]}><Text style={[s.pillText, { color: colors.muted }]}>Compte personnel</Text></View>}
      </Row>
      <T>
        Aucun profil praticienne n’est rattaché à ton compte <T variant="bold">{account}</T>.
      </T>

      {step?.status === 'own_account' ? (
        <>
          <Row gap={8} align="flex-start">
            <Icon name="info" size={18} color={colors.or} />
            <T variant="small" style={{ flex: 1 }}>
              Le profil « {step.displayName} » appartient à un compte qui a déjà son propre espace personnel. Connecte-toi avec {step.target} : tu y bascules entre tes deux espaces sans te déconnecter.
            </T>
          </Row>
          <Button title="Me connecter avec ce compte" icon="swap" onPress={signOut} />
          <Button title="Vérifier une autre adresse" small variant="soft" onPress={() => setStep(null)} />
        </>
      ) : null}
      {!step || step.status === 'none' ? (
        <>
          <T variant="small">Tu as créé ton profil praticienne (sur le web ou l’appli) avec une autre adresse ? Vérifie-la pour basculer ici entre tes deux espaces.</T>
          <Field value={identifier} onChangeText={setIdentifier} placeholder="E-mail du compte pro" icon="mail" autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
          {step?.status === 'none' ? (
            <Row gap={8}>
              <Icon name="info" size={16} color={colors.muted} />
              <T variant="small" style={{ flex: 1 }}>Aucun profil praticienne trouvé pour {step.target}.</T>
            </Row>
          ) : null}
          <Button title="Vérifier" icon="search" variant="soft" loading={busy} disabled={busy || identifier.trim().length < 3} onPress={() => check()} />
          <Button title="Devenir praticienne" variant="outline" onPress={() => router.push('/pro-inscription')} />
        </>
      ) : step.status === 'code_sent' ? (
        <>
          <Row gap={8}>
            <Icon name="check" size={18} color={colors.success} />
            <T variant="medium" style={{ flex: 1 }}>Profil trouvé : {step.displayName}</T>
          </Row>
          <T variant="small">Saisis le code envoyé à {step.target} pour le rattacher à ton compte.</T>
          <CodeInput value={code} onChange={(v) => { setCode(v); if (v.length === 6) verify(v); }} />
          {busy ? <ActivityIndicator color={colors.bordeaux} /> : null}
          <Row gap={8}>
            <Button title="Renvoyer le code" small variant="soft" onPress={() => check(step.identifier)} style={{ flex: 1 }} />
            <Button title="Annuler" small variant="outline" onPress={() => setStep(null)} style={{ flex: 1 }} />
          </Row>
        </>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
});

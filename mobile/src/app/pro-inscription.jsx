// Inscription professionnelle : choix de la formule d'abonnement puis profil pro.
// Même compte que l'espace personnel : on bascule ensuite sans se déconnecter.
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import PlanCard from '../components/PlanCard';
import { Button, Card, Chips, ErrorState, Field, Gap, Loader, Screen, Segmented, T, Toggle, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/useApi';

export default function ProRegister() {
  const toast = useToast();
  const { user, setSession, switchSpace } = useAuth();
  const { data, loading, error, reload } = useApi('/practitioners/status');
  const [step, setStep] = useState(0);
  const [billing, setBilling] = useState('mensuel');
  const [plan, setPlan] = useState('decouverte');
  const [form, setForm] = useState({ displayName: user?.firstName ? `${user.firstName} ` : '', specialty: null, city: user?.city?.name || '', address: '', description: '', siret: '', inPerson: true, supportsVideo: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  if (loading && !data) return <Screen back title="Espace pro"><Loader /></Screen>;
  if (error && !data) return <Screen back title="Espace pro"><ErrorState error={error} onRetry={reload} /></Screen>;
  const selectedPlan = data.plans.find((p) => p.key === plan);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post('/pro/register', { ...form, displayName: form.displayName.trim(), plan, billing, supportsVideo: form.supportsVideo && Boolean(selectedPlan?.features?.video) });
      await setSession({ user: r.user, practitioner: r.practitioner });
      toast(r.subscription?.status === 'active' ? 'Bienvenue dans ton espace pro !' : r.checkoutUrl ? 'Termine le paiement pour activer ta formule' : `Demande enregistrée (réf. ${r.subscription?.paymentReference}). L’équipe te contacte pour le règlement.`);
      await switchSpace('pro');
      if (r.checkoutUrl) await WebBrowser.openBrowserAsync(r.checkoutUrl);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      back
      title={step === 0 ? 'Choisis ta formule' : 'Ton profil pro'}
      footer={
        <View style={{ padding: 20, gap: 8 }}>
          {step === 0 ? (
            <Button title={`Continuer avec ${selectedPlan?.name || ''}`} onPress={() => setStep(1)} />
          ) : (
            <>
              <Button title="Créer mon espace pro" onPress={submit} loading={busy} disabled={!form.displayName.trim() || !form.specialty || !form.city.trim()} />
              <Button title="Changer de formule" variant="ghost" onPress={() => setStep(0)} />
            </>
          )}
        </View>
      }
    >
      {step === 0 ? (
        <>
          <T variant="muted">Rejoins l’annuaire Nissali des praticiennes. Ton profil est vérifié par notre équipe avant publication.</T>
          <Gap />
          <Segmented items={[{ key: 'mensuel', label: 'Mensuel' }, { key: 'annuel', label: 'Annuel (2 mois offerts)' }]} value={billing} onChange={setBilling} />
          <Gap />
          {data.plans.map((p) => (
            <PlanCard key={p.key} plan={p} billing={billing} selected={plan === p.key} onPress={() => setPlan(p.key)} />
          ))}
          <T variant="small">Les formules payantes s’activent après règlement (en ligne par carte, ou auprès de l’équipe Nissali). Tu peux commencer gratuitement et changer de formule à tout moment.</T>
        </>
      ) : (
        <View style={{ gap: 14 }}>
          <Field label="Nom affiché" value={form.displayName} onChangeText={set('displayName')} placeholder="Samira B." />
          <T variant="fieldLabel">Spécialité</T>
          <Chips items={data.categories} value={form.specialty} onChange={set('specialty')} />
          <Field label="Ville d’exercice" value={form.city} onChangeText={set('city')} icon="pin" />
          <Field label="Adresse du cabinet (facultatif)" value={form.address} onChangeText={set('address')} />
          <Field label="Présentation" value={form.description} onChangeText={set('description')} multiline placeholder="Ton parcours, ton approche…" />
          <Field label="SIRET (facultatif)" value={form.siret} onChangeText={set('siret')} keyboardType="number-pad" />
          <Card style={{ gap: 4 }}>
            <Toggle label="Consultations au cabinet" value={form.inPerson} onChange={set('inPerson')} />
            <Toggle label="Consultations en visio" value={form.supportsVideo} onChange={set('supportsVideo')} hint={selectedPlan?.features?.video ? 'Lien Jitsi généré automatiquement' : 'Disponible avec Essentiel ou Premium'} />
          </Card>
        </View>
      )}
    </Screen>
  );
}

// Inscription professionnelle : essai gratuit (ou formule payante) puis profil pro.
// Sans formule payante proposée, l'étape du choix est sautée : la praticienne démarre en essai gratuit,
// avec les fonctionnalités réglées par l'équipe. Même compte que l'espace personnel.
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import PlanCard, { TrialCard } from '../components/PlanCard';
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
  const [plan, setPlan] = useState(null); // null : essai gratuit (ou formule gratuite)
  const [form, setForm] = useState({ displayName: user?.firstName ? `${user.firstName} ` : '', specialty: null, city: user?.city?.name || '', address: '', description: '', siret: '', inPerson: true, supportsVideo: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  if (loading && !data) return <Screen back title="Espace pro"><Loader /></Screen>;
  if (error && !data) return <Screen back title="Espace pro"><ErrorState error={error} onRetry={reload} /></Screen>;
  const trial = data.trial;
  // Avec un essai gratuit, les formules gratuites ne se choisissent pas : l'essai les inclut puis y bascule.
  const plans = trial ? data.plans.filter((p) => p.priceMonthly > 0 || p.priceYearly > 0) : data.plans;
  const choosePlan = plans.length > 0 && (trial || plans.length > 1);
  const current = choosePlan ? step : 1;
  const selectedPlan = plan ? data.plans.find((p) => p.key === plan) : trial || data.plans.find((p) => p.key === 'decouverte') || plans[0];
  const onTrial = !plan && Boolean(trial);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post('/pro/register', { ...form, displayName: form.displayName.trim(), ...(plan || (!trial && selectedPlan) ? { plan: plan || selectedPlan.key } : {}), billing, supportsVideo: form.supportsVideo && Boolean(selectedPlan?.features?.video) });
      await setSession({ user: r.user, practitioner: r.practitioner });
      toast(r.trial ? `Bienvenue ! Ton essai gratuit est actif${r.trial.daysLeft ? ` pendant ${r.trial.daysLeft} jours` : ''}.` : r.subscription?.status === 'active' ? 'Bienvenue dans ton espace pro !' : r.checkoutUrl ? 'Termine le paiement pour activer ta formule' : `Demande enregistrée (réf. ${r.subscription?.paymentReference}). L’équipe te contacte pour le règlement.`);
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
      title={current === 0 ? 'Choisis ta formule' : 'Ton profil pro'}
      footer={
        <View style={{ padding: 20, gap: 8 }}>
          {current === 0 ? (
            <Button title={onTrial ? 'Commencer mon essai gratuit' : `Continuer avec ${selectedPlan?.name || ''}`} onPress={() => setStep(1)} />
          ) : (
            <>
              <Button title={onTrial ? 'Créer mon espace pro gratuitement' : 'Créer mon espace pro'} onPress={submit} loading={busy} disabled={!form.displayName.trim() || !form.specialty || !form.city.trim()} />
              {choosePlan ? <Button title="Changer de formule" variant="ghost" onPress={() => setStep(0)} /> : null}
            </>
          )}
        </View>
      }
    >
      {current === 0 ? (
        <>
          <T variant="muted">Rejoins l’annuaire Nissali des praticiennes. Ton profil est vérifié par notre équipe avant publication.</T>
          <Gap />
          {trial ? (
            <>
              <TrialCard trial={trial} selected={!plan} onPress={() => setPlan(null)} />
              <T variant="fieldLabel" style={{ marginTop: 4, marginBottom: 10 }}>Ou choisis directement une formule</T>
            </>
          ) : null}
          <Segmented items={[{ key: 'mensuel', label: 'Mensuel' }, { key: 'annuel', label: 'Annuel (2 mois offerts)' }]} value={billing} onChange={setBilling} />
          <Gap />
          {plans.map((p) => (
            <PlanCard key={p.key} plan={p} billing={billing} selected={plan === p.key || (!plan && !trial && selectedPlan?.key === p.key)} onPress={() => setPlan(p.key)} />
          ))}
          <T variant="small">
            {trial
              ? 'Pendant l’essai, tu profites des fonctionnalités ci-dessus. À la fin, tu passes sur la formule gratuite, sauf si tu choisis une formule. '
              : ''}
            Les formules payantes s’activent après règlement (en ligne par carte, ou auprès de l’équipe Nissali). Tu peux changer de formule à tout moment.
          </T>
        </>
      ) : (
        <View style={{ gap: 14 }}>
          {onTrial ? <TrialCard trial={trial} active /> : null}
          <Field label="Nom affiché" value={form.displayName} onChangeText={set('displayName')} placeholder="Samira B." />
          <T variant="fieldLabel">Spécialité</T>
          <Chips items={data.categories} value={form.specialty} onChange={set('specialty')} />
          <Field label="Ville d’exercice" value={form.city} onChangeText={set('city')} icon="pin" />
          <Field label="Adresse du cabinet (facultatif)" value={form.address} onChangeText={set('address')} />
          <Field label="Présentation" value={form.description} onChangeText={set('description')} multiline placeholder="Ton parcours, ton approche…" />
          <Field label="SIRET (facultatif)" value={form.siret} onChangeText={set('siret')} keyboardType="number-pad" />
          <Card style={{ gap: 4 }}>
            <Toggle label="Consultations au cabinet" value={form.inPerson} onChange={set('inPerson')} />
            <Toggle label="Consultations en visio" value={form.supportsVideo} onChange={set('supportsVideo')} hint={selectedPlan?.features?.video ? 'Lien Jitsi généré automatiquement' : 'Non incluse dans cette formule'} />
          </Card>
        </View>
      )}
    </Screen>
  );
}

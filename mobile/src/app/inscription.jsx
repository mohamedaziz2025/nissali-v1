// Inscription (5.1, RG-05 bis) : prénom, âge, ville, situation, puis e-mail (le téléphone est facultatif,
// ajouté ensuite dans le profil), vérifié par un code OTP. Consentements séparés, non cochés par défaut (RG-03, RG-04).
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { CityPicker } from '../components/forms';
import { Button, Card, Checkbox, Chips, CodeInput, Field, ProgressBar, Screen, Segmented, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors } from '../theme';

const STEPS = ['prenom', 'age', 'ville', 'situation', 'contact', 'consentements', 'code'];

export default function Register() {
  const { signIn } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ firstName: '', age: '', city: null, situation: null, channel: 'email', identifier: '', terms: false, health: false, marketing: false });
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const age = Number(form.age);

  const valid = {
    prenom: form.firstName.trim().length > 0,
    age: Number.isInteger(age) && age >= 15 && age <= 100,
    ville: Boolean(form.city),
    situation: Boolean(form.situation),
    contact: form.channel === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.identifier.trim()) : form.identifier.replace(/\D/g, '').length >= 9,
    consentements: form.terms,
    code: code.length === 6,
  }[STEPS[step]];

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/auth/otp', { identifier: form.identifier.trim(), purpose: 'register' });
      setSent(r);
      setStep(STEPS.indexOf('code'));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const register = async (value = code) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/auth/register', {
        identifier: form.identifier.trim(),
        code: value,
        firstName: form.firstName.trim(),
        age,
        city: form.city,
        situation: form.situation,
        consents: { terms: true, health: form.health, marketingEmail: form.marketing, marketingSms: form.marketing, marketingWhatsapp: form.marketing },
      });
      await signIn(r);
      router.replace('/securite?bienvenue=1');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    setError(null);
    if (STEPS[step] === 'consentements') return sendCode();
    if (STEPS[step] === 'code') return register();
    setStep((s) => s + 1);
  };

  const content = {
    prenom: (
      <>
        <T variant="h2">Comment t’appelles-tu ?</T>
        <Field value={form.firstName} onChangeText={set('firstName')} placeholder="Ton prénom" autoFocus autoComplete="given-name" textContentType="givenName" returnKeyType="next" onSubmitEditing={() => valid && next()} />
      </>
    ),
    age: (
      <>
        <T variant="h2">Quel âge as-tu ?</T>
        <Field value={form.age} onChangeText={(v) => set('age')(v.replace(/\D/g, '').slice(0, 3))} placeholder="Ton âge" keyboardType="number-pad" autoFocus error={form.age && age < 15 ? 'Nissali est accessible à partir de 15 ans.' : null} hint="Nous enregistrons une année de naissance estimée." />
      </>
    ),
    ville: (
      <>
        <T variant="h2">Où vis-tu ?</T>
        <T variant="muted">Ta ville sert à calculer tes horaires de prière et la direction de la qibla.</T>
        <CityPicker value={form.city} onChange={set('city')} />
      </>
    ),
    situation: (
      <>
        <T variant="h2">Ta situation</T>
        <T variant="muted">Elle adapte les contenus de l’appli. Tu pourras la modifier à tout moment.</T>
        <Chips items={[{ key: 'celibataire', label: 'Célibataire' }, { key: 'mariee', label: 'Mariée' }]} value={form.situation} onChange={set('situation')} />
      </>
    ),
    contact: (
      <>
        <T variant="h2">Ton adresse e-mail</T>
        <T variant="muted">Nous t’envoyons un code pour vérifier ton compte.</T>
        <Field value={form.identifier} onChangeText={set('identifier')} placeholder="amina@exemple.fr" keyboardType="email-address" autoCapitalize="none" autoComplete="email" icon="mail" />
        <T variant="small">Ton numéro de téléphone est facultatif : tu pourras l’ajouter ensuite dans ton profil.</T>
      </>
    ),
    consentements: (
      <>
        <T variant="h2">Tes consentements</T>
        <Checkbox checked={form.terms} onChange={set('terms')}>
          <T>
            J’accepte les{' '}
            <T color={colors.bordeaux} onPress={() => router.push('/legal?doc=cgu')}>conditions d’utilisation</T> et la{' '}
            <T color={colors.bordeaux} onPress={() => router.push('/legal?doc=confidentialite')}>politique de confidentialité</T>. (obligatoire)
          </T>
        </Checkbox>
        <Checkbox checked={form.health} onChange={set('health')}>
          <T>J’accepte que Nissali traite mes données de santé (cycle, grossesse, symptômes) pour mon suivi. Elles ne sont jamais vendues ni partagées. (obligatoire pour le suivi)</T>
        </Checkbox>
        <Checkbox checked={form.marketing} onChange={set('marketing')}>
          <T>J’accepte de recevoir les actualités et offres de Nissali par e-mail, SMS et WhatsApp. (facultatif)</T>
        </Checkbox>
        <Card tone="soft">
          <T variant="small">Tu pourras modifier tes choix à tout moment dans ton profil. Lien de désinscription dans chaque e-mail, « STOP » pour les SMS.</T>
        </Card>
      </>
    ),
    code: (
      <>
        <T variant="h2">Ton code</T>
        <T variant="muted">
          Code envoyé par e-mail à <T variant="bold">{sent?.target}</T>. Pense à regarder dans tes courriers indésirables.
        </T>
        <CodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (v.length === 6) register(v);
          }}
        />
        <Button title="Renvoyer un code" variant="ghost" onPress={sendCode} disabled={busy} />
      </>
    ),
  }[STEPS[step]];

  return (
    <Screen
      back
      title="Créer mon compte"
      footer={
        <View style={{ padding: 20, gap: 10, backgroundColor: colors.ivoire }}>
          {error ? <T color={colors.danger} style={{ textAlign: 'center' }}>{error}</T> : null}
          <Button title={STEPS[step] === 'consentements' ? 'Recevoir mon code' : STEPS[step] === 'code' ? 'Créer mon compte' : 'Continuer'} onPress={next} disabled={!valid} loading={busy} />
          {step > 0 ? <Button title="Retour" variant="ghost" onPress={() => setStep((s) => s - 1)} /> : null}
        </View>
      }
    >
      <View style={{ gap: 18 }}>
        <ProgressBar progress={(step + 1) / STEPS.length} color={colors.bordeaux} track={colors.blush} height={6} />
        {content}
        {STEPS[step] === 'prenom' ? (
          <T variant="small" style={{ marginTop: 10 }} onPress={() => Linking.openURL('mailto:contact@nissali.fr')}>
            Besoin d’aide ? contact@nissali.fr
          </T>
        ) : null}
      </View>
    </Screen>
  );
}

// Inscription (5.1, RG-05 bis) : prénom, âge, ville, situation, coordonnées (e-mail + numéro de téléphone),
// vérifiées par un code envoyé par e-mail. Le numéro est obligatoire mais jamais utilisé pour l'envoi du
// code : il est seulement enregistré sur le compte, sur le même écran que l'e-mail. Consentements séparés,
// non cochés par défaut (RG-03, RG-04).
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { CityPicker } from '../components/forms';
import { Button, Card, Checkbox, Chips, CodeInput, Field, Icon, ProgressBar, Screen, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors } from '../theme';

const STEPS = ['prenom', 'age', 'ville', 'situation', 'contact', 'consentements', 'code'];

// Tous les indicatifs téléphoniques courants ; France sélectionnée par défaut.
const COUNTRY_CODES = [
  { code: '+33', label: 'France', flag: '🇫🇷' },
  { code: '+32', label: 'Belgique', flag: '🇧🇪' },
  { code: '+41', label: 'Suisse', flag: '🇨🇭' },
  { code: '+352', label: 'Luxembourg', flag: '🇱🇺' },
  { code: '+212', label: 'Maroc', flag: '🇲🇦' },
  { code: '+213', label: 'Algérie', flag: '🇩🇿' },
  { code: '+216', label: 'Tunisie', flag: '🇹🇳' },
  { code: '+221', label: 'Sénégal', flag: '🇸🇳' },
  { code: '+223', label: 'Mali', flag: '🇲🇱' },
  { code: '+225', label: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: '+226', label: 'Burkina Faso', flag: '🇧🇫' },
  { code: '+227', label: 'Niger', flag: '🇳🇪' },
  { code: '+228', label: 'Togo', flag: '🇹🇬' },
  { code: '+229', label: 'Bénin', flag: '🇧🇯' },
  { code: '+230', label: 'Maurice', flag: '🇲🇺' },
  { code: '+237', label: 'Cameroun', flag: '🇨🇲' },
  { code: '+243', label: 'RD Congo', flag: '🇨🇩' },
  { code: '+961', label: 'Liban', flag: '🇱🇧' },
  { code: '+962', label: 'Jordanie', flag: '🇯🇴' },
  { code: '+971', label: 'Émirats arabes unis', flag: '🇦🇪' },
  { code: '+966', label: 'Arabie saoudite', flag: '🇸🇦' },
  { code: '+974', label: 'Qatar', flag: '🇶🇦' },
  { code: '+20', label: 'Égypte', flag: '🇪🇬' },
  { code: '+218', label: 'Libye', flag: '🇱🇾' },
  { code: '+249', label: 'Soudan', flag: '🇸🇩' },
  { code: '+44', label: 'Royaume-Uni', flag: '🇬🇧' },
  { code: '+1', label: 'États-Unis / Canada', flag: '🇺🇸' },
  { code: '+34', label: 'Espagne', flag: '🇪🇸' },
  { code: '+39', label: 'Italie', flag: '🇮🇹' },
  { code: '+49', label: 'Allemagne', flag: '🇩🇪' },
  { code: '+31', label: 'Pays-Bas', flag: '🇳🇱' },
  { code: '+351', label: 'Portugal', flag: '🇵🇹' },
  { code: '+90', label: 'Turquie', flag: '🇹🇷' },
  { code: '+92', label: 'Pakistan', flag: '🇵🇰' },
  { code: '+880', label: 'Bangladesh', flag: '🇧🇩' },
  { code: '+62', label: 'Indonésie', flag: '🇮🇩' },
  { code: '+60', label: 'Malaisie', flag: '🇲🇾' },
];

export default function Register() {
  const { signIn } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ firstName: '', age: '', city: null, situation: null, email: '', phoneCountry: '+33', phone: '', terms: false, health: false, marketing: false });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const age = Number(form.age);

  const emailValue = form.email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailValue);
  const phoneDigits = form.phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 6;

  const valid = {
    prenom: form.firstName.trim().length > 0,
    age: Number.isInteger(age) && age >= 15 && age <= 100,
    ville: Boolean(form.city),
    situation: Boolean(form.situation),
    contact: emailValid && phoneValid,
    consentements: form.terms,
    code: code.length === 6,
  }[STEPS[step]];

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/auth/otp', { identifier: emailValue, purpose: 'register' });
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
        identifier: emailValue,
        code: value,
        phone: `${form.phoneCountry}${phoneDigits}`,
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
        <T variant="h2">Tes coordonnées</T>
        <T variant="muted">Nous t’envoyons un code par e-mail pour vérifier ton compte. Ton numéro de téléphone est aussi demandé, mais il ne reçoit aucun code.</T>
        <Field value={form.email} onChangeText={set('email')} placeholder="amina@exemple.fr" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" icon="mail" label="Adresse e-mail" returnKeyType="next" />
        <View>
          <T variant="fieldLabel" style={{ marginBottom: 6 }}>Numéro de téléphone</T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => setShowCountryPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`Indicatif téléphonique, actuellement ${form.phoneCountry}`}
              style={{
                minHeight: 54,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: colors.line,
                backgroundColor: colors.white,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                gap: 6,
              }}
            >
              <T>{COUNTRY_CODES.find((c) => c.code === form.phoneCountry)?.flag || '🇫🇷'}</T>
              <T variant="medium">{form.phoneCountry}</T>
              <Icon name="chevronDown" size={16} color={colors.muted} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Field value={form.phone} onChangeText={(v) => set('phone')(v.replace(/\D/g, '').slice(0, 15))} placeholder="6 12 34 56 78" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
            </View>
          </View>
        </View>
        <T variant="small">Indicatif par défaut : France (+33). Tous les indicatifs sont disponibles.</T>
        <Modal visible={showCountryPicker} transparent animationType="fade" onRequestClose={() => setShowCountryPicker(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }} onPress={() => setShowCountryPicker(false)}>
            <View style={{ backgroundColor: colors.white, borderRadius: 24, maxHeight: 420, overflow: 'hidden' }}>
              <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                <T variant="h3">Choisis l’indicatif</T>
              </View>
              <ScrollView style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                {COUNTRY_CODES.map((c) => (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      set('phoneCountry')(c.code);
                      setShowCountryPicker(false);
                    }}
                    accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}
                  >
                    <T style={{ fontSize: 24 }}>{c.flag}</T>
                    <View style={{ flex: 1 }}>
                      <T variant="medium">{c.label}</T>
                      <T variant="small">{c.code}</T>
                    </View>
                    {form.phoneCountry === c.code ? <Icon name="check" size={20} color={colors.bordeaux} /> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
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

// 4.4 — Inscription, une question par écran : 3.2 prénom, 3.3 âge (roue 15–60), 3.4 ville, 3.5 situation,
// 3.6 e-mail + mot de passe, 3.7 téléphone (indicatif FR par défaut), 3.8 accords (non cochés), puis le code envoyé
// par e-mail crée le compte. Le numéro est obligatoire mais ne reçoit aucun SMS (choix de Nissali). Si l'appli est
// fermée en route, on reprend au dernier écran rempli (le mot de passe n'est jamais gardé sur le téléphone).
// Avec Apple ou Google (3.1) : pas d'écran mot de passe ni de code ; si Apple donne une adresse relais,
// l'écran « Ton e-mail de contact » remplace « Ton e-mail et ton mot de passe » (RG-02).
// La suite du questionnaire (3.9 à 3.13) est dans accueil.jsx.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CityPicker } from '../components/forms';
import { ChoiceCard, NumberWheel, SignupShell } from '../components/Signup';
import { Checkbox, CodeInput, Field, Icon, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { getPendingSocial, setPendingSocial } from '../lib/social';
import { readJson, writeJson } from '../lib/storage';
import { colors, fonts } from '../theme';

import { tr } from '../lib/i18n';
const BASE_STEPS = ['prenom', 'age', 'ville', 'situation', 'compte', 'telephone', 'accords', 'code'];
const SAVED = 'nissali.signup';

// Tous les indicatifs téléphoniques courants ; France sélectionnée par défaut.
const COUNTRY_CODES = [
  { code: '+33', label: tr("France"), flag: '🇫🇷' },
  { code: '+32', label: tr("Belgique"), flag: '🇧🇪' },
  { code: '+41', label: tr("Suisse"), flag: '🇨🇭' },
  { code: '+352', label: tr("Luxembourg"), flag: '🇱🇺' },
  { code: '+212', label: tr("Maroc"), flag: '🇲🇦' },
  { code: '+213', label: tr("Algérie"), flag: '🇩🇿' },
  { code: '+216', label: tr("Tunisie"), flag: '🇹🇳' },
  { code: '+221', label: tr("Sénégal"), flag: '🇸🇳' },
  { code: '+223', label: tr("Mali"), flag: '🇲🇱' },
  { code: '+225', label: tr("Côte d'Ivoire"), flag: '🇨🇮' },
  { code: '+226', label: tr("Burkina Faso"), flag: '🇧🇫' },
  { code: '+227', label: tr("Niger"), flag: '🇳🇪' },
  { code: '+228', label: tr("Togo"), flag: '🇹🇬' },
  { code: '+229', label: tr("Bénin"), flag: '🇧🇯' },
  { code: '+230', label: tr("Maurice"), flag: '🇲🇺' },
  { code: '+237', label: tr("Cameroun"), flag: '🇨🇲' },
  { code: '+243', label: tr("RD Congo"), flag: '🇨🇩' },
  { code: '+961', label: tr("Liban"), flag: '🇱🇧' },
  { code: '+962', label: tr("Jordanie"), flag: '🇯🇴' },
  { code: '+971', label: tr("Émirats arabes unis"), flag: '🇦🇪' },
  { code: '+966', label: tr("Arabie saoudite"), flag: '🇸🇦' },
  { code: '+974', label: tr("Qatar"), flag: '🇶🇦' },
  { code: '+20', label: tr("Égypte"), flag: '🇪🇬' },
  { code: '+218', label: tr("Libye"), flag: '🇱🇾' },
  { code: '+249', label: tr("Soudan"), flag: '🇸🇩' },
  { code: '+44', label: tr("Royaume-Uni"), flag: '🇬🇧' },
  { code: '+1', label: tr("États-Unis / Canada"), flag: '🇺🇸' },
  { code: '+34', label: tr("Espagne"), flag: '🇪🇸' },
  { code: '+39', label: tr("Italie"), flag: '🇮🇹' },
  { code: '+49', label: tr("Allemagne"), flag: '🇩🇪' },
  { code: '+31', label: tr("Pays-Bas"), flag: '🇳🇱' },
  { code: '+351', label: tr("Portugal"), flag: '🇵🇹' },
  { code: '+90', label: tr("Turquie"), flag: '🇹🇷' },
  { code: '+92', label: tr("Pakistan"), flag: '🇵🇰' },
  { code: '+880', label: tr("Bangladesh"), flag: '🇧🇩' },
  { code: '+62', label: tr("Indonésie"), flag: '🇮🇩' },
  { code: '+60', label: tr("Malaisie"), flag: '🇲🇾' },
];

const capitalize = (v) => v.replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

export default function Register() {
  const { signIn } = useAuth();
  const [social] = useState(() => getPendingSocial());
  const STEPS = social ? ['prenom', 'age', 'ville', 'situation', ...(social.relay || !social.email ? ['contact'] : []), 'telephone', 'accords'] : BASE_STEPS;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ firstName: '', age: 25, city: null, situation: null, email: '', phoneCountry: '+33', phone: '', terms: false, health: false, marketing: false });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(null);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Reprise au dernier écran rempli (le mot de passe est redemandé).
  useEffect(() => {
    readJson(SAVED, null)
      .then((saved) => {
        if (saved?.form) {
          setForm((f) => ({ ...f, ...saved.form }));
          setStep(Math.min(saved.step || 0, social ? STEPS.length - 1 : STEPS.indexOf('compte')));
        }
        // Prénom donné par Apple ou Google : pré-remplit l'écran 3.2.
        if (social?.firstName) setForm((f) => (f.firstName ? f : { ...f, firstName: social.firstName.slice(0, 30) }));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (loaded) writeJson(SAVED, { step, form }).catch(() => {});
  }, [loaded, step, form]);

  const emailValue = form.email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailValue);
  const phoneDigits = form.phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 6;
  const name = form.firstName.trim();

  const valid = {
    prenom: name.length >= 2 && name.length <= 30,
    age: form.age >= 15 && form.age <= 60,
    ville: Boolean(form.city),
    situation: Boolean(form.situation),
    compte: emailValid && password.length >= 8 && !exists,
    contact: emailValid && !exists,
    telephone: phoneValid,
    accords: form.terms && form.health,
    code: code.length === 6,
  }[STEPS[step]];

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/auth/otp', { identifier: emailValue, purpose: 'register' });
      setSent(r);
      setCode('');
      setStep(STEPS.indexOf('code'));
    } catch (e) {
      if (e.code === 'ACCOUNT_EXISTS') {
        setExists(true);
        setStep(STEPS.indexOf('compte'));
      }
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const register = async (value = code) => {
    if (!social && password.length < 8) {
      setStep(STEPS.indexOf('compte'));
      return setError(tr("Choisis ton mot de passe (8 caractères minimum)"));
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/auth/register', {
        ...(social
          ? { identifier: social.email && !social.relay ? social.email : emailValue, social: { provider: social.provider, idToken: social.idToken } }
          : { identifier: emailValue, code: value, password }),
        phone: `${form.phoneCountry}${phoneDigits}`,
        firstName: name,
        age: form.age,
        city: form.city,
        situation: form.situation,
        consents: { terms: true, health: form.health, marketingEmail: form.marketing, marketingSms: form.marketing, marketingWhatsapp: form.marketing },
      });
      await writeJson(SAVED, null).catch(() => {});
      setPendingSocial(null);
      await signIn(r);
      router.replace('/accueil');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const checkEmail = async () => {
    setBusy(true);
    try {
      const r = await api.post('/auth/exists', { identifier: emailValue });
      if (r.exists) {
        setExists(true);
        return;
      }
      setStep((x) => x + 1);
    } catch {
      setStep((x) => x + 1); // la vérification sera refaite à l'envoi du code
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    setError(null);
    const k = STEPS[step];
    if (k === 'compte' || k === 'contact') return checkEmail();
    if (k === 'accords') return social ? register() : sendCode();
    if (k === 'code') return register();
    setStep((x) => x + 1);
  };
  const back = () => {
    setError(null);
    if (step === 0) return router.canGoBack() ? router.back() : router.replace('/bienvenue');
    setStep((x) => x - 1);
  };

  const k = STEPS[step];
  const accountSteps = STEPS.filter((x) => !['accords', 'code'].includes(x));
  const privacySteps = STEPS.filter((x) => ['accords', 'code'].includes(x));
  const pos = accountSteps.includes(k) ? { index: accountSteps.indexOf(k) + 1, count: accountSteps.length } : { index: privacySteps.indexOf(k) + 1, count: privacySteps.length };
  const meta = {
    prenom: { section: tr("Ton compte"), ...pos, title: tr("Comment t’appelles-tu ?"), subtitle: tr("Ton prénom, pour que l’appli te parle à toi.") },
    age: { section: tr("Ton compte"), ...pos, title: tr("Quel âge as-tu ?"), subtitle: tr("Nissali est accessible à partir de 15 ans. On garde une année de naissance estimée.") },
    ville: { section: tr("Ton compte"), ...pos, title: tr("Où vis-tu ?"), subtitle: tr("Ta ville sert à tes horaires de prière et à la qibla.") },
    situation: { section: tr("Ton compte"), ...pos, title: tr("Ta situation"), subtitle: tr("Elle adapte les contenus de l’appli. Tu pourras la changer dans ton profil.") },
    compte: { section: tr("Ton compte"), ...pos, title: tr("Ton e-mail et ton mot de passe") },
    contact: { section: tr("Ton compte"), ...pos, title: tr("Ton e-mail de contact"), subtitle: tr("Apple a masqué ton adresse. Indique celle où l’on peut t’écrire (sauvegarde, nouveautés si tu l’acceptes).") },
    telephone: { section: tr("Ton compte"), ...pos, title: tr("Ton numéro de téléphone"), subtitle: tr("Obligatoire. Il est enregistré sur ton compte : aucun SMS ne t’est envoyé.") },
    accords: { section: tr("Ta confidentialité"), ...pos, title: tr("Tes accords"), subtitle: tr("Rien n’est coché pour toi. Tu pourras changer d’avis à tout moment dans ton profil.") },
    code: { section: tr("Ta confidentialité"), ...pos, title: tr("Vérifie ton e-mail") },
  }[k];

  const content = {
    prenom: <Field value={form.firstName} onChangeText={(v) => set('firstName')(capitalize(v.slice(0, 30)))} placeholder={tr("Ton prénom")} autoFocus autoCapitalize="words" autoComplete="given-name" textContentType="givenName" returnKeyType="next" onSubmitEditing={() => valid && next()} hint={name.length === 1 ? tr("Au moins 2 lettres") : null} />,
    age: <NumberWheel min={15} max={60} value={form.age} onChange={set('age')} suffix=" ans" />,
    ville: <CityPicker value={form.city} onChange={set('city')} />,
    situation: (
      <>
        <ChoiceCard title={tr("Mariée")} text={tr("Objectifs fertilité et grossesse proposés")} icon="heart" selected={form.situation === 'mariee'} onPress={() => set('situation')('mariee')} />
        <ChoiceCard title={tr("Célibataire")} text={tr("Suivi du cycle, prières, jeûnes")} icon="user" selected={form.situation === 'celibataire'} onPress={() => set('situation')('celibataire')} />
      </>
    ),
    compte: (
      <>
        <Field label={tr("Adresse e-mail")} value={form.email} onChangeText={(v) => { setExists(false); set('email')(v); }} placeholder="amina@exemple.fr" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" icon="mail" error={form.email && !emailValid ? 'Vérifie le format de ton adresse' : null} />
        {exists ? (
          <Pressable onPress={() => router.replace('/connexion')} accessibilityRole="link" style={s.exists}>
            <Icon name="info" size={17} color={colors.bordeaux} />
            <Text style={s.existsText}>{tr("Ce compte existe déjà, te connecter ?")}</Text>
            <Icon name="chevronRight" size={15} color={colors.bordeaux} />
          </Pressable>
        ) : null}
        <View style={{ gap: 6 }}>
          <T variant="fieldLabel">{tr("Mot de passe")}</T>
          <View style={s.pwd}>
            <Icon name="lock" size={18} color={colors.muted} />
            <TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholder={tr("8 caractères minimum")} placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" style={s.pwdInput} accessibilityLabel={tr("Mot de passe")} />
            <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={showPassword ? tr("Masquer le mot de passe") : tr("Afficher le mot de passe")} hitSlop={10}>
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={[s.hint, password && password.length < 8 && { color: colors.danger }]}>{password.length >= 8 ? tr("✓ Mot de passe valide") : tr("8 caractères minimum{0}", [password ? ` (${password.length}/8)` : ''])}</Text>
        </View>
      </>
    ),
    contact: (
      <>
        <Field label={tr("Adresse e-mail")} value={form.email} onChangeText={(v) => { setExists(false); set('email')(v); }} placeholder="amina@exemple.fr" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" icon="mail" autoFocus error={form.email && !emailValid ? 'Vérifie le format de ton adresse' : null} />
        {exists ? (
          <Pressable onPress={() => router.replace('/connexion')} accessibilityRole="link" style={s.exists}>
            <Icon name="info" size={17} color={colors.bordeaux} />
            <Text style={s.existsText}>{tr("Ce compte existe déjà, te connecter ?")}</Text>
            <Icon name="chevronRight" size={15} color={colors.bordeaux} />
          </Pressable>
        ) : null}
      </>
    ),
    telephone: (
      <>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => setShowCountryPicker(true)} accessibilityRole="button" accessibilityLabel={tr("Indicatif téléphonique, actuellement {0}", [form.phoneCountry])} style={s.country}>
            <T>{COUNTRY_CODES.find((c) => c.code === form.phoneCountry)?.flag || '🇫🇷'}</T>
            <T variant="medium">{form.phoneCountry}</T>
            <Icon name="chevronDown" size={16} color={colors.muted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Field value={form.phone} onChangeText={(v) => set('phone')(v.replace(/\D/g, '').slice(0, 15))} placeholder="6 12 34 56 78" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" autoFocus />
          </View>
        </View>
        <Modal visible={showCountryPicker} transparent animationType="fade" onRequestClose={() => setShowCountryPicker(false)}>
          <Pressable style={s.modalBg} onPress={() => setShowCountryPicker(false)}>
            <View style={s.modal}>
              <View style={s.modalHead}>
                <T variant="h3">{tr("Choisis l’indicatif")}</T>
              </View>
              <ScrollView style={{ paddingHorizontal: 20 }}>
                {COUNTRY_CODES.map((c) => (
                  <Pressable key={c.code} onPress={() => { set('phoneCountry')(c.code); setShowCountryPicker(false); }} accessibilityRole="button" style={s.countryRow}>
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
    accords: (
      <>
        <Checkbox checked={form.terms} onChange={set('terms')}>
          <T>
            {tr("J’accepte les")} <T color={colors.bordeaux} onPress={() => router.push('/legal?doc=cgu')}>{tr("conditions d’utilisation")}</T> {tr("et la")} <T color={colors.bordeaux} onPress={() => router.push('/legal?doc=confidentialite')}>{tr("politique de confidentialité")}</T>. <T variant="small">{tr("(obligatoire)")}</T>
          </T>
        </Checkbox>
        <Checkbox checked={form.health} onChange={set('health')}>
          <T>{tr("J’accepte que Nissali traite mes données de santé (cycle, grossesse, symptômes) pour mon suivi. Elles sont chiffrées, jamais vendues ni partagées.")} <T variant="small">{tr("(obligatoire)")}</T></T>
        </Checkbox>
        <Checkbox checked={form.marketing} onChange={set('marketing')}>
          <T>{tr("J’accepte de recevoir les actualités et offres de Nissali par e-mail, SMS et WhatsApp.")} <T variant="small">{tr("(facultatif)")}</T></T>
        </Checkbox>
      </>
    ),
    code: (
      <>
        <T variant="muted">
          {tr("Code à 6 chiffres envoyé à")} <T variant="bold">{sent?.target}</T>{tr(". Pense à regarder dans tes courriers indésirables.")}
        </T>
        <CodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (v.length === 6) register(v);
          }}
        />
        <Pressable onPress={sendCode} disabled={busy} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
          <Text style={s.link}>{tr("Renvoyer un code")}</Text>
        </Pressable>
      </>
    ),
  }[k];

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.ivoire }} />;
  return (
    <SignupShell
      {...meta}
      onBack={back}
      onNext={next}
      nextLabel={k === 'accords' ? (social ? tr("Créer mon compte") : tr("Recevoir mon code")) : k === 'code' ? tr("Créer mon compte") : tr("Continuer")}
      canNext={valid}
      busy={busy}
      error={error}
    >
      {content}
    </SignupShell>
  );
}

const s = StyleSheet.create({
  exists: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.blush, borderRadius: 14, padding: 12 },
  existsText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux },
  pwd: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 18 },
  pwdInput: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.prune, paddingVertical: 12 },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, paddingHorizontal: 6 },
  country: { minHeight: 54, borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 6 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  modalBg: { flex: 1, backgroundColor: colors.veil, justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: colors.white, borderRadius: 24, maxHeight: 440, overflow: 'hidden' },
  modalHead: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.bordeaux },
});

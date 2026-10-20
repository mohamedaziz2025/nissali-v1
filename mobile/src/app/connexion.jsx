// Connexion : par code reçu par e-mail ou par mot de passe, avec « mot de passe oublié ».
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, CodeInput, Field, Gap, Icon, Screen, Segmented, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors } from '../theme';

export default function Login() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState('code'); // code | password | forgot
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
      if (e.code === 'NO_PASSWORD') setMode('code');
    } finally {
      setBusy(false);
    }
  };
  const done = async (r) => {
    await signIn(r);
    router.replace('/');
  };

  const sendCode = () =>
    run(async () => {
      const r = await api.post(mode === 'forgot' ? '/auth/password/forgot' : '/auth/otp', mode === 'forgot' ? { identifier } : { identifier, purpose: 'login' });
      setSent(r);
      setCode('');
    });
  const verifyCode = (value = code) => run(async () => done(await api.post('/auth/login', { identifier, code: value })));
  const loginPassword = () => run(async () => done(await api.post('/auth/password/login', { identifier, password })));
  const resetPassword = () => run(async () => done(await api.post('/auth/password/reset', { identifier, code, password: newPassword })));

  const switchMode = (m) => {
    setMode(m);
    setSent(null);
    setError(null);
  };

  const identifierField = (
    <Field
      label="Adresse e-mail"
      value={identifier}
      onChangeText={setIdentifier}
      placeholder="amina@exemple.fr"
      autoCapitalize="none"
      autoComplete="email"
      textContentType="emailAddress"
      keyboardType="email-address"
      icon="mail"
    />
  );

  return (
    <Screen back title={mode === 'forgot' ? 'Mot de passe oublié' : 'Connexion'}>
      <View style={{ gap: 16 }}>
        {mode !== 'forgot' ? (
          <Segmented
            items={[
              { key: 'code', label: 'Code' },
              { key: 'password', label: 'Mot de passe' },
            ]}
            value={mode}
            onChange={switchMode}
          />
        ) : null}

        {mode === 'password' ? (
          <>
            {identifierField}
            <Field
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              textContentType="password"
              icon="lock"
              returnKeyType="go"
              onSubmitEditing={loginPassword}
              right={
                <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} hitSlop={8}>
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={22} color={colors.muted} />
                </Pressable>
              }
            />
            {error ? <T color={colors.danger}>{error}</T> : null}
            <Button title="Me connecter" onPress={loginPassword} loading={busy} disabled={identifier.trim().length < 4 || !password} />
            <Button title="Mot de passe oublié ?" variant="ghost" onPress={() => switchMode('forgot')} />
          </>
        ) : !sent ? (
          <>
            <T variant="muted">
              {mode === 'forgot' ? 'Saisis ton adresse e-mail : nous t’envoyons un code pour choisir un nouveau mot de passe.' : 'Saisis ton adresse e-mail : nous t’envoyons un code à 6 chiffres.'}
            </T>
            {identifierField}
            {error ? <T color={colors.danger}>{error}</T> : null}
            <Button title="Recevoir mon code" onPress={sendCode} loading={busy} disabled={identifier.trim().length < 4} />
            {mode === 'forgot' ? <Button title="Retour à la connexion" variant="ghost" onPress={() => switchMode('password')} /> : <Button title="Créer un compte" variant="ghost" onPress={() => router.replace('/inscription')} />}
          </>
        ) : (
          <>
            <T variant="muted">
              Code envoyé par e-mail à <T variant="bold">{sent.target}</T>. Pense à regarder dans tes courriers indésirables.
            </T>
            <CodeInput
              value={code}
              onChange={(v) => {
                setCode(v);
                if (v.length === 6 && mode === 'code') verifyCode(v);
              }}
            />
            {mode === 'forgot' ? (
              <Field
                label="Nouveau mot de passe"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                icon="lock"
                hint="8 caractères minimum"
                right={
                  <Pressable onPress={() => setShowNewPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} hitSlop={8}>
                    <Icon name={showNewPassword ? 'eyeOff' : 'eye'} size={22} color={colors.muted} />
                  </Pressable>
                }
              />
            ) : null}
            {error ? <T color={colors.danger} style={{ textAlign: 'center' }}>{error}</T> : null}
            {mode === 'forgot' ? (
              <Button title="Enregistrer et me connecter" onPress={resetPassword} loading={busy} disabled={code.length !== 6 || newPassword.length < 8} />
            ) : (
              <Button title="Me connecter" onPress={() => verifyCode()} loading={busy} disabled={code.length !== 6} />
            )}
            <Button title="Renvoyer un code" variant="ghost" onPress={sendCode} disabled={busy} />
            <Button title="Changer d’adresse e-mail" variant="ghost" onPress={() => setSent(null)} />
          </>
        )}
        <Gap h={4} />
      </View>
    </Screen>
  );
}

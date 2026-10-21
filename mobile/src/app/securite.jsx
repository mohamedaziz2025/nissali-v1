// Connexion et sécurité : garder la connexion par code, ou créer / changer / supprimer un mot de passe.
// Proposé une fois juste après l'inscription (?bienvenue=1), puis accessible depuis le profil.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, Gap, Label, Screen, T, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors } from '../theme';

import { tr } from '../lib/i18n';
export default function Security() {
  const { bienvenue } = useLocalSearchParams();
  const welcome = bienvenue === '1';
  const { user, setSession } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const hasPassword = Boolean(user?.hasPassword);
  const next = () => router.replace('/');

  const save = async () => {
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas');
    setBusy(true);
    setError(null);
    try {
      await setSession(await api.put('/me/password', { password, ...(hasPassword ? { currentPassword: current } : {}) }));
      toast(hasPassword ? tr("Mot de passe changé") : tr("Mot de passe créé"));
      setEditing(false);
      setCurrent('');
      setPassword('');
      setConfirm('');
      if (welcome) next();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await setSession(await api.delete_('/me/password', { currentPassword: current }));
      toast(tr("Connexion par code uniquement"));
      setEditing(false);
      setCurrent('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back={!welcome} title={welcome ? tr("Ta connexion") : tr("Connexion et sécurité")}>
      <View style={{ gap: 16 }}>
        {welcome ? <T variant="muted">{tr("Ton compte est créé. Comment préfères-tu te connecter la prochaine fois ?")}</T> : null}
        <Card style={{ gap: 6 }}>
          <Label>{tr("Connexion par code")}</Label>
          <T>{tr("Toujours disponible : un code à 6 chiffres envoyé à")} {user?.email || user?.phone}{tr(". Rien à retenir.")}</T>
        </Card>
        <Card style={{ gap: 10 }}>
          <Label>{tr("Mot de passe")}</Label>
          <T>{hasPassword ? tr("Tu peux aussi te connecter avec ton mot de passe.") : tr("Facultatif : pour te connecter sans attendre de code.")}</T>
          {editing || welcome ? (
            <>
              {hasPassword ? <Field label={tr("Mot de passe actuel")} value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" /> : null}
              <Field label={hasPassword ? tr("Nouveau mot de passe") : tr("Mot de passe")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={tr("8 caractères minimum")} />
              <Field label={tr("Confirmation")} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
              {error ? <T color={colors.danger}>{error}</T> : null}
              <Button title={hasPassword ? tr("Changer mon mot de passe") : tr("Créer mon mot de passe")} onPress={save} loading={busy} disabled={password.length < 8 || !confirm || (hasPassword && !current)} />
              {hasPassword && !welcome ? <Button title={tr("Supprimer le mot de passe (code uniquement)")} variant="danger" small onPress={remove} disabled={!current || busy} /> : null}
            </>
          ) : (
            <Button title={hasPassword ? tr("Changer ou supprimer mon mot de passe") : tr("Créer un mot de passe")} variant="outline" onPress={() => setEditing(true)} />
          )}
        </Card>
        {welcome ? (
          <>
            <Gap h={4} />
            <Button title={tr("Garder la connexion par code")} variant="ghost" onPress={next} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

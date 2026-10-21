// Compléter le profil personnel (compte créé depuis l'espace pro).
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CityPicker } from '../components/forms';
import { Button, Chips, Field, Screen, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors } from '../theme';

import { tr } from '../lib/i18n';
export default function CompleteProfile() {
  const { user, setSession } = useAuth();
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [city, setCity] = useState(user?.city || null);
  const [situation, setSituation] = useState(user?.situation || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const n = Number(age);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.patch('/me', { age: n, city, situation, lastSpace: 'personnel' });
      await setSession(r);
      router.replace('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={tr("Ton espace personnel")} subtitle={tr("Salam, {0}", [user?.firstName || ''])}>
      <View style={{ gap: 18 }}>
        <T variant="muted">{tr("Quelques informations pour activer ton suivi personnel (cycle, prières, jeûnes).")}</T>
        <Field label={tr("Âge")} value={age} onChangeText={(v) => setAge(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" error={age && n < 15 ? 'Nissali est accessible à partir de 15 ans.' : null} />
        <CityPicker value={city} onChange={setCity} />
        <View style={{ gap: 8 }}>
          <T variant="fieldLabel">{tr("Situation")}</T>
          <Chips items={[{ key: 'celibataire', label: tr("Célibataire") }, { key: 'mariee', label: tr("Mariée") }]} value={situation} onChange={setSituation} />
        </View>
        {error ? <T color={colors.danger}>{error}</T> : null}
        <Button title={tr("Continuer")} onPress={save} loading={busy} disabled={!(n >= 15 && city && situation)} />
      </View>
    </Screen>
  );
}

// RG-04 : consentement explicite au traitement des données de santé, requis pour le suivi.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Checkbox, Screen, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

import { tr } from '../lib/i18n';
export default function HealthConsent() {
  const { setSession, signOut, practitioner, switchSpace } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    try {
      await setSession(await api.patch('/me/consents', { health: true }));
      router.replace('/');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title={tr("Tes données de santé")}>
      <View style={{ gap: 18 }}>
        <T>{tr("Pour suivre ton cycle, ta grossesse et ta santé, Nissali a besoin de ton accord explicite.")}</T>
        <Card tone="soft" style={{ gap: 10 }}>
          <T>{tr("• Tes données de santé ne sont jamais vendues, jamais partagées, jamais utilisées pour la publicité.")}</T>
          <T>{tr("• Elles sont chiffrées pendant le transfert et hébergées dans l’Union européenne.")}</T>
          <T>{tr("• Tu peux les exporter ou les supprimer à tout moment depuis ton profil.")}</T>
        </Card>
        <Checkbox checked={checked} onChange={setChecked}>
          {tr("J’accepte que Nissali traite mes données de santé pour mon suivi.")}
        </Checkbox>
        <Button title={tr("Continuer")} onPress={accept} disabled={!checked} loading={busy} />
        {practitioner ? <Button title={tr("Aller à mon espace pro")} variant="outline" onPress={() => switchSpace('pro')} /> : null}
        <Button title={tr("Me déconnecter")} variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}

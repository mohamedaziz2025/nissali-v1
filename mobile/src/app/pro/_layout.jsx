import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import TabBar from '../../components/TabBar';
import { useAuth } from '../../lib/auth';

import { tr } from '../../lib/i18n';
const ICONS = { index: 'home', reservations: 'calendar', messages: 'mail', clientes: 'users', profil: 'user' };

export default function ProLayout() {
  const { status, practitioner } = useAuth();
  if (status === 'anon') return <Redirect href="/bienvenue" />;
  if (status === 'ready' && !practitioner) return <Redirect href="/devenir-praticienne" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} icons={ICONS} />}>
      <Tabs.Screen name="index" options={{ title: tr("Accueil") }} />
      <Tabs.Screen name="reservations" options={{ title: tr("Rendez-vous") }} />
      <Tabs.Screen name="messages" options={{ title: tr("Messages") }} />
      <Tabs.Screen name="clientes" options={{ title: tr("Clientes") }} />
      <Tabs.Screen name="profil" options={{ title: tr("Profil") }} />
      <Tabs.Screen name="disponibilites" options={{ title: tr("Disponibilités"), href: null }} />
      <Tabs.Screen name="prestations" options={{ title: tr("Prestations"), href: null }} />
    </Tabs>
  );
}

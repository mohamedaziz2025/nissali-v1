import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import TabBar from '../../components/TabBar';
import { useAuth } from '../../lib/auth';

const ICONS = { index: 'home', reservations: 'calendar', messages: 'mail', clientes: 'users', profil: 'user' };

export default function ProLayout() {
  const { status, practitioner } = useAuth();
  if (status === 'anon') return <Redirect href="/bienvenue" />;
  if (status === 'ready' && !practitioner) return <Redirect href="/pro-inscription" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} icons={ICONS} />}>
      <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
      <Tabs.Screen name="reservations" options={{ title: 'Rendez-vous' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="clientes" options={{ title: 'Clientes' }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
      <Tabs.Screen name="disponibilites" options={{ title: 'Disponibilités', href: null }} />
      <Tabs.Screen name="prestations" options={{ title: 'Prestations', href: null }} />
    </Tabs>
  );
}

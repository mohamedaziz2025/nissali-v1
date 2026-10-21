import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import TabBar from '../../components/TabBar';
import { useAuth } from '../../lib/auth';

import { tr } from '../../lib/i18n';
const ICONS = { index: 'home', cycle: 'cycle', jeunes: 'fasts', praticiennes: 'practitioners', lifestyle: 'star' };

export default function TabsLayout() {
  const { status } = useAuth();
  if (status === 'anon') return <Redirect href="/bienvenue" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} icons={ICONS} />}>
      <Tabs.Screen name="index" options={{ title: tr("Aujourd’hui") }} />
      <Tabs.Screen name="cycle" options={{ title: tr("Cycle") }} />
      <Tabs.Screen name="jeunes" options={{ title: tr("Jeûnes") }} />
      <Tabs.Screen name="praticiennes" options={{ title: tr("Praticiennes") }} />
      <Tabs.Screen name="lifestyle" options={{ title: tr("Lifestyle") }} />
    </Tabs>
  );
}

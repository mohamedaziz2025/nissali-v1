import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import TabBar from '../../components/TabBar';
import { useAuth } from '../../lib/auth';

const ICONS = { index: 'home', cycle: 'cycle', jeunes: 'fasts', praticiennes: 'practitioners', lifestyle: 'star' };

export default function TabsLayout() {
  const { status } = useAuth();
  if (status === 'anon') return <Redirect href="/bienvenue" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} icons={ICONS} />}>
      <Tabs.Screen name="index" options={{ title: 'Aujourd’hui' }} />
      <Tabs.Screen name="cycle" options={{ title: 'Cycle' }} />
      <Tabs.Screen name="jeunes" options={{ title: 'Jeûnes' }} />
      <Tabs.Screen name="praticiennes" options={{ title: 'Praticiennes' }} />
      <Tabs.Screen name="lifestyle" options={{ title: 'Lifestyle' }} />
    </Tabs>
  );
}

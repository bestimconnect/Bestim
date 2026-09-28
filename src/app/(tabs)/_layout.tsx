import { Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="vehicles" />
      <Tabs.Screen name="capture" />
      <Tabs.Screen name="reminders" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}

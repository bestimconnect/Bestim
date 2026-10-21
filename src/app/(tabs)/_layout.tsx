import { Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';

// Tabs cross-fade (decisions Q108); Expenses is built at launch so its first visit shows a finished page.
export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="vehicles" />
      <Tabs.Screen name="expenses" options={{ lazy: false }} />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}

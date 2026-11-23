import { Tabs } from 'expo-router';

import { Tour } from '@/components/Tour';
import { TabBar } from '@/components/TabBar';

// v2 (Q133): four tabs: Home, Timeline, Money (file: expenses), Garage (the Cars list). Account is a pushed page.
// Tabs slide-and-fade (decisions Q108); Money is built at launch so its first visit shows a finished page.
export default function TabsLayout() {
  return (
    <>
      <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, animation: 'shift' }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="timeline" />
        <Tabs.Screen name="expenses" options={{ lazy: false }} />
        <Tabs.Screen name="garage" />
      </Tabs>
      <Tour />
    </>
  );
}

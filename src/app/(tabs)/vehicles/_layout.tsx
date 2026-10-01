import { Stack } from 'expo-router';

// 08 list → 09 detail keep the tab bar, so they share a stack inside the Vehicles tab.
export default function VehiclesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

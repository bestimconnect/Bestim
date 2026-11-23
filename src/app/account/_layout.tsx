import { Stack } from 'expo-router';

// Account / Menu (v2, Q133): no longer a tab; opened from the avatar on Home and pushed over the tabs.
export default function AccountLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

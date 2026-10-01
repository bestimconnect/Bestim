import { Stack } from 'expo-router';

// Account (Phase 5) → Expenses 23 keep the tab bar (design shows the Account tab active on 23).
export default function AccountLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

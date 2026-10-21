import { Stack } from 'expo-router';

// 08 My cars. The car page (09) is a root screen (app/vehicle/[id]) so it opens over the tabs from Home as well as from here.
export default function VehiclesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

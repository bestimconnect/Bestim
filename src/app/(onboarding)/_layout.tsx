import { Stack } from 'expo-router';

// The car is saved at the odometer step (Q87): after it there is no swiping back into the form.
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="save-car" options={{ gestureEnabled: false }} />
      <Stack.Screen name="first-log" options={{ gestureEnabled: false }} />
    </Stack>
  );
}

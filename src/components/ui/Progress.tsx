import { View } from 'react-native';

/** Shared step progress bar for the 3 add-vehicle onboarding screens. */
export function Progress({ step, total }: { step: number; total: number }) {
  return (
    <View className="h-1.5 flex-row items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <View key={n} className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-lime' : 'bg-line'}`} />
      ))}
    </View>
  );
}

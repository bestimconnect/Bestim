import { View } from 'react-native';

/** Progress bars for the green top bar: `step` of `total` filled in lime. Pass as the Header's `below` (belowH = 6). */
export function StepsBar({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <View className="flex-row gap-2" style={{ height: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-lime' : 'bg-[#FFFFFF33]'}`} />
      ))}
    </View>
  );
}

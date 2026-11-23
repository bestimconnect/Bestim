import { TextInput, View } from 'react-native';

import { Text } from '@/components/ui';

// Egyptian plate: Arabic letters (up to 3) and Arabic-Indic digits (up to 4). Saved as "أ ب ج ١٢٣٤" in vehicles.plate_number.
const INDIC = '٠١٢٣٤٥٦٧٨٩';
const toIndic = (s: string) => s.replace(/\d/g, (d) => INDIC[+d]);
const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(INDIC.indexOf(d)));

export const splitPlate = (plate?: string | null) => {
  const [letters = '', digits = ''] = (plate ?? '').trim().split(/\s+(?=[٠-٩0-9]+$)/);
  return { letters: letters.replace(/\s/g, ''), digits: toLatin(digits) };
};
export const joinPlate = (letters: string, digits: string) =>
  letters || digits ? `${letters.split('').join(' ')} ${toIndic(digits)}`.trim() : null;
/** Keeps only Arabic letters (max 3) / digits (max 4) while typing. */
export const cleanLetters = (v: string) => v.replace(/[^ء-ي]/g, '').slice(0, 3);
export const cleanDigits = (v: string) => toLatin(v).replace(/\D/g, '').slice(0, 4);

const font = { fontFamily: 'Tajawal_700Bold', textAlign: 'center' } as const;

/** The number tag: a pill with a small teal EG cap, then the letters and digits. `plate` is the saved text. */
export function PlateView({ plate, size = 'md' }: { plate?: string | null; size?: 'sm' | 'md' }) {
  if (!plate?.trim()) return null;
  const { letters, digits } = splitPlate(plate);
  const big = size === 'md';
  return (
    <View
      accessibilityLabel={plate}
      className="flex-row items-center self-start rounded-full border-[1.5px] border-line bg-white"
      style={{ direction: 'rtl', gap: big ? 8 : 5, paddingVertical: big ? 4 : 2, paddingStart: big ? 5 : 3, paddingEnd: big ? 14 : 9 }}>
      <View className="rounded-full" style={{ backgroundColor: '#08736F', paddingHorizontal: big ? 7 : 5, paddingVertical: big ? 4 : 3 }}>
        <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: big ? 9 : 7, lineHeight: big ? 12 : 9, color: '#FFFFFF' }}>EG</Text>
      </View>
      <Text style={{ ...font, fontSize: big ? 17 : 12, lineHeight: big ? 24 : 17, color: '#222E29' }}>
        {letters.split('').join(' ')} · {toIndic(digits)}
      </Text>
    </View>
  );
}

/** The same plate, editable: letters on the right, digits on the left (like the real one). */
export function PlateField({ letters, digits, onChange }: { letters: string; digits: string; onChange: (letters: string, digits: string) => void }) {
  const input = { ...font, fontSize: 28, height: 52, padding: 0, color: '#222E29' };
  return (
    <View className="self-center overflow-hidden rounded-xl border-2 bg-white" style={{ direction: 'rtl', borderColor: '#222E29' }}>
      <View className="items-center py-0.5" style={{ backgroundColor: '#08736F' }}>
        <Text style={{ ...font, fontSize: 11, lineHeight: 14, color: '#FFFFFF' }}>مصر · EGYPT</Text>
      </View>
      <View className="flex-row items-center gap-3 px-4">
        <TextInput
          accessibilityLabel="Plate letters"
          value={letters.split('').join(' ')}
          onChangeText={(v) => onChange(cleanLetters(v), digits)}
          placeholder="أ ب ج"
          placeholderTextColor="#DEE5DF"
          autoCorrect={false}
          style={{ ...input, width: 96, letterSpacing: 2 }}
        />
        <View className="h-9 w-px bg-line" />
        <TextInput
          accessibilityLabel="Plate digits"
          value={toIndic(digits)}
          onChangeText={(v) => onChange(letters, cleanDigits(v))}
          placeholder="١٢٣٤"
          placeholderTextColor="#DEE5DF"
          keyboardType="number-pad"
          maxLength={4}
          style={{ ...input, width: 96 }}
        />
      </View>
    </View>
  );
}

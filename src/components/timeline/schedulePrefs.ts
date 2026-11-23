import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Edit schedule extras (design-v2 flow 5 #3): "predict from my driving" and "remind me before", kept on the phone per car + part.
// ponytail: local only (no column for them yet); the Timeline reads them, the notification plan does not until the backend has fields.
export type SchedulePref = { predict: boolean; remindKm: number };
export const DEFAULT_PREF: SchedulePref = { predict: true, remindKm: 500 };
export const prefKey = (vehicleId: string, serviceTypeId: string) => `${vehicleId}:${serviceTypeId}`;

export const useSchedulePrefs = create<{ prefs: Record<string, SchedulePref>; save: (key: string, p: SchedulePref) => void }>()(
  persist((set) => ({ prefs: {}, save: (key, p) => set((s) => ({ prefs: { ...s.prefs, [key]: p } })) }), { name: 'schedulePrefs', storage: createJSONStorage(() => AsyncStorage) }),
);
export const usePref = (vehicleId: string, serviceTypeId: string) => useSchedulePrefs((s) => s.prefs[prefKey(vehicleId, serviceTypeId)]) ?? DEFAULT_PREF;

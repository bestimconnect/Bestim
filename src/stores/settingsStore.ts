import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Language = 'ar' | 'en';
export type Theme = 'light' | 'dark';

type Settings = {
  language: Language | null; // null until the user picks on the language screen
  theme: Theme; // chosen in Account settings; first-run flows are always light
  skipSplash: boolean; // one-shot: set just before the language reload so the splash animation does not replay
  currentVehicleId: string | null; // Home's vehicle + the one new logs go to; null = the primary vehicle
  notifyAsked: boolean; // screen 45 is shown once (Q39)
  pendingShareToken: string | null; // a share link opened while signed out; used after sign-in (Q44)
  setLanguage: (l: Language) => void;
  setTheme: (t: Theme) => void;
  setCurrentVehicle: (id: string | null) => void;
  set: (patch: Partial<Pick<Settings, 'notifyAsked' | 'pendingShareToken' | 'skipSplash'>>) => void;
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      language: null,
      theme: 'light',
      skipSplash: false,
      currentVehicleId: null,
      notifyAsked: false,
      pendingShareToken: null,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setCurrentVehicle: (currentVehicleId) => set({ currentVehicleId }),
      set: (patch) => set(patch),
    }),
    { name: 'settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

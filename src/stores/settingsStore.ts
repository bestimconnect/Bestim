import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Language = 'ar' | 'en';
export type Theme = 'light' | 'dark';

type Settings = {
  language: Language | null; // null until the user picks on the language screen
  theme: Theme; // chosen in Account settings; first-run flows are always light
  tourSeen: boolean; // the 3-screen tour runs once per device, before sign-in
  currentVehicleId: string | null; // Home's vehicle + the one new logs go to; null = the primary vehicle
  notifyAsked: boolean; // screen 45 is shown once (Q39)
  pendingShareToken: string | null; // a share link opened while signed out; used after sign-in (Q44)
  setLanguage: (l: Language) => void;
  setTheme: (t: Theme) => void;
  finishTour: () => void;
  setCurrentVehicle: (id: string | null) => void;
  set: (patch: Partial<Pick<Settings, 'notifyAsked' | 'pendingShareToken'>>) => void;
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      language: null,
      theme: 'light',
      tourSeen: false,
      currentVehicleId: null,
      notifyAsked: false,
      pendingShareToken: null,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      finishTour: () => set({ tourSeen: true }),
      setCurrentVehicle: (currentVehicleId) => set({ currentVehicleId }),
      set: (patch) => set(patch),
    }),
    { name: 'settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

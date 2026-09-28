import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Language = 'ar' | 'en';
export type Theme = 'light' | 'dark';

type Settings = {
  language: Language | null; // null until the user picks on the language screen
  theme: Theme; // chosen in Account settings; first-run flows are always light
  tourSeen: boolean; // the 3-screen tour runs once per device, before sign-in
  setLanguage: (l: Language) => void;
  setTheme: (t: Theme) => void;
  finishTour: () => void;
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      language: null,
      theme: 'light',
      tourSeen: false,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      finishTour: () => set({ tourSeen: true }),
    }),
    { name: 'settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

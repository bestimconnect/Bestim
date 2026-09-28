import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Language = 'ar' | 'en';
export type Theme = 'light' | 'dark';

type Settings = {
  language: Language | null; // null until the user picks on the language screen
  theme: Theme; // chosen in Account settings; first-run flows are always light
  setLanguage: (l: Language) => void;
  setTheme: (t: Theme) => void;
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      language: null,
      theme: 'light',
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

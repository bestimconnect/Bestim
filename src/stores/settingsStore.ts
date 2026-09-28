import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Language = 'ar' | 'en';

type Settings = {
  language: Language | null; // null until the user picks on the language screen
  setLanguage: (l: Language) => void;
};

export const useSettings = create<Settings>()(
  persist((set) => ({ language: null, setLanguage: (language) => set({ language }) }), {
    name: 'settings',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

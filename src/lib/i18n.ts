import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DevSettings, I18nManager, Platform } from 'react-native';
import * as Updates from 'expo-updates';

import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import type { Language } from '@/stores/settingsStore';

i18n.use(initReactI18next).init({
  resources: { ar: { common: ar }, en: { common: en } },
  lng: 'ar',
  fallbackLng: 'ar',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

/** Switch language; flips layout direction and reloads if needed. Dynamic RTL does not work in Expo Go (dev build only). */
export function applyLanguage(lng: Language) {
  if (i18n.language !== lng) i18n.changeLanguage(lng);
  const rtl = lng === 'ar';
  if (Platform.OS !== 'web' && I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
    // reloadAsync can fail in dev-client builds; DevSettings.reload is the dev fallback.
    Updates.reloadAsync().catch(() => DevSettings.reload());
  }
}

export default i18n;

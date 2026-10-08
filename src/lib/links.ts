import { Linking } from 'react-native';

import i18n from './i18n';

// The website hosts the pages the stores require, in both languages, and the page a shared link opens.
export const SITE = 'https://bestim-eg.com';

/** Opens in the phone's own browser: it works the same on iPhone, Android and Huawei. */
export const openPage = (page: 'privacy' | 'terms' | 'support') =>
  Linking.openURL(`${SITE}/${i18n.language === 'en' ? 'en' : 'ar'}/${page}`);

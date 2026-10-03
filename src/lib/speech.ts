import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/**
 * The recognizer language for the app language. iPhones have no Egyptian Arabic model (Apple ships ar-SA only),
 * and asking for a missing one ends the session as "language-not-supported". The phone's text is only a live
 * preview: the recording goes to the AI, which is what understands Egyptian speech.
 */
export async function speechLang(appLanguage: string) {
  if (appLanguage !== 'ar') return 'en-US';
  const { locales } = await ExpoSpeechRecognitionModule.getSupportedLocales({}).catch(() => ({ locales: [] as string[] }));
  return ['ar-EG', 'ar-SA'].find((l) => locales.includes(l)) ?? locales.find((l) => l.startsWith('ar')) ?? 'ar-EG';
}

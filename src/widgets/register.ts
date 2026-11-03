import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import i18n from '@/lib/i18n';
import { useSettings } from '@/stores/settingsStore';

import { startWidgetSync } from './sync';

// Loaded from index.ts before the router: registers the widgets (iOS: stores their layouts; Android: the widget
// task, which also runs when the app is closed), starts the snapshot sync and sets the long-press app shortcuts.
// A build without the native widget code (an old dev build) must still start: widgets are an extra, never a reason to crash.
try {
  if (Platform.OS === 'ios') require('./ios');
  if (Platform.OS === 'android') require('./android');
  startWidgetSync();
} catch (e) {
  console.warn('widgets unavailable', e); // runs before monitoring starts
}
let QuickActions: typeof import('expo-quick-actions') | null = null;
try {
  QuickActions = require('expo-quick-actions');
} catch {}

const items = () => {
  const ar = i18n.language !== 'en';
  return [
    { id: 'voice', title: ar ? 'سجّل بصوتك' : 'Log by voice', params: { href: 'bestim://capture/voice' } },
    { id: 'km', title: ar ? 'حدّث العداد' : 'Update km', params: { href: 'bestim://update-odometer' } },
  ];
};
const setShortcuts = () => QuickActions?.setItems(items()).catch(() => {});
setShortcuts();
useSettings.subscribe(setShortcuts); // language changes
// Same links as the widgets; the short delay lets the router mount before a cold-start shortcut opens its screen.
const open = (a: { params?: Record<string, unknown> | null } | null | undefined) => a?.params?.href && setTimeout(() => Linking.openURL(String(a.params!.href)), 800);
open(QuickActions?.initial ?? null);
QuickActions?.addListener(open);

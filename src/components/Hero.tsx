import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

import { useScheme } from '@/lib/theme';

/** Light status bar while a screen with a dark header is focused; leaving restores the theme's own style. */
export function useLightStatusBar() {
  const dark = useScheme() === 'dark';
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(dark ? 'light' : 'dark');
    }, [dark]),
  );
}

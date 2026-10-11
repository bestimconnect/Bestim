import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { syncNotifications } from './notifications';
import { SAVE_LOG_KEY, saveLog } from './saveLog';
import { supabase } from './supabase';

// Offline (screens 47/48, decisions Q45): cached data is persisted to the device, the connection state comes
// from NetInfo, and a log saved offline is a paused mutation that resumes on reconnect or after a restart.
export const DAY = 24 * 60 * 60 * 1000;
export const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 7 * DAY } } });
queryClient.setMutationDefaults(SAVE_LOG_KEY, {
  mutationFn: saveLog,
  onSuccess: () => {
    for (const key of ['vehicles', 'logs', 'expenses']) queryClient.invalidateQueries({ queryKey: [key] });
  },
});
// Bump the key's version whenever a query's data shape changes, so an old cached shape is never read back.
export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'queryCache.v3' });
// Cached data belongs to one user: drop it whenever the signed-in user changes (sign out, an expired session,
// another account), so the next person on this phone never sees it. The first event only restores the session.
let cacheOwner: string | null | undefined;
supabase.auth.onAuthStateChange((_e, s) => {
  const id = s?.user.id ?? null;
  if (cacheOwner !== undefined && cacheOwner !== id) queryClient.clear();
  cacheOwner = id;
});
onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)));
// Reminders follow the data: reschedule after any successful write and whenever the app comes back.
queryClient.getMutationCache().subscribe((e) => {
  if (e.type === 'updated' && e.action.type === 'success') syncNotifications();
});
AppState.addEventListener('change', (s) => s === 'active' && syncNotifications());


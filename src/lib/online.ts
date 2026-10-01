import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

/** Live connection state (NetInfo via TanStack's onlineManager, see queryClient.ts). */
export const useOnline = () => useSyncExternalStore(onlineManager.subscribe, () => onlineManager.isOnline());

/** Q46: "View what's saved on this device" asks Home to render the offline variant from cache (since = when asked). In memory only. */
export const useShowSaved = create<{ since: number | null; set: (since: number | null) => void }>((set) => ({ since: null, set: (since) => set({ since }) }));

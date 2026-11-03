import { router } from 'expo-router';
import { useEffect } from 'react';

import { usePlans } from '@/lib/entitlements';
import { useSession } from '@/lib/session';
import { useSettings } from '@/stores/settingsStore';

/** The plans tour (/welcome), once per account, after the owner's first record (Q125): value first, prices second. */
export function usePlanTour(started: boolean) {
  const userId = useSession()?.user.id;
  const seen = useSettings((s) => s.planTourSeen);
  const ready = !!usePlans().data?.length;
  useEffect(() => {
    if (!userId || !ready || !started || seen === userId) return;
    useSettings.getState().set({ planTourSeen: userId });
    router.push('/welcome');
  }, [userId, ready, started, seen]);
}

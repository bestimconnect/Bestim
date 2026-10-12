import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl } from 'react-native';

import { useColors } from '@/lib/theme';

/**
 * Pull-to-refresh for a ScrollView: `<ScrollView refreshControl={useRefresh()}>`. Refetches what's on screen.
 * `offset` pushes the spinner down on screens that draw under the status bar (Home), where it would hide behind the notch.
 * `tint` recolours the iPhone spinner for a dark top (Android draws its own white disc).
 */
export function useRefresh(offset = 0, tint?: string) {
  const queryClient = useQueryClient();
  const c = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.refetchQueries({ type: 'active' }).catch(() => {}); // a failed fetch shows through each screen's own error state
    setRefreshing(false);
  };
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint ?? c.teal} colors={[c.teal]} progressViewOffset={offset} />;
}

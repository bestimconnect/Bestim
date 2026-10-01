import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl } from 'react-native';

import { useColors } from '@/lib/theme';

/** Pull-to-refresh for a ScrollView: `<ScrollView refreshControl={useRefresh()}>`. Refetches what's on screen. */
export function useRefresh() {
  const queryClient = useQueryClient();
  const c = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.refetchQueries({ type: 'active' }).catch(() => {}); // a failed fetch shows through each screen's own error state
    setRefreshing(false);
  };
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.teal} colors={[c.teal]} />;
}

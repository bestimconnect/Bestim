import { useLocalSearchParams } from 'expo-router';

import { PlanPager } from '@/components/PlanPager';

// A plan's own page, swipe for the others. Opened from the plans list; `page` = the plan id to start on.
export default function PlanPage() {
  const { page } = useLocalSearchParams<{ page?: string }>();
  return <PlanPager start={page} />;
}

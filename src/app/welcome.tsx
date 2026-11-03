import { PlanPager } from '@/components/PlanPager';

// First-login tour (decisions Q121): the welcome, then each plan. Opened once per account from Home.
export default function Welcome() {
  return <PlanPager first />;
}

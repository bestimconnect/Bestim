import { PlanCompare } from '@/components/PlanCompare';

// First-login tour (decisions Q121): every plan on one screen. Opened once per account from Home.
export default function Welcome() {
  return <PlanCompare first />;
}

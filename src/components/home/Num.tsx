import { type ComponentProps } from 'react';

import { Num as UiNum } from '@/components/ui/Num';

/** Moved to the design system (components/ui/Num, Ticks); Home's default size kept. */
export const Num = (p: ComponentProps<typeof UiNum>) => <UiNum size={38} {...p} />;
export { Ticks } from '@/components/ui/Ticks';

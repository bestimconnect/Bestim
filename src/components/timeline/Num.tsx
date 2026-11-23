import { type ComponentProps } from 'react';

import { Num as UiNum } from '@/components/ui/Num';

/** Moved to the design system (components/ui/Num); the timeline's default size kept. */
export const Num = (p: ComponentProps<typeof UiNum>) => <UiNum size={26} {...p} />;

import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import type { View } from 'react-native';

export type TourKey = 'odometer' | 'priority' | 'expenses' | 'capture';
export type Rect = { x: number; y: number; w: number; h: number };

const targets = new Map<TourKey, { current: View | null }>();

/** Put the returned ref (and `collapsable={false}`) on the view the first-run tour should light up. */
export function useTourTarget(key: TourKey) {
  const ref = useRef<View>(null);
  useEffect(() => {
    targets.set(key, ref);
    return () => {
      if (targets.get(key) === ref) targets.delete(key);
    };
  }, [key]);
  return ref;
}

/** Where a target is on screen now; null when it is not on screen (another Home state, bar hidden). */
export function measureTarget(key: TourKey, done: (r: Rect | null) => void) {
  const v = targets.get(key)?.current;
  if (!v) return done(null);
  v.measureInWindow((x, y, w, h) => done(w > 0 && h > 0 ? { x, y, w, h } : null));
}

/** Account > Replay the tour: shows the tour once more, whatever the car's records (Tour clears it). */
export const useTourReplay = create<{ on: boolean }>(() => ({ on: false }));

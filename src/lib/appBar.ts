import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useIsFocused } from 'expo-router';
import { create } from 'zustand';

// The green top bar lives once, in the root layout (components/AppBarOverlay). Each screen only says what it needs:
// a plain bar (Header: back, title, right) or its own tall green block ("hero": Home, car details).
// The bar glides between the two heights; screens that are not focused drop out of the stack.
export type BarEntry = { id: string; kind: 'bar' | 'hero'; title: string; sub?: string; back: boolean; right?: ReactNode; below?: ReactNode; belowH?: number; bottom: number };

/**
 * The bar's spacing scale: 24px sides, 12px between blocks, 44px buttons, 8 above and 16 below.
 * Blocks, top to bottom: action row (back / right), title with an optional line under it, an optional switch or chips.
 */
export const BAR_GAP = 12;
export const barHeight = (e: { back: boolean; right?: unknown; sub?: string; below?: unknown; belowH?: number }) => {
  const blocks = [(e.back || e.right ? 44 : 0), 32 + (e.sub ? 20 : 0), e.below ? (e.belowH ?? 44) : 0].filter(Boolean);
  return 8 + blocks.reduce((a, b) => a + b, 0) + BAR_GAP * (blocks.length - 1) + 16;
};

export const useAppBar = create<{ stack: BarEntry[]; put: (e: BarEntry) => void; drop: (id: string) => void }>((set) => ({
  stack: [],
  put: (e) => set((s) => (s.stack.some((x) => x.id === e.id) ? { stack: s.stack.map((x) => (x.id === e.id ? e : x)) } : { stack: [...s.stack, e] })),
  drop: (id) => set((s) => (s.stack.some((x) => x.id === id) ? { stack: s.stack.filter((x) => x.id !== id) } : s)),
}));

/** Register this screen's bar while it is focused. Runs every render so title/right stay current. */
export function useBarEntry(entry: Omit<BarEntry, 'id'> | null) {
  const id = useId();
  const focused = useIsFocused();
  const active = focused && entry != null;
  useEffect(() => () => useAppBar.getState().drop(id), [id, active]);
  useEffect(() => {
    if (active) useAppBar.getState().put({ id, ...entry! });
  });
}

/** For a screen with its own tall green block: pass the block's height (measured). */
export function useAppBarHero() {
  const [height, setHeight] = useState(0);
  useBarEntry({ kind: 'hero', title: '', back: false, bottom: height });
  return (e: { nativeEvent: { layout: { height: number } } }) => setHeight(Math.round(e.nativeEvent.layout.height));
}

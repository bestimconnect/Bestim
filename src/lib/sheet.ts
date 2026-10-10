import { router } from 'expo-router';
import { create } from 'zustand';

export type SheetAction = { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' };
type Content = { title: string; body?: string; actions: SheetAction[] };

// The callbacks can't travel as route params, so the open sheet reads its content from here.
export const useSheet = create<Content>(() => ({ title: '', actions: [] }));

/** Our bottom sheet instead of the system pop-up (founder, decisions Q55). Same arguments as `Alert.alert`. */
export function sheet(title: string, body?: string, actions: SheetAction[] = []) {
  useSheet.setState({ title, body, actions });
  router.push('/sheet');
}

export const useVehiclePick = create<{ currentId: string | null; onPick: (id: string) => void }>(() => ({ currentId: null, onPick: () => {} }));

/** The switch-vehicle sheet (decisions Q56): pictures, a tick on the current one, a dot on overdue ones. */
export function pickVehicle(currentId: string | null, onPick: (id: string) => void) {
  useVehiclePick.setState({ currentId, onPick });
  router.push('/switch-vehicle');
}

/** One row of the search picker: `label` in the app language, `hint` the line under it. Both are searched, and so is `also` (e.g. the other language's names). */
export type PickOption = { id: string; label: string; hint?: string; also?: string };
type PickRequest = {
  title: string;
  options: PickOption[];
  allowCustom: boolean; // adds a last row that uses the typed text as-is: onPick gets id null
  onPick: (choice: { id: string | null; label: string }) => void;
};

export const usePick = create<PickRequest>(() => ({ title: '', options: [], allowCustom: false, onPick: () => {} }));

/** The search picker (brand, model, year). A full-height modal: a long list can't live in a fit-to-content sheet (Q56). */
export function pickOption(request: PickRequest) {
  usePick.setState(request);
  router.push('/pick');
}

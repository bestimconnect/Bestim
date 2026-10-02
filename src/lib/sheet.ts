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

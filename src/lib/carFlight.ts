import { router } from 'expo-router';
import type { RefObject } from 'react';
import { Dimensions, I18nManager, type View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { create } from 'zustand';

// The tapped car flies from where it was (Home, My Cars) into the car-details header and back (decisions Q108).
// CarPhoto registers its picture under `<slot>:<vehicleId>`; the overlay (components/CarFlight) draws the one flying copy
// while the real pictures stay hidden for the length of the flight.
export type Rect = { x: number; y: number; width: number; height: number };
type Flight = { vehicleType: string; from: Rect; to: Rect | null; hide: string[] };
export type Slot = 'home' | 'list' | 'detail';
type Car = { id: string; vehicle_type: string };

export const useFlight = create<{ flight: Flight | null }>(() => ({ flight: null }));

const views = new Map<string, RefObject<View | null>>();
const origin = new Map<string, Slot>(); // vehicle id → where the user opened its details from

export const registerCar = (key: string, ref: RefObject<View | null>) => {
  views.set(key, ref);
  return () => {
    if (views.get(key) === ref) views.delete(key);
  };
};

const measure = (ref?: RefObject<View | null>, slot?: Slot) =>
  new Promise<Rect | null>((done) => {
    const v = ref?.current;
    if (!v) return done(null);
    v.measureInWindow((x, y, width, height) => {
      if (!width || !height) return done(null);
      // Home's pager is a right-to-left horizontal list: iOS reports its pages a page-width off sideways. The page on screen is centred.
      done({ x: slot === 'home' ? (Dimensions.get('window').width - width) / 2 : x, y, width, height });
    });
  });

/** Where the car sits in the car page's header (measured on an iPhone 16: 21 from the side, 57 below the safe area, 128x64). The flight starts at the tap and aims here, so it never waits for the page to be built. */
const detailRect = (): Rect => {
  const { width } = Dimensions.get('window');
  const w = 128;
  return { x: I18nManager.isRTL ? 21 : width - 21 - w, y: (initialWindowMetrics?.insets.top ?? 0) + 57, width: w, height: 64 };
};

/** Open the car's details (`tab` picks the segment). With `fly` and a measured picture the car flies; otherwise it is a plain push. */
export async function openDetails(car: Car, slot: Slot, { tab, fly = true }: { tab?: string; fly?: boolean } = {}) {
  const from = fly ? await measure(views.get(`${slot}:${car.id}`), slot) : null;
  origin.set(car.id, slot);
  if (from) useFlight.setState({ flight: { vehicleType: car.vehicle_type, from, to: detailRect(), hide: [`${slot}:${car.id}`, `detail:${car.id}`] } });
  router.push({ pathname: '/vehicle/[id]', params: tab ? { id: car.id, tab } : { id: car.id } });
}

/** Back from the details: the car flies home when the page it came from is still there. */
export async function closeDetails(car: Car) {
  const slot = origin.get(car.id);
  if (slot) {
    const [from, to] = await Promise.all([measure(views.get(`detail:${car.id}`)), measure(views.get(`${slot}:${car.id}`), slot)]);
    if (from && to) useFlight.setState({ flight: { vehicleType: car.vehicle_type, from, to, hide: [`detail:${car.id}`, `${slot}:${car.id}`] } });
  }
  router.back();
}

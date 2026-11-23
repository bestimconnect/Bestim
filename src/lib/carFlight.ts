import { router } from 'expo-router';
import type { RefObject } from 'react';
import { Dimensions, type View } from 'react-native';
import { create } from 'zustand';

// The tapped car's card grows into the car page and shrinks back (decisions Q108, Q143). CarPhoto registers its picture under
// `<slot>:<vehicleId>` and My Cars its card under `card:<vehicleId>`. The animation itself (components/CarFlight) lives inside the
// car page: that page is a native layer above the app, so anything drawn outside it gets covered halfway through.
export type Rect = { x: number; y: number; width: number; height: number };
export type Flight = { vehicleType: string; card: Rect; photo: Rect; to: Rect | null; hide: string[] };
export type Slot = 'home' | 'list' | 'detail';
type Car = { id: string; vehicle_type: string };

/** `landed`: the page finished opening, so its heavier body can be built. */
export const useFlight = create<{ flight: Flight | null; landed: boolean }>(() => ({ flight: null, landed: false }));

const views = new Map<string, RefObject<View | null>>();
const origin = new Map<string, Slot>(); // vehicle id → where the user opened its details from
let closer: ((next: Flight | null) => void) | null = null;
export const setCloser = (f: typeof closer) => {
  closer = f;
};

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

const measureSource = (id: string, slot: Slot) => Promise.all([measure(views.get(`${slot}:${id}`), slot), measure(views.get(`card:${id}`))]);

/** Open the car's details (`tab` picks the segment). With `fly` and a measured picture the card grows; otherwise the page just fades in. */
export async function openDetails(car: Car, slot: Slot, { tab, fly = true }: { tab?: string; fly?: boolean } = {}) {
  const [photo, card] = fly ? await measureSource(car.id, slot) : [null, null];
  origin.set(car.id, slot);
  useFlight.setState({
    // Only the page's own picture hides: the growing card covers the original, so it never blinks.
    flight: photo ? { vehicleType: car.vehicle_type, card: (slot === 'list' && card) || photo, photo, to: null, hide: [`detail:${car.id}`] } : null,
  });
  router.push({ pathname: '/vehicle/[id]', params: tab ? { id: car.id, tab } : { id: car.id } });
}

/** Back from the details: the same animation in reverse, when the card it came from is still there. */
export async function closeDetails(car?: Car) {
  const slot = car && origin.get(car.id);
  let next: Flight | null = null;
  if (car && slot) {
    const [to, [photo, card]] = await Promise.all([measure(views.get(`detail:${car.id}`)), measureSource(car.id, slot)]);
    if (to && photo) next = { vehicleType: car.vehicle_type, card: (slot === 'list' && card) || photo, photo, to, hide: [`detail:${car.id}`] };
  }
  if (closer) closer(next);
  else router.back();
}

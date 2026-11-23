// 360-degree turntable frames per body type: 22 pictures, about 16 degrees apart, frame 0 = the car seen from the front,
// turning clockwise as seen from above (front, driver's side, rear, passenger's side). Made from the Gemini grids
// (docs/gemini-360-prompt.md, cut by scripts/slice-grid.sh). A body type without frames has no 360 view yet.
import type { ImageSourcePropType } from 'react-native';

export const FRAME_COUNT = 22;

const FRAMES: Partial<Record<string, ImageSourcePropType[]>> = {
  sedan: [
    require('../../assets/images/360/sedan/00.jpg'),
    require('../../assets/images/360/sedan/01.jpg'),
    require('../../assets/images/360/sedan/02.jpg'),
    require('../../assets/images/360/sedan/03.jpg'),
    require('../../assets/images/360/sedan/04.jpg'),
    require('../../assets/images/360/sedan/05.jpg'),
    require('../../assets/images/360/sedan/06.jpg'),
    require('../../assets/images/360/sedan/07.jpg'),
    require('../../assets/images/360/sedan/08.jpg'),
    require('../../assets/images/360/sedan/09.jpg'),
    require('../../assets/images/360/sedan/10.jpg'),
    require('../../assets/images/360/sedan/11.jpg'),
    require('../../assets/images/360/sedan/12.jpg'),
    require('../../assets/images/360/sedan/13.jpg'),
    require('../../assets/images/360/sedan/14.jpg'),
    require('../../assets/images/360/sedan/15.jpg'),
    require('../../assets/images/360/sedan/16.jpg'),
    require('../../assets/images/360/sedan/17.jpg'),
    require('../../assets/images/360/sedan/18.jpg'),
    require('../../assets/images/360/sedan/19.jpg'),
    require('../../assets/images/360/sedan/20.jpg'),
    require('../../assets/images/360/sedan/21.jpg'),
  ],
};

export const frames360 = (vehicleType: string) => FRAMES[vehicleType];
// The 360 view is switched off for now (not tested on Android). Set to true to bring the badge and page back.
const ENABLED = false;
export const has360 = (vehicleType: string) => ENABLED && !!FRAMES[vehicleType];

// ---- Part markers -------------------------------------------------------------------------------------------------
// A marker is a dot that follows one spot of the car while it turns. Each run lists keyframes [frame, x%, y%] (position
// as a percentage of the picture); the dot shows from a run's first frame to its last and slides between keyframes.
// Frames (sedan set): 0 front, 6 driver's side (nose left), 12 rear, 16 passenger's side (nose right). Record keyframes with the
// annotate switch on the 360 page (dev builds): turn the car, tap the spot, copy the logged line.
export type Keyframe = [frame: number, x: number, y: number];
export type Marker = { id: string; group: 'tyres' | 'brakes' | 'wipers' | 'hood'; run: Keyframe[]; dy?: number };

const SEDAN_MARKERS: Marker[] = [
  { id: 'tyre-fl', group: 'tyres', dy: 8, run: [[3, 50, 72], [6, 16, 73], [9, 14, 67]] },
  { id: 'tyre-rl', group: 'tyres', dy: 8, run: [[3, 91, 69], [6, 80, 74], [9, 40, 73]] },
  { id: 'tyre-rr', group: 'tyres', dy: 8, run: [[13, 62, 72], [16, 19, 73], [20, 15, 69]] },
  { id: 'tyre-fr', group: 'tyres', dy: 8, run: [[13, 87, 69], [16, 83, 73], [17, 45, 72], [20, 39, 75]] },
  { id: 'brake-fl', group: 'brakes', run: [[3, 50, 72], [6, 16, 73], [9, 14, 67]] },
  { id: 'brake-fr', group: 'brakes', run: [[13, 87, 69], [16, 83, 73], [17, 45, 72], [20, 39, 75]] },
  { id: 'wiper-a', group: 'wipers', run: [[0, 50, 44], [3, 33, 48]] },
  { id: 'wiper-b', group: 'wipers', run: [[17, 65, 47], [20, 60, 50], [21, 60, 48]] },
  { id: 'hood-a', group: 'hood', run: [[0, 50, 52], [3, 23, 57]] },
  { id: 'hood-b', group: 'hood', run: [[17, 68, 56], [20, 66, 58], [21, 66, 57]] },
];

export const markers360 = (vehicleType: string): Marker[] => (vehicleType === 'sedan' ? SEDAN_MARKERS : []);

/** Where a marker sits at `frame` (percent of the picture), or null while it is out of sight. */
export function markerAt(m: Marker, frame: number): { x: number; y: number } | null {
  const r = m.run;
  if (frame < r[0][0] || frame > r[r.length - 1][0]) return null;
  for (let i = 1; i < r.length; i++) {
    if (frame <= r[i][0]) {
      const [f0, x0, y0] = r[i - 1];
      const [f1, x1, y1] = r[i];
      const t = f1 === f0 ? 0 : (frame - f0) / (f1 - f0);
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t + (m.dy ?? 0) };
    }
  }
  return null;
}

/** Which marker group an app part belongs to (matched on its English name); null = no dot, listed under the car. */
export function groupOfPart(nameEn: string): Marker['group'] | null {
  const n = nameEn.toLowerCase();
  if (/tyre|tire|wheel/.test(n)) return 'tyres';
  if (/brake/.test(n)) return 'brakes';
  if (/wiper/.test(n)) return 'wipers';
  if (/oil|coolant|battery|air filter|spark|belt|radiator/.test(n)) return 'hood';
  return null;
}

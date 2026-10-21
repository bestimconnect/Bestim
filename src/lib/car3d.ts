// A simple stylised 3D car, built in code, for the 360 view prototype. Swap `buildCar()` for a loaded GLB later: the
// rest (spin, dots) only needs the named anchors below. Car length runs along X, the front points to +X.
import * as THREE from 'three';

import type { Marker } from './car360';

export type Anchor = { id: string; group: Marker['group']; at: [number, number, number]; normal: [number, number, number] };

// Where each dot sits on the car, and which way that part faces (a dot hides when its part faces away from the camera).
export const ANCHORS: Anchor[] = [
  { id: 'tyre-fl', group: 'tyres', at: [1.25, 0.2, 0.92], normal: [0, 0, 1] },
  { id: 'tyre-fr', group: 'tyres', at: [1.25, 0.2, -0.92], normal: [0, 0, -1] },
  { id: 'tyre-rl', group: 'tyres', at: [-1.36, 0.2, 0.92], normal: [0, 0, 1] },
  { id: 'tyre-rr', group: 'tyres', at: [-1.36, 0.2, -0.92], normal: [0, 0, -1] },
  { id: 'brake-fl', group: 'brakes', at: [1.25, 0.4, 0.92], normal: [0, 0, 1] },
  { id: 'brake-fr', group: 'brakes', at: [1.25, 0.4, -0.92], normal: [0, 0, -1] },
  { id: 'wiper-l', group: 'wipers', at: [1.1, 1.27, 0.35], normal: [0.4, 0.9, 0] },
  { id: 'wiper-r', group: 'wipers', at: [1.1, 1.27, -0.35], normal: [0.4, 0.9, 0] },
  { id: 'hood', group: 'hood', at: [1.76, 1.12, 0], normal: [0.2, 1, 0] },
];

// The sedan model (lib/loadCar.ts): length 1.9 along model Z with the front at -Z, 0.87 wide, 0.64 tall. It is turned and
// scaled into the car space used by ANCHORS: front toward +X, 4.2 long, standing on y = 0.
const SCALE = 2.2;
export function placeCar(model: THREE.Mesh) {
  model.rotation.y = -Math.PI / 2;
  model.scale.setScalar(SCALE);
  return model;
}

/** A soft round shadow on the ground (no shadow maps: they are heavy on phones). */
export function buildShadow() {
  const s = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 }));
  s.rotation.x = -Math.PI / 2;
  s.scale.set(1, 0.55, 1);
  s.position.y = 0.01;
  return s;
}

import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDecay, withTiming, type SharedValue } from 'react-native-reanimated';
import * as THREE from 'three';

import { type Marker } from '@/lib/car360';
import { ANCHORS, buildShadow, placeCar } from '@/lib/car3d';
import { loadCarModel } from '@/lib/loadCar';
import { reportError } from '@/lib/monitoring';

type Dot = { x: number; y: number; on: number };
const RAD_PER_PX = 0.011;

function AnchorDot({ id, color, onPress, register }: { id: string; color?: string; onPress: () => void; register: (id: string, v: SharedValue<Dot>) => void }) {
  const pos = useSharedValue<Dot>({ x: 0, y: 0, on: 0 });
  useEffect(() => register(id, pos), [id, pos, register]);
  const style = useAnimatedStyle(() => ({ opacity: pos.get().on, transform: [{ translateX: pos.get().x - 14 }, { translateY: pos.get().y - 14 }, { scale: 0.7 + 0.3 * pos.get().on }] }));
  if (!color) return null;
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, style]}>
      <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} className="h-7 w-7 items-center justify-center rounded-full bg-white" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
        <View className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * The car in 3D (three.js on expo-gl). Drag to turn it: letting go keeps it spinning and slows to rest. Dots follow the
 * parts (projected from named anchors every frame) and hide when their part faces away.
 */
export function Car3D({ colors, onGroup }: { colors: Partial<Record<Marker['group'], string>>; onGroup: (g: Marker['group']) => void }) {
  const still = useReducedMotion();
  const yaw = useSharedValue(0.9);
  const from = useSharedValue(0);
  const dots = useRef(new Map<string, SharedValue<Dot>>());
  const size = useRef({ w: 1, h: 1 });
  const alive = useRef(true);
  const disposeAll = useRef<() => void>(() => {});

  useEffect(() => {
    alive.current = true;
    if (!still) yaw.set(withTiming(yaw.get() + Math.PI * 2, { duration: 4500 }));
    return () => {
      alive.current = false;
      cancelAnimation(yaw);
      disposeAll.current();
    };
  }, [yaw, still]);

  const register = useCallback((id: string, v: SharedValue<Dot>) => void dots.current.set(id, v), []);

  const onContext = (gl: ExpoWebGLRenderingContext) => {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const canvas = { width: w, height: h, style: {}, addEventListener: () => {}, removeEventListener: () => {}, clientHeight: h, getContext: () => gl } as unknown as HTMLCanvasElement;
    // expo-gl's context (WebGL 2) also passes `instanceof WebGLRenderingContext`, which three reads as "WebGL 1": hide that
    // global for the moment the renderer is created.
    const g = globalThis as { WebGLRenderingContext?: unknown };
    const saved = g.WebGLRenderingContext;
    g.WebGLRenderingContext = undefined;
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
    g.WebGLRenderingContext = saved;
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
    camera.position.set(0, 2.2, 7.2);
    camera.lookAt(0, 0.7, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe3e8e5, 2.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 8, 6);
    scene.add(key);

    const stage = new THREE.Group();
    scene.add(stage, buildShadow());
    disposeAll.current = () => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.MeshStandardMaterial | undefined;
        mat?.map?.dispose();
        mat?.normalMap?.dispose();
        mat?.roughnessMap?.dispose();
        mat?.dispose();
      });
      renderer.dispose();
    };
    loadCarModel(require('../../assets/models/sedan.glb'))
      .then((m) => {
        if (alive.current) {
          stage.add(placeCar(m));
        }
      })
      .catch((e) => reportError(e, 'car model failed'));

    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    let lastTick = 0;

    const frame = () => {
      if (!alive.current) return;
      const a = yaw.get();
      stage.rotation.y = a;
      stage.updateMatrixWorld(true);
      // project every anchor to screen pixels
      for (const an of ANCHORS) {
        const v = dots.current.get(an.id);
        if (!v) continue;
        p.set(...an.at).applyMatrix4(stage.matrixWorld);
        n.set(...an.normal).transformDirection(stage.matrixWorld);
        toCam.copy(camera.position).sub(p).normalize();
        const facing = n.dot(toCam);
        p.project(camera);
        v.set({ x: (p.x * 0.5 + 0.5) * size.current.w, y: (-p.y * 0.5 + 0.5) * size.current.h, on: facing > 0.15 ? 1 : 0 });
      }
      const step = Math.floor(a / (Math.PI / 12));
      if (step !== lastTick) {
        if (lastTick !== 0) Haptics.selectionAsync();
        lastTick = step;
      }
      renderer.render(scene, camera);
      gl.endFrameEXP();
      requestAnimationFrame(frame);
    };
    frame();
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      cancelAnimation(yaw);
      from.set(yaw.get());
    })
    .onUpdate((e) => {
      yaw.set(from.get() + e.translationX * RAD_PER_PX);
    })
    .onEnd((e) => {
      yaw.set(withDecay({ velocity: e.velocityX * RAD_PER_PX, deceleration: 0.996 }));
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ aspectRatio: 4 / 3, width: '100%' }} onLayout={(e) => (size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <GLView style={{ flex: 1 }} onContextCreate={onContext} />
        {ANCHORS.map((a) => (
          <AnchorDot key={a.id} id={a.id} color={colors[a.group]} onPress={() => onGroup(a.group)} register={register} />
        ))}
      </View>
    </GestureDetector>
  );
}

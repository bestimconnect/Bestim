// Loads a car model (.glb) into three.js on a phone. three's own GLTFLoader needs browser features (Blob, image decoding)
// that React Native does not have, so this reads the file directly: one mesh plus its PNG textures, decoded in JS.
import { Asset } from 'expo-asset';
import UPNG from 'upng-js';
import * as THREE from 'three';

type Gltf = { meshes: { primitives: { attributes: Record<string, number>; indices?: number }[] }[]; accessors: { bufferView: number; byteOffset?: number; count: number; componentType: number; type: string }[]; bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[]; images?: { bufferView: number; name?: string }[]; materials?: { pbrMetallicRoughness?: { baseColorTexture?: { index: number }; metallicRoughnessTexture?: { index: number } }; normalTexture?: { index: number } }[]; textures?: { source: number }[] };

const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3 } as const;

export async function loadCarModel(moduleId: number): Promise<THREE.Mesh> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const buf = await (await fetch(asset.localUri ?? asset.uri)).arrayBuffer();
  const dv = new DataView(buf);
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen))) as Gltf;
  const bin = 20 + jsonLen + 8; // 8 = the binary chunk's header

  const read = (index: number) => {
    const a = json.accessors[index];
    const v = json.bufferViews[a.bufferView];
    const size = SIZE[a.type as keyof typeof SIZE];
    const start = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const wide = a.componentType === 5126 || a.componentType === 5125; // 4-byte values
    const bytes = wide ? 4 : 2;
    const stride = v.byteStride ?? size * bytes; // interleaved attributes (position, normal, uv in one block) skip ahead per vertex
    const view = new DataView(buf);
    const out = a.componentType === 5126 ? new Float32Array(a.count * size) : a.componentType === 5125 ? new Uint32Array(a.count * size) : new Uint16Array(a.count * size);
    for (let i = 0; i < a.count; i++)
      for (let k = 0; k < size; k++) {
        const at = start + i * stride + k * bytes;
        out[i * size + k] = a.componentType === 5126 ? view.getFloat32(at, true) : a.componentType === 5125 ? view.getUint32(at, true) : view.getUint16(at, true);
      }
    return { data: out, size };
  };

  const prim = json.meshes[0].primitives[0];
  const geo = new THREE.BufferGeometry();
  const pos = read(prim.attributes.POSITION);
  geo.setAttribute('position', new THREE.BufferAttribute(pos.data as Float32Array, 3));
  if (prim.attributes.NORMAL !== undefined) geo.setAttribute('normal', new THREE.BufferAttribute(read(prim.attributes.NORMAL).data as Float32Array, 3));
  if (prim.attributes.TEXCOORD_0 !== undefined) geo.setAttribute('uv', new THREE.BufferAttribute(read(prim.attributes.TEXCOORD_0).data as Float32Array, 2));
  if (prim.indices !== undefined) geo.setIndex(new THREE.BufferAttribute(read(prim.indices).data as Uint16Array | Uint32Array, 1));

  const texture = (textureIndex: number | undefined, srgb: boolean) => {
    if (textureIndex === undefined) return undefined;
    const img = json.images![json.textures![textureIndex].source];
    const v = json.bufferViews[img.bufferView];
    const png = UPNG.decode(buf.slice(bin + (v.byteOffset ?? 0), bin + (v.byteOffset ?? 0) + v.byteLength));
    const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
    const t = new THREE.DataTexture(rgba, png.width, png.height, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  };

  const m = json.materials?.[0];
  const mr = m?.pbrMetallicRoughness?.metallicRoughnessTexture?.index;
  const rough = texture(mr, false);
  const material = new THREE.MeshStandardMaterial({
    map: texture(m?.pbrMetallicRoughness?.baseColorTexture?.index, true),
    normalMap: texture(m?.normalTexture?.index, false),
    roughnessMap: rough,
    roughness: 1,
    metalness: 0.1, // no environment map to reflect, so a fully metallic car would render black
  });
  // expo-gl draws 32-bit indices unreliably: expand to plain triangles (more vertices, but it draws everywhere).
  const flat = geo.index ? geo.toNonIndexed() : geo;
  geo.dispose();
  return new THREE.Mesh(flat, material);
}

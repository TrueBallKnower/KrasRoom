import {
  Box3,
  Vector3,
  Group,
  Texture,
  type Object3D,
  type Mesh,
  type Material,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { assetGet } from "./db";
import type { Item } from "./model";
type Entry = {
  promise: Promise<GLTF>;
  refs: number;
  bytes: number;
  used: number;
  value?: GLTF;
};
const cache = new Map<string, Entry>();
function dispose(g: GLTF) {
  const resources = new Set<{ dispose: () => void }>();
  g.scene.traverse((n) => {
    const m = n as Mesh;
    if (m.geometry) resources.add(m.geometry);
    const materials = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of materials) {
      if (!mat) continue;
      resources.add(mat);
      for (const v of Object.values(mat))
        if (v instanceof Texture) resources.add(v);
    }
  });
  resources.forEach((r) => r.dispose());
}
function trim() {
  const unused = [...cache.entries()]
    .filter(([, v]) => v.refs === 0 && v.value)
    .sort((a, b) => a[1].used - b[1].used);
  let bytes = [...cache.values()].reduce((n, v) => n + v.bytes, 0);
  while (unused.length && (cache.size > 6 || bytes > 256 * 1024 * 1024)) {
    const [id, e] = unused.shift()!;
    cache.delete(id);
    bytes -= e.bytes;
    dispose(e.value!);
  }
}
export function primeModel(id: string, g: GLTF, bytes: number) {
  cache.set(id, {
    promise: Promise.resolve(g),
    refs: 0,
    bytes,
    used: Date.now(),
    value: g,
  });
}
export function acquireModel(id: string) {
  let entry = cache.get(id);
  if (!entry) {
    entry = {
      refs: 0,
      bytes: 0,
      used: Date.now(),
      promise: Promise.resolve(null as unknown as GLTF),
    };
    const current = entry;
    cache.set(id, current);
    current.promise = (async () => {
      const blob = await assetGet(id);
      if (!blob) throw Error("Modèle local introuvable.");
      current.bytes = blob.size;
      const { parseModel } = await import("./imports");
      const g = await parseModel(blob);
      current.value = g;
      return g;
    })().catch((e) => {
      if (cache.get(id) === current) cache.delete(id);
      throw e;
    });
  }
  entry.refs++;
  entry.used = Date.now();
  trim();
  const current = entry;
  let released = false;
  return {
    promise: current.promise,
    release: () => {
      if (!released) {
        released = true;
        current.refs = Math.max(0, current.refs - 1);
        current.used = Date.now();
        queueMicrotask(trim);
      }
    },
  };
}
export function modelNode(scene: Object3D, path?: string) {
  let node = scene;
  if (path)
    for (const n of path.split("/")) {
      node = node.children[Number(n)];
      if (!node) throw Error("Sous-objet absent de ce modèle.");
    }
  return node;
}
export function normalizedClone(scene: Object3D, path?: string) {
  const source = modelNode(scene, path);
  source.updateWorldMatrix(true, true);
  const child = cloneSkeleton(source);
  child.matrix.copy(source.matrixWorld);
  child.matrixAutoUpdate = false;
  const wrapper = new Group();
  wrapper.add(child);
  const box = new Box3().setFromObject(wrapper),
    size = box.getSize(new Vector3()),
    center = box.getCenter(new Vector3());
  wrapper.position.set(-center.x, -box.min.y, -center.z);
  return { group: wrapper, size, box };
}
const footprintCache = new WeakMap<Object3D, Item["footprints"]>();
export function modelFootprints(source: Object3D): Item["footprints"] {
  if (footprintCache.has(source)) return footprintCache.get(source);
  source.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(source),
    size = box.getSize(new Vector3());
  if (Math.min(size.x, size.y, size.z) <= 0) return undefined;
  const cells: Array<{ bottom: number; top: number } | undefined> = Array(64);
  function raster(b: Box3) {
    if (
      (b.max.y - b.min.y) / size.y < 0.015 &&
      (b.max.y - box.min.y) / size.y < 0.03
    )
      return;
    const minX = Math.max(
        0,
        Math.min(7, Math.floor(((b.min.x - box.min.x) / size.x) * 8)),
      ),
      maxX = Math.max(
        0,
        Math.min(
          7,
          Math.floor(((b.max.x - box.min.x - 0.0000001) / size.x) * 8),
        ),
      );
    const minZ = Math.max(
        0,
        Math.min(7, Math.floor(((b.min.z - box.min.z) / size.z) * 8)),
      ),
      maxZ = Math.max(
        0,
        Math.min(
          7,
          Math.floor(((b.max.z - box.min.z - 0.0000001) / size.z) * 8),
        ),
      );
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) {
        const idx = x * 8 + z,
          bottom = Math.max(0, (b.min.y - box.min.y) / size.y),
          top = Math.min(1, (b.max.y - box.min.y) / size.y),
          old = cells[idx];
        cells[idx] = {
          bottom: old ? Math.min(old.bottom, bottom) : bottom,
          top: old ? Math.max(old.top, top) : top,
        };
      }
  }
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3(),
    triangle = new Box3();
  source.traverse((n) => {
    const m = n as Mesh;
    if (!m.isMesh) return;
    const geometry = m.geometry,
      position = geometry.getAttribute("position"),
      index = geometry.index,
      count = index ? index.count : position?.count || 0;
    if (
      !position ||
      count > 600000 ||
      (m as Mesh & { isSkinnedMesh?: boolean; isInstancedMesh?: boolean })
        .isSkinnedMesh ||
      (m as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh
    ) {
      raster(new Box3().setFromObject(m));
      return;
    }
    for (let k = 0; k + 2 < count; k += 3) {
      a.fromBufferAttribute(position, index ? index.getX(k) : k).applyMatrix4(
        m.matrixWorld,
      );
      b.fromBufferAttribute(
        position,
        index ? index.getX(k + 1) : k + 1,
      ).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(
        position,
        index ? index.getX(k + 2) : k + 2,
      ).applyMatrix4(m.matrixWorld);
      triangle.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c);
      raster(triangle);
    }
  });
  const output: NonNullable<Item["footprints"]> = [];
  cells.forEach((v, k) => {
    if (v)
      output.push({
        x: (Math.floor(k / 8) + 0.5) / 8 - 0.5,
        y: ((k % 8) + 0.5) / 8 - 0.5,
        width: 1 / 8,
        depth: 1 / 8,
        bottom: v.bottom,
        top: v.top,
      });
  });
  footprintCache.set(source, output);
  return output;
}
export type ModelPart = {
  path: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  center: { x: number; y: number; z: number };
  footprints: Item["footprints"];
};
export function separableParts(scene: Object3D, path?: string): ModelPart[] {
  const source = modelNode(scene, path);
  source.updateWorldMatrix(true, true);
  const hasMesh = (node: Object3D) => {
    let hit = false;
    node.traverse((n) => {
      if ((n as Mesh).isMesh) hit = true;
    });
    return hit;
  };
  let branch = source,
    base = path || "";
  while (
    branch.children.filter(hasMesh).length === 1 &&
    !(branch as Mesh).isMesh
  ) {
    const idx = branch.children.findIndex(hasMesh);
    if (idx < 0) break;
    branch = branch.children[idx];
    base = base ? base + "/" + idx : String(idx);
  }
  // A single merged mesh cannot be reliably separated into semantic furniture.
  if ((branch as Mesh).isMesh || branch.children.filter(hasMesh).length < 2)
    return [];
  if (branch.children.filter(hasMesh).length > 64) return [];
  return branch.children
    .map((n, idx) => ({ n, path: base ? base + "/" + idx : String(idx) }))
    .filter((v) => hasMesh(v.n))
    .map(({ n, path }) => {
      const b = new Box3().setFromObject(n),
        s = b.getSize(new Vector3()),
        c = b.getCenter(new Vector3());
      return {
        path,
        name:
          (typeof n.userData.name === "string" ? n.userData.name : n.name) ||
          "Sous-objet " + path.split("/").at(-1),
        width: Math.max(0.01, s.x),
        depth: Math.max(0.01, s.z),
        height: Math.max(0.01, s.y),
        center: { x: c.x, y: b.min.y, z: c.z },
        footprints: modelFootprints(n),
      };
    });
}

import { describe, it, expect } from "vitest";
import {
  Group,
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
  Box3,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  modelFootprints,
  separableParts,
  normalizedClone,
  primeModel,
  acquireModel,
} from "./modelAssets";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
function assembly() {
  const g = new Group();
  const mat = new MeshStandardMaterial();
  for (const x of [-2, 2]) {
    const m = new Mesh(new BoxGeometry(1, 1, 1), mat);
    m.position.set(x, 0.5, 0);
    m.name = x < 0 ? "Fauteuil" : "Table";
    g.add(m);
  }
  g.updateMatrixWorld(true);
  return g;
}
describe("Ressources 3D mutualisées et ensembles", () => {
  it("dissocie des sous-objets sans modifier le modèle partagé", () => {
    const g = assembly(),
      before = new Box3().setFromObject(g);
    const parts = separableParts(g);
    expect(parts).toHaveLength(2);
    expect(parts[0].name).toBe("Fauteuil");
    expect(parts[0].center.x).toBeCloseTo(-2);
    const result = normalizedClone(g, parts[0].path);
    const box = new Box3().setFromObject(result.group);
    expect(box.getCenter(new Vector3()).x).toBeCloseTo(0);
    expect(box.min.y).toBeCloseTo(0);
    expect(new Box3().setFromObject(g)).toEqual(before);
    expect((result.group.children[0] as Mesh).geometry).toBe(
      (g.children[0] as Mesh).geometry,
    );
  });
  it("laisse vide le centre d’un ensemble, même dans un maillage fusionné", () => {
    const left = new BoxGeometry(1, 1, 1).translate(-2, 0.5, 0),
      right = new BoxGeometry(1, 1, 1).translate(2, 0.5, 0);
    const merged = new Mesh(
      mergeGeometries([left, right]),
      new MeshStandardMaterial(),
    );
    const f = modelFootprints(merged)!;
    expect(f.length).toBeGreaterThan(0);
    expect(f.some((v) => Math.abs(v.x) < 0.2)).toBe(false);
    expect(separableParts(merged)).toEqual([]);
  });
  it("partage le même décodage entre deux instances", async () => {
    const g = assembly();
    primeModel("shared-test", { scene: g } as unknown as GLTF, 1024);
    const a = acquireModel("shared-test"),
      b = acquireModel("shared-test");
    expect(a.promise).toBe(b.promise);
    expect((await a.promise).scene).toBe(g);
    a.release();
    b.release();
  });
});

import {
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Box3,
  Vector3,
  type Object3D,
} from "three";
export const DESIGN_LIMIT = 48;
export type DesignPart = {
  id: string;
  name: string;
  shape: "box" | "cylinder" | "sphere";
  width: number;
  depth: number;
  height: number;
  x: number;
  z: number;
  elevation: number;
  rx: number;
  ry: number;
  rz: number;
  color: string;
};
export type Design = { version: 1; name: string; parts: DesignPart[] };
export function designPart(shape: DesignPart["shape"] = "box"): DesignPart {
  return {
    id: crypto.randomUUID(),
    name:
      shape === "box" ? "Bloc" : shape === "cylinder" ? "Cylindre" : "Sphère",
    shape,
    width: shape === "box" ? 1 : shape === "sphere" ? 0.4 : 0.15,
    depth: shape === "box" ? 0.5 : shape === "sphere" ? 0.4 : 0.15,
    height: shape === "box" ? 0.1 : shape === "sphere" ? 0.4 : 0.7,
    x: 0,
    z: 0,
    elevation: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    color: "#b99b76",
  };
}
export function designPreset(kind = "table"): Design {
  const part = (
    name: string,
    width: number,
    depth: number,
    height: number,
    x = 0,
    z = 0,
    elevation = 0,
  ) => ({ ...designPart(), name, width, depth, height, x, z, elevation });
  if (kind === "shelf")
    return {
      version: 1,
      name: "Mon étagère",
      parts: [
        part("Côté gauche", 0.04, 0.35, 1.8, -0.48),
        part("Côté droit", 0.04, 0.35, 1.8, 0.48),
        ...[0, 0.44, 0.88, 1.32, 1.76].map((h, i) =>
          part(`Étagère ${i + 1}`, 1, 0.35, 0.04, 0, 0, h),
        ),
      ],
    };
  if (kind === "empty")
    return { version: 1, name: "Ma création", parts: [designPart()] };
  return {
    version: 1,
    name: "Ma table",
    parts: [
      part("Plateau", 1.4, 0.8, 0.05, 0, 0, 0.7),
      ...[-0.6, 0.6].flatMap((x) =>
        [-0.3, 0.3].map((z) => part("Pied", 0.06, 0.06, 0.7, x, z)),
      ),
    ],
  };
}
export function validateDesign(raw: unknown): asserts raw is Design {
  const d = raw as Design;
  if (
    d?.version !== 1 ||
    typeof d.name !== "string" ||
    !d.name.trim() ||
    d.name.length > 120 ||
    !Array.isArray(d.parts) ||
    !d.parts.length ||
    d.parts.length > DESIGN_LIMIT
  )
    throw Error(
      "Création invalide : 1 à 48 formes et un nom sont nécessaires.",
    );
  const ids = new Set<string>();
  for (const p of d.parts) {
    if (
      !p ||
      typeof p.id !== "string" ||
      ids.has(p.id) ||
      typeof p.name !== "string" ||
      p.name.length > 120 ||
      !["box", "cylinder", "sphere"].includes(p.shape) ||
      !/^#[a-f\d]{6}$/i.test(p.color) ||
      [p.width, p.depth, p.height].some(
        (n) => !Number.isFinite(n) || n < 0.01 || n > 20,
      ) ||
      [p.x, p.z, p.elevation].some(
        (n) => !Number.isFinite(n) || Math.abs(n) > 50,
      ) ||
      [p.rx, p.ry, p.rz].some((n) => !Number.isFinite(n) || Math.abs(n) > 360)
    )
      throw Error(
        "Forme invalide : vérifiez ses dimensions, sa position et sa couleur.",
      );
    ids.add(p.id);
  }
}
export function buildDesign(d: Design): Group {
  validateDesign(d);
  const group = new Group();
  group.name = d.name;
  group.userData.krasroomDesign = structuredClone(d);
  for (const p of d.parts) {
    const geometry =
      p.shape === "box"
        ? new BoxGeometry(1, 1, 1)
        : p.shape === "cylinder"
          ? new CylinderGeometry(0.5, 0.5, 1, 24)
          : new SphereGeometry(0.5, 24, 12);
    const mesh = new Mesh(
      geometry,
      new MeshStandardMaterial({ color: p.color, roughness: 0.65 }),
    );
    mesh.name = p.name;
    mesh.userData.designPart = p.id;
    mesh.scale.set(p.width, p.height, p.depth);
    mesh.position.set(p.x, p.elevation + p.height / 2, p.z);
    mesh.rotation.set(
      (p.rx * Math.PI) / 180,
      (p.ry * Math.PI) / 180,
      (p.rz * Math.PI) / 180,
    );
    group.add(mesh);
  }
  return group;
}
export function disposeDesign(group: Object3D) {
  group.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => m.dispose());
    }
  });
}
export function designSize(group: Object3D) {
  return new Box3().setFromObject(group).getSize(new Vector3());
}
export function designFromModel(scene: Object3D): Design | undefined {
  let design: Design | undefined;
  scene.traverse((o) => {
    if (!design && o.userData.krasroomDesign) {
      validateDesign(o.userData.krasroomDesign);
      design = structuredClone(o.userData.krasroomDesign);
    }
  });
  return design;
}

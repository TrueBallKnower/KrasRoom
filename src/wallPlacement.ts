import { Plane, Vector3, type Ray } from "three";
import type { Item, Wall } from "./model";
/** Place the object's back against the visible wall face; Y is elevation in Three. */
export function wallPlacement(
  item: Item,
  walls: Wall[],
  ray: Ray,
  snap: boolean,
): Item | undefined {
  let best = Infinity,
    result: Item | undefined;
  for (const wall of walls) {
    const dx = wall.b.x - wall.a.x,
      dz = wall.b.y - wall.a.y;
    const length = Math.hypot(dx, dz);
    if (length < 0.001 || item.width > length || item.height > wall.height)
      continue;
    const tx = dx / length,
      tz = dz / length;
    const side =
      (ray.origin.x - wall.a.x) * -tz + (ray.origin.z - wall.a.y) * tx >= 0
        ? 1
        : -1;
    const normal = new Vector3(-tz * side, 0, tx * side);
    const face = new Vector3(wall.a.x, 0, wall.a.y).addScaledVector(
      normal,
      wall.thickness / 2,
    );
    const hit = ray.intersectPlane(
      new Plane().setFromNormalAndCoplanarPoint(normal, face),
      new Vector3(),
    );
    if (!hit || hit.y < 0 || hit.y > wall.height) continue;
    let along = (hit.x - wall.a.x) * tx + (hit.z - wall.a.y) * tz;
    if (along < 0 || along > length) continue;
    const distance = hit.distanceTo(ray.origin);
    if (distance >= best) continue;
    along = Math.max(
      item.width / 2,
      Math.min(
        length - item.width / 2,
        snap ? Math.round(along * 20) / 20 : along,
      ),
    );
    let elevation = hit.y - item.height / 2;
    if (snap) elevation = Math.round(elevation * 20) / 20;
    elevation = Math.max(0, Math.min(wall.height - item.height, elevation));
    const offset = wall.thickness / 2 + item.depth / 2 + 0.005;
    result = {
      ...item,
      x: wall.a.x + tx * along + normal.x * offset,
      y: wall.a.y + tz * along + normal.z * offset,
      elevation,
      rotation: (Math.atan2(tz, tx) * 180) / Math.PI + (side < 0 ? 180 : 0),
    };
    best = distance;
  }
  return result;
}

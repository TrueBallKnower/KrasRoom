import { useLayoutEffect, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import { useNavigation, readCamera, writeCamera } from "./navigation";
import { useStore } from "./store";
export type SceneBounds = {
  x: number;
  y: number;
  span: number;
  height: number;
};
export default function NavigationCamera({
  id,
  bounds,
}: {
  id: string;
  bounds: SceneBounds;
}) {
  const { camera, controls: raw, invalidate } = useThree();
  const controls = raw as Controls | undefined;
  const initialized = useRef(false),
    transition = useRef<{ position: Vector3; target: Vector3 } | undefined>(
      undefined,
    );
  const command = useNavigation((s) => s.command),
    seen = useRef(command.serial);
  const latest = useRef(bounds);
  latest.current = bounds;
  useLayoutEffect(() => {
    if (!controls || initialized.current) return;
    const saved = readCamera(id),
      b = latest.current;
    if (saved) {
      camera.position.fromArray(saved.position);
      controls.target.fromArray(saved.target);
    } else {
      camera.position.set(
        b.x + b.span * 0.9,
        b.span * 0.95,
        b.y + b.span * 1.1,
      );
      controls.target.set(b.x, 0, b.y);
    }
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    controls.update();
    initialized.current = true;
  }, [camera, controls, id]);
  useEffect(() => {
    if (!controls) return;
    let snapshot = {
      position: camera.position.toArray() as [number, number, number],
      target: controls.target.toArray() as [number, number, number],
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => writeCamera(id, snapshot);
    const changed = () => {
      if (useStore.getState().project.id !== id) return;
      snapshot = {
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
      };
      clearTimeout(timer);
      timer = setTimeout(save, 180);
    };
    const cancel = () => {
      transition.current = undefined;
    };
    controls.addEventListener("start", cancel);
    controls.addEventListener("change", changed);
    controls.addEventListener("end", changed);
    return () => {
      clearTimeout(timer);
      save();
      controls.removeEventListener("start", cancel);
      controls.removeEventListener("change", changed);
      controls.removeEventListener("end", changed);
    };
  }, [controls, camera, id]);
  useEffect(() => {
    if (!controls || command.serial === seen.current) return;
    seen.current = command.serial;
    const p = useStore.getState(),
      i = p.project.items.find((v) => v.id === p.selected),
      r = p.project.rooms.find((v) => v.id === p.selected),
      w = p.project.walls.find((v) => v.id === p.selected);
    let { x, y, span, height } = latest.current;
    if (command.action === "focus") {
      if (i) {
        x = i.x;
        y = i.y;
        span = Math.max(i.width, i.depth, i.height, 1);
        height = i.height;
      } else {
        const points = r?.points || (w ? [w.a, w.b] : []);
        if (points.length) {
          const xs = points.map((q) => q.x),
            ys = points.map((q) => q.y);
          x = (Math.min(...xs) + Math.max(...xs)) / 2;
          y = (Math.min(...ys) + Math.max(...ys)) / 2;
          span = Math.max(
            1,
            Math.max(...xs) - Math.min(...xs),
            Math.max(...ys) - Math.min(...ys),
          );
          height = w?.height || height;
        }
      }
    }
    const target = new Vector3(
      x,
      command.action === "focus"
        ? (i?.elevation || 0) + height * 0.4
        : ["front", "side"].includes(command.action)
          ? height / 2
          : 0,
      y,
    );
    const c = camera as PerspectiveCamera,
      dist =
        ((span * 0.7) /
          Math.tan((c.fov * Math.PI) / 360) /
          Math.min(1, c.aspect)) *
        1.15;
    let direction = camera.position.clone().sub(controls.target).normalize();
    if (command.action === "top") direction.set(0, 1, 0.001);
    if (command.action === "front") direction.set(0, 0, 1).normalize();
    if (command.action === "side") direction.set(1, 0, 0).normalize();
    if (command.action === "iso" || command.action === "fit")
      direction.set(0.9, 0.95, 1.1).normalize();
    invalidate();
    transition.current = {
      target,
      position: target
        .clone()
        .addScaledVector(
          direction,
          Math.min(controls.maxDistance, Math.max(controls.minDistance, dist)),
        ),
    };
  }, [command, controls, camera]);
  useFrame((_, dt) => {
    if (!transition.current || !controls) return;
    invalidate();
    const v = transition.current,
      alpha = 1 - Math.exp(-9 * Math.min(dt, 0.05));
    camera.position.lerp(v.position, alpha);
    controls.target.lerp(v.target, alpha);
    controls.update();
    if (camera.position.distanceTo(v.position) < 0.005) {
      camera.position.copy(v.position);
      controls.target.copy(v.target);
      controls.update();
      writeCamera(id, {
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
      });
      transition.current = undefined;
    }
  });
  return null;
}

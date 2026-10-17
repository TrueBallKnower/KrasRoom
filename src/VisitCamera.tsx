import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { Euler, Vector3 } from "three";
import { useTouchDevice } from "./useDevice";
import { useTouchWalk } from "./TouchVisit";
import { useStore } from "./store";
import { visitStart } from "./spatial";
import { walkObstacles, walkStep, walkInput, walkHeading } from "./visitMotion";
export default function Walk({
  eyeHeight,
  fieldOfView,
  speed,
  free,
  hide,
}: {
  eyeHeight: number;
  fieldOfView: number;
  speed: number;
  free: boolean;
  hide: boolean;
}) {
  const { camera, gl } = useThree();
  const touch = useTouchDevice();
  const p = useStore((s) => s.project);
  const reset = useTouchWalk((s) => s.reset);
  const start = useMemo(() => visitStart(p, eyeHeight), [p.id, reset]);
  const blocked = useMemo(
    () => walkObstacles(hide ? { ...p, items: [] } : p, eyeHeight),
    [p, eyeHeight, hide],
  );
  const keys = useRef(new Set<string>());
  const velocity = useRef(new Vector3());
  useEffect(() => {
    camera.position.set(start.x, eyeHeight, start.y);
    const heading = walkHeading(
      start,
      walkObstacles({ ...p, items: [] }, eyeHeight),
    );
    camera.lookAt(
      start.x + Math.cos(heading),
      eyeHeight,
      start.y + Math.sin(heading),
    );
    velocity.current.set(0, 0, 0);
    useTouchWalk.getState().move(0, 0);
  }, [camera, start, reset]);
  useEffect(() => {
    if ("fov" in camera) {
      (camera as import("three").PerspectiveCamera).fov = fieldOfView;
      camera.updateProjectionMatrix();
    }
    camera.position.y = eyeHeight;
  }, [camera, fieldOfView, eyeHeight]);
  useEffect(() => {
    const clear = () => {
      useTouchWalk.getState().stop();
      keys.current.clear();
      velocity.current.set(0, 0, 0);
    };
    const down = (e: KeyboardEvent) => {
      if (
        document.pointerLockElement === gl.domElement &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        /^(Key[WZSAQD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(
          e.code,
        )
      ) {
        e.preventDefault();
        keys.current.add(e.code);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("pointerlockchange", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("pointerlockchange", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [gl]);
  useEffect(() => {
    if (!touch) return;
    const canvas = gl.domElement;
    let pointer: { id: number; x: number; y: number } | undefined;
    const down = (e: PointerEvent) => {
      if (
        e.pointerType !== "touch" ||
        pointer ||
        document.querySelector('[role="dialog"]')
      )
        return;
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!pointer || pointer.id !== e.pointerId) return;
      const rotation = new Euler().setFromQuaternion(camera.quaternion, "YXZ");
      rotation.y -= (e.clientX - pointer.x) * 0.005;
      rotation.x = Math.max(
        -1.35,
        Math.min(1.35, rotation.x - (e.clientY - pointer.y) * 0.005),
      );
      camera.quaternion.setFromEuler(rotation);
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === pointer?.id) pointer = undefined;
    };
    const reset = () => {
      pointer = undefined;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
      useTouchWalk.getState().move(0, 0);
    };
  }, [touch, gl, camera]);
  useFrame((_, delta) => {
    if (
      document.hidden ||
      document.querySelector('[role="dialog"]') ||
      (!touch && document.pointerLockElement !== gl.domElement)
    ) {
      velocity.current.set(0, 0, 0);
      keys.current.clear();
      const movement = useTouchWalk.getState();
      if (movement.x || movement.y || movement.running) movement.stop();
      return;
    }
    const dt = Math.min(delta, 0.05),
      k = keys.current;
    const movement = useTouchWalk.getState();
    const input = walkInput(
      Number(k.has("KeyD") || k.has("ArrowRight")) -
        Number(k.has("KeyA") || k.has("KeyQ") || k.has("ArrowLeft")) +
        (touch ? movement.x : 0),
      Number(k.has("KeyW") || k.has("KeyZ") || k.has("ArrowUp")) -
        Number(k.has("KeyS") || k.has("ArrowDown")) +
        (touch ? movement.y : 0),
    );
    const rotation = new Euler().setFromQuaternion(camera.quaternion, "YXZ");
    const sin = Math.sin(rotation.y),
      cos = Math.cos(rotation.y);
    const pace =
      speed *
      (k.has("ShiftLeft") || k.has("ShiftRight") || (touch && movement.running)
        ? 1.7
        : 1);
    const target = new Vector3(
      (input.x * cos - input.y * sin) * pace,
      0,
      (-input.x * sin - input.y * cos) * pace,
    );
    velocity.current.lerp(
      target,
      1 - Math.exp(-(Math.hypot(input.x, input.y) ? 9 : 18) * dt),
    );
    const from = { x: camera.position.x, y: camera.position.z };
    const next = free
      ? {
          x: from.x + velocity.current.x * dt,
          y: from.y + velocity.current.z * dt,
        }
      : walkStep(
          from,
          velocity.current.x * dt,
          velocity.current.z * dt,
          blocked,
        );
    camera.position.x = next.x;
    camera.position.z = next.y;
    camera.position.y = eyeHeight;
  });
  return touch ? null : (
    <PointerLockControls
      selector=".viewport canvas"
      pointerSpeed={0.65}
      minPolarAngle={0.22}
      maxPolarAngle={Math.PI - 0.22}
    />
  );
}

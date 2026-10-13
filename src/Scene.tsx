import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  PointerLockControls,
  Grid,
  ContactShadows,
} from "@react-three/drei";
import {
  Box3,
  Vector3,
  Shape,
  DoubleSide,
  Plane,
  Raycaster,
  Vector2,
  type Group,
} from "three";
import { assetGet } from "./db";
import { parseModel } from "./imports";
import { useStore } from "./store";
import {
  distance,
  collides,
  uid,
  type Item,
  type Wall,
  type Room,
} from "./model";
function Box({
  position = [0, 0, 0],
  size,
  color,
}: {
  position?: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh castShadow receiveShadow position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  );
}
function BuiltIn({ i }: { i: Item }) {
  const { width: w, depth: d, height: h, color: c, kind: k } = i;
  const leg = (x: number, z: number) => (
    <Box
      key={x + ":" + z}
      position={[x, h * 0.35, z]}
      size={[0.055, h * 0.7, 0.055]}
      color="#6e6052"
    />
  );
  if (k === "rug")
    return <Box size={[w, h, d]} position={[0, h / 2, 0]} color={c} />;
  if (k === "table")
    return (
      <>
        <Box size={[w, 0.08, d]} position={[0, h - 0.04, 0]} color={c} />
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => leg(x * w * 0.42, z * d * 0.4)),
        )}
      </>
    );
  if (k === "sofa" || k === "chair")
    return (
      <>
        <Box
          size={[w * 0.9, h * 0.42, d * 0.9]}
          position={[0, h * 0.3, 0]}
          color={c}
        />
        <Box
          size={[w, h * 0.58, d * 0.18]}
          position={[0, h * 0.68, -d * 0.4]}
          color={c}
        />
        {[-1, 1].map((s) => (
          <Box
            key={s}
            size={[w * 0.12, h * 0.5, d]}
            position={[s * w * 0.44, h * 0.5, 0]}
            color={c}
          />
        ))}
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => (
            <Box
              key={x + ":" + z}
              size={[0.07, h * 0.12, 0.07]}
              position={[x * w * 0.38, h * 0.06, z * d * 0.35]}
              color="#5c5147"
            />
          )),
        )}
      </>
    );
  if (k === "bed")
    return (
      <>
        <Box size={[w, h * 0.5, d]} position={[0, h * 0.25, 0]} color={c} />
        <Box
          size={[w * 0.96, h * 0.25, d * 0.93]}
          position={[0, h * 0.63, 0]}
          color="#f4eee5"
        />
        <Box size={[w, h, 0.1]} position={[0, h * 0.5, -d * 0.48]} color={c} />
        {[-1, 1].map((s) => (
          <Box
            key={s}
            size={[w * 0.4, 0.12, d * 0.18]}
            position={[s * w * 0.24, h * 0.82, -d * 0.31]}
            color="#fffaf2"
          />
        ))}
      </>
    );
  if (k === "lamp" || k === "plant")
    return (
      <>
        <mesh position={[0, h * 0.18, 0]}>
          <cylinderGeometry args={[w * 0.3, w * 0.22, h * 0.35, 20]} />
          <meshStandardMaterial color={c} />
        </mesh>
        <Box
          size={[0.04, h * 0.7, 0.04]}
          position={[0, h * 0.55, 0]}
          color="#7f795c"
        />
        <mesh position={[0, h * 0.78, 0]}>
          <sphereGeometry args={[w * 0.48, 20, 16]} />
          <meshStandardMaterial color={k === "plant" ? "#6e8962" : "#fff0ce"} />
        </mesh>
      </>
    );
  if (k === "tv")
    return (
      <>
        <Box
          size={[w, h * 0.85, d * 0.3]}
          position={[0, h * 0.6, 0]}
          color="#2a3031"
        />
        <Box
          size={[w * 0.5, 0.05, d]}
          position={[0, 0.025, 0]}
          color="#50575a"
        />
      </>
    );
  if (k === "shower")
    return (
      <>
        <Box size={[w, 0.1, d]} position={[0, 0.05, 0]} color="#fafafa" />
        <mesh position={[0, h / 2, -d / 2]}>
          <boxGeometry args={[w, h, 0.04]} />
          <meshStandardMaterial color="#b1d6df" transparent opacity={0.4} />
        </mesh>
      </>
    );
  return (
    <>
      <Box size={[w, h, d]} position={[0, h / 2, 0]} color={c} />
      {[0.3, 0.6].map((v) => (
        <Box
          key={v}
          size={[w * 0.86, 0.02, 0.02]}
          position={[0, h * v, d / 2 + 0.01]}
          color="#786b5b"
        />
      ))}
      {k === "sink" && (
        <Box
          size={[w * 0.8, 0.06, d * 0.8]}
          position={[0, h + 0.03, 0]}
          color="white"
        />
      )}
    </>
  );
}
function Model({ i, onError }: { i: Item; onError: (s: string) => void }) {
  const [group, setGroup] = useState<Group>();
  useEffect(() => {
    let active = true;
    assetGet(i.asset!)
      .then((b) => {
        if (!b) throw Error("Modèle local introuvable.");
        return parseModel(b);
      })
      .then((g) => {
        if (active) setGroup(g.scene);
      })
      .catch((e) => onError(e.message));
    return () => {
      active = false;
    };
  }, [i.asset, onError]);
  const normalized = useMemo(() => {
    if (!group) return null;
    const clone = group.clone(true),
      box = new Box3().setFromObject(clone),
      size = box.getSize(new Vector3()),
      center = box.getCenter(new Vector3());
    clone.position.set(-center.x, -box.min.y, -center.z);
    return {
      clone,
      scale: [
        i.width / (size.x || 1),
        i.height / (size.y || 1),
        i.depth / (size.z || 1),
      ] as [number, number, number],
    };
  }, [group, i.width, i.height, i.depth]);
  return normalized ? (
    <group scale={normalized.scale}>
      <primitive object={normalized.clone} />
    </group>
  ) : (
    <Box
      size={[i.width, i.height, i.depth]}
      position={[0, i.height / 2, 0]}
      color={i.color}
    />
  );
}
function WallMesh({ w, transparent }: { w: Wall; transparent: boolean }) {
  const length = distance(w.a, w.b),
    angle = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x),
    parts: React.ReactNode[] = [];
  let cursor = 0;
  function piece(
    start: number,
    end: number,
    bottom: number,
    top: number,
    key: string,
  ) {
    if (end - start < 0.001 || top - bottom < 0.001) return;
    parts.push(
      <mesh
        key={key}
        position={[(start + end) / 2, (bottom + top) / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[end - start, top - bottom, w.thickness]} />
        <meshStandardMaterial
          color={w.color}
          transparent={transparent}
          opacity={transparent ? 0.23 : 1}
        />
      </mesh>,
    );
  }
  for (const o of [...w.openings].sort((a, b) => a.offset - b.offset)) {
    const start = Math.max(cursor, o.offset),
      end = Math.min(length, o.offset + o.width);
    piece(cursor, start, 0, w.height, o.id + "a");
    piece(start, end, 0, o.sill, o.id + "b");
    piece(start, end, o.sill + o.height, w.height, o.id + "c");
    if (o.kind === "window")
      parts.push(
        <mesh
          key={o.id}
          position={[(start + end) / 2, o.sill + o.height / 2, 0]}
        >
          <boxGeometry args={[end - start, o.height, 0.025]} />
          <meshStandardMaterial color="#a0c7d5" transparent opacity={0.35} />
        </mesh>,
      );
    cursor = end;
  }
  piece(cursor, length, 0, w.height, "last");
  return (
    <group position={[w.a.x, 0, w.a.y]} rotation={[0, -angle, 0]}>
      {parts}
    </group>
  );
}
function Floor({ r, ceiling }: { r: Room; ceiling?: boolean }) {
  const shape = useMemo(() => {
    const s = new Shape();
    r.points.forEach((p, i) => (i ? s.lineTo(p.x, -p.y) : s.moveTo(p.x, -p.y)));
    s.closePath();
    return s;
  }, [r]);
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, ceiling ? 2.6 : 0, 0]}
      receiveShadow
    >
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={ceiling ? "#eee9e2" : r.color}
        side={DoubleSide}
      />
    </mesh>
  );
}
function Walk() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(2, 1.65, 4);
  }, [camera]);
  useEffect(() => {
    const keys = new Set<string>();
    const down = (e: KeyboardEvent) => keys.add(e.code),
      up = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    let frame: number,
      last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const forward = new Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = forward.clone().cross(new Vector3(0, 1, 0));
      if (!document.pointerLockElement) {
        keys.clear();
        frame = requestAnimationFrame(tick);
        return;
      }
      if (keys.has("KeyW") || keys.has("KeyZ") || keys.has("ArrowUp"))
        camera.position.addScaledVector(forward, dt * 2);
      if (keys.has("KeyS") || keys.has("ArrowDown"))
        camera.position.addScaledVector(forward, -dt * 2);
      if (keys.has("KeyD") || keys.has("ArrowRight"))
        camera.position.addScaledVector(right, dt * 2);
      if (keys.has("KeyA") || keys.has("KeyQ") || keys.has("ArrowLeft"))
        camera.position.addScaledVector(right, -dt * 2);
      camera.position.y = 1.65;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [camera]);
  return <PointerLockControls />;
}
function DropFurniture() {
  const { gl, camera } = useThree();
  const { change, select } = useStore();
  useEffect(() => {
    const canvas = gl.domElement;
    const drop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const raw = e.dataTransfer?.getData("roomora-item");
        if (!raw) return;
        const i = JSON.parse(raw),
          rect = canvas.getBoundingClientRect(),
          ray = new Raycaster();
        ray.setFromCamera(
          new Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            (-(e.clientY - rect.top) / rect.height) * 2 + 1,
          ),
          camera,
        );
        const q = ray.ray.intersectPlane(
          new Plane(new Vector3(0, 1, 0), 0),
          new Vector3(),
        );
        if (!q) return;
        const id = uid();
        change((p) => p.items.push({ ...i, id, x: q.x, y: q.z }));
        select(id);
      } catch {}
    };
    const over = (e: DragEvent) => e.preventDefault();
    canvas.addEventListener("drop", drop);
    canvas.addEventListener("dragover", over);
    return () => {
      canvas.removeEventListener("drop", drop);
      canvas.removeEventListener("dragover", over);
    };
  }, [gl, camera, change, select]);
  return null;
}
export default function Scene({
  walk,
  transparent,
  ceiling,
  hide,
  quality,
  snap,
  onError,
}: {
  walk: boolean;
  transparent: boolean;
  ceiling: boolean;
  hide: boolean;
  quality: boolean;
  snap: boolean;
  onError: (s: string) => void;
}) {
  const { project: p, selected, select, change } = useStore();
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  const ground = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  function move(e: ThreeEvent<PointerEvent>) {
    if (!drag) return;
    e.stopPropagation();
    const q = e.ray.intersectPlane(ground, new Vector3());
    if (!q) return;
    const round = (v: number) => (snap ? Math.round(v * 20) / 20 : v);
    setDrag({ ...drag, x: round(q.x - drag.dx), y: round(q.z - drag.dy) });
  }
  function finish(e: ThreeEvent<PointerEvent>) {
    if (!drag) return;
    e.stopPropagation();
    change((p) => {
      const i = p.items.find((i) => i.id === drag.id);
      if (i) {
        i.x = drag.x;
        i.y = drag.y;
      }
    });
    setDrag(null);
    (e.target as Element).releasePointerCapture(e.pointerId);
  }
  return (
    <Canvas
      shadows
      dpr={[1, quality ? 2 : 1.25]}
      gl={{ preserveDrawingBuffer: true }}
      camera={{ position: [11, 10, 13], fov: 42 }}
      onPointerMissed={() => select(null)}
    >
      <DropFurniture />
      <color attach="background" args={["#e8eae6"]} />
      <ambientLight intensity={1.1} />
      <hemisphereLight args={["#f9f6ef", "#8b9b8a", 1]} />
      <directionalLight
        position={[3, 12, 5]}
        intensity={2}
        castShadow
        shadow-mapSize={quality ? 2048 : 1024}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <Grid
        infiniteGrid
        fadeDistance={40}
        cellSize={1}
        sectionSize={5}
        cellColor="#b7bfb6"
        sectionColor="#a4afa2"
        position={[0, -0.035, 0]}
      />
      {p.rooms.map((r) => (
        <group key={r.id}>
          <Floor r={r} />
          {ceiling && <Floor r={r} ceiling />}
        </group>
      ))}
      {p.walls.map((w) => (
        <WallMesh key={w.id} w={w} transparent={transparent} />
      ))}
      {!hide &&
        p.items.map((i) => (
          <group
            key={i.id}
            position={[
              drag?.id === i.id ? drag.x : i.x,
              0,
              drag?.id === i.id ? drag.y : i.y,
            ]}
            rotation={[0, (-i.rotation * Math.PI) / 180, 0]}
            onClick={(e) => {
              e.stopPropagation();
              select(i.id);
            }}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerDown={(e) => {
              if (walk) return;
              e.stopPropagation();
              select(i.id);
              const q = e.ray.intersectPlane(ground, new Vector3());
              if (q)
                setDrag({
                  id: i.id,
                  x: i.x,
                  y: i.y,
                  dx: q.x - i.x,
                  dy: q.z - i.y,
                });
              (e.target as Element).setPointerCapture(e.pointerId);
            }}
          >
            <Suspense fallback={null}>
              {i.asset ? <Model i={i} onError={onError} /> : <BuiltIn i={i} />}
            </Suspense>
            {(selected === i.id || collides(i, p)) && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
                <planeGeometry args={[i.width + 0.08, i.depth + 0.08]} />
                <meshBasicMaterial
                  color={collides(i, p) ? "#dc725e" : "#41796b"}
                  transparent
                  opacity={0.5}
                />
              </mesh>
            )}
          </group>
        ))}
      {quality && (
        <ContactShadows
          position={[4, 0.005, 3]}
          scale={20}
          opacity={0.3}
          blur={2}
          far={5}
        />
      )}{" "}
      {walk ? (
        <Walk />
      ) : (
        <OrbitControls
          makeDefault
          enabled={!drag}
          target={[4, 0, 3]}
          maxPolarAngle={Math.PI / 2 - 0.03}
        />
      )}
    </Canvas>
  );
}

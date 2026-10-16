import { useTouchDevice } from "./useDevice";
import { useTouchWalk } from "./TouchVisit";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  createContext,
  useContext,
} from "react";
import {
  Canvas,
  useThree,
  useFrame,
  type ThreeEvent,
} from "@react-three/fiber";
import {
  OrbitControls,
  PointerLockControls,
  Grid,
  ContactShadows,
  RoundedBox,
  Line,
} from "@react-three/drei";
import {
  Box3,
  Euler,
  PMREMGenerator,
  ACESFilmicToneMapping,
  NeutralToneMapping,
  Vector3,
  Shape,
  DoubleSide,
  Plane,
  Raycaster,
  Vector2,
  type Group,
  MOUSE,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { lightingProfiles, type LightingProfile } from "./lighting";
import { finishDefinition } from "./floorFinishes";
import { surfaceMaps, useSurfaceMaps } from "./materials";
import { magneticPlacement, type AlignmentGuide } from "./placement";
import { wallPlacement } from "./wallPlacement";
import { wallOutline, visitStart } from "./spatial";
import NavigationCamera from "./NavigationCamera";
import { useNavigation } from "./navigation";
import {
  acquireModel,
  normalizedClone,
  modelFootprints,
  modelNode,
} from "./modelAssets";
import { useStore } from "./store";
import {
  distance,
  collides,
  corners,
  uid,
  type Item,
  type Wall,
  type Room,
} from "./model";
const RealismContext = createContext(false);
const FabricContext = createContext<ReturnType<typeof surfaceMaps> | null>(
  null,
);
function StudioLighting({
  realistic,
  exposure,
}: {
  realistic: boolean;
  exposure: number;
}) {
  const { scene, gl, invalidate } = useThree();
  useEffect(() => {
    const old = scene.environment,
      oldTone = gl.toneMapping,
      oldExposure = gl.toneMappingExposure,
      oldIntensity = scene.environmentIntensity;
    gl.toneMapping = realistic ? ACESFilmicToneMapping : NeutralToneMapping;
    gl.toneMappingExposure = realistic ? 1.05 : 1;
    if (!realistic)
      return () => {
        gl.toneMapping = oldTone;
        gl.toneMappingExposure = oldExposure;
      };
    const generator = new PMREMGenerator(gl),
      room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.7;
    return () => {
      scene.environment = old;
      scene.environmentIntensity = oldIntensity;
      target.dispose();
      room.dispose();
      generator.dispose();
      gl.toneMapping = oldTone;
      gl.toneMappingExposure = oldExposure;
    };
  }, [scene, gl, realistic]);
  useEffect(() => {
    gl.toneMappingExposure = realistic ? exposure : 1;
    invalidate();
  }, [gl, realistic, exposure, invalidate]);
  return null;
}
function Box({
  position = [0, 0, 0],
  size,
  color,
  fabric = false,
}: {
  position?: [number, number, number];
  size: [number, number, number];
  color: string;
  fabric?: boolean;
}) {
  const realistic = useContext(RealismContext);
  const texture = useContext(FabricContext);
  if (realistic)
    return (
      <RoundedBox
        args={size}
        radius={Math.min(0.035, ...size.map((v) => v * 0.12))}
        smoothness={2}
        position={position}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={color}
          map={fabric ? texture?.map : null}
          bumpMap={fabric ? texture?.bumpMap : null}
          roughnessMap={fabric ? texture?.roughnessMap : null}
          bumpScale={0.004}
          roughness={fabric ? 0.9 : 0.65}
        />
      </RoundedBox>
    );
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
          fabric
          size={[w * 0.9, h * 0.42, d * 0.9]}
          position={[0, h * 0.3, 0]}
          color={c}
        />
        <Box
          fabric
          size={[w, h * 0.58, d * 0.18]}
          position={[0, h * 0.68, -d * 0.4]}
          color={c}
        />
        {[-1, 1].map((s) => (
          <Box
            fabric
            key={s}
            size={[w * 0.12, h * 0.5, d]}
            position={[s * w * 0.44, h * 0.5, 0]}
            color={c}
          />
        ))}
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => (
            <Box
              fabric
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
          fabric
          color="#f4eee5"
        />
        <Box size={[w, h, 0.1]} position={[0, h * 0.5, -d * 0.48]} color={c} />
        {[-1, 1].map((s) => (
          <Box
            key={s}
            size={[w * 0.4, 0.12, d * 0.18]}
            position={[s * w * 0.24, h * 0.82, -d * 0.31]}
            fabric
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
    const lease = acquireModel(i.asset!);
    lease.promise
      .then((g) => {
        if (active) {
          setGroup(g.scene);
          if (i.footprints === undefined) {
            const footprints = modelFootprints(modelNode(g.scene, i.modelPart));
            if (footprints)
              useStore
                .getState()
                .enrichFootprints(i.asset!, i.modelPart, footprints);
          }
        }
      })
      .catch((e) => onError(e.message));
    return () => {
      active = false;
      lease.release();
    };
  }, [i.asset, i.modelPart, i.footprints === undefined, onError]);
  const normalized = useMemo(
    () => (group ? normalizedClone(group, i.modelPart) : null),
    [group, i.modelPart],
  );
  return normalized ? (
    <group
      scale={[
        i.width / (normalized.size.x || 1),
        i.height / (normalized.size.y || 1),
        i.depth / (normalized.size.z || 1),
      ]}
      dispose={null}
    >
      <primitive object={normalized.group} dispose={null} />
    </group>
  ) : (
    <Box
      size={[i.width, i.height, i.depth]}
      position={[0, i.height / 2, 0]}
      color={i.color}
    />
  );
}
function WallMesh({
  w,
  walls,
  transparent,
}: {
  w: Wall;
  walls: Wall[];
  transparent: boolean;
}) {
  const realistic = useContext(RealismContext);
  const select = useStore((s) => s.select);
  const finish = w.finish || "paint";
  const definition = finishDefinition(finish);
  const maps = useSurfaceMaps(finish, w.textureScale, w.textureAngle)!;
  const outline = wallOutline(w, walls);
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
        position={[0, bottom, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <extrudeGeometry
          args={[
            (() => {
              const local = outline.map((q) => ({
                x:
                  (q.x - w.a.x) * Math.cos(angle) +
                  (q.y - w.a.y) * Math.sin(angle),
                z:
                  -(q.x - w.a.x) * Math.sin(angle) +
                  (q.y - w.a.y) * Math.cos(angle),
              }));
              const pts = [
                start === 0 ? local[0] : { x: start, z: w.thickness / 2 },
                end === length ? local[1] : { x: end, z: w.thickness / 2 },
                end === length ? local[2] : { x: end, z: -w.thickness / 2 },
                start === 0 ? local[3] : { x: start, z: -w.thickness / 2 },
              ];
              const shape = new Shape();
              pts.forEach((p, i) =>
                i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z),
              );
              shape.closePath();
              return shape;
            })(),
            { depth: top - bottom, bevelEnabled: false },
          ]}
        />
        <meshStandardMaterial
          color={w.color}
          map={maps.map}
          bumpMap={realistic ? maps.bumpMap : null}
          roughnessMap={realistic ? maps.roughnessMap : null}
          roughness={definition.roughness}
          bumpScale={definition.relief}
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
          <meshPhysicalMaterial
            color="#d7edf4"
            transparent
            opacity={realistic ? 0.22 : 0.35}
            roughness={0.08}
            metalness={0}
            clearcoat={1}
            depthWrite={false}
          />
        </mesh>,
      );
    cursor = end;
  }
  piece(cursor, length, 0, w.height, "last");
  return (
    <group
      position={[w.a.x, 0, w.a.y]}
      rotation={[0, -angle, 0]}
      onClick={(e) => {
        if (!document.pointerLockElement) {
          e.stopPropagation();
          select(w.id);
        }
      }}
    >
      {parts}
    </group>
  );
}
function Floor({ r, ceiling }: { r: Room; ceiling?: boolean }) {
  const select = useStore((s) => s.select);
  const realistic = useContext(RealismContext);
  const finish = r.finish || "plain";
  const definition = finishDefinition(finish);
  const maps = useSurfaceMaps(
    finish,
    r.textureScale,
    r.textureAngle,
    !ceiling && finish !== "plain",
  );
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
      onClick={(e) => {
        if (!ceiling && !document.pointerLockElement) {
          e.stopPropagation();
          select(r.id);
        }
      }}
      receiveShadow
    >
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={
          ceiling
            ? r.ceilingColor || "#eee9e2"
            : maps
              ? r.tint || "#ffffff"
              : r.color
        }
        map={maps?.map}
        bumpMap={realistic ? maps?.bumpMap : null}
        roughnessMap={realistic ? maps?.roughnessMap : null}
        bumpScale={definition.relief}
        roughness={ceiling ? 0.95 : definition.roughness}
        side={DoubleSide}
      />
    </mesh>
  );
}
function Walk({
  eyeHeight,
  fieldOfView,
  speed,
}: {
  eyeHeight: number;
  fieldOfView: number;
  speed: number;
}) {
  const { camera, gl } = useThree();
  const touch = useTouchDevice();
  const p = useStore((s) => s.project);
  const start = useMemo(() => visitStart(p), [p.id]);
  const keys = useRef(new Set<string>());
  const velocity = useRef(new Vector3());
  useEffect(() => {
    camera.position.set(start.x, eyeHeight, start.y);
    camera.lookAt(start.x + 1, eyeHeight, start.y);
  }, [camera, start]);
  useEffect(() => {
    if ("fov" in camera) {
      (camera as import("three").PerspectiveCamera).fov = fieldOfView;
      camera.updateProjectionMatrix();
    }
    camera.position.y = eyeHeight;
  }, [camera, fieldOfView, eyeHeight]);
  useEffect(() => {
    const clear = () => {
      keys.current.clear();
      velocity.current.set(0, 0, 0);
    };
    const down = (e: KeyboardEvent) => {
      if (document.pointerLockElement) {
        e.preventDefault();
        keys.current.add(e.code);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("pointerlockchange", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("pointerlockchange", clear);
    };
  }, []);
  useEffect(() => {
    if (!touch) return;
    const canvas = gl.domElement;
    let pointer: { id: number; x: number; y: number } | undefined;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || pointer) return;
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
    if (!document.pointerLockElement && !touch) return;
    const dt = Math.min(delta, 0.05),
      k = keys.current;
    const forward = camera.getWorldDirection(new Vector3());
    forward.y = 0;
    forward.normalize();
    const right = forward.clone().cross(new Vector3(0, 1, 0));
    const direction = new Vector3();
    if (k.has("KeyW") || k.has("KeyZ") || k.has("ArrowUp"))
      direction.add(forward);
    if (k.has("KeyS") || k.has("ArrowDown")) direction.sub(forward);
    if (k.has("KeyD") || k.has("ArrowRight")) direction.add(right);
    if (k.has("KeyA") || k.has("KeyQ") || k.has("ArrowLeft"))
      direction.sub(right);
    if (touch) {
      const movement = useTouchWalk.getState();
      direction
        .addScaledVector(forward, movement.y)
        .addScaledVector(right, movement.x);
    }
    direction.normalize().multiplyScalar(speed);
    velocity.current.lerp(direction, 1 - Math.exp(-12 * dt));
    camera.position.addScaledVector(velocity.current, dt);
    camera.position.y = eyeHeight;
  });
  return touch ? null : (
    <PointerLockControls selector=".viewport canvas" pointerSpeed={0.65} />
  );
}
function DropFurniture() {
  const { gl, camera } = useThree();
  const { change, select } = useStore();
  useEffect(() => {
    const canvas = gl.domElement;
    const drop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files.length) return;
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
  eyeHeight = 1.55,
  fieldOfView = 72,
  walkSpeed = 1.4,
  realistic = false,
  paused = false,
  showCollisions = true,
  lighting = "daylight",
  exposure = 1.05,
}: {
  lighting?: LightingProfile;
  exposure?: number;
  realistic?: boolean;
  paused?: boolean;
  showCollisions?: boolean;
  eyeHeight?: number;
  fieldOfView?: number;
  walkSpeed?: number;
  walk: boolean;
  transparent: boolean;
  ceiling: boolean;
  hide: boolean;
  quality: boolean;
  snap: boolean;
  onError: (s: string) => void;
}) {
  const { project: p, selected, select, change } = useStore();
  const touchDevice = useTouchDevice();
  const light = lightingProfiles[lighting];
  const fabricTexture = useSurfaceMaps("fabric", 1, 0, realistic);
  const bounds = useMemo(() => {
    const points = [
      ...p.walls.flatMap((w) => [w.a, w.b]),
      ...p.rooms.flatMap((r) => r.points),
      ...p.items.flatMap((i) => corners(i)),
    ];
    if (!points.length) return { x: 4, y: 3, span: 8, height: 2.6 };
    const xs = points.map((q) => q.x),
      ys = points.map((q) => q.y),
      minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      span: Math.max(4, maxX - minX, maxY - minY),
      height: Math.max(
        2.6,
        ...p.walls.map((w) => w.height),
        ...p.items.map((i) => i.height + (i.elevation || 0)),
      ),
    };
  }, [p.walls, p.rooms, p.items]);
  const collisionIds = useMemo(
    () =>
      new Set(
        showCollisions
          ? p.items.filter((i) => collides(i, p)).map((i) => i.id)
          : [],
      ),
    [p, showCollisions],
  );
  const [drag, setDragState] = useState<{
    id: string;
    x: number;
    y: number;
    elevation: number;
    rotation: number;
  } | null>(null);
  const latestDrag = useRef<typeof drag>(null);
  function setDrag(next: typeof drag) {
    latestDrag.current = next;
    setDragState(next);
  }
  const draggedItem = drag ? p.items.find((i) => i.id === drag.id) : undefined;
  const previewCollision =
    showCollisions && drag && draggedItem
      ? collides({ ...draggedItem, ...drag }, p)
      : false;
  const [hovered, setHovered] = useState(false);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const gesture = useRef<{
    id: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
    sx: number;
    sy: number;
    elevation: number;
    rotation: number;
    plane: Plane;
    startHeight: number;
    placement: "floor" | "height" | "wall";
  } | null>(null);
  const { mode, space, placement: placementMode } = useNavigation();
  const panning = mode === "pan" || space;
  const orbit = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const touchPointers = useRef(new Set<number>());
  function cancelDrag() {
    setGuides([]);
    gesture.current = null;
    setDrag(null);
    if (orbit.current) orbit.current.enabled = true;
  }
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDrag();
    };
    const blur = () => {
      touchPointers.current.clear();
      cancelDrag();
    };
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useEffect(() => {
    if (panning) cancelDrag();
  }, [panning]);
  useEffect(() => {
    touchPointers.current.clear();
    cancelDrag();
  }, [placementMode, p.id]);
  const ground = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  function move(e: ThreeEvent<PointerEvent>) {
    const g = gesture.current;
    if (!g) return;
    e.stopPropagation();
    if (!drag && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 5) return;
    const source = p.items.find((i) => i.id === g.id);
    if (!source) return;
    if (g.placement === "wall") {
      const placed = wallPlacement(source, p.walls, e.ray, snap);
      if (placed)
        setDrag({
          id: source.id,
          x: placed.x,
          y: placed.y,
          elevation: placed.elevation || 0,
          rotation: placed.rotation,
        });
      setGuides([]);
      return;
    }
    const q = e.ray.intersectPlane(g.plane, new Vector3());
    if (!q) return;
    if (g.placement === "height") {
      const height = Math.max(0, g.elevation + q.y - g.startHeight);
      setDrag({
        id: g.id,
        x: g.x,
        y: g.y,
        elevation: snap ? Math.round(height * 20) / 20 : height,
        rotation: g.rotation,
      });
      return;
    }
    const candidate = {
      ...p.items.find((i) => i.id === g.id)!,
      x: q.x - g.dx,
      y: q.z - g.dy,
    };
    const placement = snap
      ? magneticPlacement(candidate, p)
      : { item: candidate, guides: [] };
    setDrag({
      id: g.id,
      x: placement.item.x,
      y: placement.item.y,
      elevation: g.elevation,
      rotation: g.rotation,
    });
    setGuides(placement.guides);
  }
  function finish(e: ThreeEvent<PointerEvent>) {
    const drag = latestDrag.current;
    const g = gesture.current;
    if (!g) return;
    e.stopPropagation();
    if (
      drag &&
      (Math.abs(drag.x - g.x) > 0.0001 ||
        Math.abs(drag.y - g.y) > 0.0001 ||
        Math.abs(drag.elevation - g.elevation) > 0.0001 ||
        Math.abs(drag.rotation - g.rotation) > 0.0001)
    )
      change((p) => {
        const i = p.items.find((i) => i.id === g.id);
        if (i) {
          i.x = drag.x;
          i.y = drag.y;
          i.elevation = drag.elevation;
          i.rotation = drag.rotation;
        }
      });
    cancelDrag();
    setGuides([]);
    (e.target as Element).releasePointerCapture(e.pointerId);
  }
  return (
    <Canvas
      onPointerDownCapture={(e) => {
        if (e.pointerType !== "touch") return;
        touchPointers.current.add(e.pointerId);
        if (touchPointers.current.size > 1) cancelDrag();
      }}
      onPointerUpCapture={(e) => touchPointers.current.delete(e.pointerId)}
      onPointerCancelCapture={(e) => {
        touchPointers.current.delete(e.pointerId);
        cancelDrag();
      }}
      shadows
      frameloop={paused ? "never" : walk ? "always" : "demand"}
      style={{
        touchAction: "none",
        cursor: drag
          ? "grabbing"
          : panning
            ? "grab"
            : hovered
              ? "move"
              : "grab",
      }}
      dpr={[1, touchDevice ? (quality ? 1.5 : 1) : quality ? 2 : 1.25]}
      gl={{ preserveDrawingBuffer: true }}
      camera={{
        position: [11, 10, 13],
        fov: walk ? fieldOfView : 42,
        near: 0.05,
        far: Math.max(500, bounds.span * 30),
      }}
      onPointerMissed={() => select(null)}
    >
      <RealismContext.Provider value={realistic}>
        <FabricContext.Provider value={fabricTexture}>
          <StudioLighting realistic={realistic} exposure={exposure} />
          {!walk && <NavigationCamera key={p.id} id={p.id} bounds={bounds} />}
          <DropFurniture />
          <color attach="background" args={["#e8eae6"]} />
          <ambientLight intensity={realistic ? light.ambient : 1.1} />
          <hemisphereLight
            args={[
              realistic ? light.sky : "#f9f6ef",
              realistic ? light.ground : "#8b9b8a",
              realistic ? light.hemisphere : 1,
            ]}
          />
          {realistic && (
            <directionalLight
              position={[bounds.x - 6, 5, bounds.y - 4]}
              color={light.sky}
              intensity={light.fill}
            />
          )}
          <directionalLight
            position={[
              bounds.x + 3,
              lighting === "warm" ? 6 : 12,
              bounds.y + 5,
            ]}
            color={realistic ? light.color : "#ffffff"}
            intensity={realistic ? light.sun : 2}
            castShadow
            shadow-mapSize={quality ? 2048 : 1024}
            shadow-camera-left={-Math.max(12, bounds.span)}
            shadow-camera-right={Math.max(12, bounds.span)}
            shadow-camera-top={Math.max(12, bounds.span)}
            shadow-camera-bottom={-Math.max(12, bounds.span)}
            shadow-normalBias={0.025}
            shadow-bias={-0.00015}
            shadow-radius={quality ? 4 : 2}
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
            <WallMesh
              key={w.id}
              w={w}
              walls={p.walls}
              transparent={transparent && !walk}
            />
          ))}
          {!hide &&
            p.items.map((i) => {
              const collision =
                drag?.id === i.id ? previewCollision : collisionIds.has(i.id);
              return (
                <group
                  key={i.id}
                  position={[
                    drag?.id === i.id ? drag.x : i.x,
                    drag?.id === i.id ? drag.elevation : i.elevation || 0,
                    drag?.id === i.id ? drag.y : i.y,
                  ]}
                  rotation={[
                    0,
                    (-(drag?.id === i.id ? drag.rotation : i.rotation) *
                      Math.PI) /
                      180,
                    0,
                  ]}
                  onClick={(e) => {
                    e.stopPropagation();
                    select(i.id);
                  }}
                  onPointerMove={move}
                  onPointerUp={finish}
                  onPointerEnter={() => setHovered(true)}
                  onPointerLeave={() => setHovered(false)}
                  onPointerCancel={() => {
                    cancelDrag();
                    setGuides([]);
                  }}
                  onPointerDown={(e) => {
                    if (
                      walk ||
                      touchPointers.current.size > 1 ||
                      panning ||
                      e.button !== 0 ||
                      e.ctrlKey ||
                      e.metaKey ||
                      e.shiftKey
                    )
                      return;
                    e.stopPropagation();
                    select(i.id);
                    const plane =
                      placementMode === "height"
                        ? new Plane().setFromNormalAndCoplanarPoint(
                            new Vector3(
                              e.ray.direction.x,
                              0,
                              e.ray.direction.z,
                            ).normalize(),
                            new Vector3(i.x, i.elevation || 0, i.y),
                          )
                        : ground;
                    const q = e.ray.intersectPlane(plane, new Vector3());
                    if (!q) return;
                    if (orbit.current) orbit.current.enabled = false;
                    gesture.current = {
                      id: i.id,
                      x: i.x,
                      y: i.y,
                      dx: q.x - i.x,
                      dy: q.z - i.y,
                      sx: e.clientX,
                      sy: e.clientY,
                      elevation: i.elevation || 0,
                      rotation: i.rotation,
                      plane,
                      startHeight: q.y,
                      placement: placementMode,
                    };
                    (e.target as Element).setPointerCapture(e.pointerId);
                  }}
                >
                  <Suspense fallback={null}>
                    {i.asset ? (
                      <Model i={i} onError={onError} />
                    ) : (
                      <BuiltIn i={i} />
                    )}
                  </Suspense>
                  {(selected === i.id || collision) &&
                    (collision && i.footprints
                      ? i.footprints
                      : [{ x: 0, y: 0, width: 1, depth: 1, bottom: 0, top: 1 }]
                    ).map((f, k) => (
                      <mesh
                        key={k}
                        rotation={[-Math.PI / 2, 0, 0]}
                        position={[
                          f.x * i.width,
                          0.015 - (i.elevation || 0),
                          f.y * i.depth,
                        ]}
                      >
                        <planeGeometry
                          args={[
                            f.width * i.width + 0.01,
                            f.depth * i.depth + 0.01,
                          ]}
                        />
                        <meshBasicMaterial
                          color={collision ? "#dc725e" : "#41796b"}
                          transparent
                          opacity={0.45}
                        />
                      </mesh>
                    ))}
                </group>
              );
            })}
          {guides.map((g, index) => (
            <Line
              key={index}
              points={[
                [g.a.x, 0.025, g.a.y],
                [g.b.x, 0.025, g.b.y],
              ]}
              color="#397bea"
              lineWidth={1.5}
              dashed
              dashSize={0.12}
              gapSize={0.07}
            />
          ))}
          {(quality || realistic) && (
            <ContactShadows
              position={[bounds.x, 0.005, bounds.y]}
              scale={Math.max(12, bounds.span * 1.8)}
              resolution={quality ? 512 : 256}
              opacity={realistic ? 0.4 : 0.3}
              blur={2.5}
              far={5}
            />
          )}{" "}
          {walk ? (
            <Walk
              eyeHeight={eyeHeight}
              fieldOfView={fieldOfView}
              speed={walkSpeed}
            />
          ) : (
            <OrbitControls
              ref={orbit}
              makeDefault
              zoomToCursor
              screenSpacePanning={false}
              minDistance={Math.max(0.25, Math.min(1, bounds.span * 0.04))}
              maxDistance={Math.max(30, bounds.span * 12)}
              mouseButtons={{
                LEFT: panning ? MOUSE.PAN : MOUSE.ROTATE,
                MIDDLE: MOUSE.DOLLY,
                RIGHT: MOUSE.PAN,
              }}
              enableDamping
              dampingFactor={0.1}
              enabled={!drag}
              target={[bounds.x, 0, bounds.y]}
              maxPolarAngle={Math.PI / 2}
            />
          )}
        </FabricContext.Provider>
      </RealismContext.Provider>
    </Canvas>
  );
}

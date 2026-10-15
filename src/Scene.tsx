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
} from "@react-three/drei";
import {
  Box3,
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
  type Texture,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { surfaceTexture } from "./materials";
import { wallOutline, visitStart } from "./spatial";
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
const RealismContext = createContext(false);
const FabricContext = createContext<Texture | null>(null);
function StudioLighting({ realistic }: { realistic: boolean }) {
  const { scene, gl } = useThree();
  useEffect(() => {
    const old = scene.environment,
      oldTone = gl.toneMapping,
      oldExposure = gl.toneMappingExposure;
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
    scene.environmentIntensity = 0.5;
    return () => {
      scene.environment = old;
      target.dispose();
      room.dispose();
      generator.dispose();
      gl.toneMapping = oldTone;
      gl.toneMappingExposure = oldExposure;
    };
  }, [scene, gl, realistic]);
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
          map={fabric ? texture : null}
          bumpMap={fabric ? texture : null}
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
function WallMesh({
  w,
  walls,
  transparent,
}: {
  w: Wall;
  walls: Wall[];
  transparent: boolean;
}) {
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
  const select = useStore((s) => s.select);
  const realistic = useContext(RealismContext);
  const finish = r.finish || "plain";
  const texture = useMemo(
    () => (!ceiling && finish !== "plain" ? surfaceTexture(finish) : null),
    [finish, ceiling],
  );
  useEffect(() => () => texture?.dispose(), [texture]);
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
        color={ceiling ? "#eee9e2" : texture ? "#ffffff" : r.color}
        map={texture}
        bumpMap={realistic ? texture : null}
        bumpScale={finish === "tile" ? 0.012 : 0.006}
        roughness={finish === "tile" ? 0.48 : 0.78}
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
  const { camera } = useThree();
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
  useFrame((_, delta) => {
    if (!document.pointerLockElement) return;
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
    direction.normalize().multiplyScalar(speed);
    velocity.current.lerp(direction, 1 - Math.exp(-12 * dt));
    camera.position.addScaledVector(velocity.current, dt);
    camera.position.y = eyeHeight;
  });
  return <PointerLockControls pointerSpeed={0.65} />;
}
function FitCamera({
  id,
  x,
  y,
  span,
  walk,
}: {
  id: string;
  x: number;
  y: number;
  span: number;
  walk: boolean;
}) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    if (!walk) {
      camera.position.set(x + span * 0.9, span * 0.95, y + span * 1.1);
      camera.lookAt(x, 0, y);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    }
  }, [camera, id, walk, x, y, span]);
  return null;
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
}: {
  realistic?: boolean;
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
  const fabricTexture = useMemo(
    () => (realistic ? surfaceTexture("fabric") : null),
    [realistic],
  );
  useEffect(() => () => fabricTexture?.dispose(), [fabricTexture]);
  const bounds = useMemo(() => {
    const points = p.walls.flatMap((w) => [w.a, w.b]);
    if (!points.length) return { x: 4, y: 3, span: 8 };
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
    };
  }, [p.id]);
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  const orbit = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => {
    if (!drag) return;
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrag(null);
        if (orbit.current) orbit.current.enabled = true;
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [drag]);
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
    if (orbit.current) orbit.current.enabled = true;
    (e.target as Element).releasePointerCapture(e.pointerId);
  }
  return (
    <Canvas
      shadows
      style={{ touchAction: "none", cursor: drag ? "grabbing" : "grab" }}
      dpr={[1, quality ? 2 : 1.25]}
      gl={{ preserveDrawingBuffer: true }}
      camera={{
        position: [11, 10, 13],
        fov: walk ? fieldOfView : 42,
        near: 0.05,
        far: 500,
      }}
      onPointerMissed={() => select(null)}
    >
      <RealismContext.Provider value={realistic}>
        <FabricContext.Provider value={fabricTexture}>
          <StudioLighting realistic={realistic} />
          <FitCamera id={p.id} {...bounds} walk={walk} />
          <DropFurniture />
          <color attach="background" args={["#e8eae6"]} />
          <ambientLight intensity={realistic ? 0.45 : 1.1} />
          <hemisphereLight args={["#f9f6ef", "#8b9b8a", 1]} />
          <directionalLight
            position={[3, 12, 5]}
            intensity={realistic ? 2.5 : 2}
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
            <WallMesh
              key={w.id}
              w={w}
              walls={p.walls}
              transparent={transparent && !walk}
            />
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
                  if (orbit.current) orbit.current.enabled = false;
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
                  {i.asset ? (
                    <Model i={i} onError={onError} />
                  ) : (
                    <BuiltIn i={i} />
                  )}
                </Suspense>
                {(selected === i.id ||
                  collides(
                    drag?.id === i.id ? { ...i, x: drag.x, y: drag.y } : i,
                    p,
                  )) && (
                  <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0.015, 0]}
                  >
                    <planeGeometry args={[i.width + 0.08, i.depth + 0.08]} />
                    <meshBasicMaterial
                      color={
                        collides(
                          drag?.id === i.id
                            ? { ...i, x: drag.x, y: drag.y }
                            : i,
                          p,
                        )
                          ? "#dc725e"
                          : "#41796b"
                      }
                      transparent
                      opacity={0.5}
                    />
                  </mesh>
                )}
              </group>
            ))}
          {(quality || realistic) && (
            <ContactShadows
              position={[4, 0.005, 3]}
              scale={20}
              opacity={0.3}
              blur={2}
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
              enableDamping
              dampingFactor={0.1}
              enabled={!drag}
              target={[bounds.x, 0, bounds.y]}
              maxPolarAngle={Math.PI / 2 - 0.03}
            />
          )}
        </FabricContext.Provider>
      </RealismContext.Provider>
    </Canvas>
  );
}

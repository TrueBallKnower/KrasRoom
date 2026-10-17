import { useEffect, useRef } from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls, Grid, TransformControls } from "@react-three/drei";
import {
  Box3,
  Vector3,
  type Group,
  type Object3D,
  type Box3Helper,
  type PerspectiveCamera,
} from "three";
import type {
  OrbitControls as OrbitImpl,
  TransformControls as TransformImpl,
} from "three-stdlib";
export type StudioView = {
  kind: "perspective" | "top" | "front" | "fit";
  tick: number;
};
export type StudioTool = "translate" | "rotate" | "scale";
export default function StudioScene({
  group,
  selected,
  onSelect,
  onTransform,
  tool,
  snap,
  view,
  dark,
  disabled,
}: {
  group: Group;
  selected: string;
  onSelect: (id: string) => void;
  onTransform: (id: string, object: Object3D) => void;
  tool: StudioTool;
  snap: boolean;
  view: StudioView;
  dark: boolean;
  disabled: boolean;
}) {
  const mesh = group.children.find((c) => c.userData.designPart === selected);
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [3, 2.5, 3], near: 0.01, far: 2000 }}
    >
      <color attach="background" args={[dark ? "#18201f" : "#e9eae4"]} />
      <ambientLight intensity={1.7} />
      <directionalLight position={[4, 7, 5]} intensity={2} />
      <directionalLight position={[-4, 3, -3]} intensity={0.8} />
      <primitive
        object={group}
        dispose={null}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.object.userData.designPart)
            onSelect(e.object.userData.designPart);
        }}
      />
      {mesh && <Selection object={mesh} />}
      {mesh && (
        <Gizmo
          key={selected + tool}
          object={mesh}
          disabled={disabled}
          tool={tool}
          snap={snap}
          onCommit={() => onTransform(selected, mesh)}
        />
      )}
      <Grid
        position={[0, -0.006, 0]}
        args={[100, 100]}
        cellSize={0.1}
        sectionSize={1}
        cellThickness={0.5}
        sectionThickness={1}
        cellColor={dark ? "#2d3c55" : "#cfd8e5"}
        sectionColor={dark ? "#41516c" : "#a9b8cc"}
        fadeDistance={25}
        fadeStrength={1.5}
      />
      <OrbitControls
        makeDefault
        minDistance={0.1}
        maxDistance={250}
        enableDamping
        dampingFactor={0.15}
      />
      <CameraView group={group} view={view} />
    </Canvas>
  );
}
function Selection({ object }: { object: Object3D }) {
  const helper = useRef<Box3Helper>(null);
  useFrame(() => {
    helper.current?.box.setFromObject(object);
    helper.current?.updateMatrixWorld(true);
  });
  return (
    <box3Helper
      ref={helper}
      args={[new Box3().setFromObject(object), 0x578dff]}
    />
  );
}
function Gizmo({
  object,
  tool,
  snap,
  onCommit,
  disabled,
}: {
  object: Object3D;
  tool: StudioTool;
  snap: boolean;
  onCommit: () => void;
  disabled: boolean;
}) {
  const ref = useRef<TransformImpl>(null);
  const dragging = useRef(false),
    cancelled = useRef(false);
  const snapshot = useRef({
    position: object.position.clone(),
    rotation: object.rotation.clone(),
    scale: object.scale.clone(),
  });
  const { invalidate } = useThree();
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragging.current) {
        cancelled.current = true;
        const s = snapshot.current;
        object.position.copy(s.position);
        object.rotation.copy(s.rotation);
        object.scale.copy(s.scale);
        object.updateMatrixWorld(true);
        invalidate();
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [object, invalidate]);
  return (
    <TransformControls
      ref={ref}
      object={object}
      mode={tool}
      space={tool === "translate" ? "world" : "local"}
      size={0.85}
      enabled={!disabled}
      translationSnap={snap ? 0.05 : null}
      rotationSnap={snap ? Math.PI / 12 : null}
      scaleSnap={snap ? 0.05 : null}
      onObjectChange={() => {
        if (cancelled.current) {
          const s = snapshot.current;
          object.position.copy(s.position);
          object.rotation.copy(s.rotation);
          object.scale.copy(s.scale);
          object.updateMatrixWorld(true);
          invalidate();
        }
      }}
      onMouseDown={() => {
        dragging.current = true;
        cancelled.current = false;
        snapshot.current = {
          position: object.position.clone(),
          rotation: object.rotation.clone(),
          scale: object.scale.clone(),
        };
      }}
      onMouseUp={() => {
        dragging.current = false;
        onCommit();
      }}
    />
  );
}
function CameraView({ group, view }: { group: Group; view: StudioView }) {
  const { camera, controls, invalidate, size } = useThree();
  const latest = useRef(group);
  latest.current = group;
  useEffect(() => {
    const box = new Box3().setFromObject(latest.current),
      center = box.getCenter(new Vector3()),
      s = box.getSize(new Vector3());
    const span = Math.max(s.x, s.y, s.z, 0.2),
      aspect = size.width / Math.max(size.height, 1),
      fov = (camera as PerspectiveCamera).fov || 42;
    const distance =
      ((span / (2 * Math.tan((fov * Math.PI) / 360))) * 1.65) /
      Math.min(aspect, 1);
    const direction =
      view.kind === "top"
        ? new Vector3(0, 1, 0.0001)
        : view.kind === "front"
          ? new Vector3(0, 0.08, 1)
          : new Vector3(1, 0.75, 1).normalize();
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.lookAt(center);
    camera.near = Math.max(0.001, span / 1000);
    camera.far = Math.max(1000, distance * 10);
    camera.updateProjectionMatrix();
    const orbit = controls as OrbitImpl | undefined;
    orbit?.target.copy(center);
    orbit?.update();
    invalidate();
  }, [view, camera, controls, invalidate]);
  return null;
}

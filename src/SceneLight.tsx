import { Billboard } from "@react-three/drei";
import { useMemo } from "react";
import { Object3D } from "three";
import { type Item } from "./model";
export default function SceneLight({
  item,
  shadow,
  quality,
  active,
  markers,
}: {
  item: Item;
  shadow: boolean;
  quality: boolean;
  active: boolean;
  markers: boolean;
}) {
  const light = item.light!;
  const target = useMemo(() => {
    const o = new Object3D();
    const tilt = (light.tilt * Math.PI) / 180;
    o.position.set(0, -Math.cos(tilt), -Math.sin(tilt));
    return o;
  }, [light.tilt]);
  const power = light.enabled && active ? light.lumens / (4 * Math.PI) : 0;
  const props = {
    color: light.color,
    intensity: power,
    distance: light.range,
    decay: 2,
    castShadow: shadow && power > 0,
    "shadow-mapSize-width": quality ? 1024 : 512,
    "shadow-mapSize-height": quality ? 1024 : 512,
    "shadow-normalBias": 0.03,
    "shadow-bias": -0.00015,
    "shadow-camera-near": 0.05,
    "shadow-camera-far": light.range,
  };
  return (
    <group>
      {markers && (
        <Billboard>
          <mesh renderOrder={20}>
            <ringGeometry args={[0.12, 0.16, 24]} />
            <meshBasicMaterial
              color={light.enabled ? "#99b7ff" : "#7c879e"}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
        </Billboard>
      )}
      <mesh position={[0, item.height / 2, 0]}>
        <sphereGeometry
          args={[Math.min(item.width, item.depth, item.height) / 2, 12, 8]}
        />
        <meshStandardMaterial
          color={light.enabled ? light.color : "#647086"}
          emissive={light.color}
          emissiveIntensity={power > 0 ? 2 : 0}
        />
      </mesh>
      {light.type === "spot" ? (
        <>
          <primitive object={target} />
          <spotLight
            {...props}
            angle={(light.angle * Math.PI) / 360}
            penumbra={0.5}
            target={target}
          />
        </>
      ) : (
        <pointLight {...props} />
      )}
    </group>
  );
}

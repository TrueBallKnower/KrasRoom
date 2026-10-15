import { useState, useEffect } from "react";
import { Box3, Vector3 } from "three";
import {
  acquireModel,
  modelNode,
  separableParts,
  type ModelPart,
} from "./modelAssets";
import { uid, type Item } from "./model";
export default function SplitModel({
  item,
  onSplit,
}: {
  item: Item;
  onSplit: (items: Item[]) => void;
}) {
  const [parts, setParts] = useState<ModelPart[]>([]),
    [origin, setOrigin] = useState<{
      x: number;
      y: number;
      z: number;
      width: number;
      height: number;
      depth: number;
    }>(),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const lease = acquireModel(item.asset!);
    lease.promise
      .then((g) => {
        if (!active) return;
        const node = modelNode(g.scene, item.modelPart),
          b = new Box3().setFromObject(node),
          s = b.getSize(new Vector3()),
          c = b.getCenter(new Vector3());
        const parts = separableParts(g.scene, item.modelPart);
        setOrigin({
          x: c.x,
          y: b.min.y,
          z: c.z,
          width: s.x || 1,
          height: s.y || 1,
          depth: s.z || 1,
        });
        setParts(parts);
        setReady(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      lease.release();
    };
  }, [item.asset, item.modelPart]);
  function split() {
    if (!origin) return;
    const sx = item.width / origin.width,
      sy = item.height / origin.height,
      sz = item.depth / origin.depth,
      r = (item.rotation * Math.PI) / 180;
    onSplit(
      parts.map((p) => {
        const x = (p.center.x - origin.x) * sx,
          y = (p.center.z - origin.z) * sz;
        return {
          ...item,
          id: uid(),
          name: p.name,
          modelPart: p.path,
          x: item.x + x * Math.cos(r) - y * Math.sin(r),
          y: item.y + x * Math.sin(r) + y * Math.cos(r),
          elevation: (item.elevation || 0) + (p.center.y - origin.y) * sy,
          width: p.width * sx,
          height: p.height * sy,
          depth: p.depth * sz,
          footprints: p.footprints,
        };
      }),
    );
  }
  return (
    <>
      <h2>Dissocier cet ensemble</h2>
      <p className="small">
        Les sous-objets restent à leur place et partagent le même fichier 3D. Le
        découpage dépend de la structure du modèle ; vous pourrez dissocier à
        nouveau un sous-groupe.
      </p>
      {error && (
        <p role="alert" className="warning">
          {error}
        </p>
      )}
      {!ready && !error && <p>Analyse de la structure…</p>}
      {ready && !parts.length && (
        <p className="notice">
          Ce modèle ne présente pas de groupe séparable de 2 à 64 objets. Un
          maillage fusionné ne permet pas d’identifier automatiquement les
          meubles. Choisissez une version avec des objets distincts.
        </p>
      )}
      <div className="model-parts">
        {parts.map((p) => (
          <div key={p.path}>
            <strong>{p.name}</strong>
            <small>
              {origin ? ((p.width * item.width) / origin.width).toFixed(2) : ""}{" "}
              ×{" "}
              {origin ? ((p.depth * item.depth) / origin.depth).toFixed(2) : ""}{" "}
              m
            </small>
          </div>
        ))}
      </div>
      {parts.length > 1 && (
        <button className="primary full" onClick={split}>
          Dissocier ces {parts.length} sous-objets
        </button>
      )}
    </>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Box3, Vector3, Group, type Object3D } from "three";
import {
  acquireModel,
  modelNode,
  separableParts,
  type ModelPart,
} from "./modelAssets";
import { Canvas } from "@react-three/fiber";
import { Bounds, OrbitControls } from "@react-three/drei";
import { normalizedClone } from "./modelAssets";
import { uid, type Item } from "./model";
import { exportModelGLB, downloadModel } from "./modelExport";
export default function SplitModel({
  item,
  onSplit,
  onSaveLibrary,
}: {
  item: Item;
  onSplit: (items: Item[]) => void;
  onSaveLibrary: (file: File) => Promise<void>;
}) {
  const [scene, setScene] = useState<Object3D>();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string>();
  const [search, setSearch] = useState(""),
    [isolated, setIsolated] = useState(false),
    [working, setWorking] = useState(false);
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
        setScene(g.scene);
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
      parts
        .filter((p) => !hidden.has(p.path))
        .map((p) => {
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
  async function exportCleaned(save: boolean) {
    if (!scene || !origin) return;
    setWorking(true);
    setError("");
    try {
      const group = new Group();
      group.name = item.name + " nettoyé";
      for (const p of parts.filter((p) => !hidden.has(p.path))) {
        const clone = normalizedClone(scene, p.path).group;
        clone.position.set(0, 0, 0);
        clone.name = p.name;
        group.add(clone);
      }
      group.scale.set(
        item.width / origin.width,
        item.height / origin.height,
        item.depth / origin.depth,
      );
      const bounds = new Box3().setFromObject(group),
        center = bounds.getCenter(new Vector3());
      group.position.set(-center.x, -bounds.min.y, -center.z);
      const blob = await exportModelGLB(group);
      if (save)
        await onSaveLibrary(
          new File([blob], group.name + ".glb", { type: "model/gltf-binary" }),
        );
      else downloadModel(blob, group.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <h3>Retirer le décor</h3>
      <p className="small">
        Cliquez sur un élément dans l’aperçu pour le repérer. Décochez le mur,
        le sol ou les accessoires à retirer, puis appliquez. Vous pouvez tourner
        autour du modèle et ouvrir ses sous-groupes. Le fichier original reste
        intact.
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
      {scene && parts.length > 0 && (
        <WorkshopPreview
          scene={scene}
          parts={parts}
          hidden={
            isolated && selected
              ? new Set(
                  parts
                    .filter((p) => p.path !== selected || hidden.has(p.path))
                    .map((p) => p.path),
                )
              : hidden
          }
          selected={selected}
          onSelect={setSelected}
        />
      )}
      {parts.length > 0 && (
        <div className="workshop-actions">
          <button
            onClick={() => {
              setHidden(new Set());
              setIsolated(false);
            }}
          >
            Tout afficher
          </button>
          <button
            disabled={!selected}
            aria-pressed={isolated}
            onClick={() => setIsolated((v) => !v)}
          >
            Isoler la sélection
          </button>
          <button
            disabled={!selected}
            onClick={() => {
              if (selected) setHidden((old) => new Set([...old, selected]));
            }}
          >
            Retirer la sélection
          </button>
          <span className="small">
            {parts.length - hidden.size} / {parts.length} éléments conservés
          </span>
        </div>
      )}
      {parts.length > 0 && (
        <label className="field">
          Rechercher un élément
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sol, mur, canapé…"
          />
        </label>
      )}
      <div className="model-parts">
        {parts
          .filter((p) =>
            p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
          )
          .map((p) => (
            <div
              key={p.path}
              className={selected === p.path ? "workshop-selected" : ""}
            >
              <label>
                <input
                  type="checkbox"
                  checked={!hidden.has(p.path)}
                  onChange={() => {
                    setSelected(p.path);
                    setHidden((old) => {
                      const next = new Set(old);
                      if (next.has(p.path)) next.delete(p.path);
                      else next.add(p.path);
                      return next;
                    });
                  }}
                />{" "}
                Garder <strong>{p.name}</strong>
              </label>
              <small>
                {origin
                  ? ((p.width * item.width) / origin.width).toFixed(2)
                  : ""}{" "}
                ×{" "}
                {origin
                  ? ((p.depth * item.depth) / origin.depth).toFixed(2)
                  : ""}{" "}
                m
              </small>
              <button onClick={() => setSelected(p.path)}>Repérer</button>
              {scene && separableParts(scene, p.path).length > 1 && (
                <button
                  onClick={() => {
                    const children = separableParts(scene, p.path);
                    if (parts.length - 1 + children.length > 128) {
                      setError(
                        "Limite de 128 éléments pour conserver un aperçu fluide. Séparez le modèle dans Blender.",
                      );
                      return;
                    }
                    setParts((old) =>
                      old.flatMap((v) => (v.path === p.path ? children : [v])),
                    );
                    setHidden((old) => {
                      const next = new Set(old);
                      const wasHidden = next.delete(p.path);
                      if (wasHidden) children.forEach((c) => next.add(c.path));
                      return next;
                    });
                    setSelected(undefined);
                  }}
                >
                  Ouvrir le groupe {p.name}
                </button>
              )}
            </div>
          ))}
      </div>
      {parts.length > 1 && (
        <button
          className="primary full"
          disabled={working || hidden.size === parts.length}
          onClick={split}
        >
          {hidden.size
            ? `Appliquer · garder ${parts.length - hidden.size} éléments`
            : `Dissocier ces ${parts.length} sous-objets`}
        </button>
      )}
      {parts.length > 0 && (
        <div className="workshop-actions">
          <button
            disabled={working || hidden.size === parts.length}
            onClick={() => void exportCleaned(false)}
          >
            Télécharger le modèle nettoyé en GLB
          </button>
          <button
            disabled={working || hidden.size === parts.length}
            onClick={() => void exportCleaned(true)}
          >
            Garder une copie nettoyée dans Mes meubles
          </button>
          {working && <span role="status">Export des éléments conservés…</span>}
        </div>
      )}
      {parts.length > 0 && (
        <p className="small">
          Les éléments conservés deviennent sélectionnables séparément dans
          l’appartement. Annuler restaure l’ensemble initial. Cet atelier retire
          des objets distincts ; il ne découpe pas un maillage fusionné et ne
          corrige pas les textures.
        </p>
      )}
    </>
  );
}
function WorkshopPreview({
  scene,
  parts,
  hidden,
  selected,
  onSelect,
}: {
  scene: Object3D;
  parts: ModelPart[];
  hidden: Set<string>;
  selected?: string;
  onSelect: (path: string) => void;
}) {
  const objects = useMemo(
    () =>
      parts.map((p) => {
        const clone = normalizedClone(scene, p.path);
        // Restore each part to its original location, retaining shared materials.
        clone.group.position.set(0, 0, 0);
        return { path: p.path, group: clone.group };
      }),
    [scene, parts],
  );
  return (
    <div
      className="workshop-preview"
      aria-label="Aperçu interactif du modèle 3D"
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [5, 4, 6], near: 0.01, far: 100000 }}
      >
        <color attach="background" args={["#cbd5df"]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 8, 5]} intensity={2} />
        <Bounds fit clip observe margin={1.3}>
          {objects.map((o) => (
            <group
              key={o.path}
              visible={!hidden.has(o.path)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(o.path);
              }}
            >
              <primitive object={o.group} dispose={null} />
              {selected === o.path && <SelectionBox object={o.group} />}
            </group>
          ))}
        </Bounds>
        <OrbitControls makeDefault />
      </Canvas>
      <span className="small">
        Glisser : tourner · Molette : zoomer · Clic : repérer
      </span>
    </div>
  );
}
function SelectionBox({ object }: { object: Object3D }) {
  const box = useMemo(() => new Box3().setFromObject(object), [object]);
  return <box3Helper args={[box, 0x2563eb]} />;
}

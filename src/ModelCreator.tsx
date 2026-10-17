import { useEffect, useMemo, useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, OrbitControls, Grid } from "@react-three/drei";
import { Box3 } from "three";
import {
  DESIGN_LIMIT,
  buildDesign,
  designPart,
  designPreset,
  designSize,
  disposeDesign,
  designFromModel,
  type Design,
  type DesignPart,
} from "./workshopDesign";
import { loadDesignDraft, saveDesignDraft } from "./workshopDraft";
import { exportModelGLB, downloadModel } from "./modelExport";
import { acquireModel } from "./modelAssets";
import type { Item } from "./model";
export default function ModelCreator({
  source,
  onCreate,
}: {
  source?: Item;
  onCreate: (file: File) => Promise<void>;
}) {
  const [history, setHistory] = useState<{
    past: Design[];
    present: Design;
    future: Design[];
  }>({ past: [], present: designPreset(), future: [] });
  const d = history.present;
  const latest = useRef<{ value: Design; loaded: boolean }>({
    value: d,
    loaded: false,
  });
  const [selected, setSelected] = useState<string>(),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [working, setWorking] = useState(false),
    [frame, setFrame] = useState(0);
  latest.current = { value: d, loaded };
  useEffect(
    () => () => {
      if (latest.current.loaded)
        void saveDesignDraft(latest.current.value).catch(() => {});
    },
    [],
  );
  useEffect(() => {
    let active = true;
    loadDesignDraft()
      .then((value) => {
        if (active && value)
          setHistory({ past: [], present: value, future: [] });
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    setSaved(false);
    let active = true;
    const timer = setTimeout(() => {
      void saveDesignDraft(d)
        .then(() => {
          if (active) setSaved(true);
        })
        .catch((e) => {
          if (active) setError("Brouillon non enregistré : " + e.message);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [d, loaded]);
  function update(next: Design) {
    setHistory((old) => ({
      past: [...old.past, old.present].slice(-40),
      present: next,
      future: [],
    }));
  }
  const part = d.parts.find((p) => p.id === selected) || d.parts[0];
  function edit(patch: Partial<DesignPart>) {
    update({
      ...d,
      parts: d.parts.map((p) => (p.id === part.id ? { ...p, ...patch } : p)),
    });
  }
  const group = useMemo(() => buildDesign(d), [d]);
  const size = useMemo(() => designSize(group), [group]);
  const box = useMemo(() => {
    const child = group.children.find((c) => c.userData.designPart === part.id);
    return child ? new Box3().setFromObject(child) : undefined;
  }, [group, part.id]);
  useEffect(() => () => disposeDesign(group), [group]);
  async function action(f: () => Promise<void>) {
    setWorking(true);
    setError("");
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  }
  async function exportFile() {
    return new File([await exportModelGLB(group)], d.name + ".glb", {
      type: "model/gltf-binary",
    });
  }
  if (!loaded) return <p>Ouverture du brouillon…</p>;
  return (
    <div className="model-creator" aria-busy={working}>
      <p className="small">
        Assemblez jusqu’à {DESIGN_LIMIT} formes légères. Dimensions en mètres.
        Le brouillon reste sur cet appareil ; le GLB conserve aussi la création
        pour la reprendre plus tard.
      </p>
      {error && (
        <p role="alert" className="warning">
          {error}
        </p>
      )}
      <fieldset disabled={working}>
        <div className="form-grid">
          <label className="field">
            Nom de la création
            <input
              maxLength={120}
              value={d.name}
              onChange={(e) => {
                if (e.target.value.trim())
                  update({ ...d, name: e.target.value });
              }}
            />
          </label>
          <label className="field">
            Point de départ
            <select
              aria-label="Point de départ"
              defaultValue=""
              onChange={(e) => {
                update(designPreset(e.target.value));
                setSelected(undefined);
                setFrame((n) => n + 1);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Choisir un modèle…
              </option>
              <option value="empty">Bloc libre</option>
              <option value="table">Table</option>
              <option value="shelf">Étagère</option>
            </select>
          </label>
        </div>
        <div className="workshop-actions">
          <button
            type="button"
            disabled={!history.past.length}
            onClick={() =>
              setHistory((h) => ({
                past: h.past.slice(0, -1),
                present: h.past.at(-1)!,
                future: [h.present, ...h.future],
              }))
            }
          >
            Annuler la création
          </button>
          <button
            type="button"
            disabled={!history.future.length}
            onClick={() =>
              setHistory((h) => ({
                past: [...h.past, h.present],
                present: h.future[0],
                future: h.future.slice(1),
              }))
            }
          >
            Rétablir la création
          </button>
          <button type="button" onClick={() => setFrame((n) => n + 1)}>
            Cadrer la création
          </button>
        </div>
        <div className="creator-layout">
          <div className="creator-visual">
            <div
              className="workshop-preview creator-preview"
              aria-label="Aperçu de la création"
            >
              <Canvas
                frameloop="demand"
                dpr={[1, 1.5]}
                camera={{ position: [3, 2.5, 3], near: 0.01, far: 1000 }}
              >
                <color attach="background" args={["#e8ecef"]} />
                <ambientLight intensity={1.6} />
                <directionalLight position={[4, 6, 4]} intensity={2} />
                <Bounds key={frame} fit clip margin={1.5}>
                  <primitive
                    object={group}
                    dispose={null}
                    onClick={(
                      e: import("@react-three/fiber").ThreeEvent<MouseEvent>,
                    ) => {
                      e.stopPropagation();
                      if (e.object.userData.designPart)
                        setSelected(e.object.userData.designPart);
                    }}
                  />
                </Bounds>
                {box && <box3Helper args={[box, 0x397bf2]} />}
                <Grid
                  position={[0, -0.005, 0]}
                  args={[20, 20]}
                  cellSize={0.1}
                  sectionSize={1}
                  fadeDistance={15}
                />
                <OrbitControls makeDefault />
              </Canvas>
            </div>
            <p className="small">
              {size.x.toFixed(2)} m de large × {size.z.toFixed(2)} m de
              profondeur × {size.y.toFixed(2)} m de haut · {d.parts.length}/
              {DESIGN_LIMIT} formes ·{" "}
              {saved ? "Brouillon enregistré" : "Sauvegarde du brouillon…"}
            </p>
            <p className="small">
              Glisser : tourner · Molette ou deux doigts : zoomer · Clic :
              sélectionner une forme
            </p>
          </div>
          <div className="creator-editor">
            <div className="workshop-actions">
              {(
                [
                  ["box", "Ajouter un bloc"],
                  ["cylinder", "Ajouter un cylindre"],
                  ["sphere", "Ajouter une sphère"],
                ] as const
              ).map(([shape, label]) => (
                <button
                  key={shape}
                  type="button"
                  disabled={d.parts.length >= DESIGN_LIMIT}
                  onClick={() => {
                    const p = designPart(shape);
                    update({ ...d, parts: [...d.parts, p] });
                    setSelected(p.id);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="field">
              Forme sélectionnée
              <select
                aria-label="Forme sélectionnée"
                value={part.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {d.parts.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label className="field">
                Nom de la forme
                <input
                  maxLength={120}
                  value={part.name}
                  onChange={(e) => edit({ name: e.target.value })}
                />
              </label>
              <label className="field">
                Couleur de la forme
                <input
                  type="color"
                  value={part.color}
                  onChange={(e) => edit({ color: e.target.value })}
                />
              </label>
            </div>
            <div className="creator-fields">
              {(
                [
                  ["width", "Largeur de la forme", 0.01, 20, 0.01],
                  ["depth", "Profondeur de la forme", 0.01, 20, 0.01],
                  ["height", "Hauteur de la forme", 0.01, 20, 0.01],
                  ["x", "Position X de la forme", -50, 50, 0.01],
                  ["z", "Position Y de la forme", -50, 50, 0.01],
                  ["elevation", "Élévation de la forme", -50, 50, 0.01],
                  ["rx", "Rotation X de la forme", -360, 360, 1],
                  ["ry", "Rotation Y de la forme", -360, 360, 1],
                  ["rz", "Rotation Z de la forme", -360, 360, 1],
                ] as const
              ).map(([key, label, min, max, step]) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    type="number"
                    value={part[key]}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(e) => {
                      const n = e.currentTarget.valueAsNumber;
                      if (Number.isFinite(n) && n >= min && n <= max)
                        edit({ [key]: n });
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="workshop-actions">
              <button
                type="button"
                disabled={d.parts.length >= DESIGN_LIMIT}
                onClick={() => {
                  const copy = {
                    ...part,
                    id: crypto.randomUUID(),
                    name: (part.name + " copie").slice(0, 120),
                    x: Math.min(50, part.x + 0.1),
                  };
                  update({ ...d, parts: [...d.parts, copy] });
                  setSelected(copy.id);
                }}
              >
                Dupliquer la forme
              </button>
              <button
                type="button"
                disabled={d.parts.length === 1}
                onClick={() => {
                  update({
                    ...d,
                    parts: d.parts.filter((p) => p.id !== part.id),
                  });
                  setSelected(undefined);
                }}
              >
                Supprimer la forme
              </button>
            </div>
            <button
              className="primary full"
              onClick={() =>
                void action(async () => {
                  await saveDesignDraft(d);
                  await onCreate(await exportFile());
                })
              }
            >
              Ajouter ma création à l’appartement
            </button>
            <button
              className="outline full"
              onClick={() =>
                void action(async () => {
                  const f = await exportFile();
                  downloadModel(f, d.name);
                })
              }
            >
              Télécharger ma création en GLB
            </button>
            {source?.asset && (
              <button
                className="outline full"
                onClick={() =>
                  void action(async () => {
                    const lease = acquireModel(source.asset!);
                    try {
                      const model = await lease.promise;
                      const design = designFromModel(model.scene);
                      if (!design)
                        throw Error(
                          "Ce modèle n’a pas été créé avec cet atelier. Modifiez ses maillages dans Blender puis réimportez un GLB.",
                        );
                      update(design);
                      setSelected(undefined);
                      setFrame((n) => n + 1);
                    } finally {
                      lease.release();
                    }
                  })
                }
              >
                Reprendre la création sélectionnée
              </button>
            )}
          </div>
        </div>
      </fieldset>
      <p className="small">
        Création par assemblage : pas de sculpture, découpe booléenne ou édition
        des sommets. La grille et le cadre bleu ne sont pas exportés.
      </p>
    </div>
  );
}

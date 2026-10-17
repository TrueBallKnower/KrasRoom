import { useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Circle,
  Cylinder,
  Layers,
  Magnet,
  Maximize2,
  Move3D,
  Rotate3D,
  Scaling,
  Undo2,
  Redo2,
  Copy,
  Trash2,
  X,
  Table2,
  PanelsTopLeft,
  Armchair,
  GripHorizontal,
  LayoutGrid,
} from "lucide-react";
import StudioScene, { type StudioTool, type StudioView } from "./StudioScene";
import { useMediaQuery } from "./useDevice";
import {
  DESIGN_LIMIT,
  buildDesign,
  designPart,
  designPreset,
  designSize,
  disposeDesign,
  furnitureComponent,
  transformedPart,
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
  const compact = useMediaQuery("(max-width: 980px)");
  const dark = document.documentElement.dataset.theme === "dark";
  const [panel, setPanel] = useState<"parts" | "properties" | null>(null);
  const [tool, setTool] = useState<StudioTool>("translate");
  const [snap, setSnap] = useState(true);
  const [view, setView] = useState<StudioView>({
    kind: "perspective",
    tick: 0,
  });

  const latest = useRef<{ value: Design; loaded: boolean }>({
    value: d,
    loaded: false,
  });
  const [selected, setSelected] = useState<string>(),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [working, setWorking] = useState(false);
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

  const undoDesign = () =>
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past.at(-1)!,
            future: [h.present, ...h.future],
          }
        : h,
    );
  const redoDesign = () =>
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
  const duplicate = () => {
    if (d.parts.length >= DESIGN_LIMIT) return;
    const copy = {
      ...part,
      id: crypto.randomUUID(),
      name: (part.name + " copie").slice(0, 120),
      x: Math.min(50, part.x + 0.1),
    };
    update({ ...d, parts: [...d.parts, copy] });
    setSelected(copy.id);
  };
  const remove = () => {
    if (d.parts.length > 1) {
      update({ ...d, parts: d.parts.filter((p) => p.id !== part.id) });
      setSelected(undefined);
    }
  };
  function addPart(p: DesignPart) {
    if (d.parts.length >= DESIGN_LIMIT) return;
    update({ ...d, parts: [...d.parts, p] });
    setSelected(p.id);
    if (compact) setPanel("properties");
  }
  function preset(kind: string) {
    update(designPreset(kind));
    setSelected(undefined);
    setView((v) => ({ kind: "perspective", tick: v.tick + 1 }));
    if (compact) setPanel(null);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const snapshot = latest.current.value;
        void saveDesignDraft(snapshot)
          .then(() => {
            if (latest.current.value === snapshot) setSaved(true);
          })
          .catch((e) => setError("Brouillon non enregistré : " + e.message));
        return;
      }
      if (
        working ||
        (e.target as HTMLElement)?.closest?.(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redoDesign() : undoDesign();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      if (e.key.toLowerCase() === "w") setTool("translate");
      if (e.key.toLowerCase() === "e") setTool("rotate");
      if (e.key.toLowerCase() === "r") setTool("scale");
      if (e.key.toLowerCase() === "f")
        setView((v) => ({ kind: "fit", tick: v.tick + 1 }));
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [d, part, working]);
  if (!loaded)
    return (
      <div className="studio-loading">
        Ouverture de votre espace de création…
      </div>
    );
  return (
    <section
      className="model-creator studio-creator"
      aria-label="Espace de conception"
      aria-busy={working}
    >
      <div className="creator-commandbar">
        <label className="creator-title">
          Nom de la création
          <input
            aria-label="Nom de la création"
            maxLength={120}
            value={d.name}
            onChange={(e) => {
              if (e.target.value.trim()) update({ ...d, name: e.target.value });
            }}
          />
        </label>
        <div className="creator-history">
          <button
            aria-label="Annuler la création"
            title="Annuler · ⌘/Ctrl Z"
            disabled={!history.past.length || working}
            onClick={undoDesign}
          >
            <Undo2 size={18} />
          </button>
          <button
            aria-label="Rétablir la création"
            title="Rétablir · ⇧⌘/Ctrl Z"
            disabled={!history.future.length || working}
            onClick={redoDesign}
          >
            <Redo2 size={18} />
          </button>
        </div>
        <div className="creator-file-actions">
          <button
            className="studio-export"
            aria-label="Télécharger ma création en GLB"
            disabled={working}
            onClick={() =>
              void action(async () => downloadModel(await exportFile(), d.name))
            }
          >
            <ArrowDownToLine size={17} />
            <span>Exporter GLB</span>
          </button>
          <button
            className="primary studio-use"
            aria-label="Ajouter ma création à l’appartement"
            disabled={working}
            onClick={() =>
              void action(async () => {
                await saveDesignDraft(d);
                await onCreate(await exportFile());
              })
            }
          >
            <span>Utiliser ce meuble</span>
            <ArrowUpRight size={17} />
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="warning studio-error">
          {error}
        </p>
      )}
      <div className="creator-body" data-panel={panel || "none"}>
        <aside
          className="studio-panel studio-library"
          data-open={panel === "parts"}
          aria-label="Bibliothèque de construction"
        >
          <div className="studio-panel-title">
            <div>
              <span className="eyebrow">VOTRE PALETTE</span>
              <h2>Construire</h2>
            </div>
            <button
              className="studio-panel-close"
              aria-label="Fermer les composants"
              onClick={() => setPanel(null)}
            >
              <X size={18} />
            </button>
          </div>
          <p className="studio-description">
            Une idée, quelques pièces. Créez le meuble qui vous ressemble.
          </p>
          <h3>Commencer avec un meuble</h3>
          <div className="studio-templates">
            {(
              [
                ["table", "Table", Table2],
                ["desk", "Bureau", PanelsTopLeft],
                ["shelf", "Étagère", Layers],
                ["cabinet", "Meuble TV", LayoutGrid],
                ["bench", "Banc", Armchair],
                ["empty", "Libre", Box],
              ] as const
            ).map(([id, label, Icon]) => (
              <button key={id} disabled={working} onClick={() => preset(id)}>
                <Icon size={26} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <label className="field studio-template-select">
            Point de départ
            <select
              aria-label="Point de départ"
              value=""
              disabled={working}
              onChange={(e) => preset(e.target.value)}
            >
              <option value="" disabled>
                Choisir un modèle…
              </option>
              <option value="empty">Bloc libre</option>
              <option value="table">Table</option>
              <option value="shelf">Étagère</option>
              <option value="desk">Bureau</option>
              <option value="cabinet">Meuble TV</option>
              <option value="bench">Banc</option>
            </select>
          </label>
          <h3>Composants de mobilier</h3>
          <div className="studio-components">
            {(
              [
                ["top", "Plateau"],
                ["leg", "Pied"],
                ["panel", "Panneau"],
                ["handle", "Poignée"],
                ["cushion", "Coussin"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                disabled={working || d.parts.length >= DESIGN_LIMIT}
                onClick={() => addPart(furnitureComponent(id))}
              >
                <GripHorizontal size={16} />
                {label}
                <span>+</span>
              </button>
            ))}
          </div>
          <h3>Formes libres</h3>
          <div className="studio-shapes">
            {(
              [
                ["box", "Ajouter un bloc", Box],
                ["cylinder", "Ajouter un cylindre", Cylinder],
                ["sphere", "Ajouter une sphère", Circle],
              ] as const
            ).map(([shape, label, Icon]) => (
              <button
                key={shape}
                title={label}
                aria-label={label}
                disabled={working || d.parts.length >= DESIGN_LIMIT}
                onClick={() => addPart(designPart(shape))}
              >
                <Icon size={21} />
              </button>
            ))}
          </div>
          <div className="studio-layer-heading">
            <h3>Assemblage</h3>
            <span>
              {d.parts.length}/{DESIGN_LIMIT}
            </span>
          </div>
          <div className="studio-layers">
            {d.parts.map((p, i) => (
              <button
                key={p.id}
                aria-pressed={part.id === p.id}
                disabled={working}
                onClick={() => {
                  setSelected(p.id);
                  if (compact) setPanel("properties");
                }}
              >
                <Box size={14} />
                <span>{p.name || "Sans nom"}</span>
                <small>{String(i + 1).padStart(2, "0")}</small>
              </button>
            ))}
          </div>
          {source?.asset && (
            <button
              className="outline full"
              disabled={working}
              onClick={() =>
                void action(async () => {
                  const lease = acquireModel(source.asset!);
                  try {
                    const design = designFromModel((await lease.promise).scene);
                    if (!design)
                      throw Error(
                        "Ce modèle n’a pas été créé avec cet atelier. Modifiez ses maillages dans Blender puis réimportez un GLB.",
                      );
                    update(design);
                    setSelected(undefined);
                    setView((v) => ({ kind: "fit", tick: v.tick + 1 }));
                  } finally {
                    lease.release();
                  }
                })
              }
            >
              Reprendre la création sélectionnée
            </button>
          )}
        </aside>
        <div className="studio-stage" aria-label="Scène de création 3D">
          <div className="studio-stage-top">
            <span className="studio-stage-label">
              <span />
              Vue de travail
            </span>
            <div className="studio-camera-views">
              {(
                [
                  ["perspective", "Perspective"],
                  ["top", "Dessus"],
                  ["front", "Face"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  aria-pressed={view.kind === kind}
                  onClick={() => setView((v) => ({ kind, tick: v.tick + 1 }))}
                >
                  {label}
                </button>
              ))}
              <button
                aria-label="Cadrer la création"
                title="Tout cadrer · F"
                onClick={() =>
                  setView((v) => ({ kind: "fit", tick: v.tick + 1 }))
                }
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>
          <div
            className="studio-transform-tools"
            aria-label="Outils de transformation"
          >
            {(
              [
                ["translate", "Déplacer la forme", Move3D, "W"],
                ["rotate", "Tourner la forme", Rotate3D, "E"],
                ["scale", "Redimensionner la forme", Scaling, "R"],
              ] as const
            ).map(([mode, label, Icon, key]) => (
              <button
                key={mode}
                aria-label={label}
                title={label + " · " + key}
                aria-pressed={tool === mode}
                disabled={working}
                onClick={() => setTool(mode)}
              >
                <Icon size={20} />
                <small>{key}</small>
              </button>
            ))}
            <span />
            <button
              aria-label="Magnétisme de création"
              title="Pas de 5 cm · rotations de 15°"
              aria-pressed={snap}
              onClick={() => setSnap((v) => !v)}
            >
              <Magnet size={20} />
            </button>
          </div>
          <div className="creator-preview" aria-label="Aperçu de la création">
            <StudioScene
              group={group}
              selected={part.id}
              onSelect={setSelected}
              onTransform={(id, mesh) => {
                const before = d.parts.find((p) => p.id === id);
                if (!before) return;
                const next = transformedPart(before, mesh);
                if (JSON.stringify(before) !== JSON.stringify(next))
                  update({
                    ...d,
                    parts: d.parts.map((p) => (p.id === id ? next : p)),
                  });
              }}
              tool={tool}
              snap={snap}
              view={view}
              dark={dark}
              disabled={working}
            />
          </div>
          <div className="studio-stage-bottom">
            <span>
              <strong>{size.x.toFixed(2)}</strong> ×{" "}
              <strong>{size.z.toFixed(2)}</strong> ×{" "}
              <strong>{size.y.toFixed(2)}</strong> m
            </span>
            <span>
              Glisser les axes pour modifier · Glisser le fond pour tourner
            </span>
          </div>
        </div>
        <aside
          className="studio-panel studio-inspector"
          data-open={panel === "properties"}
          aria-label="Propriétés de la forme"
        >
          <div className="studio-panel-title">
            <div>
              <span className="eyebrow">SÉLECTION</span>
              <h2>{part.name || "Votre pièce"}</h2>
            </div>
            <button
              className="studio-panel-close"
              aria-label="Fermer les propriétés de la forme"
              onClick={() => setPanel(null)}
            >
              <X size={18} />
            </button>
          </div>
          <fieldset disabled={working}>
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
            <label className="field">
              Nom de la forme
              <input
                maxLength={120}
                value={part.name}
                onChange={(e) => edit({ name: e.target.value })}
              />
            </label>
            <h3>
              Dimensions <small>mètres</small>
            </h3>
            <div className="studio-numeric-fields">
              {(
                [
                  ["width", "Largeur de la forme", "Largeur", 0.01, 20, 0.01],
                  [
                    "depth",
                    "Profondeur de la forme",
                    "Profondeur",
                    0.01,
                    20,
                    0.01,
                  ],
                  ["height", "Hauteur de la forme", "Hauteur", 0.01, 20, 0.01],
                  ["x", "Position X de la forme", "X", -50, 50, 0.01],
                  ["z", "Position Y de la forme", "Y", -50, 50, 0.01],
                  [
                    "elevation",
                    "Élévation de la forme",
                    "Élévation",
                    -50,
                    50,
                    0.01,
                  ],
                  ["rx", "Rotation X de la forme", "Rotation X", -360, 360, 1],
                  ["ry", "Rotation Y de la forme", "Rotation Y", -360, 360, 1],
                  ["rz", "Rotation Z de la forme", "Rotation Z", -360, 360, 1],
                ] as const
              ).map(([key, label, short, min, max, step]) => (
                <label className="field" key={key}>
                  {short}
                  <input
                    aria-label={label}
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
            <h3>Finition</h3>
            <label className="field studio-color">
              Couleur de la forme
              <input
                type="color"
                value={part.color}
                onChange={(e) => edit({ color: e.target.value })}
              />
            </label>
            <div className="studio-swatches">
              {[
                "#b99b76",
                "#eadfcf",
                "#594735",
                "#e7e8e9",
                "#303641",
                "#bdc5ce",
                "#658177",
                "#b98574",
              ].map((color) => (
                <button
                  key={color}
                  style={{ background: color }}
                  aria-label={"Teinte " + color}
                  aria-pressed={part.color === color}
                  onClick={() => edit({ color })}
                />
              ))}
            </div>
            <div className="studio-object-actions">
              <button
                aria-label="Dupliquer la forme"
                disabled={d.parts.length >= DESIGN_LIMIT}
                onClick={duplicate}
              >
                <Copy size={17} />
                Dupliquer
              </button>
              <button
                aria-label="Supprimer la forme"
                disabled={d.parts.length === 1}
                onClick={remove}
              >
                <Trash2 size={17} />
                Supprimer
              </button>
            </div>
          </fieldset>
          <p className="studio-description">
            Concevez par assemblage. Pour sculpter ou modifier les sommets,
            poursuivez dans Blender avec l’export GLB.
          </p>
        </aside>
      </div>
      <nav className="studio-mobile-panels" aria-label="Panneaux de création">
        <button
          aria-expanded={panel === "parts"}
          onClick={() => setPanel((v) => (v === "parts" ? null : "parts"))}
        >
          <Layers size={18} />
          Composants
        </button>
        <button
          aria-expanded={panel === "properties"}
          onClick={() =>
            setPanel((v) => (v === "properties" ? null : "properties"))
          }
        >
          <Scaling size={18} />
          Propriétés de la forme
        </button>
      </nav>
      <footer className="studio-status">
        <span className={saved ? "studio-saved" : ""}>
          <i />
          {working
            ? "Préparation du modèle…"
            : saved
              ? "Brouillon enregistré"
              : "Sauvegarde du brouillon…"}
        </span>
        <span>{d.parts.length} formes · Unités en mètres</span>
        <span>W déplacer · E tourner · R dimensionner · F cadrer</span>
      </footer>
    </section>
  );
}

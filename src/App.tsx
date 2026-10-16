import { useCloudSync } from "./useCloudSync";
import { useCloud } from "./cloudState";
import { useImmersiveVisit } from "./useImmersiveVisit";
import {
  lightingProfiles,
  readRenderPreferences,
  type LightingProfile,
} from "./lighting";
import { useNavigation } from "./navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import {
  Armchair,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  Check,
  ChevronDown,
  Copy,
  DoorOpen,
  Expand,
  Eye,
  EyeOff,
  Folder,
  Grid2X2,
  Home,
  ImagePlus,
  Layers,
  Link,
  Magnet,
  MousePointer2,
  Plus,
  Redo2,
  Ruler,
  Search,
  Sun,
  Trash2,
  Undo2,
  Footprints,
  Wallpaper,
  X,
} from "lucide-react";
import { useStore } from "./store";
import {
  catalog,
  furniture,
  uid,
  blank,
  demo,
  distance,
  area,
  collides,
  segmentDistance,
  againstWall,
  type Item,
  type Project,
} from "./model";
import {
  saveProject,
  projects,
  removeProject,
  library,
  libraryPut,
  libraryDelete,
  assetPut,
  exportProject,
  importProject,
} from "./db";
import {
  importPlan,
  importFurnitureFile,
  importFurnitureFiles,
  importURL,
} from "./imports";
import ColorPicker from "./ColorPicker";
import { floorFinishes, wallFinishes } from "./floorFinishes";
import FurnitureSources from "./FurnitureSources";
import StorageStatus from "./StorageStatus";
import DimensionsEditor from "./DimensionsEditor";
import { edgeWallDistance } from "./placement";
const AccountPanel = lazy(() => import("./AccountPanel"));
const SplitModel = lazy(() => import("./SplitModel"));
import CameraToolbar from "./CameraToolbar";
import AssetImage from "./AssetImage";
import { visitStart } from "./spatial";
import FurniturePreview from "./FurniturePreview";
import AutoPlanImport from "./AutoPlanImport";
import Plan, { type Tool } from "./Plan";
const Scene = lazy(() => import("./Scene"));
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const iconFor = (kind: string) =>
  kind === "bed"
    ? "🛏"
    : kind === "sofa"
      ? "🛋"
      : kind === "table"
        ? "▱"
        : kind === "plant"
          ? "🪴"
          : kind === "lamp"
            ? "💡"
            : kind === "chair"
              ? "🪑"
              : kind === "rug"
                ? "▧"
                : kind === "shower"
                  ? "🚿"
                  : kind === "sink"
                    ? "◡"
                    : kind === "tv"
                      ? "▣"
                      : "▥";
export default function App() {
  const {
    project: p,
    selected,
    select,
    change,
    set,
    undo,
    redo,
    past,
    future,
  } = useStore();
  const [view, setView] = useState<"2d" | "3d" | "walk">("2d"),
    [tool, setTool] = useState<Tool>("select"),
    [tab, setTab] = useState("catalog"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("Toutes"),
    [snap, setSnap] = useState(true),
    [dark, setDark] = useState(localStorage.getItem("roomora-dark") === "true"),
    [hide, setHide] = useState(false),
    [showCollisions, setShowCollisions] = useState(true),
    [transparent, setTransparent] = useState(true),
    [ceiling, setCeiling] = useState(false),
    [quality, setQuality] = useState(false),
    [realistic, setRealistic] = useState(
      () => readRenderPreferences().realistic,
    ),
    [lighting, setLighting] = useState<LightingProfile>(
      () => readRenderPreferences().lighting,
    ),
    [exposure, setExposure] = useState(() => readRenderPreferences().exposure),
    [eyeHeight, setEyeHeight] = useState(1.55),
    [fieldOfView, setFieldOfView] = useState(72),
    [walkSpeed, setWalkSpeed] = useState(1.4),
    [message, setMessage] = useState(""),
    [persisted, setPersisted] = useState<Project | null>(null),
    [saveError, setSaveError] = useState(false),
    [loaded, setLoaded] = useState(false),
    [modal, setModal] = useState<
      | null
      | "projects"
      | "import"
      | "reference"
      | "help"
      | "autoPlan"
      | "split"
      | "account"
    >(null),
    [allProjects, setAllProjects] = useState<Project[]>([]),
    [personal, setPersonal] = useState<Item[]>([]),
    [busy, setBusy] = useState(false),
    [busyStage, setBusyStage] = useState("Traitement en cours…"),
    [url, setUrl] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem(
        "roomora-render",
        JSON.stringify({ lighting, exposure, realistic }),
      );
    } catch {
      /* Preferences do not block project editing. */
    }
  }, [lighting, exposure, realistic]);
  const {
    immersive,
    locked: visitLocked,
    toggle: toggleImmersive,
  } = useImmersiveVisit(view === "walk", !!modal || busy);
  useCloudSync(p, loaded);
  const cloud = useCloud();
  useEffect(() => {
    if (cloud.recovery) setModal("account");
  }, [cloud.recovery]);
  const saved = !loaded
    ? "Chargement…"
    : saveError
      ? "Échec de sauvegarde"
      : persisted === p
        ? "Enregistré"
        : "Enregistrement…";
  const [autoFile, setAutoFile] = useState<File>();
  const planInput = useRef<HTMLInputElement>(null),
    modelInput = useRef<HTMLInputElement>(null),
    furnitureFolderInput = useRef<HTMLInputElement>(null),
    backupInput = useRef<HTMLInputElement>(null);
  const notify = useCallback((s: string) => setMessage(s), []);
  const item = p.items.find((i) => i.id === selected),
    wall = p.walls.find((w) => w.id === selected),
    room = p.rooms.find((r) => r.id === selected);
  useEffect(() => {
    let active = true;
    Promise.all([projects(), library()])
      .then(([ps, ls]) => {
        if (!active) return;
        const id = localStorage.getItem("roomora-last");
        const last =
          ps.find((p) => p.id === id) ||
          ps.sort((a, b) => b.updated - a.updated)[0];
        if (last) set(last);
        setAllProjects(ps);
        setPersonal(ls);
        setLoaded(true);
      })
      .catch((e) => notify("Stockage indisponible : " + e.message));
    return () => {
      active = false;
    };
  }, [set, notify]);
  useEffect(() => {
    if (!loaded) return;
    setSaveError(false);
    const t = setTimeout(
      () =>
        saveProject(p)
          .then(() => {
            if (useStore.getState().project !== p) return;
            setPersisted(p);
            localStorage.setItem("roomora-last", p.id);
          })
          .catch((e) => {
            if (useStore.getState().project !== p) return;
            setSaveError(true);
            notify("Sauvegarde impossible : " + e.message);
          }),
      350,
    );
    return () => clearTimeout(t);
  }, [p, loaded, notify]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("roomora-dark", String(dark));
  }, [dark]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 7000);
    return () => clearTimeout(t);
  }, [message]);
  function remove() {
    if (!selected) return;
    change((p) => {
      p.items = p.items.filter((i) => i.id !== selected);
      p.walls = p.walls.filter((w) => w.id !== selected);
      p.rooms = p.rooms.filter((r) => r.id !== selected);
    });
    select(null);
  }
  function duplicate() {
    if (item) {
      const id = uid();
      change((p) =>
        p.items.push({ ...item, id, x: item.x + 0.3, y: item.y + 0.3 }),
      );
      select(id);
    }
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest?.(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (
        e.key.toLowerCase() === "e" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        if (!e.repeat) {
          e.preventDefault();
          setShowCollisions((v) => !v);
        }
        return;
      }
      if (
        document.pointerLockElement ||
        (e.target as HTMLElement).matches("input,textarea,select")
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveProject(useStore.getState().project)
          .then(() => notify("Projet enregistré."))
          .catch((e) => notify(e.message));
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      }
      if (e.key === "Escape") {
        setTool("select");
        setModal(null);
      }
      if (e.key.toLowerCase() === "r" && item)
        change((p) => {
          p.items.find((i) => i.id === item.id)!.rotation =
            (item.rotation + 15) % 360;
        });
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  async function run(f: () => Promise<void>) {
    setBusy(true);
    setBusyStage("Traitement en cours…");
    try {
      await f();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function loadFurniture(file: File | File[]) {
    return run(async () => {
      const i = await (Array.isArray(file)
        ? importFurnitureFiles(file, setBusyStage)
        : importFurnitureFile(file, setBusyStage));
      await libraryPut(i);
      setPersonal(await library());
      setModal(null);
      setView("3d");
      setRealistic(true);
      add(i);
      notify(
        "Meuble et textures enregistrés dans Mes meubles. Vérifiez ses dimensions en mètres.",
      );
    });
  }
  function add(i: Item) {
    const id = uid();
    const position = view === "3d" ? visitStart(p) : { x: i.x, y: i.y };
    change((p) => p.items.push({ ...i, ...position, id }));
    select(id);
  }
  async function openProjects() {
    await run(async () => {
      await saveProject(p);
      setAllProjects(await projects());
      setModal("projects");
    });
  }
  function editItem(key: keyof Item, value: string | number) {
    if (!item) return;
    change((p) => {
      Object.assign(
        p.items.find((i) => i.id === item.id)!,
        { [key]: value },
      );
    });
  }
  function num(
    label: string,
    value: number,
    onChange: (v: number) => void,
    min = 0,
    max = 1000,
  ) {
    return (
      <label className="field">
        {label}
        <div className="number">
          <input
            type="number"
            aria-label={label}
            value={Number(value.toFixed(3))}
            step="0.05"
            min={min}
            max={max}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (
                e.target.value !== "" &&
                Number.isFinite(v) &&
                v >= min &&
                v <= max
              )
                onChange(v);
            }}
          />
          <span>
            {label.includes("Rotation") || label.includes("Orientation")
              ? "°"
              : label.startsWith("Échelle du motif")
                ? "×"
                : "m"}
          </span>
        </div>
      </label>
    );
  }
  const totalArea = p.rooms.reduce((s, r) => s + area(r.points), 0),
    filtered = catalog.filter(
      (c) =>
        (category === "Toutes" || c[5] === category) &&
        c[0].toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <div className={immersive ? "app immersive-visit" : "app"}>
      <header>
        <a className="brand" href="#" aria-label="Roomora">
          <span className="brand-mark">
            <Home size={21} />
          </span>
          roomora<span className="beta">LOCAL</span>
        </a>
        <div className="project-title">
          <button onClick={openProjects}>
            <Folder size={16} />
            {p.name}
            <ChevronDown size={14} />
          </button>
          <span className="saved">
            <Check size={12} />
            {saved}
          </span>
        </div>
        <div className="header-actions">
          <button
            className="outline account-button"
            onClick={() => setModal("account")}
            title={
              cloud.error ||
              cloud.status ||
              "Retrouver mes appartements sur un autre ordinateur"
            }
          >
            Mon compte
            {cloud.session
              ? cloud.busy
                ? " · Envoi…"
                : cloud.error
                  ? " · À vérifier"
                  : " · Connecté"
              : ""}
          </button>
          <button
            className="outline"
            title="Créer automatiquement mon appartement depuis un plan"
            onClick={() => {
              setAutoFile(undefined);
              setModal("autoPlan");
            }}
          >
            <ImagePlus size={17} />
            <span className="import-plan-label">Mon plan → 3D</span>
          </button>
          <button title="Annuler · ⌘Z" disabled={!past.length} onClick={undo}>
            <Undo2 size={17} />
          </button>
          <button
            title="Rétablir · ⌘⇧Z"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
          <span className="divider" />
          <button title="Mode clair / sombre" onClick={() => setDark(!dark)}>
            <Sun size={18} />
          </button>
          <button title="Aide et raccourcis" onClick={() => setModal("help")}>
            ?
          </button>
          <button
            className="primary"
            onClick={() =>
              run(async () =>
                download(await exportProject(p), p.name + ".roomora.zip"),
              )
            }
          >
            <ArrowDownToLine size={16} />
            Exporter
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="left">
          <div className="sidebar-heading">
            <span>ÉDITEUR D’INTÉRIEUR</span>
            <h2>
              {tab === "build"
                ? "Construire le plan"
                : tab === "personal"
                  ? "Ma collection"
                  : "Meubler & décorer"}
            </h2>
          </div>
          <div className="tabs">
            <button
              className={tab === "catalog" ? "active" : ""}
              onClick={() => setTab("catalog")}
            >
              <Armchair size={16} />
              Mobilier
            </button>
            <button
              className={tab === "build" ? "active" : ""}
              onClick={() => setTab("build")}
            >
              <Wallpaper size={16} />
              Structure
            </button>
            <button
              className={tab === "personal" ? "active" : ""}
              onClick={() => setTab("personal")}
            >
              <Box size={16} />
              Mes meubles
            </button>
          </div>
          {tab === "build" ? (
            <>
              <button
                className="primary full"
                onClick={() => {
                  setAutoFile(undefined);
                  setModal("autoPlan");
                }}
              >
                <ImagePlus size={18} />
                Créer la 3D depuis mon plan
              </button>
              <p className="small">
                Déposez votre plan et sa surface. Roomora propose
                automatiquement les murs, pièces et ouvertures.
              </p>
              <p className="section-label">CORRIGER OU AJUSTER</p>
              <div className="tool-list">
                {[
                  ["select", "Sélectionner", MousePointer2],
                  ["wall", "Tracer des murs", Wallpaper],
                  ["room", "Définir une pièce", Grid2X2],
                  ["door", "Ajouter une porte", DoorOpen],
                  ["window", "Ajouter une fenêtre", Layers],
                  ["measure", "Mesurer une distance", Ruler],
                  ["scale", "Calibrer le plan", Expand],
                ].map(([key, label, Icon]) => (
                  <button
                    key={key as string}
                    className={tool === key ? "active" : ""}
                    onClick={() => {
                      setView("2d");
                      setTool(key as Tool);
                    }}
                  >
                    {<Icon size={18} />}
                    <span>{label as string}</span>
                  </button>
                ))}
              </div>
              <button
                className="outline full"
                onClick={() => planInput.current?.click()}
              >
                <ImagePlus size={18} />
                Importer un plan PDF / image
              </button>
              <p className="notice">
                Les outils ci-dessus servent à corriger les propositions
                automatiques ou à construire manuellement si votre image ne peut
                pas être reconnue.
              </p>
            </>
          ) : (
            <>
              <div className="search">
                <Search size={16} />
                <input
                  aria-label="Rechercher un meuble"
                  placeholder="Rechercher un meuble…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {tab === "catalog" && (
                <div className="categories">
                  {[
                    "Toutes",
                    "Salon",
                    "Chambre",
                    "Cuisine",
                    "Bureau",
                    "Salle de bain",
                    "Décoration",
                  ].map((c) => (
                    <button
                      key={c}
                      className={category === c ? "active" : ""}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div className="section-line">
                <span className="section-label">
                  {tab === "catalog" ? "LES ESSENTIELS" : "VOTRE COLLECTION"}
                </span>
                <span>
                  {tab === "catalog" ? filtered.length : personal.length}
                </span>
              </div>
              <div className="catalog">
                {tab === "catalog"
                  ? filtered.map((c) => (
                      <button
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData(
                            "roomora-item",
                            JSON.stringify(furniture(c)),
                          )
                        }
                        className="furniture-card"
                        key={c[0]}
                        onClick={() => add(furniture(c))}
                      >
                        <div className={"furniture-preview " + c[1]}>
                          <FurniturePreview kind={c[1]} />
                          <span className="add-circle">
                            <Plus size={14} />
                          </span>
                        </div>
                        <strong>{c[0]}</strong>
                        <small>
                          {c[2]} × {c[3]} m
                        </small>
                      </button>
                    ))
                  : personal
                      .filter((i) =>
                        i.name.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map((i) => (
                        <div className="personal-card" key={i.id}>
                          <button
                            className="furniture-card"
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData(
                                "roomora-item",
                                JSON.stringify(i),
                              )
                            }
                            onClick={() => add(i)}
                          >
                            <div className="furniture-preview">
                              {i.photo ? (
                                <AssetImage id={i.photo} alt={i.name} />
                              ) : (
                                <FurniturePreview kind={i.kind} />
                              )}
                              <span className="add-circle">
                                <Plus size={14} />
                              </span>
                            </div>
                            <strong>{i.name}</strong>
                            <small>
                              {i.width} × {i.depth} m
                            </small>
                          </button>
                          <div className="personal-actions">
                            <button
                              onClick={() => {
                                const name = prompt("Nouveau nom", i.name);
                                if (name)
                                  run(async () => {
                                    await libraryPut({ ...i, name });
                                    setPersonal(await library());
                                  });
                              }}
                            >
                              Renommer
                            </button>
                            <button
                              title="Supprimer de la bibliothèque"
                              onClick={() =>
                                run(async () => {
                                  await libraryDelete(i.id);
                                  setPersonal(await library());
                                })
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
              </div>
              {tab === "personal" && !personal.length && (
                <p className="small">
                  Vos modèles et références enregistrés apparaîtront ici.
                  Sélectionnez un meuble puis « Garder dans Mes meubles ».
                </p>
              )}
              <button
                className="outline full import-button"
                onClick={() => setModal("import")}
              >
                <Plus size={17} />
                Ajouter mon propre meuble
              </button>
            </>
          )}
          <div className="local-card">
            <span className="local-dot" />
            <div>
              <strong>Un espace qui vous appartient</strong>
              <p>
                Sans compte. Sans abonnement.
                <br />
                Vos projets restent sur cet appareil.
              </p>
            </div>
          </div>
        </aside>
        <main
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && /\.(glb|gltf|zip)$/i.test(file.name)) {
              void loadFurniture(file);
              return;
            }
            if (file) {
              setAutoFile(file);
              setModal("autoPlan");
              return;
            }
            try {
              const raw = e.dataTransfer.getData("roomora-item");
              if (raw) add(JSON.parse(raw));
            } catch {
              notify("Meuble invalide.");
            }
          }}
        >
          <div className="viewport-toolbar">
            <div className="view-switch">
              <button
                className={view === "2d" ? "active" : ""}
                onClick={() => setView("2d")}
              >
                <Grid2X2 size={15} />
                Plan 2D
              </button>
              <button
                className={view === "3d" ? "active" : ""}
                onClick={() => setView("3d")}
              >
                <Box size={15} />
                Vue 3D
              </button>
              <button
                className={view === "walk" ? "active" : ""}
                onClick={() => setView("walk")}
              >
                <Footprints size={15} />
                Visite
              </button>
            </div>
            <div className="viewport-actions">
              <button
                aria-label="Alertes de chevauchement"
                aria-pressed={showCollisions}
                className={showCollisions ? "active" : ""}
                title={
                  (showCollisions ? "Masquer" : "Afficher") +
                  " les alertes de chevauchement · E"
                }
                onClick={() => setShowCollisions((v) => !v)}
              >
                <AlertTriangle size={17} />
              </button>
              <button
                title="Alignement sur une grille de 5 cm"
                className={snap ? "active" : ""}
                onClick={() => setSnap(!snap)}
              >
                <Magnet size={17} />
              </button>
              <button
                title="Masquer / afficher les meubles"
                onClick={() => setHide(!hide)}
              >
                {hide ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
              <button
                title="Plein écran"
                onClick={() => {
                  if (document.fullscreenElement) document.exitFullscreen();
                  else
                    document.documentElement
                      .requestFullscreen()
                      .catch(() =>
                        notify("Plein écran indisponible dans ce navigateur."),
                      );
                }}
              >
                <Expand size={17} />
              </button>
            </div>
          </div>
          <nav className="drawing-toolbar" aria-label="Outils du plan">
            {(
              [
                ["select", "Sélectionner", MousePointer2],
                ["wall", "Tracer des murs", Wallpaper],
                ["room", "Définir une pièce", Grid2X2],
                ["door", "Ajouter une porte", DoorOpen],
                ["window", "Ajouter une fenêtre", Layers],
                ["measure", "Mesurer une distance", Ruler],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                title={label}
                aria-label={label + " — outil rapide"}
                aria-pressed={view === "2d" && tool === key}
                className={view === "2d" && tool === key ? "active" : ""}
                onClick={() => {
                  setView("2d");
                  setTool(key);
                  if (key !== "select") setTab("build");
                }}
              >
                <Icon size={19} />
              </button>
            ))}
          </nav>
          {p.analysis && (
            <div className="analysis-banner">
              <span>
                <strong>Appartement généré automatiquement</strong> ·{" "}
                {p.rooms.length} pièces · {p.analysis.surface} m² renseignés
              </span>
              <small>
                Dimensions estimées ·{" "}
                {
                  p.walls
                    .flatMap((w) => w.openings)
                    .filter((o) => o.detection && !o.detection.reviewed).length
                }{" "}
                ouvertures à vérifier
              </small>
              <button
                onClick={() => {
                  setView("2d");
                  setTab("build");
                  const w = p.walls.find((w) =>
                    w.openings.some(
                      (o) => o.detection && !o.detection.reviewed,
                    ),
                  );
                  if (w) select(w.id);
                }}
              >
                Vérifier les ouvertures
              </button>
            </div>
          )}
          <div className="viewport">
            {view === "2d" ? (
              <Plan
                tool={tool}
                snap={snap}
                hide={hide}
                showCollisions={showCollisions}
                onMessage={notify}
              />
            ) : (
              <>
                <Suspense
                  fallback={
                    <div className="busy">Chargement de la vue 3D…</div>
                  }
                >
                  <Scene
                    key={view}
                    walk={view === "walk"}
                    eyeHeight={eyeHeight}
                    fieldOfView={fieldOfView}
                    walkSpeed={walkSpeed}
                    snap={snap}
                    transparent={transparent}
                    ceiling={ceiling}
                    hide={hide}
                    showCollisions={showCollisions}
                    quality={quality}
                    realistic={realistic}
                    lighting={lighting}
                    exposure={exposure}
                    paused={!!modal || busy}
                    onError={notify}
                  />
                </Suspense>
                {view === "3d" && <CameraToolbar />}
                {view === "3d" && item && (
                  <div
                    className="scene-object-actions"
                    aria-label="Actions du meuble en 3D"
                  >
                    <strong>{item.name}</strong>
                    <button
                      title="Tourner de 15° vers la gauche"
                      onClick={() =>
                        editItem("rotation", (item.rotation - 15) % 360)
                      }
                    >
                      <Undo2 size={16} />
                    </button>
                    <button
                      title="Tourner de 15° vers la droite"
                      onClick={() =>
                        editItem("rotation", (item.rotation + 15) % 360)
                      }
                    >
                      <Redo2 size={16} />
                    </button>
                    <button
                      title="Dupliquer le meuble sélectionné"
                      onClick={duplicate}
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      title="Aligner le meuble contre un mur"
                      onClick={() =>
                        change((p) => {
                          const index = p.items.findIndex(
                            (i) => i.id === item.id,
                          );
                          p.items[index] = againstWall(p.items[index], p.walls);
                        })
                      }
                    >
                      <Magnet size={16} />
                    </button>
                    <button
                      title="Supprimer le meuble sélectionné"
                      onClick={remove}
                    >
                      <Trash2 size={16} />
                    </button>
                    <small>
                      Glissez le meuble pour le déplacer · R pour tourner
                    </small>
                  </div>
                )}
                <div className="canvas-hint">
                  {view === "walk"
                    ? "Cliquez pour visiter · ZQSD / WASD pour avancer · L : masquer l’interface · Échap : libérer la souris"
                    : "Gauche : tourner / déplacer un meuble · Clic droit ou Espace + glisser : déplacer la vue · Molette : zoom au curseur"}
                </div>
                {view === "walk" && (
                  <div className="visit-settings">
                    <strong>Confort de visite</strong>
                    <button
                      className="outline"
                      onClick={toggleImmersive}
                      title="Masquer l’interface et visiter en plein écran · L"
                    >
                      Visite sans interface · L
                    </button>
                    <label>
                      Hauteur des yeux{" "}
                      <select
                        aria-label="Hauteur des yeux"
                        value={eyeHeight}
                        onChange={(e) => setEyeHeight(Number(e.target.value))}
                      >
                        <option value={1.4}>1,40 m</option>
                        <option value={1.55}>1,55 m</option>
                        <option value={1.65}>1,65 m</option>
                        <option value={1.75}>1,75 m</option>
                      </select>
                    </label>
                    <label>
                      Champ de vision{" "}
                      <input
                        aria-label="Champ de vision"
                        type="range"
                        min="55"
                        max="90"
                        value={fieldOfView}
                        onChange={(e) => setFieldOfView(Number(e.target.value))}
                      />
                      <span>{fieldOfView}°</span>
                    </label>
                    <label>
                      Déplacement{" "}
                      <select
                        aria-label="Vitesse de visite"
                        value={walkSpeed}
                        onChange={(e) => setWalkSpeed(Number(e.target.value))}
                      >
                        <option value={0.8}>Lent</option>
                        <option value={1.4}>Normal</option>
                        <option value={2.2}>Rapide</option>
                      </select>
                    </label>
                    <small>
                      La perspective change, les dimensions restent en mètres.
                      Échap pour régler la visite.
                    </small>
                  </div>
                )}
                <div className="render-controls">
                  <label>
                    Rendu{" "}
                    <select
                      aria-label="Style de rendu"
                      value={realistic ? "realistic" : "standard"}
                      onChange={(e) =>
                        setRealistic(e.target.value === "realistic")
                      }
                    >
                      <option value="standard">Standard · fluide</option>
                      <option value="realistic">
                        Réaliste · matières et lumière
                      </option>
                    </select>
                  </label>
                  {realistic && (
                    <>
                      <label>
                        Lumière{" "}
                        <select
                          aria-label="Ambiance lumineuse"
                          value={lighting}
                          onChange={(e) =>
                            setLighting(e.target.value as LightingProfile)
                          }
                        >
                          {Object.entries(lightingProfiles).map(([id, p]) => (
                            <option key={id} value={id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Exposition{" "}
                        <input
                          aria-label="Exposition du rendu"
                          type="range"
                          min="0.6"
                          max="1.6"
                          step="0.05"
                          value={exposure}
                          onChange={(e) => setExposure(Number(e.target.value))}
                        />
                        <span>{exposure.toFixed(2)}</span>
                      </label>
                    </>
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={transparent}
                      onChange={(e) => setTransparent(e.target.checked)}
                    />
                    Murs transparents
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={ceiling}
                      onChange={(e) => setCeiling(e.target.checked)}
                    />
                    Plafond
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={quality}
                      onChange={(e) => setQuality(e.target.checked)}
                    />
                    Haute qualité
                  </label>
                  <button
                    onClick={() => {
                      const c = document.querySelector("canvas");
                      if (c)
                        c.toBlob((b) => {
                          if (b) download(b, "roomora-vue.png");
                        });
                    }}
                  >
                    Capture PNG
                  </button>
                </div>
              </>
            )}
          </div>
          <footer>
            <span>
              <span className="local-dot" />
              Échelle en mètres
            </span>
            <span>
              {p.rooms.length} pièces · {totalArea.toFixed(1)} m² ·{" "}
              {p.items.length} meubles
            </span>
            <span>{snap ? "Magnétisme activé" : "Placement libre"}</span>
          </footer>
        </main>
        <aside className="right">
          <div className="right-heading">
            <h3>
              {item
                ? "Votre meuble"
                : wall
                  ? "Votre mur"
                  : room
                    ? "Votre pièce"
                    : "Les détails font la différence"}
            </h3>
            <span className="section-label">PROPRIÉTÉS</span>
            <button
              className="inspector-close"
              aria-label="Fermer les propriétés"
              onClick={() => select(null)}
            >
              <X size={17} />
            </button>
          </div>
          {item ? (
            <>
              <div className="selection-preview">
                {item.photo ? (
                  <AssetImage id={item.photo} alt={item.name} />
                ) : (
                  <span>{iconFor(item.kind)}</span>
                )}
              </div>
              <label className="field">
                Nom
                <input
                  value={item.name}
                  onChange={(e) => editItem("name", e.target.value)}
                />
              </label>
              <DimensionsEditor
                key={item.id}
                item={item}
                onPatch={(patch) =>
                  change((p) => {
                    Object.assign(
                      p.items.find((i) => i.id === item.id)!,
                      patch,
                    );
                  })
                }
              />
              {item.asset && (
                <button
                  className="outline full"
                  onClick={() => setModal("split")}
                >
                  Atelier 3D · retirer le décor
                </button>
              )}
              <div className="property-section">
                <h4>Position et orientation</h4>
                <div className="workshop-actions">
                  <button
                    onClick={() => {
                      setView("3d");
                      useNavigation.getState().setPlacement("height");
                    }}
                  >
                    Régler la hauteur · H
                  </button>
                  <button
                    onClick={() => {
                      setView("3d");
                      useNavigation.getState().setPlacement("wall");
                    }}
                  >
                    Placer sur un mur · M
                  </button>
                </div>
                <p className="small">
                  En vue 3D : H pour monter ou descendre, M pour fixer au mur.
                  Appuyez à nouveau pour revenir au déplacement au sol.
                </p>
                {num("Position X", item.x, (v) => editItem("x", v), -1000)}
                {num("Position Y", item.y, (v) => editItem("y", v), -1000)}
                {num("Élévation au-dessus du sol", item.elevation || 0, (v) =>
                  editItem("elevation", v),
                )}
                {num(
                  "Rotation",
                  item.rotation,
                  (v) => editItem("rotation", v),
                  -360,
                  360,
                )}
                <label className="field">
                  Couleur
                  <input
                    type="color"
                    value={item.color}
                    onChange={(e) => editItem("color", e.target.value)}
                  />
                </label>
              </div>
              {showCollisions && collides(item, p) && (
                <p className="warning">
                  Chevauchement possible avec un mur ou un autre meuble. Le
                  contrôle utilise des empreintes simplifiées ; les ouvertures
                  ne sont pas prises en compte.
                </p>
              )}
              <p className="small">
                Distance libre estimée entre le bord et le mur :{" "}
                {p.walls.length
                  ? Math.min(
                      ...p.walls.map((w) => edgeWallDistance(item, w)),
                    ).toFixed(2) + " m"
                  : "aucun mur"}
              </p>
              <button
                className="outline full"
                disabled={!p.walls.length}
                onClick={() =>
                  change((p) => {
                    const index = p.items.findIndex((i) => i.id === item.id);
                    p.items[index] = againstWall(p.items[index], p.walls);
                  })
                }
              >
                Placer contre le mur le plus proche
              </button>
              {item.url && (
                <a
                  className="product-link"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Voir le produit ↗
                </a>
              )}
              {item.price && (
                <p className="small">Prix indicatif : {item.price}</p>
              )}
              <div className="object-actions">
                <button onClick={duplicate}>
                  <Copy size={15} />
                  Dupliquer
                </button>
                <button className="danger" onClick={remove}>
                  <Trash2 size={15} />
                  Supprimer
                </button>
              </div>
              <button
                className="outline full"
                onClick={() =>
                  run(async () => {
                    await libraryPut({ ...item, id: uid() });
                    setPersonal(await library());
                    notify("Meuble enregistré dans votre bibliothèque.");
                  })
                }
              >
                Garder dans Mes meubles
              </button>
            </>
          ) : wall ? (
            <>
              <label className="field">
                Mur · {distance(wall.a, wall.b).toFixed(2)} m
              </label>
              {num(
                "Longueur",
                distance(wall.a, wall.b),
                (v) =>
                  change((p) => {
                    const w = p.walls.find((w) => w.id === wall.id)!,
                      l = distance(w.a, w.b);
                    w.b = {
                      x: w.a.x + ((w.b.x - w.a.x) * v) / l,
                      y: w.a.y + ((w.b.y - w.a.y) * v) / l,
                    };
                    w.openings = w.openings.filter(
                      (o) => o.offset + o.width <= v,
                    );
                  }),
                0.05,
              )}
              <details className="wall-points">
                <summary>Modifier les extrémités</summary>
                {(["a", "b"] as const).map((end) => (
                  <div key={end}>
                    {(["x", "y"] as const).map((axis) =>
                      num(
                        `Point ${end === "a" ? "A" : "B"} · ${axis.toUpperCase()}`,
                        wall[end][axis],
                        (v) =>
                          change((p) => {
                            const w = p.walls.find((w) => w.id === wall.id)!;
                            const q = { ...w[end], [axis]: v };
                            if (
                              distance(q, w[end === "a" ? "b" : "a"]) >= 0.05
                            ) {
                              w[end] = q;
                              w.openings = w.openings.filter(
                                (o) => o.offset + o.width <= distance(w.a, w.b),
                              );
                            }
                          }),
                        -1000,
                      ),
                    )}
                  </div>
                ))}
              </details>
              {num(
                "Épaisseur",
                wall.thickness,
                (v) =>
                  change((p) => {
                    p.walls.find((w) => w.id === wall.id)!.thickness = v;
                  }),
                0.03,
                2,
              )}
              {num(
                "Hauteur",
                wall.height,
                (v) =>
                  change((p) => {
                    p.walls.find((w) => w.id === wall.id)!.height = v;
                  }),
                0.3,
                10,
              )}
              <h4>Revêtement mural</h4>
              <div className="surface-options">
                {wallFinishes.map((f) => (
                  <button
                    key={f.id}
                    aria-pressed={(wall.finish || "paint") === f.id}
                    onClick={() =>
                      change((p) => {
                        const w = p.walls.find((w) => w.id === wall.id)!;
                        w.finish = f.id;
                        w.color =
                          f.id === "paint" || f.id === "satin"
                            ? wall.color
                            : "#ffffff";
                      })
                    }
                  >
                    <span
                      className={`surface-swatch pattern-${f.pattern}`}
                      style={{ backgroundColor: f.color }}
                    />
                    {f.name}
                  </button>
                ))}
              </div>
              <ColorPicker
                key={wall.id}
                label="Couleur du mur"
                value={wall.color}
                onChange={(color) =>
                  change((p) => {
                    p.walls.find((w) => w.id === wall.id)!.color = color;
                  })
                }
              />
              <button
                className="text-button"
                onClick={() =>
                  change((p) => {
                    p.walls.find((w) => w.id === wall.id)!.color = "#ffffff";
                  })
                }
              >
                Retrouver la couleur naturelle du mur
              </button>
              <p className="small">
                La couleur teinte le revêtement. Le blanc conserve sa couleur
                naturelle.
              </p>
              {num(
                "Échelle du motif mural",
                wall.textureScale || 1,
                (v) =>
                  change((p) => {
                    p.walls.find((w) => w.id === wall.id)!.textureScale = v;
                  }),
                0.1,
                10,
              )}
              {num(
                "Orientation du motif mural",
                wall.textureAngle || 0,
                (v) =>
                  change((p) => {
                    p.walls.find((w) => w.id === wall.id)!.textureAngle = v;
                  }),
                -360,
                360,
              )}
              <button
                className="outline full"
                onClick={() =>
                  change((p) => {
                    for (const w of p.walls) {
                      w.finish = wall.finish;
                      w.color = wall.color;
                      w.textureScale = wall.textureScale;
                      w.textureAngle = wall.textureAngle;
                    }
                  })
                }
              >
                Appliquer à tous les murs
              </button>
              {wall.openings.map((o) => (
                <div className="opening" key={o.id}>
                  <h4>
                    {o.kind === "door" ? "Porte" : "Fenêtre"}
                    <button
                      onClick={() =>
                        change((p) => {
                          const w = p.walls.find((w) => w.id === wall.id)!;
                          w.openings = w.openings.filter((v) => v.id !== o.id);
                        })
                      }
                    >
                      <X size={14} />
                    </button>
                  </h4>
                  {o.detection && (
                    <div className="opening-review">
                      <p className="small">
                        {o.detection.reviewed
                          ? "✓ Ouverture vérifiée"
                          : "Proposition automatique à vérifier"}{" "}
                        · signal{" "}
                        {o.detection.confidence >= 0.75
                          ? "fort"
                          : o.detection.confidence >= 0.55
                            ? "moyen"
                            : "faible"}
                      </p>
                      <label className="field">
                        Type de l’ouverture
                        <select
                          value={o.kind}
                          onChange={(e) =>
                            change((p) => {
                              const v = p.walls
                                .find((w) => w.id === wall.id)!
                                .openings.find((v) => v.id === o.id)!;
                              v.kind = e.target.value as "door" | "window";
                              v.sill = v.kind === "door" ? 0 : 0.9;
                              v.height = v.kind === "door" ? 2.1 : 1.2;
                            })
                          }
                        >
                          <option value="door">Porte</option>
                          <option value="window">Fenêtre</option>
                        </select>
                      </label>
                      <button
                        className="outline full"
                        onClick={() =>
                          change((p) => {
                            p.walls
                              .find((w) => w.id === wall.id)!
                              .openings.find(
                                (v) => v.id === o.id,
                              )!.detection!.reviewed = true;
                          })
                        }
                      >
                        Confirmer cette ouverture
                      </button>
                    </div>
                  )}
                  {num(
                    "Décalage",
                    o.offset,
                    (v) =>
                      change((p) => {
                        p.walls
                          .find((w) => w.id === wall.id)!
                          .openings.find((v) => v.id === o.id)!.offset = v;
                      }),
                    0,
                    Math.max(0, distance(wall.a, wall.b) - o.width),
                  )}
                  {num(
                    "Largeur",
                    o.width,
                    (v) =>
                      change((p) => {
                        p.walls
                          .find((w) => w.id === wall.id)!
                          .openings.find((v) => v.id === o.id)!.width = v;
                      }),
                    0.1,
                    distance(wall.a, wall.b) - o.offset,
                  )}
                  {num(
                    "Hauteur",
                    o.height,
                    (v) =>
                      change((p) => {
                        p.walls
                          .find((w) => w.id === wall.id)!
                          .openings.find((v) => v.id === o.id)!.height = v;
                      }),
                    0.1,
                    Math.max(0.1, wall.height - o.sill),
                  )}
                  {o.kind === "window" &&
                    num(
                      "Allège",
                      o.sill,
                      (v) =>
                        change((p) => {
                          p.walls
                            .find((w) => w.id === wall.id)!
                            .openings.find((v) => v.id === o.id)!.sill = v;
                        }),
                      0,
                      Math.max(0, wall.height - o.height),
                    )}
                </div>
              ))}
              <button className="danger full" onClick={remove}>
                <Trash2 size={15} />
                Supprimer ce mur
              </button>
            </>
          ) : room ? (
            <>
              <label className="field">
                Nom de la pièce
                <input
                  value={room.name}
                  onChange={(e) =>
                    change((p) => {
                      p.rooms.find((r) => r.id === room.id)!.name =
                        e.target.value;
                    })
                  }
                />
              </label>
              <p className="metric">
                {area(room.points).toFixed(2)}
                <small>m²</small>
              </p>
              <div className="floor-finishes">
                <h4>Revêtement du sol</h4>
                <div className="floor-options">
                  {floorFinishes.map((f) => (
                    <button
                      key={f.id}
                      className={
                        (room.finish || "plain") === f.id ? "active" : ""
                      }
                      aria-pressed={(room.finish || "plain") === f.id}
                      onClick={() =>
                        change((p) => {
                          p.rooms.find((r) => r.id === room.id)!.finish = f.id;
                        })
                      }
                    >
                      <span
                        className={`surface-swatch pattern-${f.pattern}`}
                        style={{ backgroundColor: f.color }}
                      />
                      {f.name}
                    </button>
                  ))}
                </div>
                <small>
                  Visible en 3D et conservé dans la sauvegarde. Ajustez la
                  teinte et la taille du motif ci-dessous.
                </small>
              </div>
              <ColorPicker
                key={room.id + "floor"}
                label="Couleur du sol"
                value={
                  room.finish && room.finish !== "plain"
                    ? room.tint || "#ffffff"
                    : room.color
                }
                onChange={(color) =>
                  change((p) => {
                    const r = p.rooms.find((r) => r.id === room.id)!;
                    if (r.finish && r.finish !== "plain") r.tint = color;
                    else r.color = color;
                  })
                }
              />
              {room.finish && room.finish !== "plain" && (
                <button
                  className="text-button"
                  onClick={() =>
                    change((p) => {
                      p.rooms.find((r) => r.id === room.id)!.tint = "#ffffff";
                    })
                  }
                >
                  Retrouver la couleur naturelle du sol
                </button>
              )}
              {num(
                "Échelle du motif du sol",
                room.textureScale || 1,
                (v) =>
                  change((p) => {
                    p.rooms.find((r) => r.id === room.id)!.textureScale = v;
                  }),
                0.1,
                10,
              )}
              {num(
                "Orientation du motif du sol",
                room.textureAngle || 0,
                (v) =>
                  change((p) => {
                    p.rooms.find((r) => r.id === room.id)!.textureAngle = v;
                  }),
                -360,
                360,
              )}
              <ColorPicker
                key={room.id + "ceiling"}
                label="Couleur du plafond"
                value={room.ceilingColor || "#eee9e2"}
                onChange={(color) =>
                  change((p) => {
                    p.rooms.find((r) => r.id === room.id)!.ceilingColor = color;
                  })
                }
              />
              <button className="danger full" onClick={remove}>
                Supprimer la pièce
              </button>
            </>
          ) : (
            <>
              <div className="empty-selection">
                <MousePointer2 size={28} />
                <h4>Faites de la place à vos idées.</h4>
                <p>
                  Sélectionnez un meuble, un mur ou une pièce pour ajuster
                  chaque détail.
                </p>
              </div>
              <div className="project-summary">
                <h4>Votre appartement</h4>
                <div>
                  <span>Surface dessinée</span>
                  <strong>{totalArea.toFixed(1)} m²</strong>
                </div>
                <div>
                  <span>Pièces</span>
                  <strong>{p.rooms.length}</strong>
                </div>
                <div>
                  <span>Meubles</span>
                  <strong>{p.items.length}</strong>
                </div>
              </div>
              <div className="tip">
                <span>✦</span>
                <p>
                  Commencez par votre plan, puis imaginez votre intérieur. Tout
                  est enregistré automatiquement.
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
      <input
        ref={planInput}
        hidden
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setAutoFile(f);
            setModal("autoPlan");
          }
          e.target.value = "";
        }}
      />
      <input
        ref={modelInput}
        hidden
        type="file"
        accept=".glb,.gltf,.zip"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFurniture(f);
          e.target.value = "";
        }}
      />
      <input
        ref={furnitureFolderInput}
        hidden
        type="file"
        {...{ webkitdirectory: "" }}
        multiple
        aria-label="Dossier du meuble 3D"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) void loadFurniture(files);
          e.target.value = "";
        }}
      />
      <input
        ref={backupInput}
        hidden
        type="file"
        accept=".zip"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f)
            run(async () => {
              set(await importProject(f));
              setModal(null);
              notify("Projet et ressources restaurés.");
            });
          e.target.value = "";
        }}
      />
      {immersive && !visitLocked && (
        <button className="immersive-return" onClick={toggleImmersive}>
          Afficher l’interface · L
        </button>
      )}
      {message && (
        <div className="toast" role="status">
          {message}
          <button onClick={() => setMessage("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy" role="status">
          {busyStage}
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Gestion Roomora"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Fermer"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "account" ? (
              <Suspense fallback={<p>Chargement du compte…</p>}>
                <AccountPanel
                  project={p}
                  onOpen={(next) => {
                    set(next);
                    setView("2d");
                    setModal(null);
                  }}
                />
              </Suspense>
            ) : modal === "autoPlan" ? (
              <AutoPlanImport
                initial={autoFile}
                onGenerated={async (next) => {
                  await saveProject(useStore.getState().project);
                  set(next);
                  setView("3d");
                  setTab("build");
                  setTool("select");
                  setTransparent(true);
                  setModal(null);
                  notify(
                    `${next.walls.length} murs, ${next.rooms.length} pièces et ${next.walls.reduce((s, w) => s + w.openings.length, 0)} ouvertures proposés. Dimensions estimées ; vérifiez les éléments signalés.`,
                  );
                }}
                onManual={async (file) => {
                  const plan = await importPlan(file);
                  change((p) => {
                    p.plan = plan;
                  });
                  setView("2d");
                  setTab("build");
                  setTool("scale");
                  setModal(null);
                  notify(
                    "Plan importé. Calibrez une distance connue avant de tracer.",
                  );
                }}
              />
            ) : modal === "projects" ? (
              <>
                <span className="eyebrow">VOTRE ATELIER</span>
                <h2>Mes appartements</h2>
                <StorageStatus project={p} />
                <p className="small">
                  Sauvegardés dans ce navigateur. Exportez régulièrement une
                  copie.
                </p>
                <label className="field">
                  Nom du projet actif
                  <input
                    value={p.name}
                    onChange={(e) =>
                      change((p) => {
                        p.name = e.target.value;
                      })
                    }
                  />
                </label>
                <div className="project-list">
                  {allProjects.map((pr) => (
                    <div key={pr.id}>
                      <button
                        onClick={() => {
                          set(pr);
                          setModal(null);
                        }}
                      >
                        <Home size={18} />
                        <span>
                          {pr.name}
                          <small>
                            {new Date(pr.updated).toLocaleDateString("fr-FR")}
                          </small>
                        </span>
                      </button>
                      <button
                        title="Supprimer le projet"
                        onClick={() => {
                          if (confirm("Supprimer définitivement ce projet ?"))
                            run(async () => {
                              await removeProject(pr.id);
                              setAllProjects(await projects());
                              if (pr.id === p.id) set(blank());
                            });
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="primary full"
                  onClick={() => {
                    set(blank());
                    setView("2d");
                    setTab("build");
                    setModal(null);
                  }}
                >
                  <Plus size={16} />
                  Nouvel appartement
                </button>
                <button
                  className="outline full"
                  onClick={() => backupInput.current?.click()}
                >
                  <ArrowUpFromLine size={16} />
                  Restaurer une sauvegarde ZIP
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    set(demo());
                    setModal(null);
                  }}
                >
                  Créer un appartement de démonstration
                </button>
              </>
            ) : modal === "split" && item ? (
              <Suspense fallback={<p>Chargement de la structure…</p>}>
                <SplitModel
                  item={item}
                  onSplit={(items) => {
                    change((p) => {
                      p.items = p.items.filter((i) => i.id !== item.id);
                      p.items.push(...items);
                    });
                    select(items[0]?.id || null);
                    setModal(null);
                    notify(
                      "Atelier appliqué. Annuler permet de retrouver le modèle initial.",
                    );
                  }}
                />
              </Suspense>
            ) : modal === "import" ? (
              <>
                <span className="eyebrow">VOS MEUBLES, SANS LIMITE</span>
                <h2>Ajoutez une pièce à votre intérieur</h2>
                <p className="small">
                  Importez un vrai modèle ou créez une référence à ses
                  dimensions.
                </p>
                <FurnitureSources />
                <button
                  className="import-option furniture-file-drop"
                  disabled={busy}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const f = e.dataTransfer.files[0];
                    if (f) void loadFurniture(f);
                  }}
                  onClick={() => modelInput.current?.click()}
                >
                  <Box />
                  <div>
                    <strong>
                      {busy
                        ? "Préparation du meuble…"
                        : "Importer un fichier 3D ou un ZIP"}
                    </strong>
                    <p>
                      Déposez un GLB ou un ZIP glTF avec ses textures · 100 Mo
                      max.
                    </p>
                  </div>
                  <Plus size={18} />
                </button>
                <button
                  className="outline full"
                  disabled={busy}
                  onClick={() => furnitureFolderInput.current?.click()}
                >
                  Mon ZIP est déjà décompressé : choisir le dossier
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      const i = await importURL(url, setBusyStage);
                      add(i);
                      await libraryPut(i);
                      setPersonal(await library());
                      setModal(null);
                      setView("3d");
                      setRealistic(true);
                    });
                  }}
                >
                  <label className="field">
                    <span>
                      <Link size={16} />
                      Lien direct vers un modèle
                    </span>
                    <input
                      type="url"
                      required
                      placeholder="https://…/canape.glb"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </label>
                  <button className="outline full" disabled={busy}>
                    Télécharger et importer
                  </button>
                </form>
                <button
                  className="import-option"
                  onClick={() => setModal("reference")}
                >
                  <ImagePlus />
                  <div>
                    <strong>Créer un meuble de référence</strong>
                    <p>
                      Photo, lien produit et dimensions réelles. Forme 3D
                      simplifiée.
                    </p>
                  </div>
                  <Plus size={18} />
                </button>
                <p className="notice">
                  Une URL de page marchande ne contient pas forcément de modèle
                  3D. Les restrictions CORS sont respectées. Les ZIP glTF et la
                  compression Draco sont acceptés. OBJ/MTL et textures KTX2 ne
                  sont pas pris en charge.
                </p>
              </>
            ) : modal === "reference" ? (
              <Reference
                onSubmit={(i, file) =>
                  run(async () => {
                    if (file) i.photo = await assetPut(file);
                    add(i);
                    await libraryPut(i);
                    setPersonal(await library());
                    setModal(null);
                  })
                }
              />
            ) : (
              <>
                <h2>Bienvenue chez vous.</h2>
                <p>
                  Déposez votre plan dans l’espace central ou ouvrez{" "}
                  <strong>Mon plan → 3D</strong>. Indiquez la surface totale :
                  Roomora propose automatiquement les murs, les pièces et les
                  ouvertures. Les éléments signalés peuvent être corrigés dans
                  Structure.
                </p>
                <p>
                  Ajoutez vos meubles depuis la bibliothèque, puis glissez-les
                  dans le plan ou modifiez leurs coordonnées précises à droite.
                </p>
                <p>
                  ⌘/Ctrl Z : annuler · ⇧⌘/Ctrl Z : rétablir · ⌘/Ctrl D :
                  dupliquer · R : rotation de 15° · E : masquer/afficher les
                  alertes de chevauchement · Suppr : supprimer · Échap : quitter
                  l’outil.
                </p>
                <p>
                  En visite : cliquez dans la scène, puis utilisez ZQSD ou WASD.
                  Échap libère la souris. Ce mode n’empêche pas de traverser les
                  murs.
                </p>
                <p>
                  Vos données restent dans ce navigateur et cet appareil.
                  L’export ZIP contient aussi vos modèles, photos et plans. Un
                  effacement des données du navigateur peut supprimer vos
                  projets.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Reference({ onSubmit }: { onSubmit: (i: Item, file?: File) => void }) {
  const [photo, setPhoto] = useState<File>();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const width = Number(f.get("width")),
          depth = Number(f.get("depth")),
          height = Number(f.get("height"));
        if ([width, depth, height].some((v) => !Number.isFinite(v) || v <= 0))
          return;
        onSubmit(
          {
            id: uid(),
            name: String(f.get("name")),
            kind: String(f.get("kind")),
            width,
            depth,
            height,
            x: 3,
            y: 3,
            rotation: 0,
            color: "#b5a28d",
            price: String(f.get("price")),
            url: String(f.get("url")),
          },
          photo,
        );
      }}
    >
      <span className="eyebrow">À LA BONNE DIMENSION</span>
      <h2>Un meuble de référence</h2>
      <label className="field">
        Nom
        <input name="name" required placeholder="Mon canapé" />
      </label>
      <label className="field">
        Forme simplifiée
        <select name="kind">
          <option value="sofa">Canapé</option>
          <option value="table">Table / bureau</option>
          <option value="cabinet">Armoire / rangement</option>
          <option value="bed">Lit</option>
          <option value="chair">Chaise</option>
        </select>
      </label>
      <div className="form-grid">
        {[
          ["width", "Largeur"],
          ["depth", "Profondeur"],
          ["height", "Hauteur"],
        ].map(([n, l]) => (
          <label className="field" key={n}>
            {l} (m)
            <input
              name={n}
              type="number"
              step=".01"
              min=".01"
              max="100"
              defaultValue="1"
              required
            />
          </label>
        ))}
      </div>
      <label className="field">
        Photo (facultative)
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setPhoto(e.target.files?.[0])}
        />
      </label>
      <label className="field">
        Prix indicatif
        <input name="price" placeholder="499 €" />
      </label>
      <label className="field">
        Lien produit
        <input name="url" type="url" placeholder="https://…" />
      </label>
      <p className="notice">
        La photo est conservée comme référence. Elle ne produit pas une
        reconstruction 3D fidèle.
      </p>
      <button className="primary full">
        Ajouter et enregistrer dans Mes meubles
      </button>
    </form>
  );
}

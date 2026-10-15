import { useEffect, useState } from "react";
import { MousePointer2, Hand, Scan, Focus, Box } from "lucide-react";
import { useNavigation } from "./navigation";
export default function CameraToolbar() {
  const { mode, setMode, issue, space } = useNavigation();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const editing = (e: KeyboardEvent) =>
      (e.target as HTMLElement)?.closest?.(
        "input,textarea,select,[contenteditable],[role=dialog]",
      );
    const down = (e: KeyboardEvent) => {
      if (
        editing(e) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.pointerLockElement
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        useNavigation.getState().setSpace(true);
      }
      if (e.key.toLowerCase() === "f" && !e.repeat) {
        e.preventDefault();
        useNavigation.getState().issue("focus");
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") useNavigation.getState().setSpace(false);
    };
    const clear = () => useNavigation.getState().setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, []);
  return (
    <div className="camera-toolbar" aria-label="Navigation 3D">
      <button
        className="camera-toolbar-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <Box size={15} />
        Navigation 3D
      </button>
      <div className="camera-toolbar-content" data-expanded={expanded}>
        <div className="camera-tools">
          <button
            title="Aménager : déplacer les meubles avec le bouton gauche"
            aria-pressed={mode === "orbit" && !space}
            onClick={() => setMode("orbit")}
          >
            <MousePointer2 size={16} />
            Aménager
          </button>
          <button
            title="Déplacer la vue · Espace + glisser ou clic droit"
            aria-pressed={mode === "pan" || space}
            onClick={() => setMode("pan")}
          >
            <Hand size={16} />
            Déplacer la vue
          </button>
        </div>
        <div className="camera-tools">
          <button
            title="Cadrer tout l’appartement"
            onClick={() => issue("fit")}
          >
            <Scan size={16} />
            Tout voir
          </button>
          <button
            title="Centrer sur la sélection · F"
            onClick={() => issue("focus")}
          >
            <Focus size={16} />
            Centrer · F
          </button>
        </div>
        <div className="camera-cube" aria-label="Vues prédéfinies">
          <button onClick={() => issue("top")}>Dessus</button>
          <button onClick={() => issue("front")}>Face</button>
          <button onClick={() => issue("side")}>Côté</button>
          <button title="Vue isométrique" onClick={() => issue("iso")}>
            <Box size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

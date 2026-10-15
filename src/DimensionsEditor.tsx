import { useState } from "react";
import type { Item } from "./model";
import { resizeItem, unitFactors } from "./placement";
export default function DimensionsEditor({
  item,
  onPatch,
}: {
  item: Item;
  onPatch: (patch: Partial<Item>) => void;
}) {
  const [locked, setLocked] = useState(true),
    [unit, setUnit] = useState<keyof typeof unitFactors>("m");
  const factor = unitFactors[unit];
  function apply(key: "width" | "depth" | "height", value: number) {
    if (!Number.isFinite(value) || value <= 0 || value * factor > 10000) return;
    const r = resizeItem(item, key, value * factor, locked);
    onPatch({ width: r.width, depth: r.depth, height: r.height });
  }
  return (
    <div className="property-section">
      <h4>Dimensions</h4>
      <label className="field">
        Unité de saisie
        <select
          aria-label="Unité de saisie des dimensions"
          value={unit}
          onChange={(e) => setUnit(e.target.value as keyof typeof unitFactors)}
        >
          <option value="m">Mètres</option>
          <option value="cm">Centimètres</option>
          <option value="mm">Millimètres</option>
          <option value="in">Pouces</option>
        </select>
      </label>
      <label className="dimension-lock">
        <input
          type="checkbox"
          checked={locked}
          onChange={(e) => setLocked(e.target.checked)}
        />
        Conserver les proportions
      </label>
      {(
        [
          ["width", "Largeur"],
          ["depth", "Profondeur"],
          ["height", "Hauteur"],
        ] as const
      ).map(([key, label]) => (
        <label className="field" key={key}>
          {label}
          <div className="number">
            <input
              type="number"
              aria-label={label}
              min={0.001 / factor}
              max={10000 / factor}
              step={0.01 / factor}
              value={Number((item[key] / factor).toFixed(3))}
              onChange={(e) => {
                if (e.target.value !== "") apply(key, Number(e.target.value));
              }}
            />
            <span>{unit}</span>
          </div>
        </label>
      ))}
      {item.asset && (
        <details className="unit-correction">
          <summary>Corriger l’unité du fichier importé</summary>
          <p>
            Si le fichier paraît géant, choisissez son unité d’origine. Ces
            boutons redimensionnent tout le modèle ; Annuler permet de revenir
            en arrière.
          </p>
          {(["cm", "mm", "in"] as const).map((u) => (
            <button
              key={u}
              className="outline full"
              onClick={() =>
                onPatch({
                  width: item.width * unitFactors[u],
                  depth: item.depth * unitFactors[u],
                  height: item.height * unitFactors[u],
                  elevation: (item.elevation || 0) * unitFactors[u],
                })
              }
            >
              Interpréter le modèle en {u === "in" ? "pouces" : u}
            </button>
          ))}
        </details>
      )}
    </div>
  );
}

import { useState } from "react";
import { Lightbulb, Moon, Sun, Target } from "lucide-react";
import { useStore } from "./store";
import { lightPresets } from "./lightSources";
import {
  MAX_LIGHTS,
  type LightingProfile,
  type LightSettings,
} from "./lighting";
import type { Item } from "./model";
export function LightingPanel({
  lighting,
  onLighting,
  onAdd,
  onSelect,
}: {
  lighting: LightingProfile;
  onLighting: (v: LightingProfile) => void;
  onAdd: (preset: keyof typeof lightPresets, room: string) => void;
  onSelect: (id: string) => void;
}) {
  const { project, change } = useStore();
  const [room, setRoom] = useState(project.rooms[0]?.id || "");
  const lights = project.items.filter((i) => i.kind === "light");
  return (
    <section className="lighting-panel" aria-label="Éclairage de l’appartement">
      <p className="panel-intro">Dessinez l’ambiance, une lumière à la fois.</p>
      <div className="day-night-switch">
        <button
          aria-pressed={lighting !== "night"}
          onClick={() => onLighting("daylight")}
        >
          <Sun size={18} />
          Jour
        </button>
        <button
          aria-pressed={lighting === "night"}
          onClick={() => onLighting("night")}
        >
          <Moon size={18} />
          Nuit
        </button>
      </div>
      <label className="field">
        Placer dans la pièce
        <select
          aria-label="Pièce pour la nouvelle lumière"
          value={project.rooms.some((r) => r.id === room) ? room : ""}
          onChange={(e) => setRoom(e.target.value)}
        >
          <option value="">Au centre de l’appartement</option>
          {project.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="light-presets">
        {Object.entries(lightPresets).map(([id, preset]) => (
          <button
            key={id}
            disabled={lights.length >= MAX_LIGHTS}
            onClick={() => onAdd(id as keyof typeof lightPresets, room)}
          >
            {id === "spot" ? <Target size={22} /> : <Lightbulb size={22} />}
            <strong>Ajouter {preset.name.toLowerCase()}</strong>
            <small>
              {id === "spot"
                ? "Faisceau dirigé"
                : id === "ceiling"
                  ? "Éclairer une pièce"
                  : "Souligner un coin"}
            </small>
          </button>
        ))}
      </div>
      <p className="small">
        Déplacez la lumière comme un meuble. Dans ses propriétés, réglez sa
        hauteur et son intensité. H permet aussi de la monter ou descendre en
        3D.
      </p>
      <div className="section-line">
        <span className="section-label">MES LUMIÈRES</span>
        <span>
          {lights.length} / {MAX_LIGHTS}
        </span>
      </div>
      {lights.length === 0 && (
        <p className="light-empty">
          Ajoutez un plafonnier, puis passez en Nuit pour voir son effet.
        </p>
      )}
      <div className="light-list">
        {lights.map((i) => (
          <div key={i.id}>
            <input
              type="checkbox"
              aria-label={`Allumer ${i.name}`}
              checked={!!i.light?.enabled}
              onChange={(e) =>
                change((p) => {
                  p.items.find((v) => v.id === i.id)!.light!.enabled =
                    e.target.checked;
                })
              }
            />
            <button
              onClick={() => onSelect(i.id)}
              aria-label={`Modifier ${i.name}`}
            >
              <span
                className="light-color"
                style={{ background: i.light?.color }}
              />
              {i.name}
              <small>{i.light?.lumens} lm</small>
            </button>
          </div>
        ))}
      </div>
      <p className="small">
        Jusqu’à 12 sources. Deux sources activées calculent les ombres pour
        préserver la fluidité.
      </p>
    </section>
  );
}
export function LightInspector({ item, pro }: { item: Item; pro: boolean }) {
  const { change } = useStore();
  const light = item.light!;
  function patch(v: Partial<LightSettings>) {
    change((p) =>
      Object.assign(p.items.find((i) => i.id === item.id)!.light!, v),
    );
  }
  return (
    <section
      className="light-inspector property-section"
      aria-label="Réglages de la lumière"
    >
      <h4>Source lumineuse</h4>
      <label className="light-toggle">
        <input
          type="checkbox"
          aria-label="Lumière allumée"
          checked={light.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        Allumée
      </label>
      <label className="field">
        Intensité · {light.lumens} lm
        <input
          aria-label="Intensité de la lumière"
          type="range"
          min="0"
          max={pro ? "10000" : Math.max(3000, light.lumens)}
          step="50"
          value={light.lumens}
          onChange={(e) => patch({ lumens: Number(e.target.value) })}
        />
      </label>
      <label className="field">
        Hauteur de la lumière (m)
        <input
          aria-label="Hauteur de la lumière"
          type="number"
          min="0"
          max="20"
          step="0.05"
          value={item.elevation || 0}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (e.target.value && Number.isFinite(v) && v >= 0 && v <= 20)
              change((p) => {
                p.items.find((i) => i.id === item.id)!.elevation = v;
              });
          }}
        />
      </label>
      <div className="light-swatches">
        {[
          ["Chaud", "#ffd2a1"],
          ["Neutre", "#fff1d6"],
          ["Froid", "#d9e6ff"],
        ].map(([name, color]) => (
          <button
            key={name}
            onClick={() => patch({ color })}
            aria-pressed={light.color === color}
          >
            <span style={{ background: color }} />
            {name}
          </button>
        ))}
      </div>
      <label className="field">
        Couleur personnalisée
        <input
          aria-label="Couleur de la lumière"
          type="color"
          value={light.color}
          onChange={(e) => patch({ color: e.target.value })}
        />
      </label>
      <label className="field">
        Diffusion
        <select
          aria-label="Type de lumière"
          value={light.type}
          onChange={(e) =>
            patch({ type: e.target.value as LightSettings["type"] })
          }
        >
          <option value="point">Tout autour</option>
          <option value="spot">Spot dirigé</option>
        </select>
      </label>
      {light.type === "spot" && (
        <>
          <label className="field">
            Inclinaison · {light.tilt}°
            <input
              aria-label="Inclinaison du spot"
              type="range"
              min="0"
              max="90"
              step="5"
              value={light.tilt}
              onChange={(e) => patch({ tilt: Number(e.target.value) })}
            />
          </label>
          <p className="small">
            0° : vers le sol. 90° : horizontal. Utilisez Rotation pour orienter
            le spot autour de la pièce.
          </p>
        </>
      )}
      {pro && (
        <div className="light-pro-controls">
          <label className="field">
            Flux lumineux (lm)
            <input
              aria-label="Flux lumineux"
              type="number"
              min="0"
              max="10000"
              step="50"
              value={light.lumens}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (
                  e.target.value &&
                  Number.isFinite(v) &&
                  v >= 0 &&
                  v <= 10000
                )
                  patch({ lumens: v });
              }}
            />
          </label>
          <label className="field">
            Portée du calcul · {light.range} m
            <input
              aria-label="Portée de la lumière"
              type="range"
              min="1"
              max="30"
              value={light.range}
              onChange={(e) => patch({ range: Number(e.target.value) })}
            />
          </label>
          {light.type === "spot" && (
            <label className="field">
              Ouverture · {light.angle}°
              <input
                aria-label="Ouverture du spot"
                type="range"
                min="10"
                max="120"
                step="5"
                value={light.angle}
                onChange={(e) => patch({ angle: Number(e.target.value) })}
              />
            </label>
          )}
          <label className="light-toggle">
            <input
              type="checkbox"
              checked={light.shadows}
              onChange={(e) => patch({ shadows: e.target.checked })}
            />
            Calculer les ombres
          </label>
          <p className="small">
            Ombres pour les deux premières sources actives qui les demandent.
            Les autres éclairent sans occlusion. Aperçu artistique, sans calcul
            d’éclairement en lux.
          </p>
        </div>
      )}
    </section>
  );
}

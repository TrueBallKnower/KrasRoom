import { useState } from "react";
import { Download, Ruler } from "lucide-react";
import { useStore } from "./store";
import { quantities, technicalSvg, quantityCsv } from "./architecture";
export default function ArchitecturePanel({
  onMessage,
}: {
  onMessage: (v: string) => void;
}) {
  const { project, change } = useStore();
  const [scale, setScale] = useState<50 | 100 | 200>(100),
    [height, setHeight] = useState(2.6),
    [thickness, setThickness] = useState(0.15);
  const q = quantities(project);
  function download(data: string, type: string, ext: string) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `KrasRoom-plan-${scale}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="architecture-panel" aria-label="Outils d’architecture">
      <div className="pro-heading">
        <Ruler size={18} />
        <h3>Dossier technique</h3>
        <span>PRO</span>
      </div>
      <p className="small">
        Travaillez en mètres, exportez à l’échelle et préparez vos quantités.
      </p>
      <dl className="quantity-grid">
        <div>
          <dt>Surface tracée</dt>
          <dd>
            {q.floor.toFixed(2)} <small>m²</small>
          </dd>
        </div>
        <div>
          <dt>Murs · axes</dt>
          <dd>
            {q.length.toFixed(2)} <small>m</small>
          </dd>
        </div>
        <div>
          <dt>Faces nettes · 2 côtés</dt>
          <dd>
            {q.wallFaces.toFixed(2)} <small>m²</small>
          </dd>
        </div>
        <div>
          <dt>Volume net des murs</dt>
          <dd>
            {q.volume.toFixed(2)} <small>m³</small>
          </dd>
        </div>
      </dl>
      <p className="small">
        Ouvertures déduites, recouvrements d’ouvertures comptés une fois. Hors
        recouvrements aux jonctions et couches de finition. Les surfaces de
        pièces suivent vos tracés.
      </p>
      <label className="field">
        Échelle du plan
        <select
          aria-label="Échelle du plan technique"
          value={scale}
          onChange={(e) => setScale(Number(e.target.value) as 50 | 100 | 200)}
        >
          <option value="50">1:50</option>
          <option value="100">1:100</option>
          <option value="200">1:200</option>
        </select>
      </label>
      <button
        className="outline full"
        disabled={!project.walls.length && !project.rooms.length}
        onClick={() => {
          try {
            download(technicalSvg(project, scale), "image/svg+xml", "svg");
            onMessage(
              "Plan SVG à l’échelle exporté. Imprimez à 100 %, sans ajuster à la page.",
            );
          } catch (e) {
            onMessage(String(e));
          }
        }}
      >
        <Download size={15} />
        Exporter le plan à l’échelle
      </button>
      <p className="small">
        SVG vectoriel : murs, ouvertures, pièces et cotes en mètres. Sans
        mobilier ni image de fond. À imprimer à 100 %, sans ajustement.
      </p>
      <button
        className="outline full"
        onClick={() =>
          download(quantityCsv(project), "text/csv;charset=utf-8", "csv")
        }
      >
        <Download size={15} />
        Exporter le quantitatif CSV
      </button>
      <details className="wall-standards">
        <summary>Réglages communs des murs</summary>
        <label className="field">
          Hauteur commune (m)
          <input
            aria-label="Hauteur commune des murs"
            type="number"
            min=".5"
            max="10"
            step=".05"
            value={height}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 0.5 && v <= 10) setHeight(v);
            }}
          />
        </label>
        <label className="field">
          Épaisseur commune (m)
          <input
            aria-label="Épaisseur commune des murs"
            type="number"
            min=".05"
            max="1"
            step=".01"
            value={thickness}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 0.05 && v <= 1) setThickness(v);
            }}
          />
        </label>
        <button
          className="outline full"
          disabled={!project.walls.length}
          onClick={() => {
            if (
              project.walls.some((w) =>
                w.openings.some((o) => o.sill + o.height > height + 0.001),
              )
            ) {
              onMessage(
                "Hauteur trop faible : une ouverture dépasserait le mur. Ajustez-la avant de continuer.",
              );
              return;
            }
            change((p) =>
              p.walls.forEach((w) => {
                w.height = height;
                w.thickness = thickness;
              }),
            );
            onMessage(
              "Hauteur et épaisseur appliquées à tous les murs. Annuler reste disponible.",
            );
          }}
        >
          Appliquer à tous les murs du projet
        </button>
      </details>
    </section>
  );
}

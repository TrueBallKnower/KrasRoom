import { useEffect, useRef, useState } from "react";
import { ImagePlus, Sparkles, ArrowRight } from "lucide-react";
import { importPlan } from "./imports";
import { analyzePlan, reconstruct } from "./detection/analyze";
import { type Project } from "./model";
export default function AutoPlanImport({
  initial,
  onGenerated,
  onManual,
}: {
  initial?: File;
  onGenerated: (p: Project) => Promise<void>;
  onManual: (f: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | undefined>(initial),
    [surface, setSurface] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(""),
    [threshold, setThreshold] = useState(170),
    [thickness, setThickness] = useState(3);
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!file?.type.startsWith("image/")) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const choose = (f?: File) => {
    if (!f) return;
    setFile(f);
    setError("");
  };
  async function generate() {
    if (!file) {
      setError("Déposez votre plan pour commencer.");
      return;
    }
    const total = Number(surface.replace(",", "."));
    if (!Number.isFinite(total) || total < 1 || total > 10000) {
      setError("Indiquez la surface intérieure totale, entre 1 et 10 000 m².");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setStatus("Lecture de votre plan…");
      const plan = await importPlan(file);
      if (!active.current) return;
      setStatus("Détection des murs, des pièces et des ouvertures…");
      const detection = await analyzePlan(plan, {
        threshold,
        minThickness: thickness,
      });
      if (!active.current) return;
      setStatus("Création de votre appartement en 3D…");
      const p = reconstruct(
        detection,
        plan,
        total,
        file.name.replace(/\.[^.]+$/, "") || "Mon appartement",
      );
      await onGenerated(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }
  return (
    <div className="auto-import">
      <span className="eyebrow">DU PLAN À VOTRE APPARTEMENT</span>
      <h2>
        Déposez votre plan.
        <br />
        Roomora construit la 3D.
      </h2>
      <p className="small">
        Une image ou un PDF, la surface totale de votre appartement, et
        l’analyse se fait sur votre appareil. Aucun mur à tracer pour commencer.
      </p>
      <button
        className={"plan-drop " + (file ? "has-file" : "")}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) choose(e.dataTransfer.files[0]);
        }}
      >
        {preview ? (
          <img src={preview} alt="Votre plan à analyser" />
        ) : (
          <ImagePlus size={32} />
        )}
        <strong>{file ? file.name : "Déposez votre plan ici"}</strong>
        <span>
          {file
            ? "Cliquer pour choisir un autre fichier"
            : "ou cliquez pour choisir · PDF, PNG, JPG"}
        </span>
      </button>
      <input
        ref={input}
        hidden
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      <label className="field">
        Surface intérieure totale de l’appartement (m²)
        <input
          autoFocus
          aria-label="Surface intérieure totale"
          inputMode="decimal"
          placeholder="Par exemple : 48"
          value={surface}
          disabled={busy}
          onChange={(e) => setSurface(e.target.value)}
        />
      </label>
      <p className="notice">
        Utilisez la surface habitable des pièces, hors balcon. Elle sert à
        estimer les dimensions ; Roomora ne lit pas encore les cotes imprimées.
        Les ouvertures proposées restent à vérifier.
      </p>
      <details className="detection-settings">
        <summary>Réglages si votre plan est peu contrasté</summary>
        <label className="field">
          Contraste de détection : {threshold}
          <input
            type="range"
            min="70"
            max="220"
            value={threshold}
            disabled={busy}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </label>
        <label className="field">
          Épaisseur minimale des traits : {thickness} px
          <input
            type="range"
            min="2"
            max="8"
            value={thickness}
            disabled={busy}
            onChange={(e) => setThickness(Number(e.target.value))}
          />
        </label>
        <p className="small">
          Plans nets avec murs horizontaux et verticaux. Les photos en
          perspective, les murs obliques et les plans très chargés peuvent
          nécessiter un recadrage ou des corrections.
        </p>
      </details>
      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      <button className="primary full" disabled={busy} onClick={generate}>
        <Sparkles size={17} />
        {busy ? status : "Créer mon appartement en 3D"}
      </button>
      <details className="detection-settings">
        <summary>Je préfère utiliser le tracé manuel</summary>
        <button
          className="text-button"
          disabled={!file || busy}
          onClick={async () => {
            if (!file) return;
            setBusy(true);
            try {
              await onManual(file);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Import impossible.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Utiliser comme fond de plan <ArrowRight size={14} />
        </button>
      </details>
    </div>
  );
}

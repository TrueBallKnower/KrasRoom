import { useState, useEffect } from "react";
import { assetGet } from "./db";
import type { Project } from "./model";
const bytes = (n?: number) =>
  n === undefined
    ? "Non communiqué"
    : n >= 1024 ** 3
      ? (n / 1024 ** 3).toFixed(2) + " Go"
      : (n / 1024 ** 2).toFixed(1) + " Mo";
export default function StorageStatus({ project }: { project: Project }) {
  const [info, setInfo] = useState<{
      size: number;
      count: number;
      usage?: number;
      quota?: number;
      protected?: boolean;
    }>(),
    [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    const ids = [
      ...new Set(
        [
          project.plan?.asset,
          ...project.items.flatMap((i) => [i.asset, i.photo]),
        ].filter(Boolean) as string[],
      ),
    ];
    Promise.all([
      Promise.all(ids.map((id) => assetGet(id))).then((b) =>
        b.reduce((n, b) => n + (b?.size || 0), 0),
      ),
      navigator.storage?.estimate?.().catch(() => ({} as StorageEstimate)),
      navigator.storage?.persisted?.().catch(() => false),
    ])
      .then(([size, estimate, protectedStorage]) => {
        if (active)
          setInfo({
            size,
            count: ids.length,
            usage: estimate?.usage,
            quota: estimate?.quota,
            protected: protectedStorage,
          });
      })
      .catch(() => {
        if (active) setStatus("Estimation du stockage indisponible.");
      });
    return () => {
      active = false;
    };
  }, [project]);
  return (
    <section className="storage-status">
      <h3>Stockage de ce navigateur</h3>
      {info ? (
        <>
          <p>
            Fichiers du projet : <strong>{bytes(info.size)}</strong> ·{" "}
            {info.count} ressources distinctes
          </p>
          <p>
            Utilisé : {bytes(info.usage)} · quota annoncé : {bytes(info.quota)}
          </p>
          <small>
            Le quota dépend du navigateur et de l’espace libre. La mémoire
            nécessaire au rendu peut dépasser la taille des fichiers.
          </small>
          {navigator.storage?.persist && (
            <button
              className="outline full"
              disabled={info.protected}
              onClick={async () => {
                const ok = await navigator.storage.persist();
                setInfo({ ...info, protected: ok });
                setStatus(
                  ok
                    ? "Stockage persistant accordé."
                    : "Le navigateur n’a pas accordé le stockage persistant. Exportez régulièrement une sauvegarde.",
                );
              }}
            >
              {info.protected
                ? "Stockage persistant activé"
                : "Demander la conservation du stockage"}
            </button>
          )}
        </>
      ) : (
        <p>{status || "Calcul du stockage…"}</p>
      )}
      {status && info && <p role="status">{status}</p>}
    </section>
  );
}

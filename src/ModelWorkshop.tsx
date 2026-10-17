import { lazy, Suspense, useState } from "react";
import type { Item } from "./model";
const SplitModel = lazy(() => import("./SplitModel"));
const ModelCreator = lazy(() => import("./ModelCreator"));
export default function ModelWorkshop({
  item,
  onSplit,
  onCreate,
  onSaveLibrary,
}: {
  item?: Item;
  onSplit: (items: Item[]) => void;
  onCreate: (file: File) => Promise<void>;
  onSaveLibrary: (file: File) => Promise<void>;
}) {
  const [tab, setTab] = useState<"clean" | "create" | "blender">(
    item?.asset ? "clean" : "create",
  );
  const [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  return (
    <>
      <h2>Atelier 3D</h2>
      <nav className="workshop-tabs" aria-label="Sections de l’atelier 3D">
        {(
          [
            ["clean", "Nettoyer un modèle"],
            ["create", "Créer un meuble"],
            ["blender", "Depuis Blender"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <Suspense fallback={<p>Ouverture de l’atelier…</p>}>
        {tab === "clean" ? (
          item?.asset ? (
            <SplitModel
              item={item}
              onSplit={onSplit}
              onSaveLibrary={onSaveLibrary}
            />
          ) : (
            <p className="notice">
              Sélectionnez un meuble importé dans l’appartement pour retirer son
              décor, ou importez-le depuis la section « Depuis Blender ».
            </p>
          )
        ) : tab === "create" ? (
          <ModelCreator source={item} onCreate={onCreate} />
        ) : (
          <>
            <h3>De Blender à votre appartement</h3>
            <p>
              Le format <strong>GLB</strong> réunit le modèle et ses textures
              dans un seul fichier. L’import et la sauvegarde sont gratuits et
              locaux.
            </p>
            <ol className="blender-steps">
              <li>
                Dans Blender, choisissez <strong>Metric / Meters</strong> dans
                Scene Properties → Units, puis vérifiez les dimensions du
                meuble.
              </li>
              <li>
                Sélectionnez les objets du meuble, sans le sol ni les murs du
                décor. Gardez des objets séparés si vous souhaitez les nettoyer
                ici.
              </li>
              <li>
                Choisissez <strong>File → Export → glTF 2.0</strong>, puis{" "}
                <strong>glTF Binary (.glb)</strong> et{" "}
                <strong>Selected Objects</strong>.
              </li>
              <li>
                Utilisez des matériaux Principled BSDF et des textures PNG/JPG ;
                les textures procédurales doivent être converties en images dans
                Blender.
              </li>
              <li>
                Importez le GLB ci-dessous, puis vérifiez ses dimensions dans
                les propriétés.
              </li>
            </ol>
            <label className="field blender-import">
              Importer un modèle Blender (GLB, glTF ou ZIP)
              <input
                type="file"
                accept=".glb,.gltf,.zip,.blend"
                disabled={working}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setWorking(true);
                  setError("");
                  void onCreate(file)
                    .catch((e) => setError(e.message))
                    .finally(() => setWorking(false));
                }}
              />
            </label>
            {working && (
              <p role="status">Préparation et enregistrement du modèle…</p>
            )}
            {error && (
              <p role="alert" className="warning">
                {error}
              </p>
            )}
            <p className="notice">
              Les fichiers natifs <strong>.blend</strong> ne s’ouvrent pas dans
              le navigateur : exportez-les depuis Blender en GLB. Les modifiers,
              éclairages et shaders propres à Blender ne sont pas tous
              transférables. Import maximal : 100 Mo ; glTF avec fichiers
              associés : ZIP complet ou dossier via « Ajouter mon propre meuble
              ».
            </p>
          </>
        )}
      </Suspense>
    </>
  );
}

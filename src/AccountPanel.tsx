import { useEffect, useState } from "react";
import type { Project } from "./model";
import { uid } from "./model";
import { saveProject } from "./db";
import { cloudConfig } from "./cloudConfig";
import { cloudClient, cloudError } from "./cloudClient";
import { useCloud } from "./cloudState";
import { listCloudProjects, openCloudProject } from "./cloudProjects";
import type { CloudRow } from "./cloudDocument";
import { pushCloud } from "./useCloudSync";
export default function AccountPanel({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: (p: Project) => void;
}) {
  const state = useCloud(),
    [rows, setRows] = useState<Omit<CloudRow, "document">[]>([]),
    [working, setWorking] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function refresh() {
    try {
      const user = useCloud.getState().session?.user.id;
      const result = await listCloudProjects();
      if (user === useCloud.getState().session?.user.id) setRows(result);
    } catch (e) {
      setError(cloudError(e));
    }
  }
  useEffect(() => {
    if (state.session) void refresh();
  }, [state.session?.user.id, state.tick]);
  async function action(f: () => Promise<void>) {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      await f();
    } catch (e) {
      setError(cloudError(e));
    } finally {
      setWorking(false);
    }
  }
  if (!cloudConfig())
    return (
      <>
        <h2>Mon compte</h2>
        <p>
          La connexion et les sauvegardes entre ordinateurs doivent encore être
          activées sur ce site.
        </p>
        <p className="notice">
          Vos appartements restent enregistrés sur cet appareil. En attendant
          l’activation, utilisez Exporter puis Restaurer une sauvegarde sur
          l’autre ordinateur.
        </p>
        <a
          href="https://github.com/TrueBallKnower/KrasRoom/blob/main/supabase/INSTALLATION.md"
          target="_blank"
          rel="noreferrer"
        >
          Instructions d’activation du service gratuit ↗
        </a>
      </>
    );
  const disabled = working || state.busy;
  return (
    <>
      <h2>Mon compte</h2>
      {state.session ? (
        <>
          <p>
            Connecté : <strong>{state.session.user.email}</strong>
          </p>
          {state.recovery ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action(async () => {
                  const c = await cloudClient(),
                    { error } = await c.auth.updateUser({
                      password: String(f.get("password")),
                    });
                  if (error) throw error;
                  state.patch({ recovery: false });
                  setMessage("Mot de passe modifié.");
                });
              }}
            >
              <label className="field">
                Nouveau mot de passe
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <button className="primary full" disabled={disabled}>
                Modifier le mot de passe
              </button>
            </form>
          ) : null}
          <p className="small">
            La sauvegarde locale reste active. Après le premier envoi, les
            modifications de cet appartement sont synchronisées automatiquement.
            Sur l’autre ordinateur, la dernière version est récupérée à la
            connexion et au retour dans l’onglet, si aucune modification locale
            n’est en conflit.
          </p>
          <button
            className="primary full"
            disabled={disabled}
            onClick={() =>
              void action(async () => {
                if (!(await pushCloud(project)))
                  throw Error(useCloud.getState().error || "Envoi impossible.");
                setMessage(
                  "Appartement sauvegardé en ligne, avec ses modèles 3D.",
                );
                await refresh();
              })
            }
          >
            Sauvegarder cet appartement en ligne
          </button>
          <button
            className="outline full"
            disabled={disabled}
            onClick={() =>
              void action(async () => {
                const copy = {
                  ...structuredClone(project),
                  id: uid(),
                  name: project.name + " (copie)",
                  updated: Date.now(),
                };
                await saveProject(copy);
                if (!(await pushCloud(copy)))
                  throw Error(useCloud.getState().error || "Envoi impossible.");
                onOpen(copy);
              })
            }
          >
            Enregistrer une copie en ligne
          </button>
          <h3>Mes appartements en ligne</h3>
          <button disabled={disabled} onClick={() => void refresh()}>
            Actualiser la liste
          </button>
          {!rows.length && (
            <p className="small">Aucun appartement en ligne pour le moment.</p>
          )}
          <div className="project-list">
            {rows.map((r) => (
              <div key={r.project_id}>
                <button
                  disabled={disabled}
                  onClick={() =>
                    void action(async () => {
                      await saveProject(project);
                      state.patch({
                        busy: true,
                        error: "",
                        status: "Récupération de l’appartement…",
                      });
                      try {
                        const p = await openCloudProject(
                          r.project_id,
                          state.session!.user.id,
                          setMessage,
                        );
                        state.patch({
                          error: "",
                          status: "En ligne",
                          tick: state.tick + 1,
                        });
                        onOpen(p);
                      } finally {
                        useCloud.getState().patch({ busy: false });
                      }
                    })
                  }
                >
                  <span>
                    {r.name}
                    <small>
                      {new Date(r.updated_at).toLocaleString("fr-FR")}
                    </small>
                  </span>
                  <span>Ouvrir</span>
                </button>
              </div>
            ))}
          </div>
          <button
            className="text-button"
            disabled={disabled}
            onClick={() =>
              void action(async () => {
                const c = await cloudClient(),
                  { error } = await c.auth.signOut({ scope: "local" });
                if (error) throw error;
                state.patch({
                  session: null,
                  error: "",
                  status: "",
                  recovery: false,
                });
                setRows([]);
              })
            }
          >
            Se déconnecter de cet appareil
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget),
              submit = (e.nativeEvent as SubmitEvent)
                .submitter as HTMLButtonElement | null,
              mode = submit?.value || "login",
              email = String(form.get("email")),
              password = String(form.get("password"));
            void action(async () => {
              const c = await cloudClient();
              if (mode === "reset") {
                const { error } = await c.auth.resetPasswordForEmail(email, {
                  redirectTo: location.origin + location.pathname,
                });
                if (error) throw error;
                setMessage(
                  "Si ce compte existe, un lien de réinitialisation vous sera envoyé.",
                );
                return;
              }
              const { data, error } =
                mode === "signup"
                  ? await c.auth.signUp({
                      email,
                      password,
                      options: {
                        emailRedirectTo: location.origin + location.pathname,
                      },
                    })
                  : await c.auth.signInWithPassword({ email, password });
              if (error) throw error;
              if (mode === "signup" && !data.session)
                setMessage(
                  "Vérifiez votre boîte mail et confirmez votre adresse avant de vous connecter.",
                );
            });
          }}
        >
          <p>
            Retrouvez vos appartements et leurs meubles sur vos autres
            ordinateurs.
          </p>
          <label className="field">
            Adresse e-mail
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label className="field">
            Mot de passe
            <input
              type="password"
              name="password"
              minLength={8}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary full" disabled={disabled} value="login">
            Se connecter
          </button>
          <button className="outline full" disabled={disabled} value="signup">
            Créer mon compte gratuit
          </button>
          <button
            className="text-button"
            disabled={disabled}
            value="reset"
            formNoValidate
          >
            Mot de passe oublié
          </button>
          <p className="small">
            Seuls les appartements envoyés en ligne seront accessibles depuis
            vos autres appareils.
          </p>
        </form>
      )}
      {(working || state.busy) && (
        <p role="status">{state.status || message || "Connexion…"}</p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {(error || state.error) && (
        <p role="alert" className="warning">
          {error || state.error}
        </p>
      )}
    </>
  );
}

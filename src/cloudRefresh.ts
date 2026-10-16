import { cloudClient } from "./cloudClient";
import { cloudLink } from "./cloudMeta";
import { fingerprint } from "./cloudDocument";
import { listCloudProjects, openCloudProject } from "./cloudProjects";
import { saveProject } from "./db";
import { useStore } from "./store";
import { useCloud } from "./cloudState";

/** Returns false when another transfer owns the lock; retry on the next tick. */
export async function refreshCloudProject(user: string, initial: boolean) {
  if (useCloud.getState().busy) return false;
  const snapshot = useStore.getState().project;
  const current = () =>
    useCloud.getState().session?.user.id === user &&
    useStore.getState().project === snapshot;
  useCloud.getState().patch({ busy: true });
  try {
    const link = await cloudLink(user, snapshot.id);
    let id = snapshot.id;
    if (!link) {
      if (!initial) return true;
      const rows = await listCloudProjects();
      if (!rows.length) return true;
      id = rows[0].project_id;
    } else {
      const c = await cloudClient();
      const { data, error } = await c
        .from("roomora_projects")
        .select("revision")
        .eq("project_id", id)
        .maybeSingle();
      if (error) throw error;
      if (data?.revision === link.revision) return true;
      if (!data || (await fingerprint(snapshot)) !== link.fingerprint)
        throw Error(
          "Des modifications existent sur les deux ordinateurs. Ouvrez Mon compte pour choisir la version à conserver ou enregistrer une copie.",
        );
    }
    if (!current()) return true;
    // Preserve even an unrelated local project before resuming the cloud one.
    await saveProject(snapshot);
    useCloud
      .getState()
      .patch({ status: "Actualisation de l’appartement…", error: "" });
    const project = await openCloudProject(
      id,
      user,
      (status) => useCloud.getState().patch({ status }),
      current,
      (project) => useStore.getState().set(project),
    );
    if (useStore.getState().project !== project) return true;
    useCloud.getState().patch({
      status: "À jour",
      error: "",
      tick: useCloud.getState().tick + 1,
    });
    return true;
  } catch (error) {
    const latest = useStore.getState().project;
    if (latest !== snapshot && useCloud.getState().session?.user.id === user)
      await saveProject(latest);
    throw error;
  } finally {
    const state = useCloud.getState();
    state.patch({
      busy: false,
      ...(useStore.getState().project !== snapshot ||
      state.session?.user.id !== user
        ? { tick: state.tick + 1 }
        : {}),
    });
  }
}

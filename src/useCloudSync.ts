import { useEffect } from "react";
import { cloudConfig } from "./cloudConfig";
import { cloudClient, cloudError } from "./cloudClient";
import { useCloud } from "./cloudState";
import { cloudLink } from "./cloudMeta";
import { fingerprint } from "./cloudDocument";
import { saveCloudProject } from "./cloudProjects";
import { useStore } from "./store";
import type { Project } from "./model";
export async function pushCloud(p: Project) {
  const state = useCloud.getState();
  if (!state.session || state.busy) return false;
  state.patch({ busy: true, error: "", status: "Synchronisation…" });
  try {
    await saveCloudProject(p, state.session.user.id, (s) =>
      useCloud.getState().patch({ status: s }),
    );
    useCloud
      .getState()
      .patch({ status: "En ligne", tick: useCloud.getState().tick + 1 });
    return true;
  } catch (e) {
    useCloud
      .getState()
      .patch({ error: cloudError(e), status: "Copie locale conservée" });
    return false;
  } finally {
    useCloud.getState().patch({ busy: false });
  }
}
export function useCloudSync(project: Project, loaded: boolean) {
  const { session, tick } = useCloud();
  useEffect(() => {
    if (!cloudConfig()) {
      useCloud.getState().patch({ ready: true });
      return;
    }
    let active = true,
      unsubscribe: (() => void) | undefined;
    void cloudClient()
      .then(async (c) => {
        if (!active) return;
        const {
          data: { subscription },
        } = c.auth.onAuthStateChange((event, session) => {
          if (active)
            useCloud.getState().patch({
              session,
              ready: true,
              ...(event === "PASSWORD_RECOVERY" ? { recovery: true } : {}),
            });
        });
        unsubscribe = () => subscription.unsubscribe();
        const { data, error } = await c.auth.getSession();
        if (active)
          useCloud.getState().patch({
            session: data.session,
            ready: true,
            ...(error ? { error: cloudError(error) } : {}),
          });
      })
      .catch((e) => {
        if (active)
          useCloud.getState().patch({ ready: true, error: cloudError(e) });
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (!loaded || !session) return;
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        const link = await cloudLink(session.user.id, project.id);
        if (!active || !link || useCloud.getState().busy) return;
        if ((await fingerprint(project)) === link.fingerprint) return;
        if (!active) return;
        useCloud.getState().patch({ status: "Modifications locales" });
        await pushCloud(project);
      })().catch((e) => {
        if (active) useCloud.getState().patch({ error: cloudError(e) });
      });
    }, 4000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [project, loaded, session?.user.id, tick]);
  useEffect(() => {
    if (!session || !loaded) return;
    const refresh = () => {
      const p = useStore.getState().project;
      void (async () => {
        const link = await cloudLink(session.user.id, p.id);
        if (!link || useCloud.getState().busy) return;
        const c = await cloudClient(),
          { data, error } = await c
            .from("roomora_projects")
            .select("revision")
            .eq("project_id", p.id)
            .maybeSingle();
        if (error) throw error;
        if (!data || data.revision !== link.revision)
          useCloud.getState().patch({
            error:
              "Une version différente existe en ligne. Ouvrez Mon compte pour la récupérer ; votre copie locale est conservée.",
          });
        else if ((await fingerprint(p)) !== link.fingerprint)
          await pushCloud(p);
      })().catch((e) => useCloud.getState().patch({ error: cloudError(e) }));
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    refresh();
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [session?.user.id, loaded, project.id]);
}

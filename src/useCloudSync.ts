import { useEffect, useRef } from "react";
import { cloudConfig } from "./cloudConfig";
import { cloudClient, cloudError } from "./cloudClient";
import { useCloud } from "./cloudState";
import { cloudLink } from "./cloudMeta";
import { fingerprint } from "./cloudDocument";
import { saveCloudProject } from "./cloudProjects";
import type { Project } from "./model";
import { refreshCloudProject } from "./cloudRefresh";
import { useStore } from "./store";
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
    const state = useCloud.getState();
    state.patch({
      busy: false,
      ...(useStore.getState().project !== p ? { tick: state.tick + 1 } : {}),
    });
  }
}
export function useCloudSync(project: Project, loaded: boolean) {
  const { session, tick } = useCloud();
  const resumedUser = useRef<string | undefined>(undefined);
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
    if (!session) {
      resumedUser.current = undefined;
      return;
    }
    if (!loaded) return;
    const refresh = () => {
      void (async () => {
        const user = session.user.id;
        if (await refreshCloudProject(user, resumedUser.current !== user))
          resumedUser.current = user;
      })().catch((e) => useCloud.getState().patch({ error: cloudError(e) }));
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    refresh();
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [session?.user.id, loaded, project.id, tick]);
}

import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshCloudProject } from "./cloudRefresh";
import { useStore } from "./store";
import { useCloud } from "./cloudState";
import type { Session } from "@supabase/supabase-js";
import { demo, uid } from "./model";
import { assetPut, assetGet, saveProject, projects } from "./db";
import * as database from "./db";
import {
  fingerprint,
  sha256,
  validateCloudDocument,
  CLOUD_CHUNK_SIZE,
  type CloudRow,
} from "./cloudDocument";
import {
  saveCloudProject,
  openCloudProject,
  CloudConflict,
} from "./cloudProjects";
const mock = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  files: new Map<string, Blob>(),
  uploads: 0,
  fail: false,
  race: false,
  onDownload: undefined as (() => void) | undefined,
}));
vi.mock("./cloudClient", () => ({
  cloudClient: async () => ({
    storage: {
      from: () => ({
        upload: async (path: string, b: Blob) => {
          mock.uploads++;
          if (mock.fail) return { error: { message: "network failure" } };
          if (mock.files.has(path))
            return { error: { statusCode: "409", message: "already exists" } };
          mock.files.set(path, b);
          return { error: null };
        },
        download: async (path: string) => {
          mock.onDownload?.();
          return {
            data: mock.files.get(path),
            error: mock.files.has(path) ? null : { message: "missing" },
          };
        },
      }),
    },
    from: () => {
      let kind = "read",
        value: any,
        filters: Record<string, string> = {};
      const run = () => {
        const id = filters.project_id || value?.project_id,
          row = mock.rows.get(id);
        if (kind === "read")
          return { data: row ? structuredClone(row) : null, error: null };
        if (kind === "insert" && row)
          return { data: null, error: { code: "23505" } };
        if (
          kind === "update" &&
          (!row || row.revision !== filters.revision || mock.race)
        )
          return { data: [], error: null };
        mock.rows.set(id, {
          ...structuredClone(value),
          updated_at: new Date().toISOString(),
        });
        return { data: [{ revision: value.revision }], error: null };
      };
      const q: any = {
        select: () => q,
        order: async () => ({
          data: [...mock.rows.values()]
            .reverse()
            .map((r) => structuredClone(r)),
          error: null,
        }),
        eq: (k: string, v: string) => {
          filters[k] = v;
          return q;
        },
        maybeSingle: async () => run(),
        single: async () => run(),
        insert: (v: any) => {
          kind = "insert";
          value = v;
          return q;
        },
        update: (v: any) => {
          kind = "update";
          value = v;
          return q;
        },
        then: (resolve: any, reject: any) =>
          Promise.resolve(run()).then(resolve, reject),
      };
      return q;
    },
  }),
}));
beforeEach(() => {
  mock.rows.clear();
  mock.files.clear();
  mock.uploads = 0;
  mock.fail = false;
  mock.race = false;
  mock.onDownload = undefined;
  useCloud.getState().patch({ session: null, busy: false, error: "", tick: 0 });
});
describe("Sauvegarde entre appareils (service simulé)", () => {
  it("transfère les octets, les vérifie et réutilise les fichiers après modification d’un meuble", async () => {
    const user = uid(),
      p = demo(),
      bytes = new Uint8Array([1, 4, 9, 16]);
    p.items[0].asset = await assetPut(new Blob([bytes]));
    await saveProject(p);
    await saveCloudProject(p, user);
    expect(mock.uploads).toBe(1);
    p.items[0].x += 0.25;
    p.updated++;
    await saveCloudProject(p, user);
    expect(mock.uploads).toBe(1);
    const restored = await openCloudProject(p.id, user);
    expect(restored.id).toBe(p.id);
    expect(restored.items[0].x).toBe(p.items[0].x);
    expect(restored.items[0].asset).not.toBe(p.items[0].asset);
    expect(
      new Uint8Array(
        await (await assetGet(restored.items[0].asset!))!.arrayBuffer(),
      ),
    ).toEqual(bytes);
  });
  it("découpe les gros fichiers sous la limite unitaire et reconstruit le fichier complet", async () => {
    const user = uid(),
      p = demo(),
      bytes = new Uint8Array(CLOUD_CHUNK_SIZE + 17);
    bytes[bytes.length - 1] = 123;
    p.items[0].asset = await assetPut(new Blob([bytes]));
    await saveCloudProject(p, user);
    const row = mock.rows.get(p.id) as CloudRow,
      parts = row.document.assets[p.items[0].asset!].parts;
    expect(parts.map((x) => x.size)).toEqual([CLOUD_CHUNK_SIZE, 17]);
    const restored = await openCloudProject(p.id, user),
      blob = (await assetGet(restored.items[0].asset!))!;
    expect(blob.size).toBe(bytes.length);
    expect(new Uint8Array(await blob.slice(-1).arrayBuffer())[0]).toBe(123);
  });
  it("refuse une version concurrente et ne remplace pas la version distante", async () => {
    const user = uid(),
      p = demo();
    await saveCloudProject(p, user);
    const row = mock.rows.get(p.id);
    row.revision = uid();
    const original = structuredClone(row);
    p.name = "autre PC";
    await expect(saveCloudProject(p, user)).rejects.toBeInstanceOf(
      CloudConflict,
    );
    expect(mock.rows.get(p.id)).toEqual(original);
  });
  it("détecte aussi une course entre le contrôle et l’enregistrement", async () => {
    const user = uid(),
      p = demo();
    await saveCloudProject(p, user);
    const original = structuredClone(mock.rows.get(p.id));
    mock.race = true;
    p.name = "course";
    await expect(saveCloudProject(p, user)).rejects.toBeInstanceOf(
      CloudConflict,
    );
    expect(mock.rows.get(p.id)).toEqual(original);
  });
  it("garde une copie locale avant d’ouvrir une version distante", async () => {
    const user = uid(),
      p = demo();
    await saveCloudProject(p, user);
    p.name = "Travail non synchronisé";
    await saveProject(p);
    const loaded = await openCloudProject(p.id, user);
    expect(loaded.name).not.toBe(p.name);
    expect(
      (await projects()).some(
        (x) => x.id !== p.id && x.name === p.name + " (copie locale)",
      ),
    ).toBe(true);
  });
  it("refuse un fichier altéré avant de remplacer le projet local", async () => {
    const user = uid(),
      p = demo();
    p.items[0].asset = await assetPut(new Blob([new Uint8Array([1, 2, 3])]));
    await saveProject(p);
    await saveCloudProject(p, user);
    const key = [...mock.files.keys()][0];
    mock.files.set(key, new Blob([new Uint8Array([4, 5, 6])]));
    await expect(openCloudProject(p.id, user)).rejects.toThrow("endommagé");
    expect((await projects()).find((x) => x.id === p.id)).toEqual(p);
  });
  it("ne publie pas de document lorsque l’envoi d’une ressource échoue", async () => {
    const user = uid(),
      p = demo();
    p.items[0].asset = await assetPut(new Blob(["meuble"]));
    mock.fail = true;
    await expect(saveCloudProject(p, user)).rejects.toMatchObject({
      message: "network failure",
    });
    expect(mock.rows.has(p.id)).toBe(false);
  });
  it("refuse les chemins d’un autre compte et les tailles incohérentes", async () => {
    const user = uid(),
      p = demo(),
      id = uid(),
      hash = await sha256(new Uint8Array([1]));
    p.items[0].asset = id;
    const d = {
      version: 1,
      project: p,
      assets: {
        [id]: {
          size: 1,
          type: "",
          parts: [{ path: `other/blobs/${hash}`, hash, size: 1 }],
        },
      },
    };
    expect(() => validateCloudDocument(d, user, p.id)).toThrow("Fragment");
    d.assets[id].parts[0].path = `${user}/blobs/${hash}`;
    expect(() => validateCloudDocument(d, user, p.id)).not.toThrow();
    d.assets[id].size = 2;
    expect(() => validateCloudDocument(d, user, p.id)).toThrow("incomplète");
    expect(await fingerprint(p)).toBe(await fingerprint(structuredClone(p)));
  });
});

describe("Reprise automatique entre appareils", () => {
  function login(user: string) {
    useCloud.getState().patch({ session: { user: { id: user } } as Session });
  }
  it("reprend le dernier appartement à la connexion tout en conservant le projet local", async () => {
    const user = uid(),
      remote = demo(),
      local = demo();
    remote.name = "Appartement du laptop";
    local.name = "Travail sur PC";
    await saveCloudProject(remote, user);
    useStore.getState().set(local);
    login(user);
    await refreshCloudProject(user, true);
    expect(useStore.getState().project.id).toBe(remote.id);
    expect((await projects()).find((p) => p.id === local.id)?.name).toBe(
      local.name,
    );
  });
  it("récupère une nouvelle révision avec tous les meubles et fichiers sur un appareil sans modifications", async () => {
    const user = uid(),
      p = demo();
    await saveCloudProject(p, user);
    useStore.getState().set(p);
    login(user);
    const row = mock.rows.get(p.id),
      changed = structuredClone(p);
    changed.items.push({
      ...changed.items[0],
      id: uid(),
      name: "Nouveau canapé",
      asset: await assetPut(new Blob(["canape"])),
    });
    await saveCloudProject(changed, user);
    // Restore the old device's link, rather than the sender's new revision.
    const { putCloudLink } = await import("./cloudMeta");
    await putCloudLink(user, p.id, {
      revision: row.revision,
      fingerprint: await fingerprint(p),
    });
    await refreshCloudProject(user, false);
    const loaded = useStore.getState().project;
    expect(loaded.items).toHaveLength(changed.items.length);
    expect(await (await assetGet(loaded.items.at(-1)!.asset!))!.text()).toBe(
      "canape",
    );
    expect(useCloud.getState().busy).toBe(false);
  });
  it("suspend la récupération si les deux versions ont été modifiées", async () => {
    const user = uid(),
      p = demo();
    await saveCloudProject(p, user);
    mock.rows.get(p.id).revision = uid();
    p.name = "Modification locale";
    useStore.getState().set(p);
    login(user);
    await expect(refreshCloudProject(user, false)).rejects.toThrow(
      "deux ordinateurs",
    );
    expect(useStore.getState().project).toBe(p);
    expect(useCloud.getState().busy).toBe(false);
  });
  it("n’applique pas un téléchargement si l’utilisateur modifie le projet pendant sa réception", async () => {
    const user = uid(),
      remote = demo(),
      local = demo();
    remote.items[0].asset = await assetPut(new Blob(["modele"]));
    await saveCloudProject(remote, user);
    useStore.getState().set(local);
    login(user);
    mock.onDownload = () =>
      useStore.getState().change((p) => {
        p.name = "Modification pendant le téléchargement";
      });
    await expect(refreshCloudProject(user, true)).rejects.toThrow(
      "pendant sa récupération",
    );
    expect(useStore.getState().project.name).toBe(
      "Modification pendant le téléchargement",
    );
    expect(useCloud.getState().busy).toBe(false);
  });
});

it("ne marque pas une version distante comme synchronisée si une saisie arrive pendant l’écriture IndexedDB", async () => {
  const user = uid(),
    remote = demo(),
    local = demo();
  await saveCloudProject(remote, user);
  const { cloudLink } = await import("./cloudMeta");
  const before = await cloudLink(user, remote.id);
  useStore.getState().set(local);
  useCloud.getState().patch({ session: { user: { id: user } } as Session });
  const original = database.saveProject;
  const spy = vi
    .spyOn(database, "saveProject")
    .mockImplementation(async (p) => {
      await original(p);
      if (p.id === remote.id)
        useStore.getState().change((current) => {
          current.name = "Saisie à conserver";
        });
    });
  try {
    await expect(refreshCloudProject(user, true)).rejects.toThrow(
      "travail local a changé",
    );
    expect(useStore.getState().project.name).toBe("Saisie à conserver");
    expect((await projects()).find((p) => p.id === local.id)?.name).toBe(
      "Saisie à conserver",
    );
    expect(await cloudLink(user, remote.id)).toEqual(before);
  } finally {
    spy.mockRestore();
  }
});

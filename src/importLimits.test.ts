import { importProject } from "./db";
import { afterEach, describe, it, expect, vi } from "vitest";
import { importURL, parseModel } from "./imports";
import { prepareFurnitureFile, prepareFurnitureFolder } from "./modelBundle";
import {
  MODEL_FILE_LIMIT,
  PREPARED_MODEL_LIMIT,
  FURNITURE_EXPANDED_LIMIT,
  MIB,
  PROJECT_ARCHIVE_LIMIT,
  PROJECT_EXPANDED_LIMIT,
} from "./importLimits";
import { zipSync } from "fflate";
afterEach(() => vi.unstubAllGlobals());
describe("Gros modèles et limites mémoire", () => {
  it("refuse un fichier ou un dossier de plus de 100 Mo avant de lire les octets", async () => {
    const arrayBuffer = vi.fn();
    const file = {
      size: MODEL_FILE_LIMIT + 1,
      name: "large.glb",
      arrayBuffer,
    } as unknown as File;
    await expect(prepareFurnitureFile(file)).rejects.toThrow("100 Mo");
    await expect(prepareFurnitureFolder([file])).rejects.toThrow("100 Mo");
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
  it("réserve 150 Mo au glTF préparé et rejette un dépassement avant décodage", async () => {
    const arrayBuffer = vi.fn();
    await expect(
      parseModel({
        size: PREPARED_MODEL_LIMIT + 1,
        arrayBuffer,
      } as unknown as Blob),
    ).rejects.toThrow("150 Mo");
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
  it("refuse une entrée ZIP annonçant plus de 200 Mo avant décompression", async () => {
    const zip = zipSync({ "scene.glb": new Uint8Array([0]) }),
      v = new DataView(zip.buffer);
    for (let k = 0; k < zip.length - 28; k++)
      if (v.getUint32(k, true) === 0x02014b50) {
        v.setUint32(k + 24, FURNITURE_EXPANDED_LIMIT + 1, true);
        break;
      }
    await expect(
      prepareFurnitureFile(
        new File([zip as Uint8Array<ArrayBuffer>], "large.zip"),
      ),
    ).rejects.toThrow("200 Mo");
  });
  it("garde les sauvegardes dans leurs limites avant lecture ou décompression", async () => {
    const arrayBuffer = vi.fn();
    await expect(
      importProject({
        size: PROJECT_ARCHIVE_LIMIT + 1,
        arrayBuffer,
      } as unknown as Blob),
    ).rejects.toThrow("300 Mo");
    expect(arrayBuffer).not.toHaveBeenCalled();
    const zip = zipSync({ "project.json": new Uint8Array([0]) }),
      v = new DataView(zip.buffer);
    for (let k = 0; k < zip.length - 28; k++)
      if (v.getUint32(k, true) === 0x02014b50) {
        v.setUint32(k + 24, PROJECT_EXPANDED_LIMIT + 1, true);
        break;
      }
    await expect(
      importProject(new Blob([zip as Uint8Array<ArrayBuffer>])),
    ).rejects.toThrow("500 Mo");
  });
  it("annule immédiatement une réponse URL qui annonce plus de 100 Mo", async () => {
    const cancel = vi.fn(),
      body = new ReadableStream<Uint8Array>({ cancel });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          headers: { "content-length": String(MODEL_FILE_LIMIT + 1) },
        }),
      ),
    );
    await expect(importURL("https://example.com/large.glb")).rejects.toThrow(
      "100 Mo",
    );
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("interrompt un flux URL dépassant 100 Mo même sans Content-Length", async () => {
    const cancel = vi.fn(),
      chunk = new Uint8Array(5 * MIB);
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(chunk);
      },
      cancel,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    const stages: string[] = [];
    await expect(
      importURL("https://example.com/large.glb", (s) => stages.push(s)),
    ).rejects.toThrow("100 Mo");
    expect(stages.at(-1)).toContain("100.0 Mo");
    expect(cancel).toHaveBeenCalledOnce();
  });
});

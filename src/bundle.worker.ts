import { prepareFurnitureFile, prepareFurnitureFolder } from "./modelBundle";
self.onmessage = async (e: MessageEvent<File | File[]>) => {
  try {
    const result = Array.isArray(e.data)
      ? await prepareFurnitureFolder(e.data)
      : await prepareFurnitureFile(e.data);
    self.postMessage({ result });
  } catch (e) {
    self.postMessage({
      error:
        e instanceof Error ? e.message : "Préparation du modèle impossible.",
    });
  }
};

import { it, expect } from "vitest";
import { useStore } from "./store";
import { blank, furniture, catalog } from "./model";
it("annule et rétablit une commande, et invalide la branche après une nouvelle modification", () => {
  useStore.getState().set(blank());
  useStore.getState().change((p) => p.items.push(furniture(catalog[0])));
  expect(useStore.getState().project.items).toHaveLength(1);
  useStore.getState().undo();
  expect(useStore.getState().project.items).toHaveLength(0);
  useStore.getState().redo();
  expect(useStore.getState().project.items).toHaveLength(1);
  useStore.getState().undo();
  useStore.getState().change((p) => {
    p.name = "Nouveau";
  });
  expect(useStore.getState().future).toHaveLength(0);
  expect(useStore.getState().project.name).toBe("Nouveau");
});

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
it("conserve la sélection pendant une édition annulée et la retire si le meuble disparaît", () => {
  const i = furniture(catalog[0]);
  useStore.getState().set(blank());
  useStore.getState().change((p) => p.items.push(i));
  useStore.getState().select(i.id);
  useStore.getState().change((p) => {
    p.items[0].rotation = 15;
  });
  useStore.getState().undo();
  expect(useStore.getState().selected).toBe(i.id);
  useStore.getState().redo();
  expect(useStore.getState().selected).toBe(i.id);
  useStore.getState().undo();
  useStore.getState().undo();
  expect(useStore.getState().selected).toBeNull();
});
it("enrichit les anciens imports sans ajouter de commande dans l’historique", () => {
  const i = { ...furniture(catalog[0]), asset: "shared-legacy" };
  const p = blank();
  p.items = [i, { ...i, id: "duplicate" }];
  useStore.getState().set(p);
  useStore
    .getState()
    .enrichFootprints("shared-legacy", undefined, [
      { x: 0, y: 0, width: 1, depth: 1, bottom: 0, top: 1 },
    ]);
  expect(
    useStore.getState().project.items.every((i) => i.footprints?.length === 1),
  ).toBe(true);
  expect(useStore.getState().past).toHaveLength(0);
});

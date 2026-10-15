import { create } from "zustand";
import { demo, type Project, type Item } from "./model";
type State = {
  project: Project;
  selected: string | null;
  past: Project[];
  future: Project[];
  set: (p: Project) => void;
  change: (f: (p: Project) => void) => void;
  select: (id: string | null) => void;
  enrichFootprints: (
    asset: string,
    part: string | undefined,
    footprints: NonNullable<Item["footprints"]>,
  ) => void;
  undo: () => void;
  redo: () => void;
};
export const useStore = create<State>((set, get) => ({
  project: demo(),
  selected: null,
  past: [],
  future: [],
  set: (p) => set({ project: p, selected: null, past: [], future: [] }),
  select: (selected) => set({ selected }),
  change: (f) => {
    const s = get(),
      p = structuredClone(s.project);
    f(p);
    p.updated = Date.now();
    set({ project: p, past: [...s.past.slice(-79), s.project], future: [] });
  },
  enrichFootprints: (asset, part, footprints) => {
    const s = get();
    if (
      !s.project.items.some(
        (i) =>
          i.asset === asset &&
          i.modelPart === part &&
          i.footprints === undefined,
      )
    )
      return;
    const p = structuredClone(s.project);
    for (const i of p.items)
      if (
        i.asset === asset &&
        i.modelPart === part &&
        i.footprints === undefined
      )
        i.footprints = footprints;
    p.updated = Date.now();
    set({ project: p });
  },
  undo: () => {
    const s = get();
    if (s.past.length)
      set({
        project: s.past.at(-1)!,
        past: s.past.slice(0, -1),
        future: [s.project, ...s.future],
        selected: [
          ...s.past.at(-1)!.items,
          ...s.past.at(-1)!.walls,
          ...s.past.at(-1)!.rooms,
        ].some((v) => v.id === s.selected)
          ? s.selected
          : null,
      });
  },
  redo: () => {
    const s = get();
    if (s.future.length)
      set({
        project: s.future[0],
        future: s.future.slice(1),
        past: [...s.past, s.project],
        selected: [
          ...s.future[0].items,
          ...s.future[0].walls,
          ...s.future[0].rooms,
        ].some((v) => v.id === s.selected)
          ? s.selected
          : null,
      });
  },
}));

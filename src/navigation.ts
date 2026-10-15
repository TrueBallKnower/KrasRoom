import { create } from "zustand";
export type CameraAction = "fit" | "focus" | "top" | "front" | "side" | "iso";
export const useNavigation = create<{
  mode: "orbit" | "pan";
  space: boolean;
  command: { action: CameraAction; serial: number };
  setMode: (mode: "orbit" | "pan") => void;
  setSpace: (space: boolean) => void;
  issue: (action: CameraAction) => void;
}>((set) => ({
  mode: "orbit",
  space: false,
  command: { action: "fit", serial: 0 },
  setMode: (mode) => set({ mode }),
  setSpace: (space) => set({ space }),
  issue: (action) =>
    set((s) => ({ command: { action, serial: s.command.serial + 1 } })),
}));
export type CameraSnapshot = {
  position: [number, number, number];
  target: [number, number, number];
};
export function readCamera(id: string): CameraSnapshot | undefined {
  try {
    const v = JSON.parse(
      localStorage.getItem("roomora-camera-" + id) || "null",
    );
    if (
      v &&
      [v.position, v.target].every(
        (a) =>
          Array.isArray(a) &&
          a.length === 3 &&
          a.every((n: unknown) => typeof n === "number" && Number.isFinite(n)),
      )
    )
      return v;
  } catch {
    /* Browser storage can be unavailable. */
  }
}
export function writeCamera(id: string, value: CameraSnapshot) {
  try {
    localStorage.setItem("roomora-camera-" + id, JSON.stringify(value));
  } catch {
    /* Camera persistence is optional; the project is saved separately. */
  }
}

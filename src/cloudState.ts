import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
type CloudState = {
  session: Session | null;
  ready: boolean;
  recovery: boolean;
  busy: boolean;
  status: string;
  error: string;
  tick: number;
  patch: (p: Partial<Omit<CloudState, "patch">>) => void;
};
export const useCloud = create<CloudState>((set) => ({
  session: null,
  ready: false,
  recovery: false,
  busy: false,
  status: "",
  error: "",
  tick: 0,
  patch: (p) => set(p),
}));

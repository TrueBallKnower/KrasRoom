import { useEffect, useRef, type PointerEvent } from "react";
import { create } from "zustand";
import { walkInput } from "./visitMotion";
export const useTouchWalk = create<{
  x: number;
  y: number;
  running: boolean;
  reset: number;
  move: (x: number, y: number) => void;
  stop: () => void;
  restart: () => void;
  toggleRun: () => void;
}>((set) => ({
  x: 0,
  y: 0,
  running: false,
  reset: 0,
  move: (x, y) => set(walkInput(x, y)),
  stop: () => set({ x: 0, y: 0, running: false }),
  restart: () =>
    set((s) => ({ reset: s.reset + 1, x: 0, y: 0, running: false })),
  toggleRun: () => set((s) => ({ running: !s.running })),
}));
export default function TouchVisit() {
  const movement = useTouchWalk();
  const pointer = useRef<number | null>(null);
  const stop = () => {
    pointer.current = null;
    useTouchWalk.getState().move(0, 0);
  };
  useEffect(() => {
    const clear = () => {
      pointer.current = null;
      useTouchWalk.getState().stop();
    };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      clear();
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, []);
  const steer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / 44,
      y = (rect.top + rect.height / 2 - e.clientY) / 44;
    const dead = Math.hypot(x, y) < 0.12;
    useTouchWalk.getState().move(dead ? 0 : x, dead ? 0 : y);
  };
  return (
    <div className="touch-visit-controls" aria-label="Déplacement en visite">
      <p>Pouce gauche : marcher · Glissez ailleurs pour regarder</p>
      <div
        className="touch-stick"
        role="group"
        aria-label="Joystick de déplacement"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (pointer.current !== null) return;
          e.preventDefault();
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          steer(e);
        }}
        onPointerMove={(e) => {
          if (pointer.current === e.pointerId) steer(e);
        }}
        onPointerUp={(e) => {
          if (pointer.current === e.pointerId) stop();
        }}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
      >
        <div className="touch-stick-track" aria-hidden="true">
          <span
            style={{
              transform: `translate(${movement.x * 34}px,${-movement.y * 34}px)`,
            }}
          />
        </div>
        {(
          [
            ["Avancer", "↑", 0, 1],
            ["Aller à gauche", "←", -1, 0],
            ["Reculer", "↓", 0, -1],
            ["Aller à droite", "→", 1, 0],
          ] as const
        ).map(([label, arrow, x, y]) => (
          <button
            key={label}
            aria-label={label}
            aria-pressed={movement.x === x && movement.y === y}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (pointer.current !== null) return;
              pointer.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              movement.move(x, y);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (pointer.current === e.pointerId) stop();
            }}
            onPointerCancel={stop}
            onLostPointerCapture={stop}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                movement.move(x, y);
              }
            }}
            onKeyUp={stop}
            onBlur={stop}
          >
            {arrow}
          </button>
        ))}
      </div>
      <button
        className="touch-run"
        aria-label="Marche rapide"
        aria-pressed={movement.running}
        onClick={movement.toggleRun}
      >
        {movement.running ? "Rapide" : "Marcher"}
      </button>
    </div>
  );
}

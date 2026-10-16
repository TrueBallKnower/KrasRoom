import { useEffect } from "react";
import { create } from "zustand";
export const useTouchWalk = create<{
  x: number;
  y: number;
  move: (x: number, y: number) => void;
}>((set) => ({ x: 0, y: 0, move: (x, y) => set({ x, y }) }));
export default function TouchVisit() {
  const movement = useTouchWalk();
  useEffect(() => {
    const stop = () => useTouchWalk.getState().move(0, 0);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      stop();
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, []);
  return (
    <div className="touch-visit-controls" aria-label="Déplacement en visite">
      <p>Glissez sur la vue pour regarder</p>
      <div className="touch-dpad">
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
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              useTouchWalk.getState().move(x, y);
            }}
            onPointerUp={() => useTouchWalk.getState().move(0, 0)}
            onPointerCancel={() => useTouchWalk.getState().move(0, 0)}
            onLostPointerCapture={() => useTouchWalk.getState().move(0, 0)}
          >
            {arrow}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
/** Hide editing chrome without remounting the camera or changing visit settings. */
export function useImmersiveVisit(enabled: boolean, blocked: boolean) {
  const [immersive, setImmersive] = useState(false);
  const [locked, setLocked] = useState(false);
  const active = useRef(false),
    ownsFullscreen = useRef(false);
  const leave = useCallback(() => {
    active.current = false;
    setImmersive(false);
    if (ownsFullscreen.current) {
      ownsFullscreen.current = false;
      if (document.fullscreenElement)
        void document.exitFullscreen?.().catch(() => {});
    }
  }, []);
  const toggle = useCallback(() => {
    if (active.current) {
      leave();
      return;
    }
    if (!enabled || blocked) return;
    active.current = true;
    setImmersive(true);
    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      void document.documentElement
        .requestFullscreen()
        .then(() => {
          ownsFullscreen.current = true;
          if (!active.current) leave();
        })
        .catch(() => {
          /* Filling the browser viewport remains available. */
        });
    }
  }, [enabled, blocked, leave]);
  useEffect(() => {
    if (!enabled) leave();
  }, [enabled, leave]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() !== "l" ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target as HTMLElement)?.closest?.(
          "input,textarea,select,[contenteditable],[role=dialog]",
        )
      )
        return;
      if (!enabled || blocked) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [enabled, blocked, toggle]);
  useEffect(() => {
    const pointer = () => setLocked(!!document.pointerLockElement);
    const fullscreen = () => {
      if (ownsFullscreen.current && !document.fullscreenElement) {
        ownsFullscreen.current = false;
        active.current = false;
        setImmersive(false);
      }
    };
    document.addEventListener("pointerlockchange", pointer);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      document.removeEventListener("pointerlockchange", pointer);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, []);
  return { immersive: enabled && immersive, locked, toggle };
}

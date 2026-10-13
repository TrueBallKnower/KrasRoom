import { detectPlan, type Options } from "./geometry";
self.onmessage = (
  event: MessageEvent<{
    pixels: ArrayBuffer;
    width: number;
    height: number;
    options: Partial<Options>;
  }>,
) => {
  try {
    const { pixels, width, height, options } = event.data;
    self.postMessage({
      ok: true,
      result: detectPlan(new Uint8ClampedArray(pixels), width, height, options),
    });
  } catch (e) {
    self.postMessage({
      ok: false,
      error: e instanceof Error ? e.message : "Analyse impossible.",
    });
  }
};

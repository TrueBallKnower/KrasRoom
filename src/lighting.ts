export const lightingProfiles = {
  daylight: {
    name: "Jour naturel",
    color: "#fff4df",
    sky: "#e4efff",
    ground: "#8c8172",
    ambient: 0.32,
    hemisphere: 0.7,
    sun: 2.6,
    fill: 0.35,
  },
  warm: {
    name: "Fin de journée",
    color: "#ffd2a0",
    sky: "#eddfd8",
    ground: "#8c7561",
    ambient: 0.28,
    hemisphere: 0.55,
    sun: 2.4,
    fill: 0.3,
  },
  studio: {
    name: "Studio doux",
    color: "#ffffff",
    sky: "#f2f4ff",
    ground: "#92928c",
    ambient: 0.45,
    hemisphere: 0.8,
    sun: 1.65,
    fill: 0.65,
  },
} as const;
export type LightingProfile = keyof typeof lightingProfiles;
export function readRenderPreferences(): {
  lighting: LightingProfile;
  exposure: number;
  realistic: boolean;
} {
  try {
    const v = JSON.parse(localStorage.getItem("roomora-render") || "null");
    if (
      v &&
      Object.hasOwn(lightingProfiles, v.lighting) &&
      Number.isFinite(v.exposure) &&
      v.exposure >= 0.6 &&
      v.exposure <= 1.6 &&
      typeof v.realistic === "boolean"
    )
      return v;
  } catch {
    /* Rendering preferences are optional. */
  }
  return { lighting: "daylight", exposure: 1.05, realistic: false };
}

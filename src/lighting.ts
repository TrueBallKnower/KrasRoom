export type LightSettings = {
  type: "point" | "spot";
  enabled: boolean;
  lumens: number;
  color: string;
  range: number;
  angle: number;
  tilt: number;
  shadows: boolean;
};
export const MAX_LIGHTS = 12;
export function validLightSettings(value: unknown): value is LightSettings {
  const v = value as LightSettings;
  return (
    !!v &&
    ["point", "spot"].includes(v.type) &&
    typeof v.enabled === "boolean" &&
    typeof v.shadows === "boolean" &&
    /^#[0-9a-f]{6}$/i.test(v.color) &&
    Number.isFinite(v.lumens) &&
    v.lumens >= 0 &&
    v.lumens <= 10000 &&
    Number.isFinite(v.range) &&
    v.range >= 1 &&
    v.range <= 30 &&
    Number.isFinite(v.angle) &&
    v.angle >= 10 &&
    v.angle <= 120 &&
    Number.isFinite(v.tilt) &&
    v.tilt >= 0 &&
    v.tilt <= 90
  );
}
export const lightingProfiles = {
  night: {
    name: "Nuit · éclairage intérieur",
    color: "#aabfff",
    sky: "#111b36",
    ground: "#11121e",
    ambient: 0.04,
    hemisphere: 0.08,
    sun: 0.015,
    fill: 0.02,
  },
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

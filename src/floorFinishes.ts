export type FloorFinish =
  "plain" | "oak" | "walnut" | "ash" | "tile" | "concrete";
export const floorFinishes: { id: FloorFinish; name: string; color: string }[] =
  [
    { id: "plain", name: "Couleur unie", color: "#ddcbb4" },
    { id: "oak", name: "Parquet chêne naturel", color: "#c8a575" },
    { id: "walnut", name: "Parquet noyer", color: "#826044" },
    { id: "ash", name: "Parquet clair", color: "#d8d0b9" },
    { id: "tile", name: "Carrelage pierre", color: "#d3d0c7" },
    { id: "concrete", name: "Béton ciré", color: "#b1b2b0" },
  ];

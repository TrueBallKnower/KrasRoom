export type SurfacePattern =
  | "plain"
  | "wood"
  | "herringbone"
  | "tile"
  | "marble"
  | "terrazzo"
  | "concrete"
  | "slate"
  | "fabric"
  | "brick"
  | "plaster"
  | "panel";
export type FinishDefinition = {
  id: string;
  name: string;
  color: string;
  pattern: SurfacePattern;
  roughness: number;
  relief: number;
  size: number;
};
export const floorFinishes = [
  {
    id: "plain",
    name: "Couleur unie",
    color: "#ddcbb4",
    pattern: "plain",
    roughness: 0.8,
    relief: 0,
    size: 1,
  },
  {
    id: "oak",
    name: "Parquet chêne naturel",
    color: "#c8a575",
    pattern: "wood",
    roughness: 0.55,
    relief: 0.003,
    size: 2,
  },
  {
    id: "walnut",
    name: "Parquet noyer",
    color: "#826044",
    pattern: "wood",
    roughness: 0.48,
    relief: 0.003,
    size: 2,
  },
  {
    id: "ash",
    name: "Parquet clair",
    color: "#d8d0b9",
    pattern: "wood",
    roughness: 0.65,
    relief: 0.003,
    size: 2,
  },
  {
    id: "honey",
    name: "Parquet miel",
    color: "#b88548",
    pattern: "wood",
    roughness: 0.5,
    relief: 0.003,
    size: 2,
  },
  {
    id: "smoked",
    name: "Parquet fumé",
    color: "#69594c",
    pattern: "wood",
    roughness: 0.58,
    relief: 0.004,
    size: 2,
  },
  {
    id: "whitewood",
    name: "Parquet blanchi",
    color: "#e3dfd2",
    pattern: "wood",
    roughness: 0.7,
    relief: 0.003,
    size: 2,
  },
  {
    id: "herringbone",
    name: "Chêne en chevrons",
    color: "#c29a6c",
    pattern: "herringbone",
    roughness: 0.52,
    relief: 0.004,
    size: 1.6,
  },
  {
    id: "herringbone-dark",
    name: "Noyer en chevrons",
    color: "#79523a",
    pattern: "herringbone",
    roughness: 0.46,
    relief: 0.004,
    size: 1.6,
  },
  {
    id: "tile",
    name: "Carrelage pierre",
    color: "#d3d0c7",
    pattern: "tile",
    roughness: 0.48,
    relief: 0.006,
    size: 1.2,
  },
  {
    id: "ivory-tile",
    name: "Grès ivoire",
    color: "#e5ddca",
    pattern: "tile",
    roughness: 0.32,
    relief: 0.004,
    size: 1.2,
  },
  {
    id: "terracotta",
    name: "Terre cuite",
    color: "#b96848",
    pattern: "tile",
    roughness: 0.86,
    relief: 0.009,
    size: 0.6,
  },
  {
    id: "slate",
    name: "Ardoise anthracite",
    color: "#485057",
    pattern: "slate",
    roughness: 0.82,
    relief: 0.012,
    size: 1.2,
  },
  {
    id: "marble",
    name: "Marbre de Carrare",
    color: "#eeeae3",
    pattern: "marble",
    roughness: 0.16,
    relief: 0.0005,
    size: 2,
  },
  {
    id: "black-marble",
    name: "Marbre noir",
    color: "#292d30",
    pattern: "marble",
    roughness: 0.18,
    relief: 0.0005,
    size: 2,
  },
  {
    id: "travertine",
    name: "Travertin sable",
    color: "#cdbba0",
    pattern: "slate",
    roughness: 0.7,
    relief: 0.008,
    size: 1.4,
  },
  {
    id: "terrazzo",
    name: "Terrazzo clair",
    color: "#dfd8ce",
    pattern: "terrazzo",
    roughness: 0.4,
    relief: 0.002,
    size: 1,
  },
  {
    id: "terrazzo-rose",
    name: "Terrazzo rosé",
    color: "#d5b3a7",
    pattern: "terrazzo",
    roughness: 0.4,
    relief: 0.002,
    size: 1,
  },
  {
    id: "concrete",
    name: "Béton ciré",
    color: "#b1b2b0",
    pattern: "concrete",
    roughness: 0.55,
    relief: 0.003,
    size: 2,
  },
  {
    id: "sand-concrete",
    name: "Béton sable",
    color: "#c7b99f",
    pattern: "concrete",
    roughness: 0.6,
    relief: 0.003,
    size: 2,
  },
  {
    id: "carpet",
    name: "Moquette crème",
    color: "#cfc6b5",
    pattern: "fabric",
    roughness: 0.98,
    relief: 0.008,
    size: 0.5,
  },
  {
    id: "carpet-gray",
    name: "Moquette graphite",
    color: "#666b70",
    pattern: "fabric",
    roughness: 0.98,
    relief: 0.008,
    size: 0.5,
  },
] as const satisfies readonly FinishDefinition[];
export type FloorFinish = (typeof floorFinishes)[number]["id"];
export const wallFinishes = [
  {
    id: "paint",
    name: "Peinture mate",
    color: "#ffffff",
    pattern: "plaster",
    roughness: 0.92,
    relief: 0.0007,
    size: 1,
  },
  {
    id: "satin",
    name: "Peinture satinée",
    color: "#ffffff",
    pattern: "plaster",
    roughness: 0.38,
    relief: 0.0004,
    size: 1,
  },
  {
    id: "lime",
    name: "Enduit à la chaux",
    color: "#eee6d9",
    pattern: "plaster",
    roughness: 0.98,
    relief: 0.006,
    size: 1.5,
  },
  {
    id: "wall-concrete",
    name: "Béton brut",
    color: "#aeb0ac",
    pattern: "concrete",
    roughness: 0.86,
    relief: 0.008,
    size: 2,
  },
  {
    id: "brick",
    name: "Brique rouge",
    color: "#ae6550",
    pattern: "brick",
    roughness: 0.9,
    relief: 0.018,
    size: 1.2,
  },
  {
    id: "white-brick",
    name: "Brique blanche",
    color: "#e5e1d9",
    pattern: "brick",
    roughness: 0.9,
    relief: 0.018,
    size: 1.2,
  },
  {
    id: "wood-panel",
    name: "Lambris chêne",
    color: "#b89160",
    pattern: "panel",
    roughness: 0.56,
    relief: 0.008,
    size: 1.6,
  },
  {
    id: "dark-panel",
    name: "Lambris noyer",
    color: "#74513b",
    pattern: "panel",
    roughness: 0.5,
    relief: 0.008,
    size: 1.6,
  },
  {
    id: "wall-tile",
    name: "Faïence ivoire",
    color: "#e9e5da",
    pattern: "tile",
    roughness: 0.23,
    relief: 0.006,
    size: 0.6,
  },
  {
    id: "green-tile",
    name: "Faïence sauge",
    color: "#91aa98",
    pattern: "tile",
    roughness: 0.24,
    relief: 0.006,
    size: 0.6,
  },
  {
    id: "wall-marble",
    name: "Marbre mural",
    color: "#eeeae3",
    pattern: "marble",
    roughness: 0.18,
    relief: 0.0005,
    size: 2,
  },
  {
    id: "linen",
    name: "Papier peint lin",
    color: "#d4c8b4",
    pattern: "fabric",
    roughness: 0.95,
    relief: 0.003,
    size: 0.6,
  },
] as const satisfies readonly FinishDefinition[];
export type WallFinish = (typeof wallFinishes)[number]["id"];
export function finishDefinition(
  kind: FloorFinish | WallFinish | "fabric",
): FinishDefinition {
  if (kind === "fabric")
    return {
      id: kind,
      name: "Tissu",
      color: "#dedbd3",
      pattern: "fabric",
      roughness: 0.94,
      relief: 0.004,
      size: 1 / 3,
    };
  return (
    [...floorFinishes, ...wallFinishes].find((f) => f.id === kind) ||
    wallFinishes[0]
  );
}

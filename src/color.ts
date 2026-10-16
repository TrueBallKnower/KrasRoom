export function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return (
    "#" +
    [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("")
  );
}
export function hexToHsv(hex: string) {
  const [r, g, b] = [1, 3, 5].map(
      (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
    ),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h =
    d === 0
      ? 0
      : max === r
        ? ((g - b) / d) % 6
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
export const colorPalette = [
  ["Blanc craie", "#f5f3ed"],
  ["Ivoire", "#ede5d5"],
  ["Lin", "#d9cdb7"],
  ["Sable", "#c8b496"],
  ["Grège", "#b7afa2"],
  ["Taupe", "#938477"],
  ["Argile", "#b87e66"],
  ["Terracotta", "#b85f46"],
  ["Rose poudré", "#ddbcb7"],
  ["Vieux rose", "#aa7c80"],
  ["Bordeaux", "#713f49"],
  ["Ocre", "#c69a48"],
  ["Sauge", "#a4b09a"],
  ["Eucalyptus", "#6d8c7d"],
  ["Olive", "#81845a"],
  ["Forêt", "#35594a"],
  ["Menthe", "#c4dcd0"],
  ["Bleu brume", "#b7cbd2"],
  ["Bleu gris", "#7b929f"],
  ["Bleu nuit", "#31485f"],
  ["Lavande", "#b2a8c8"],
  ["Gris perle", "#d5d6d2"],
  ["Anthracite", "#45494d"],
  ["Noir doux", "#282c2e"],
] as const;

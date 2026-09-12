/** Converte cor hex (#RRGGBB) para [r,g,b] usado nos PDFs. */
export function hexToRgb(hex: string, fallback: [number, number, number] = [82, 196, 184]): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Clareia uma cor para uso em fundos de tabela. */
export function lighten(rgb: [number, number, number], amount = 0.85): [number, number, number] {
  return rgb.map((c) => Math.round(c + (255 - c) * amount)) as [number, number, number];
}

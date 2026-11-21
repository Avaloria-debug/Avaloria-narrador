// Trigramas de caracteres con bordes y similitud coseno (P11). Sin dependencias.

/** Trigramas de una palabra con bordes: "pan" → [" pa", "pan", "an "]. Cuenta repetidos. */
export function trigramas(palabra) {
  const w = ` ${String(palabra ?? '').toLowerCase()} `;
  const m = new Map();
  for (let i = 0; i + 3 <= w.length; i++) { const g = w.slice(i, i + 3); m.set(g, (m.get(g) ?? 0) + 1); }
  return m;
}

/** Coseno entre dos palabras por sus trigramas (0..1). */
export function similitud(a, b) {
  const x = trigramas(a);
  const y = trigramas(b);
  let dot = 0;
  for (const [g, n] of x) dot += n * (y.get(g) ?? 0);
  const norma = (m) => Math.sqrt([...m.values()].reduce((s, n) => s + n * n, 0));
  const d = norma(x) * norma(y);
  return d === 0 ? 0 : dot / d;
}

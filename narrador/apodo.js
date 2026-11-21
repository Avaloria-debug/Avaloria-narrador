// Apodo del jugador (P18): sale del verbo que más pesa en sus hechos. Tabla y usos en t24. Sin texto propio.
// Un solo apodo activo; cambia solo si otro verbo lo supera por ≥2 puntos (histéresis).
export const HISTERESIS = 2;
export const MIN_USOS = 5;
export const PESO_FUERTE = 3;

/** Puntaje por verbo: suma de pesos de sus hechos. */
export function puntajes(hechos) {
  const p = {};
  for (const h of hechos ?? []) p[h.tipo] = (p[h.tipo] ?? 0) + (h.peso ?? 0);
  return p;
}

/**
 * Apodo nuevo (o el mismo). Candidato: el verbo de más puntaje si tiene un hecho fuerte (peso ≥3) o ≥5 hechos.
 * @param {{ verbo: string, puntaje: number, texto: string }|null} actual
 * @returns {{ verbo: string, puntaje: number, texto: string }|null}
 */
export function derivarApodo(actual, hechos, tabla, rng) {
  const p = puntajes(hechos);
  const cuenta = (v) => (hechos ?? []).filter((h) => h.tipo === v).length;
  const validos = Object.keys(p).filter((v) => tabla?.[v]?.length && ((hechos ?? []).some((h) => h.tipo === v && h.peso >= PESO_FUERTE) || cuenta(v) >= MIN_USOS));
  if (!validos.length) return actual ? { ...actual, puntaje: p[actual.verbo] ?? 0 } : null;
  const mejor = validos.reduce((a, b) => (p[b] > p[a] ? b : a));
  if (actual && actual.verbo !== mejor && p[mejor] < (p[actual.verbo] ?? 0) + HISTERESIS) return { ...actual, puntaje: p[actual.verbo] ?? 0 };
  if (actual?.verbo === mejor) return { ...actual, puntaje: p[mejor] };
  const lista = tabla[mejor];
  return { verbo: mejor, puntaje: p[mejor], texto: lista[Math.min(lista.length - 1, Math.floor(rng() * lista.length))] };
}

/** Valor de {apodo} para un NPC: el apodo si la relación es neutra o buena; si no, la base ("forastero"). */
export function apodoPara(apodo, base, r) {
  return apodo && (r === 'neutra' || r === 'buena') ? apodo.texto : base;
}

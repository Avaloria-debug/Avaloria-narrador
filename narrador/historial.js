// Fase 7 (W2): anti-repetición global con el contenido ampliado.
// Historial de las últimas 30 líneas emitidas (texto final, en estado.ext.lineas; no va al registro).
// Los selectores (seleccion.elegir, picks de focos y ampliado) consultan el historial activo del turno.
// El historial se activa solo dentro de funciones síncronas (conHistorial), así no se mezcla entre partidas.

export const VENTANA_LINEAS = 30;
let activo = null;

/** Corre `fn` con `lineas` como historial activo. */
export function conHistorial(lineas, fn) {
  const previo = activo;
  activo = Array.isArray(lineas) ? lineas : [];
  try { return fn(); } finally { activo = previo; }
}

// Fragmentos cortos (símbolos de gramática) no cuentan: se repiten por naturaleza.
const repetida = (t) => typeof t === 'string' && t.length >= 20 && activo.some((l) => l.includes(t));
const ultimoUso = (t) => { if (typeof t !== 'string' || t.length < 20) return -1; for (let i = activo.length - 1; i >= 0; i--) if (activo[i].includes(t)) return i; return -1; };

/**
 * Excluye las candidatas que ya salieron mientras quede otra; si todas salieron, deja la más antigua.
 * Sin historial activo devuelve la lista igual (comportamiento anterior).
 */
export function sinRepetir(candidatas, textoDe = (c) => (typeof c === 'string' ? c : c?.t ?? c?.texto)) {
  if (!activo || !Array.isArray(candidatas) || candidatas.length < 2) return candidatas;
  const libres = candidatas.filter((c) => !repetida(textoDe(c)));
  if (libres.length) return libres;
  let mejor = candidatas[0]; let min = Infinity;
  for (const c of candidatas) { const u = ultimoUso(textoDe(c)); if (u < min) { min = u; mejor = c; } }
  return [mejor];
}

/** Pick uniforme con anti-repetición (consume un solo número del rng). */
export function elegirLinea(lista, rng, textoDe) {
  if (!Array.isArray(lista) || !lista.length) return null;
  const pool = sinRepetir(lista, textoDe);
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** Agrega los párrafos/oraciones del texto final al historial (máx. 30). */
export function anotarTexto(lineas, texto) {
  const previas = Array.isArray(lineas) ? lineas.filter((l) => typeof l === 'string') : [];
  const nuevas = String(texto ?? '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return [...previas, ...nuevas].slice(-VENTANA_LINEAS);
}

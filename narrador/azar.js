// Generador de azar sembrado (mulberry32). Su estado es un entero: se puede guardar en la
// partida y seguir desde ahí, así una partida con semilla es reproducible turno a turno.

/** Convierte cualquier semilla (número o texto) en un entero de 32 bits. */
export function semillaAEntero(semilla) {
  if (typeof semilla === 'number' && Number.isFinite(semilla)) return Math.trunc(semilla) | 0;
  let h = 2166136261;
  for (const c of String(semilla)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h | 0;
}

/**
 * @param {number} estadoInicial entero de 32 bits
 * @returns {(() => number) & { estado: () => number }} rng en [0, 1); `estado()` devuelve el entero para seguir después
 */
export function crearRng(estadoInicial) {
  let s = estadoInicial | 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.estado = () => s;
  return rng;
}

/** Semilla nueva para una partida sin semilla. Es el único lugar del narrador que usa azar del sistema. */
export function semillaAlAzar() {
  return Math.floor(Math.random() * 4294967296) | 0;
}

/**
 * Generador derivado para un subsistema: mulberry32(hash(semillaBase + nombre)). No consume el generador principal,
 * así un módulo nuevo no cambia la salida existente.
 * @param {number|string} semillaBase
 * @param {string} nombre
 */
export function derivar(semillaBase, nombre) {
  return crearRng(semillaAEntero(`${semillaBase}:${nombre}`));
}

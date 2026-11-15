// Ayudas para los tests del narrador.

/** rng que devuelve los valores en orden; después, siempre `resto`. Cuenta las llamadas. */
export function rngDe(valores = [], resto = 0.99) {
  let i = 0;
  const rng = () => (i < valores.length ? valores[i++] : (i++, resto));
  rng.llamadas = () => i;
  return rng;
}

/** Generador determinista sembrado (mulberry32). */
export function rngSembrado(semilla) {
  let s = semilla | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Evento activo sin vencimiento, para armar estados de prueba. */
export const eventoActivo = (id, escenaId) => ({ id, escenaId, turnosRestantes: null, horaFin: null });

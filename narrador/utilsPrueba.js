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

/**
 * Copia del contenido donde el _1 de Hollis vuelve a pedir la tormenta y la tormenta lo habilita (como hasta 0.0.42).
 * Desde 0.0.43 el contenido real no lo pide ni tiene el efecto; los tests del mecanismo evento/habilita la usan.
 */
export function contenidoConSenderoPorTormenta(contenido) {
  return {
    ...contenido,
    npcs: contenido.npcs.map((n) => (n.id !== 'hollis_pastor' ? n : {
      ...n,
      conocimientos: n.conocimientos.map((k) => (k.id === 'conocimiento_sendero_sin_vigilancia' ? { ...k, requiereEvento: 'evento_tormenta_verano' } : k)),
    })),
    eventos: contenido.eventos.map((e) => (e.id !== 'evento_tormenta_verano' || e.efectos.some((f) => f.tipo === 'habilita') ? e : {
      ...e,
      efectos: [...e.efectos, { tipo: 'habilita', npcId: 'hollis_pastor', conocimientoId: 'conocimiento_sendero_sin_vigilancia' }],
    })),
  };
}

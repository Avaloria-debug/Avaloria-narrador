// Orquestador del contenido ampliado. Solo corre si narrar recibe `opciones.ampliado` (contenidoAmpliado.js).
// Sin ampliado, narrar no llama a este módulo y la salida es idéntica a la de siempre.
// Estado propio en `estado.ext` (se guarda con la partida; partida vieja → valores por defecto).
// Azar: solo generadores derivados de la semilla del turno (azar.derivar); nunca el generador principal.

/** ext con valores por defecto (partida vieja o nueva). */
export function extInicial(ext) {
  const e = ext && typeof ext === 'object' ? ext : {};
  return {
    ...e,
    visitas: e.visitas && typeof e.visitas === 'object' ? { ...e.visitas } : {},
    repeticion: e.repeticion && typeof e.repeticion === 'object' ? { ...e.repeticion } : { verbo: null, n: 0 },
    turno: Number.isInteger(e.turno) ? e.turno : 0,
  };
}

const verboDe = (turno, contenido) => {
  const id = turno?.accion?.intencionId ?? turno?.intencionId ?? null;
  return (contenido.intenciones.find((i) => i.id === id)?.verbo) ?? null;
};

/** Contabilidad del turno: visitas a la escena y repetición del mismo verbo. */
export function contabilizar(ext, { antes, despues, turno, contenido }) {
  const e = extInicial(ext);
  e.turno += 1;
  const esc = despues.jugador.escenaId;
  if (e.turno === 1 || antes.jugador.escenaId !== esc) e.visitas[esc] = (e.visitas[esc] ?? 0) + 1;
  const verbo = verboDe(turno, contenido);
  if (verbo) e.repeticion = e.repeticion.verbo === verbo ? { verbo, n: e.repeticion.n + 1 } : { verbo, n: 1 };
  return e;
}

/**
 * Aplica las extensiones al turno ya narrado.
 * @returns {{ texto: string, aperturas: string[], ext: object }}
 */
export function aplicarAmpliado({ amp, contenido, antes, despues, turno, texto, aperturas }) {
  const ext = contabilizar(antes.ext, { antes, despues, turno, contenido });
  void amp;
  return { texto, aperturas, ext };
}

// Estado de escena a partir de los eventos activos (vocabulario-v1.md, sección 7.1).
import { ESTADOS_ESCENA } from './contenido.js';

export const ESTADO_BASE = ESTADOS_ESCENA[0]; // tranquilo

/** Posición en el orden de gravedad: tranquilo < social < sigilo < tenso < peligroso < combate. */
export function gravedad(estado) {
  return ESTADOS_ESCENA.indexOf(estado);
}

/**
 * Estado propio: el de mayor gravedad entre los eventos activos de la escena.
 * Los neutros (estado null) no cuentan. Sin eventos: tranquilo.
 */
export function estadoPropio(escenaId, eventosActivos, contenido) {
  const porId = new Map((contenido?.eventos ?? []).map((e) => [e.id, e]));
  let mayor = 0;
  for (const a of eventosActivos ?? []) {
    if (a.escenaId !== escenaId) continue;
    const g = gravedad(porId.get(a.id)?.estado);
    if (g > mayor) mayor = g;
  }
  return ESTADOS_ESCENA[mayor];
}

/**
 * Estado de la escena: el propio, y si una vecina (escena de sus salidas) tiene
 * un estado propio más grave, sube un nivel. Nunca más de uno.
 */
export function estadoDeEscena(escenaId, eventosActivos, contenido) {
  const propio = gravedad(estadoPropio(escenaId, eventosActivos, contenido));
  const escena = (contenido?.escenas ?? []).find((e) => e.id === escenaId);
  const vecinaMasGrave = (escena?.salidas ?? []).some(
    (vecinaId) => gravedad(estadoPropio(vecinaId, eventosActivos, contenido)) > propio,
  );
  return ESTADOS_ESCENA[vecinaMasGrave ? propio + 1 : propio];
}

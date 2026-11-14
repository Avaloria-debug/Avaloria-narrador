// Clasificación y costo de un viaje según su destino.
// El motor (bloque 3) decide si el destino es alcanzable y descuenta las horas.

export const TIPOS_VIAJE = Object.freeze({
  MISMA_ESCENA: 'misma_escena',
  INTRA_CIUDAD: 'intra_ciudad',
  POR_CAMINO: 'por_camino',
});

/**
 * @param {string} destino id de escena o `ciudad_*`
 * @param {string} escenaActualId
 * @param {{ escenas: object[], reglas: object }} contenido
 * @returns {{ tipo: string, horas: number|null }}
 *   `intra_ciudad`: el destino es otra escena de la ciudad de la escena actual; cuesta reglas.viajeHorasIntraCiudad.
 *   `por_camino`: cualquier otro destino; las horas salen de reglas.viajeHorasPorCamino (bloque 3), acá van en null.
 *   `misma_escena`: el jugador ya está ahí; no cuesta nada.
 */
export function clasificarViaje(destino, escenaActualId, contenido) {
  if (destino === escenaActualId) return { tipo: TIPOS_VIAJE.MISMA_ESCENA, horas: 0 };
  const escenas = contenido?.escenas ?? [];
  const actual = escenas.find((e) => e.id === escenaActualId);
  const meta = escenas.find((e) => e.id === destino);
  const ciudad = (e) => (typeof e?.ciudad === 'string' && e.ciudad !== '' ? e.ciudad : null);
  if (ciudad(actual) !== null && ciudad(actual) === ciudad(meta)) {
    return { tipo: TIPOS_VIAJE.INTRA_CIUDAD, horas: contenido.reglas.viajeHorasIntraCiudad };
  }
  return { tipo: TIPOS_VIAJE.POR_CAMINO, horas: null };
}

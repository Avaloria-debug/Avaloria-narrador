// Calendario y festividades (P21). Días del reloj → estación; festividades de t27 (canon A APROBAR).
// Las fechas de las festividades (día del año) las define el autor en data/contenido/ampliado/calendario.json
// ({ "festividades": { "<id>": { "diaDelAnio": n } } }); sin ese archivo, ninguna festividad está activa.
export const DIAS_ESTACION = 90;
export const ESTACIONES = Object.freeze(['primavera', 'verano', 'otono', 'invierno']);
export const DIAS_ANIO = DIAS_ESTACION * ESTACIONES.length;

/** Día del año (1..360) de un día de reloj (1..∞). */
export const diaDelAnio = (dia) => (((Number.isInteger(dia) ? dia : 1) - 1) % DIAS_ANIO) + 1;

/** Estación del día de reloj (el día 1 es el primero de primavera). */
export const estacionDe = (dia) => ESTACIONES[Math.floor((diaDelAnio(dia) - 1) / DIAS_ESTACION)];

/** Ciudad de una escena para festividades: su ciudad, o "cruce" para el cruce de colinas (nota de t27). */
export const ciudadDe = (escena) => escena?.ciudad ?? (escena?.id === 'escena_cruce_colinas' ? 'cruce' : null);

/**
 * Festividad activa en la ciudad de la escena, o null.
 * @param {object} festividades t27 { id: { ciudad, estacion, dias, lineas } }
 * @param {object} fechas calendario.json festividades { id: { diaDelAnio } }
 */
export function festividadActiva(festividades, fechas, { dia, escena }) {
  const ciudad = ciudadDe(escena);
  if (!ciudad) return null;
  const hoy = diaDelAnio(dia);
  for (const [id, f] of Object.entries(festividades ?? {})) {
    const inicio = fechas?.[id]?.diaDelAnio;
    if (!Number.isInteger(inicio) || f.ciudad !== ciudad) continue;
    const dur = Number.isInteger(f.dias) ? f.dias : 1;
    const desde = (hoy - inicio + DIAS_ANIO) % DIAS_ANIO;
    if (desde < dur) return id;
  }
  return null;
}

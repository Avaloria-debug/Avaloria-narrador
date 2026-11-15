// Efectos de los eventos activos (eventos[].efectos del contenido).
// No se guardan en el estado: se calculan desde los eventos activos, así que
// desaparecen solos cuando el evento se cierra.
//
// Alcance de cada efecto:
// - disposicion, habilita, precio: valen en todo el mundo mientras el evento esté activo en alguna escena.
// - bloqueo de hablar_con a un NPC: en todo el mundo.
// - bloqueo de usar un objeto y de viajar a una ciudad (`destino`): solo si el jugador está en una escena del evento.
// - bloqueo de viajar por una escena (`escenaId`): si la ruta pasa por esa escena o termina en ella.

const lista = (v) => (Array.isArray(v) ? v : []);

/**
 * Efectos vigentes, uno por evento (aunque esté activo en varias escenas).
 * @returns {{ eventoId: string, escenas: string[], efecto: object }[]}
 */
export function efectosActivos(eventosActivos, contenido) {
  const escenasPorEvento = new Map();
  for (const a of lista(eventosActivos)) {
    if (!escenasPorEvento.has(a.id)) escenasPorEvento.set(a.id, []);
    escenasPorEvento.get(a.id).push(a.escenaId);
  }
  const vigentes = [];
  for (const evento of lista(contenido?.eventos)) {
    const escenas = escenasPorEvento.get(evento.id);
    if (!escenas) continue;
    for (const efecto of lista(evento.efectos)) vigentes.push({ eventoId: evento.id, escenas, efecto });
  }
  return vigentes;
}

/** Suma de los deltas de disposición que los eventos activos le dan a un NPC. */
export function deltaDisposicionPorEventos(npcId, eventosActivos, contenido) {
  let delta = 0;
  for (const { efecto } of efectosActivos(eventosActivos, contenido)) {
    if (efecto.tipo === 'disposicion' && efecto.npcId === npcId) delta += efecto.delta;
  }
  return delta;
}

/** ¿Algún evento activo habilita ese conocimiento de ese NPC? */
export function conocimientoHabilitado(npcId, conocimientoId, eventosActivos, contenido) {
  return efectosActivos(eventosActivos, contenido).some(
    ({ efecto }) => efecto.tipo === 'habilita' && efecto.npcId === npcId && efecto.conocimientoId === conocimientoId,
  );
}

/**
 * Precio de un objeto con los efectos de precio vigentes.
 * `multiplicador` aplica al objeto indicado; `porcentaje` a todos los objetos de ese tipo (`categoria`).
 * Se redondea hacia arriba y nunca baja de 1.
 * @returns {{cantidad: number, moneda: string}|null} null si el objeto no tiene precio
 */
export function precioEfectivo(objeto, eventosActivos, contenido) {
  if (!objeto?.precio) return null;
  let cantidad = objeto.precio.cantidad;
  for (const { efecto } of efectosActivos(eventosActivos, contenido)) {
    if (efecto.tipo !== 'precio') continue;
    if (efecto.objetoId != null && efecto.objetoId !== objeto.id) continue;
    if (efecto.categoria != null && efecto.categoria !== objeto.tipo) continue;
    if (efecto.objetoId == null && efecto.categoria == null) continue;
    if (typeof efecto.multiplicador === 'number') cantidad *= efecto.multiplicador;
    if (typeof efecto.porcentaje === 'number') cantidad *= 1 + efecto.porcentaje / 100;
  }
  return { cantidad: Math.max(1, Math.ceil(cantidad - 1e-9)), moneda: objeto.precio.moneda };
}

/**
 * ¿Un evento activo bloquea la acción?
 * @param {{ verbo: string, npcId?: string|null, objetoId?: string|null,
 *   viaje?: { destino: string, escenaLlegada: string|null, escenasDeRuta: string[] } }} accion
 * @param {string} escenaJugadorId
 * @returns {string|null} id del evento que bloquea, o null
 */
export function eventoQueBloquea(accion, escenaJugadorId, eventosActivos, contenido) {
  const ciudadDe = (escenaId) => {
    const e = lista(contenido?.escenas).find((x) => x.id === escenaId);
    return typeof e?.ciudad === 'string' && e.ciudad !== ''
      ? `ciudad_${e.ciudad.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
      : null;
  };
  for (const { eventoId, escenas, efecto } of efectosActivos(eventosActivos, contenido)) {
    if (efecto.tipo !== 'bloqueo' || efecto.verbo !== accion.verbo) continue;
    const aca = escenas.includes(escenaJugadorId);
    if (efecto.npcId != null) {
      if (efecto.npcId === accion.npcId) return eventoId;
    } else if (efecto.objetoId != null) {
      if (aca && efecto.objetoId === accion.objetoId) return eventoId;
    } else if (efecto.destino != null) {
      const v = accion.viaje;
      if (aca && v && (v.destino === efecto.destino || ciudadDe(v.escenaLlegada) === efecto.destino)) return eventoId;
    } else if (efecto.escenaId != null) {
      if (accion.viaje && lista(accion.viaje.escenasDeRuta).includes(efecto.escenaId)) return eventoId;
    }
  }
  return null;
}

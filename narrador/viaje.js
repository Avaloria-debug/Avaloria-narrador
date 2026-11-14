// Clasificación y costo de un viaje según su destino.
// No mueve al jugador ni revisa bloqueos de eventos: eso es del motor de turnos (bloque 3b).
import { YA_EN_DESTINO } from './motivos.js';

export { YA_EN_DESTINO };

export const TIPOS_VIAJE = Object.freeze({
  MISMA_ESCENA: 'misma_escena',
  INTRA_CIUDAD: 'intra_ciudad',
  POR_CAMINO: 'por_camino',
  SIN_RUTA: 'sin_ruta',
});


const ciudadDe = (e) => (typeof e?.ciudad === 'string' && e.ciudad !== '' ? e.ciudad : null);
const idDeCiudad = (ciudad) =>
  `ciudad_${ciudad.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

/**
 * Ruta con menos horas entre la escena actual y cualquiera de las escenas meta.
 * Las salidas valen en los dos sentidos. Las horas de una ruta son la suma de
 * reglas.viajeHorasPorCamino de cada camino por el que pasa, incluido el camino
 * de partida o de llegada.
 */
function rutaPorCamino(origenId, metas, contenido) {
  const horasCamino = contenido.reglas?.viajeHorasPorCamino ?? {};
  const costo = (id) => horasCamino[id] ?? 0;
  const vecinas = new Map(contenido.escenas.map((e) => [e.id, new Set()]));
  for (const e of contenido.escenas) {
    for (const s of e.salidas ?? []) {
      if (!vecinas.has(s)) continue;
      vecinas.get(e.id).add(s);
      vecinas.get(s).add(e.id);
    }
  }
  if (!vecinas.has(origenId)) return null;

  const mejor = new Map([[origenId, { horas: costo(origenId), camino: [origenId] }]]);
  const pendientes = new Set([origenId]);
  while (pendientes.size > 0) {
    let actual = null;
    for (const id of pendientes) if (actual === null || mejor.get(id).horas < mejor.get(actual).horas) actual = id;
    pendientes.delete(actual);
    for (const v of vecinas.get(actual)) {
      const horas = mejor.get(actual).horas + costo(v);
      const previa = mejor.get(v);
      const camino = mejor.get(actual).camino.length + 1;
      // Con las mismas horas gana la ruta con menos escenas.
      if (!previa || horas < previa.horas || (horas === previa.horas && camino < previa.camino.length)) {
        mejor.set(v, { horas, camino: [...mejor.get(actual).camino, v] });
        pendientes.add(v);
      }
    }
  }
  let elegida = null;
  for (const id of metas) {
    const r = mejor.get(id);
    const gana =
      r && (elegida === null || r.horas < elegida.horas || (r.horas === elegida.horas && r.camino.length < elegida.camino.length));
    if (gana) elegida = { ...r, escenaLlegada: id };
  }
  if (!elegida) return null;
  return {
    horas: elegida.horas,
    caminos: elegida.camino.filter((id) => id in horasCamino),
    escenaLlegada: elegida.escenaLlegada,
  };
}

/**
 * @param {string} destino id de escena o `ciudad_*`
 * @param {string} escenaActualId
 * @param {{ escenas: object[], reglas: object }} contenido
 * @returns {{ tipo: string, horas: number|null, escenaLlegada: string|null, caminos: string[], motivo?: string }}
 *   `misma_escena`: el jugador ya está en el destino (la escena, o una escena de esa ciudad). 0 horas, motivo `ya_en_destino`.
 *   `intra_ciudad`: otra escena de la ciudad de la escena actual. Cuesta reglas.viajeHorasIntraCiudad.
 *   `por_camino`: cualquier otro destino. Cuesta la suma de reglas.viajeHorasPorCamino de los caminos de la ruta.
 *   `sin_ruta`: el destino no existe o no hay ruta.
 */
export function clasificarViaje(destino, escenaActualId, contenido) {
  const escenas = contenido?.escenas ?? [];
  const actual = escenas.find((e) => e.id === escenaActualId);
  const meta = escenas.find((e) => e.id === destino);
  const metas = meta ? [meta.id] : escenas.filter((e) => ciudadDe(e) && idDeCiudad(e.ciudad) === destino).map((e) => e.id);
  const sinRuta = { tipo: TIPOS_VIAJE.SIN_RUTA, horas: null, escenaLlegada: null, caminos: [] };
  if (!actual || metas.length === 0) return sinRuta;

  if (metas.includes(escenaActualId)) {
    return { tipo: TIPOS_VIAJE.MISMA_ESCENA, horas: 0, escenaLlegada: escenaActualId, caminos: [], motivo: YA_EN_DESTINO };
  }
  if (meta && ciudadDe(actual) !== null && ciudadDe(actual) === ciudadDe(meta)) {
    return {
      tipo: TIPOS_VIAJE.INTRA_CIUDAD,
      horas: contenido.reglas.viajeHorasIntraCiudad,
      escenaLlegada: meta.id,
      caminos: [],
    };
  }
  const ruta = rutaPorCamino(escenaActualId, metas, contenido);
  if (!ruta) return sinRuta;
  return { tipo: TIPOS_VIAJE.POR_CAMINO, ...ruta };
}

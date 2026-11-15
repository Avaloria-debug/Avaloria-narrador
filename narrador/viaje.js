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
 *
 * Costo: cada tramo entre un camino y una escena de ciudad cuesta la mitad de las horas
 * de ese camino (reglas.viajeHorasPorCamino). Cada tramo entre un camino y su lugar de
 * camino cuesta reglas.viajeHorasLugarCamino. Los tramos dentro de la ciudad no suman.
 * - Cruzar un camino de ciudad a ciudad: sus dos tramos, o sea sus horas completas, una vez.
 * - Entrar a un camino y quedarse, o salir de un camino donde ya se estaba: la mitad,
 *   redondeada hacia arriba.
 */
function rutaPorCamino(origenId, metas, contenido) {
  const horasCamino = contenido.reglas?.viajeHorasPorCamino ?? {};
  const porId = new Map(contenido.escenas.map((e) => [e.id, e]));
  if (!porId.has(origenId)) return null;
  const esCamino = (id) => id in horasCamino;
  // Camino del tramo, si el tramo une un camino con una escena de ciudad.
  const caminoDelTramo = (a, b) => {
    if (esCamino(a) && ciudadDe(porId.get(b)) !== null) return a;
    if (esCamino(b) && ciudadDe(porId.get(a)) !== null) return b;
    return null;
  };
  const horasLugar = contenido.reglas?.viajeHorasLugarCamino ?? 0;
  // ¿El tramo une un camino con un lugar de camino (escena sin ciudad que no es camino)?
  const esTramoDeLugar = (a, b) => {
    const lugar = (id) => !esCamino(id) && ciudadDe(porId.get(id)) === null;
    return (esCamino(a) && lugar(b)) || (esCamino(b) && lugar(a));
  };
  const costoTramo = (a, b) => {
    const camino = caminoDelTramo(a, b);
    if (camino !== null) return horasCamino[camino] / 2;
    return esTramoDeLugar(a, b) ? horasLugar : 0;
  };

  const mejor = new Map([[origenId, { horas: 0, camino: [origenId] }]]);
  const pendientes = new Set([origenId]);
  while (pendientes.size > 0) {
    let actual = null;
    for (const id of pendientes) if (actual === null || mejor.get(id).horas < mejor.get(actual).horas) actual = id;
    pendientes.delete(actual);
    for (const v of porId.get(actual).salidas ?? []) {
      if (!porId.has(v)) continue;
      const horas = mejor.get(actual).horas + costoTramo(actual, v);
      const previa = mejor.get(v);
      const largo = mejor.get(actual).camino.length + 1;
      // Con las mismas horas gana la ruta con menos escenas.
      if (!previa || horas < previa.horas || (horas === previa.horas && largo < previa.camino.length)) {
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

  // Horas por camino: completas si la ruta usa sus dos tramos; la mitad, hacia arriba, si usa uno.
  const tramos = new Map();
  let horasDeLugares = 0;
  for (let i = 1; i < elegida.camino.length; i++) {
    const camino = caminoDelTramo(elegida.camino[i - 1], elegida.camino[i]);
    if (camino !== null) tramos.set(camino, (tramos.get(camino) ?? 0) + 1);
    else if (esTramoDeLugar(elegida.camino[i - 1], elegida.camino[i])) horasDeLugares += horasLugar;
  }
  let horas = horasDeLugares;
  for (const [camino, n] of tramos) horas += n >= 2 ? horasCamino[camino] : Math.ceil(horasCamino[camino] / 2);
  return {
    horas,
    caminos: elegida.camino.filter(esCamino),
    escenaLlegada: elegida.escenaLlegada,
    escenasDeRuta: elegida.camino.slice(1),
  };
}

/**
 * @param {string} destino id de escena o `ciudad_*`
 * @param {string} escenaActualId
 * @param {{ escenas: object[], reglas: object }} contenido
 * @returns {{ tipo: string, horas: number|null, escenaLlegada: string|null, caminos: string[],
 *   escenasDeRuta: string[], motivo?: string }} `escenasDeRuta`: escenas por las que pasa, sin la de partida.
 *   `misma_escena`: el jugador ya está en el destino (la escena, o una escena de esa ciudad). 0 horas, motivo `ya_en_destino`.
 *   `intra_ciudad`: otra escena de la ciudad de la escena actual. Cuesta reglas.viajeHorasIntraCiudad.
 *   `por_camino`: cualquier otro destino. Cuesta la suma de las horas de los caminos de la ruta, cada uno una vez
 *     (la mitad si el viaje empieza o termina en el camino). `caminos` trae los caminos por los que pasa.
 *   `sin_ruta`: el destino no existe o no hay ruta.
 */
export function clasificarViaje(destino, escenaActualId, contenido) {
  const escenas = contenido?.escenas ?? [];
  const actual = escenas.find((e) => e.id === escenaActualId);
  const meta = escenas.find((e) => e.id === destino);
  const metas = meta ? [meta.id] : escenas.filter((e) => ciudadDe(e) && idDeCiudad(e.ciudad) === destino).map((e) => e.id);
  const sinRuta = { tipo: TIPOS_VIAJE.SIN_RUTA, horas: null, escenaLlegada: null, caminos: [], escenasDeRuta: [] };
  if (!actual || metas.length === 0) return sinRuta;

  if (metas.includes(escenaActualId)) {
    return {
      tipo: TIPOS_VIAJE.MISMA_ESCENA,
      horas: 0,
      escenaLlegada: escenaActualId,
      caminos: [],
      escenasDeRuta: [],
      motivo: YA_EN_DESTINO,
    };
  }
  if (meta && ciudadDe(actual) !== null && ciudadDe(actual) === ciudadDe(meta)) {
    return {
      tipo: TIPOS_VIAJE.INTRA_CIUDAD,
      horas: contenido.reglas.viajeHorasIntraCiudad,
      escenaLlegada: meta.id,
      caminos: [],
      escenasDeRuta: [meta.id],
    };
  }
  const ruta = rutaPorCamino(escenaActualId, metas, contenido);
  if (!ruta) return sinRuta;
  return { tipo: TIPOS_VIAJE.POR_CAMINO, ...ruta };
}

// Instanciación de un caso (docs/motor-caso-v1-operativo.md, secciones 2 y 4).
// Un caso tiene 3 ranuras de pista con 2 conocimientos válidos cada una: 8 firmas posibles.
// Firma = qué conocimiento ocupa cada ranura, sin orden. El NPC de cada pista es el dueño del conocimiento.
//
// historialJugador: {
//   jugadorId,
//   instancias: [{ firma, usos, ultimaHora, ordenes }]  // de persistencia.instanciasDeCaso(jugadorId, casoId)
//   tags: [...]                                          // tags de la partida (para el rencor grave)
// }
// contexto: { contenido } o { duenos } para saber el dueño de cada conocimiento; { persistencia, fecha } en instanciar.

import { crearRng, semillaAEntero } from '../azar.js';
import { nivelDeTag, NIVEL_MAX } from './tags.js';

export const RANURAS = Object.freeze(['p1', 'p2', 'p3']);
export const OPCIONES_POR_RANURA = 2;

/** Mapa conocimientoId → npcId (dueño), del contenido. */
export function duenosDeConocimientos(contenido) {
  const duenos = new Map();
  for (const npc of contenido.npcs ?? []) {
    for (const conocimiento of npc.conocimientos ?? []) duenos.set(conocimiento.id, npc.id);
  }
  return duenos;
}

function duenosDe(contexto = {}) {
  if (contexto.duenos) return contexto.duenos;
  if (contexto.contenido) return duenosDeConocimientos(contexto.contenido);
  throw new Error('instancias: falta el contenido para saber el dueño de cada conocimiento');
}

/** Clave de una firma: conocimiento por ranura, siempre en el orden p1, p2, p3. */
export function claveDeFirma(pistas) {
  return RANURAS.map((r) => `${r}=${pistas.find((p) => p.ranura === r).conocimientoId}`).join('|');
}

/** Clave de un orden de ranuras: "p1>p3>p2". */
export const claveDeOrden = (orden) => orden.join('>');

function ranurasDe(caso) {
  const ranuras = caso?.ranuras_pista;
  if (!Array.isArray(ranuras) || ranuras.length !== RANURAS.length) {
    throw new Error(`instancias: el caso "${caso?.id}" tiene que tener ${RANURAS.length} ranuras`);
  }
  return RANURAS.map((id) => {
    const ranura = ranuras.find((r) => r.id === id);
    if (!ranura) throw new Error(`instancias: al caso "${caso.id}" le falta la ranura ${id}`);
    if (!Array.isArray(ranura.conocimientos_validos) || ranura.conocimientos_validos.length !== OPCIONES_POR_RANURA) {
      throw new Error(`instancias: la ranura ${id} de "${caso.id}" tiene que tener ${OPCIONES_POR_RANURA} conocimientos`);
    }
    return ranura;
  });
}

/**
 * Órdenes de ranuras válidos para un caso. p1 va siempre primera si el primer hito depende de ella
 * (la nombra en sus condiciones o en su escena de entrega); si no, valen las 6 permutaciones.
 */
export function ordenesValidos(caso) {
  const todas = [
    ['p1', 'p2', 'p3'], ['p1', 'p3', 'p2'], ['p2', 'p1', 'p3'], ['p2', 'p3', 'p1'], ['p3', 'p1', 'p2'], ['p3', 'p2', 'p1'],
  ];
  const h1 = caso?.hitos?.[0];
  const dependeDeP1 = h1 ? /\bp1\b/.test(JSON.stringify([h1.condiciones ?? null, h1.escena_entrega ?? null])) : true;
  return dependeDeP1 ? todas.filter((orden) => orden[0] === 'p1') : todas;
}

/**
 * Firmas posibles de un caso para un jugador.
 * Producto de los 2 conocimientos de cada ranura, sin dueño repetido ni conocimiento repetido en la firma.
 * Un conocimiento con requiereEvento o requiereMarca es candidato igual (se revela después).
 * En p1 no entra un conocimiento cuyo dueño tenga rencor grave; si eso deja el caso sin firmas, no se aplica.
 * Cada firma trae su historial: usos, ultimaHora, ordenes usados y los órdenes válidos del caso.
 * @returns {{clave, pistas:[{ranura, conocimientoId, npcId}], usos, ultimaHora, ordenes, ordenesValidos}[]}
 */
export function candidatos(caso, historialJugador = {}, contexto = {}) {
  const duenos = duenosDe(contexto);
  const duenoDe = (conocimientoId) => {
    const npcId = duenos.get(conocimientoId);
    if (!npcId) throw new Error(`instancias: el conocimiento "${conocimientoId}" de "${caso.id}" no existe en el contenido`);
    return npcId;
  };
  const [p1, p2, p3] = ranurasDe(caso);
  const validos = ordenesValidos(caso);
  const jugadas = new Map((historialJugador.instancias ?? []).map((i) => [i.firma, i]));

  const firmas = [];
  for (const a of p1.conocimientos_validos) {
    for (const b of p2.conocimientos_validos) {
      for (const c of p3.conocimientos_validos) {
        const ids = [a, b, c];
        const npcs = ids.map(duenoDe);
        if (new Set(ids).size < ids.length || new Set(npcs).size < npcs.length) continue;
        const pistas = RANURAS.map((ranura, i) => ({ ranura, conocimientoId: ids[i], npcId: npcs[i] }));
        const clave = claveDeFirma(pistas);
        const jugada = jugadas.get(clave);
        firmas.push({
          clave,
          pistas,
          usos: jugada?.usos ?? 0,
          ultimaHora: jugada?.ultimaHora ?? null,
          ordenes: { ...(jugada?.ordenes ?? {}) },
          ordenesValidos: validos,
        });
      }
    }
  }

  const tags = historialJugador.tags ?? [];
  const sinRencor = firmas.filter((f) => nivelDeTag(tags, 'rencor', f.pistas[0].npcId) < NIVEL_MAX);
  return sinRencor.length > 0 ? sinRencor : firmas;
}

const rngDe = (semilla, uso) => crearRng(semillaAEntero(`${semilla}:${uso}`));
const sortear = (lista, rng) => lista[Math.floor(rng() * lista.length)];
const minimo = (lista, valor) => {
  const menor = Math.min(...lista.map(valor));
  return lista.filter((x) => valor(x) === menor);
};

/**
 * Elige la firma: una no jugada por el jugador (sorteo con semilla); si no queda ninguna, la de menos usos;
 * con empate, la más vieja; si sigue el empate, sorteo con semilla.
 * El historial se lee de cada candidato (lo pone `candidatos`); `historialJugador.instancias` lo pisa si viene.
 */
export function elegirFirma(listaCandidatos, historialJugador = {}, semilla = 0) {
  if (!Array.isArray(listaCandidatos) || listaCandidatos.length === 0) throw new Error('instancias: no hay firmas candidatas');
  const jugadas = new Map((historialJugador.instancias ?? []).map((i) => [i.firma, i]));
  const lista = listaCandidatos.map((f) => {
    const jugada = jugadas.get(f.clave);
    return jugada ? { ...f, usos: jugada.usos, ultimaHora: jugada.ultimaHora, ordenes: { ...(jugada.ordenes ?? {}) } } : f;
  });
  const rng = rngDe(semilla, 'firma');

  const noJugadas = lista.filter((f) => f.usos === 0);
  if (noJugadas.length > 0) return sortear(noJugadas, rng);
  const menosUsadas = minimo(lista, (f) => f.usos);
  const masViejas = minimo(menosUsadas, (f) => f.ultimaHora ?? -Infinity);
  return sortear(masViejas, rng);
}

/**
 * Orden de las pistas: entre los órdenes válidos de la firma, el menos usado con esa firma; empate, sorteo con semilla.
 * @returns {string[]} ranuras en orden, p. ej. ['p1', 'p3', 'p2']
 */
export function ordenar(firma, semilla = 0) {
  const validos = firma.ordenesValidos ?? [RANURAS];
  const menosUsados = minimo(validos, (orden) => firma.ordenes?.[claveDeOrden(orden)] ?? 0);
  return [...sortear(menosUsados, rngDe(semilla, 'orden'))];
}

/** Arma la instancia sin guardar nada. */
export function armarInstancia(caso, historialJugador = {}, semilla = 0, contexto = {}) {
  const firma = elegirFirma(candidatos(caso, historialJugador, contexto), {}, semilla);
  const orden = ordenar(firma, semilla);
  return {
    casoId: caso.id,
    firma: firma.clave,
    pistas: firma.pistas.map((p) => ({ ...p, orden: orden.indexOf(p.ranura) + 1 })),
    semilla,
  };
}

/**
 * Instancia un caso para un jugador y suma el uso en historial_instancias.
 * @param {object} caso
 * @param {{jugadorId:string, instancias?:object[], tags?:object[]}} historialJugador
 * @param {number|string} semilla
 * @param {{contenido?:object, duenos?:Map, persistencia:object, fecha?:number}} contexto
 *   persistencia: la base abierta (persistencia.js) o las operaciones de un `turno` en curso.
 *   fecha: momento del uso, para el empate "la más vieja"; por defecto Date.now().
 * @returns {Promise<{casoId, firma, pistas:[{ranura, conocimientoId, npcId, orden}], semilla}>}
 */
export async function instanciar(caso, historialJugador, semilla, contexto = {}) {
  if (!contexto.persistencia) throw new Error('instancias: falta la persistencia para sumar el uso');
  if (!historialJugador?.jugadorId) throw new Error('instancias: falta historialJugador.jugadorId');
  const instancia = armarInstancia(caso, historialJugador, semilla, contexto);
  const orden = [...instancia.pistas].sort((a, b) => a.orden - b.orden).map((p) => p.ranura);
  await contexto.persistencia.sumarUsoInstancia(historialJugador.jugadorId, caso.id, instancia.firma, {
    hora: contexto.fecha ?? Date.now(),
    orden: claveDeOrden(orden),
  });
  return instancia;
}

/** Historial de un jugador para un caso, leído de la persistencia. */
export async function leerHistorialJugador(persistencia, jugadorId, casoId, tags = []) {
  return { jugadorId, instancias: await persistencia.instanciasDeCaso(jugadorId, casoId), tags };
}

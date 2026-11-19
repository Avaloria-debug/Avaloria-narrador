// Hitos del motor de caso (docs/motor-caso-v1-operativo.md, sección 5).
// Funciones puras: reciben el estado del caso y el del mundo y devuelven estados nuevos.
//
// estadoCaso: {
//   casoId, instancia: { pistas: [{ ranura, conocimientoId, npcId, orden }] },
//   tags, contadorHitos, hitoPrevio: { id, hora, escena, contador },
//   hitosAlcanzados: [id], hitosListos: [id], listosDesde: { id: hora }, hitosBloqueados: [id],
//   entregasMovidas: { id: escena }, reparados: [npcId], progresoReparacion: { npcId: [escena] }, umbralesBajados: [id], reparacionHabilitada: [id],
//   sinListosDesde: turno, ultimoAvance: { hora }, turnoUltimoDisparo, finalAlcanzado, abandonoHabilitado
// }
// estadoMundo: {
//   caso,                // plantilla del caso activo (hitos)
//   hora,                // hora total del reloj del mundo
//   turno,               // contadorTurnos
//   escena,              // escena del jugador
//   estadoEvento,        // tranquilo, social, sigilo, tenso, peligroso, combate
//   npcs: { id: { escena, relacion, bloqueadoConocimientos } },
//   distancia?: (escenaA, escenaB) => número   // para "el NPC de ranura más cercano"
// }
//
// Condiciones de un hito (todas las presentes tienen que cumplirse):
//   requiere_hitos: [ids] | { todos: [ids], alguno: [ids] }
//   tags: [{ tipo, objetivo, op: '>=' | '<' | '==' | 'ausente', nivel }]
//   escena: 'id' | [ids] | { en: [ids], no_en: [ids] }
//   hora: { rango: [desde, hasta] }           hora del día, desde ≤ h < hasta
//       | { desde_previo: n }                 hora >= hitoPrevio.hora + n (horas del reloj)
//   contador: { desde_previo: n }             contadorHitos >= hitoPrevio.contador + n
//   estado_evento: 'id' | [ids]
//   pistas: { cantidad: n, nivel: 2, habilitada: 'pN' }
// Objetivos y escenas pueden nombrar ranuras: 'p1' (su conocimiento), 'npc(p1)' (su dueño), 'escena(p1)' (donde está su dueño).

import { escribirTag, subirTag, quitarTag, ajustarReputacion, nivelDeTag, deltaRelacion, RELACION_REPARACION, NIVEL_MAX } from './tags.js';
import { aplicarDecaimientoPorHitos, aplicarReparacion, TAGS_REPARABLES } from './decaimiento.js';

export const TURNOS_SIN_LISTOS = 8;
export const HORAS_SIN_AVANCE = 24;
export const HORAS_GANCHO = 12;
export const NIVEL_VISTA = 1;
export const NIVEL_ENTENDIDA = 2;
export const RELACION_MINIMA_REPARACION = 15;
export const REPARACIONES_PREVIAS = 2;
export const GRATITUD_MINIMA_REPARACION = 2;
const RELACION_MIN = -100;
const RELACION_MAX = 100;

const lista = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const numeroDeId = (id) => Number(String(id).match(/\d+/)?.[0] ?? Infinity);
const porId = (a, b) => numeroDeId(a.id) - numeroDeId(b.id) || String(a.id).localeCompare(String(b.id));

function hitosDe(estadoMundo) {
  const hitos = estadoMundo?.caso?.hitos;
  if (!Array.isArray(hitos)) throw new Error('hitos: falta estadoMundo.caso con sus hitos');
  return hitos;
}

const pistasDe = (estadoCaso) => estadoCaso.instancia?.pistas ?? [];
const pistaDe = (estadoCaso, ranura) => pistasDe(estadoCaso).find((p) => p.ranura === ranura) ?? null;
const escenaDeNpc = (estadoMundo, npcId) => estadoMundo.npcs?.[npcId]?.escena ?? null;

/**
 * Resuelve un objetivo o una escena que nombra una ranura.
 * 'p1' → conocimiento; 'npc(p1)' → dueño; 'escena(p1)' → escena donde está el dueño; 'escena' → escena del jugador.
 * Cualquier otro texto se toma como id literal.
 */
export function resolver(texto, estadoCaso, estadoMundo) {
  if (typeof texto !== 'string') return texto ?? null;
  if (texto === 'escena') return estadoMundo.escena ?? null;
  const m = texto.match(/^(?:(npc|escena)\()?(p\d)\)?$/);
  if (!m) return texto;
  const pista = pistaDe(estadoCaso, m[2]);
  if (!pista) throw new Error(`hitos: la instancia no tiene la ranura ${m[2]}`);
  if (m[1] === 'npc') return pista.npcId;
  if (m[1] === 'escena') return escenaDeNpc(estadoMundo, pista.npcId);
  return pista.conocimientoId;
}

/** Nivel de pista_conocida de una ranura. */
export function nivelDePista(estadoCaso, ranura) {
  const pista = pistaDe(estadoCaso, ranura);
  return pista ? nivelDeTag(estadoCaso.tags ?? [], 'pista_conocida', pista.conocimientoId) : 0;
}

/** Una ranura está habilitada cuando la anterior en el orden de la instancia llegó a nivel 1. La primera, siempre. */
export function ranuraHabilitada(estadoCaso, ranura) {
  const pista = pistaDe(estadoCaso, ranura);
  if (!pista) return false;
  if (pista.orden <= 1) return true;
  const anterior = pistasDe(estadoCaso).find((p) => p.orden === pista.orden - 1);
  return !anterior || nivelDePista(estadoCaso, anterior.ranura) >= NIVEL_VISTA;
}

/** Siguiente ranura habilitada que el jugador todavía no vio, en el orden de la instancia. */
export function siguienteRanuraHabilitada(estadoCaso) {
  return (
    [...pistasDe(estadoCaso)]
      .sort((a, b) => a.orden - b.orden)
      .find((p) => ranuraHabilitada(estadoCaso, p.ranura) && nivelDePista(estadoCaso, p.ranura) < NIVEL_VISTA) ?? null
  );
}

const esExplicita = (hito) => hito.es_reparacion === true && hito.repara_rencor_grave === true;
const esPasoDeReparacion = (hito) => hito.es_reparacion === true && hito.repara_rencor_grave !== true;

/** NPC dueño de los tags que repara el hito (`npc_reparacion`), o null. La reparación nunca va sobre otro. */
export function npcDeReparacion(hito, estadoCaso, estadoMundo = {}) {
  if (!hito.es_reparacion || !hito.npc_reparacion) return null;
  return resolver(hito.npc_reparacion, estadoCaso, estadoMundo);
}

/** Escenas donde ya hubo un hito de reparación sobre el NPC. */
export const progresoDeReparacion = (estadoCaso, npcId) => estadoCaso.progresoReparacion?.[npcId] ?? [];

/**
 * Las tres condiciones de la reparación explícita (rencor grave) sobre un NPC. Se piden todas.
 * @returns {{progreso:boolean, relacion:boolean, gratitud:boolean, cumple:boolean}}
 */
export function condicionesDeReparacionExplicita(npcId, estadoCaso, estadoMundo) {
  const progreso = new Set(progresoDeReparacion(estadoCaso, npcId)).size >= REPARACIONES_PREVIAS;
  const relacion = (estadoMundo.npcs?.[npcId]?.relacion ?? 0) >= RELACION_MINIMA_REPARACION;
  const gratitud = nivelDeTag(estadoCaso.tags ?? [], 'gratitud', npcId) >= GRATITUD_MINIMA_REPARACION;
  return { progreso, relacion, gratitud, cumple: progreso && relacion && gratitud };
}

/** Borra el progreso de reparación de un NPC (o varios). Lo llama quien registra una traición o un rencor nuevo sobre él. */
export function reiniciarProgresoReparacion(estadoCaso, npcIds) {
  const ids = lista(npcIds).filter((id) => estadoCaso.progresoReparacion?.[id] !== undefined);
  if (ids.length === 0) return estadoCaso;
  const progresoReparacion = Object.fromEntries(Object.entries(estadoCaso.progresoReparacion).filter(([id]) => !ids.includes(id)));
  return { ...estadoCaso, progresoReparacion };
}

/**
 * El NPC del hito, si tiene algo que este hito repara; si no, lista vacía.
 * Hito de reparación: un tag medio o grave de rencor, desconfianza o miedo (el rencor grave no lo quita, pero suma progreso).
 * Reparación explícita: rencor grave.
 */
export function npcsPorReparar(hito, estadoCaso, estadoMundo = {}) {
  const npcId = npcDeReparacion(hito, estadoCaso, estadoMundo);
  if (!npcId) return [];
  const tags = estadoCaso.tags ?? [];
  const pendiente = esExplicita(hito)
    ? nivelDeTag(tags, 'rencor', npcId) === NIVEL_MAX
    : TAGS_REPARABLES.some((tipo) => nivelDeTag(tags, tipo, npcId) >= NIVEL_ENTENDIDA);
  return pendiente ? [npcId] : [];
}

function cumpleRequiereHitos(condicion, alcanzados) {
  if (!condicion) return true;
  const todos = Array.isArray(condicion) ? condicion : lista(condicion.todos);
  const alguno = Array.isArray(condicion) ? [] : lista(condicion.alguno);
  return todos.every((id) => alcanzados.includes(id)) && (alguno.length === 0 || alguno.some((id) => alcanzados.includes(id)));
}

function cumpleTag(condicion, estadoCaso, estadoMundo, bajar) {
  const objetivo = resolver(condicion.objetivo, estadoCaso, estadoMundo);
  const actual = objetivo ? nivelDeTag(estadoCaso.tags ?? [], condicion.tipo, objetivo) : 0;
  // Umbral bajado por anti-traba: una pista pedida en "entendida" vale en "vista".
  const nivel = bajar && condicion.tipo === 'pista_conocida' && condicion.op === '>=' ? Math.max(NIVEL_VISTA, condicion.nivel - 1) : condicion.nivel;
  switch (condicion.op) {
    case '>=': return actual >= nivel;
    case '<': return actual < nivel;
    case '==': return actual === nivel;
    case 'ausente': return actual === 0;
    default: throw new Error(`hitos: operador de tag desconocido "${condicion.op}"`);
  }
}

function cumpleEscena(condicion, estadoCaso, estadoMundo) {
  if (!condicion) return true;
  const esObjeto = typeof condicion === 'object' && !Array.isArray(condicion);
  const resolverTodas = (v) => lista(v).map((e) => resolver(e, estadoCaso, estadoMundo));
  const en = resolverTodas(esObjeto ? condicion.en : condicion);
  const noEn = resolverTodas(esObjeto ? condicion.no_en : null);
  return (en.length === 0 || en.includes(estadoMundo.escena)) && !noEn.includes(estadoMundo.escena);
}

function cumpleHora(condicion, estadoCaso, estadoMundo) {
  if (!condicion) return true;
  if (condicion.rango) {
    const [desde, hasta] = condicion.rango;
    const h = ((estadoMundo.hora % 24) + 24) % 24;
    const dentro = desde <= hasta ? h >= desde && h < hasta : h >= desde || h < hasta;
    if (!dentro) return false;
  }
  if (condicion.desde_previo !== undefined) {
    if (estadoMundo.hora < (estadoCaso.hitoPrevio?.hora ?? 0) + condicion.desde_previo) return false;
  }
  return true;
}

function cumplePistas(condicion, estadoCaso, bajar) {
  if (!condicion) return true;
  if (condicion.habilitada && !lista(condicion.habilitada).every((r) => ranuraHabilitada(estadoCaso, r))) return false;
  if (condicion.cantidad !== undefined) {
    const pedido = condicion.nivel ?? NIVEL_ENTENDIDA;
    const nivel = bajar ? Math.max(NIVEL_VISTA, pedido - 1) : pedido;
    const cuantas = pistasDe(estadoCaso).filter((p) => nivelDePista(estadoCaso, p.ranura) >= nivel).length;
    if (cuantas < condicion.cantidad) return false;
  }
  return true;
}

/**
 * ¿Se cumplen las condiciones del hito? No mira la escena de entrega.
 * La reparación explícita pide además sus tres condiciones (progreso, relación, gratitud); nada las saltea.
 * Un hito de reparación habilitado por anti-traba (rencor grave) se cumple sin otras condiciones.
 */
export function evaluarCondiciones(hito, estadoCaso, estadoMundo) {
  if (esExplicita(hito)) {
    const npcId = npcDeReparacion(hito, estadoCaso, estadoMundo);
    if (!npcId || !condicionesDeReparacionExplicita(npcId, estadoCaso, estadoMundo).cumple) return false;
  }
  if ((estadoCaso.reparacionHabilitada ?? []).includes(hito.id)) return true;
  const c = hito.condiciones ?? {};
  const bajar = (estadoCaso.umbralesBajados ?? []).includes(hito.id);
  if (!cumpleRequiereHitos(c.requiere_hitos, estadoCaso.hitosAlcanzados ?? [])) return false;
  if (!lista(c.tags).every((t) => cumpleTag(t, estadoCaso, estadoMundo, bajar))) return false;
  if (!cumpleEscena(c.escena, estadoCaso, estadoMundo)) return false;
  if (!cumpleHora(c.hora, estadoCaso, estadoMundo)) return false;
  if (c.contador?.desde_previo !== undefined) {
    if ((estadoCaso.contadorHitos ?? 0) < (estadoCaso.hitoPrevio?.contador ?? 0) + c.contador.desde_previo) return false;
  }
  if (c.estado_evento && !lista(c.estado_evento).includes(estadoMundo.estadoEvento)) return false;
  if (!cumplePistas(c.pistas, estadoCaso, bajar)) return false;
  return true;
}

/** Un hito ya disparado no vuelve, salvo el de reparación mientras su NPC tenga algo por reparar. */
function disponible(hito, estadoCaso) {
  if ((estadoCaso.hitosBloqueados ?? []).includes(hito.id)) return false;
  if (!(estadoCaso.hitosAlcanzados ?? []).includes(hito.id)) return true;
  return hito.es_reparacion === true && npcsPorReparar(hito, estadoCaso).length > 0;
}

/**
 * Recalcula hitosListos: hitos cuya condición se cumple y que no están alcanzados ni bloqueados.
 * Guarda desde qué hora está listo cada uno (para el gancho) y desde qué turno no hay ninguno (anti-traba).
 */
export function actualizarListos(estadoCaso, estadoMundo) {
  const listos = hitosDe(estadoMundo)
    .filter((h) => disponible(h, estadoCaso) && evaluarCondiciones(h, estadoCaso, estadoMundo))
    .map((h) => h.id);
  const listosDesde = {};
  for (const id of listos) listosDesde[id] = estadoCaso.listosDesde?.[id] ?? estadoMundo.hora;
  const sinListosDesde = listos.length > 0 ? null : (estadoCaso.sinListosDesde ?? estadoMundo.turno ?? 0);
  return { ...estadoCaso, hitosListos: listos, listosDesde, sinListosDesde };
}

/** Escena de entrega principal del hito: la fija, la del dueño de una ranura, o null (cualquiera). */
export function escenaDeEntrega(hito, estadoCaso, estadoMundo) {
  if (hito.escena_entrega === null || hito.escena_entrega === undefined) return null;
  return resolver(hito.escena_entrega, estadoCaso, estadoMundo);
}

/** Escena alternativa del hito (opcional, una sola), o null. Solo vale con escena_entrega no nula. */
export function escenaAlternativa(hito, estadoCaso, estadoMundo) {
  if (typeof hito.escena_alternativa !== 'string' || hito.escena_alternativa === '') return null;
  if (hito.escena_entrega === null || hito.escena_entrega === undefined) return null;
  return resolver(hito.escena_alternativa, estadoCaso, estadoMundo);
}

/** Escenas donde un hito de reparación ya contó para su NPC: ahí no se repite (una vez por NPC y escena). */
function escenasYaContadas(hito, estadoCaso, estadoMundo) {
  if (!esPasoDeReparacion(hito)) return [];
  const npcId = npcDeReparacion(hito, estadoCaso, estadoMundo);
  return npcId ? progresoDeReparacion(estadoCaso, npcId) : [];
}

/**
 * Escenas donde se puede entregar el hito: escena_entrega y escena_alternativa, cualquiera de las dos.
 * null = cualquier escena.
 */
export function escenasDeEntrega(hito, estadoCaso, estadoMundo) {
  const principal = escenaDeEntrega(hito, estadoCaso, estadoMundo);
  if (hito.escena_entrega === null || hito.escena_entrega === undefined) return null;
  const alternativa = escenaAlternativa(hito, estadoCaso, estadoMundo);
  return [...new Set([principal, alternativa].filter(Boolean))];
}

/** Hitos listos, en orden de prioridad: reparación con tags pendientes > el que bloquea ramas > menor id. */
function listosPorPrioridad(estadoCaso, estadoMundo) {
  const ids = estadoCaso.hitosListos ?? [];
  const peso = (h) => (h.es_reparacion && npcsPorReparar(h, estadoCaso, estadoMundo).length > 0 ? 0 : lista(h.bloquea).length > 0 ? 1 : 2);
  return hitosDe(estadoMundo)
    .filter((h) => ids.includes(h.id))
    .sort((a, b) => peso(a) - peso(b) || porId(a, b));
}

const entregableAca = (hito, estadoCaso, estadoMundo) => {
  if (escenasYaContadas(hito, estadoCaso, estadoMundo).includes(estadoMundo.escena)) return false;
  const escenas = escenasDeEntrega(hito, estadoCaso, estadoMundo);
  return escenas === null || escenas.includes(estadoMundo.escena);
};

/**
 * Hito a disparar este turno, o null. Máximo 1 por turno: si ya se disparó uno en este turno, null.
 * Solo entran los listos que se entregan en la escena del jugador: escena_entrega, escena_alternativa, o null.
 */
export function elegirDisparo(estadoCaso, estadoMundo) {
  if (estadoCaso.turnoUltimoDisparo !== undefined && estadoCaso.turnoUltimoDisparo !== null && estadoCaso.turnoUltimoDisparo === estadoMundo.turno) {
    return null;
  }
  return listosPorPrioridad(estadoCaso, estadoMundo).find((h) => entregableAca(h, estadoCaso, estadoMundo)) ?? null;
}

const acotarRelacion = (n) => Math.max(RELACION_MIN, Math.min(RELACION_MAX, n));

function cambiarNpc(estadoMundo, npcId, cambio) {
  const npc = estadoMundo.npcs?.[npcId];
  if (!npc) return estadoMundo;
  return { ...estadoMundo, npcs: { ...estadoMundo.npcs, [npcId]: { ...npc, ...cambio(npc) } } };
}

/** Aplica un efecto de tag de un hito. Devuelve { tags, estadoMundo }. */
function aplicarEfecto(efecto, tags, estadoCaso, estadoMundo, marca) {
  const objetivo = resolver(efecto.objetivo, estadoCaso, estadoMundo);
  if (!objetivo) throw new Error(`hitos: el efecto ${efecto.tipo} no tiene objetivo`);
  const op = efecto.op ?? 'escribir';
  if (op === 'quitar') return { tags: quitarTag(tags, efecto.tipo, objetivo), estadoMundo };
  if (op === 'reputacion') return { tags: ajustarReputacion(tags, { objetivo, paso: efecto.paso, ...marca }), estadoMundo };
  if (op === 'subir') return { tags: subirTag(tags, { tipo: efecto.tipo, objetivo, ...marca }), estadoMundo };
  if (op !== 'escribir') throw new Error(`hitos: operación de efecto desconocida "${op}"`);
  const delta = deltaRelacion(efecto.tipo, efecto.nivel);
  return {
    tags: escribirTag(tags, { tipo: efecto.tipo, objetivo, nivel: efecto.nivel, ...marca }),
    estadoMundo: delta === 0 ? estadoMundo : cambiarNpc(estadoMundo, objetivo, (npc) => ({ relacion: acotarRelacion((npc.relacion ?? 0) + delta) })),
  };
}

/**
 * Dispara un hito: contadorHitos + 1, hitoPrevio, efectos, bloqueos, reparación (si es_reparacion) y decaimiento por hitos.
 * La reparación va solo sobre `hito.npc_reparacion`, el NPC dueño de los tags.
 * Hito de reparación: quita un tag medio/grave (no el rencor grave), baja el resto 1, suma +15 de relación y
 * anota la escena en progresoReparacion[npc]. Reparación explícita: quita el rencor grave si se cumplen las tres
 * condiciones, y consume el progreso. Sin rencor grave se levanta bloqueadoConocimientos.
 * Un efecto del hito que escribe rencor sobre un NPC borra su progreso de reparación.
 * @returns {{estadoCaso:object, estadoMundo:object, hito:object, reparado:string|null}}
 */
export function dispararHito(hito, estadoCaso, estadoMundo) {
  const contadorHitos = (estadoCaso.contadorHitos ?? 0) + 1;
  const marca = { hora: estadoMundo.hora, hito: contadorHitos, casoId: estadoCaso.casoId ?? null, origen: `hito:${hito.id}` };

  let mundo = estadoMundo;
  let tags = estadoCaso.tags ?? [];
  let progresoReparacion = estadoCaso.progresoReparacion ?? {};
  for (const efecto of lista(hito.efectos)) {
    ({ tags, estadoMundo: mundo } = aplicarEfecto(efecto, tags, estadoCaso, mundo, marca));
    if (efecto.tipo === 'rencor' && (efecto.op ?? 'escribir') !== 'quitar') {
      progresoReparacion = reiniciarProgresoReparacion({ progresoReparacion }, resolver(efecto.objetivo, estadoCaso, mundo)).progresoReparacion;
    }
  }

  const bloqueados = [...new Set([...(estadoCaso.hitosBloqueados ?? []), ...lista(hito.bloquea)])];

  let reparados = estadoCaso.reparados ?? [];
  let reparado = null;
  if (hito.es_reparacion) {
    const conTags = { ...estadoCaso, tags, progresoReparacion };
    const npcId = npcsPorReparar(hito, conTags, mundo)[0] ?? null;
    const explicita = esExplicita(hito);
    if (npcId && (!explicita || condicionesDeReparacionExplicita(npcId, conTags, mundo).cumple)) {
      tags = aplicarReparacion(conTags, npcId, explicita ? { tipo: 'rencor', reparaRencorGrave: true } : {}).tags;
      const sigueGrave = nivelDeTag(tags, 'rencor', npcId) === NIVEL_MAX;
      mundo = cambiarNpc(mundo, npcId, (npc) => ({
        relacion: acotarRelacion((npc.relacion ?? 0) + RELACION_REPARACION),
        bloqueadoConocimientos: sigueGrave ? (npc.bloqueadoConocimientos ?? false) : false,
      }));
      if (explicita) {
        progresoReparacion = reiniciarProgresoReparacion({ progresoReparacion }, npcId).progresoReparacion;
      } else if (estadoMundo.escena) {
        const previas = progresoReparacion[npcId] ?? [];
        if (!previas.includes(estadoMundo.escena)) progresoReparacion = { ...progresoReparacion, [npcId]: [...previas, estadoMundo.escena] };
      }
      if (!reparados.includes(npcId)) reparados = [...reparados, npcId];
      reparado = npcId;
    }
  }

  const fuera = (id) => id !== hito.id && !bloqueados.includes(id);
  const listosDesde = Object.fromEntries(Object.entries(estadoCaso.listosDesde ?? {}).filter(([id]) => fuera(id)));
  const entregasMovidas = Object.fromEntries(Object.entries(estadoCaso.entregasMovidas ?? {}).filter(([id]) => fuera(id)));

  let nuevo = {
    ...estadoCaso,
    tags,
    contadorHitos,
    hitoPrevio: { id: hito.id, hora: estadoMundo.hora, escena: estadoMundo.escena ?? null, contador: contadorHitos },
    hitosAlcanzados: [...new Set([...(estadoCaso.hitosAlcanzados ?? []), hito.id])],
    hitosListos: (estadoCaso.hitosListos ?? []).filter(fuera),
    listosDesde,
    hitosBloqueados: bloqueados,
    entregasMovidas,
    reparados,
    progresoReparacion,
    reparacionHabilitada: (estadoCaso.reparacionHabilitada ?? []).filter((id) => id !== hito.id),
    umbralesBajados: (estadoCaso.umbralesBajados ?? []).filter((id) => id !== hito.id),
    sinListosDesde: null,
    ultimoAvance: { hora: estadoMundo.hora },
    turnoUltimoDisparo: estadoMundo.turno ?? null,
  };
  if (hito.final) nuevo.finalAlcanzado = hito.id;
  nuevo = aplicarDecaimientoPorHitos(nuevo);
  return { estadoCaso: nuevo, estadoMundo: mundo, hito, reparado };
}

/**
 * Gancho de un hito listo que no se puede entregar en la escena del jugador.
 * Devuelve el del hito de mayor prioridad: { hitoId, escena, npcId, movido }. npcId: el NPC de la ranura de
 * `escena(pN)`, o el NPC de ranura que está en esa escena; null si no hay ninguno.
 * El gancho nombra escena_entrega. A las 12 horas de reloj de estar listo sin entregarse, si el hito tiene
 * escena_alternativa, pasa a nombrarla (`movido` es true la primera vez). La entrega no se mueve a otra escena:
 * el hito se entrega en cualquiera de las dos desde que está listo.
 * @returns {{estadoCaso:object, gancho:object|null}}
 */
export function ganchoFueraDeEscena(estadoCaso, estadoMundo) {
  const libresDe = (h) => {
    const contadas = escenasYaContadas(h, estadoCaso, estadoMundo);
    return (escenasDeEntrega(h, estadoCaso, estadoMundo) ?? []).filter((e) => !contadas.includes(e));
  };
  const hito = listosPorPrioridad(estadoCaso, estadoMundo).find(
    (h) => !entregableAca(h, estadoCaso, estadoMundo) && libresDe(h).length > 0,
  );
  if (!hito) return { estadoCaso, gancho: null };

  const libres = libresDe(hito);
  const principal = escenaDeEntrega(hito, estadoCaso, estadoMundo);
  const alternativa = escenaAlternativa(hito, estadoCaso, estadoMundo);
  const desde = estadoCaso.listosDesde?.[hito.id] ?? estadoMundo.hora;
  const vencido = estadoMundo.hora - desde >= HORAS_GANCHO;
  const usaAlternativa = libres.includes(alternativa) && (vencido || !libres.includes(principal));
  const escena = usaAlternativa ? alternativa : libres[0];

  let estado = estadoCaso;
  let movido = false;
  if (usaAlternativa && vencido && estadoCaso.entregasMovidas?.[hito.id] !== alternativa) {
    estado = { ...estadoCaso, entregasMovidas: { ...(estadoCaso.entregasMovidas ?? {}), [hito.id]: alternativa } };
    movido = true;
  }

  const nombrada = usaAlternativa ? hito.escena_alternativa : hito.escena_entrega;
  const deRanura = typeof nombrada === 'string' ? nombrada.match(/^escena\((p\d)\)$/) : null;
  const npcId = deRanura
    ? pistaDe(estado, deRanura[1])?.npcId ?? null
    : pistasDe(estado).map((p) => p.npcId).find((id) => escenaDeNpc(estadoMundo, id) === escena) ?? null;
  return { estadoCaso: estado, gancho: { hitoId: hito.id, escena, npcId, movido } };
}

// ---------- Anti-traba: una función por regla. Cada una devuelve el estado del caso (el mismo si no aplica). ----------

/** ¿El hito pide alguna pista en nivel "entendida" o más? (es lo que se puede bajar a "vista") */
function pidePistaEntendida(hito) {
  const c = hito.condiciones ?? {};
  const porTag = lista(c.tags).some((t) => t.tipo === 'pista_conocida' && t.op === '>=' && t.nivel >= NIVEL_ENTENDIDA);
  const porConteo = c.pistas?.cantidad !== undefined && (c.pistas.nivel ?? NIVEL_ENTENDIDA) >= NIVEL_ENTENDIDA;
  return porTag || porConteo;
}

/**
 * 8 turnos sin hitos listos → baja el umbral de pista del siguiente hito alcanzable (vista en lugar de entendida).
 * Siguiente alcanzable: el de menor id, no alcanzado ni bloqueado, con sus requiere_hitos cumplidos, que pida una pista entendida.
 */
export function antiTrabaSinListos(estadoCaso, estadoMundo) {
  if ((estadoCaso.hitosListos ?? []).length > 0) return estadoCaso;
  const desde = estadoCaso.sinListosDesde;
  if (desde === null || desde === undefined || estadoMundo.turno - desde < TURNOS_SIN_LISTOS) return estadoCaso;
  const bajados = estadoCaso.umbralesBajados ?? [];
  const siguiente = [...hitosDe(estadoMundo)].sort(porId).find(
    (h) =>
      disponible(h, estadoCaso) &&
      !bajados.includes(h.id) &&
      pidePistaEntendida(h) &&
      cumpleRequiereHitos(h.condiciones?.requiere_hitos, estadoCaso.hitosAlcanzados ?? []),
  );
  if (!siguiente) return estadoCaso;
  return { ...estadoCaso, umbralesBajados: [...bajados, siguiente.id], sinListosDesde: estadoMundo.turno };
}

/**
 * Un NPC de ranura con rencor grave → se habilitan sus hitos de reparación (los de npc_reparacion = ese NPC, sin
 * repara_rencor_grave) sin otras condiciones, mientras le falte progreso. Las tres condiciones de la reparación
 * explícita no se saltean.
 */
export function antiTrabaRencorGrave(estadoCaso, estadoMundo) {
  const conRencorGrave = pistasDe(estadoCaso)
    .map((p) => p.npcId)
    .filter(
      (npcId) =>
        nivelDeTag(estadoCaso.tags ?? [], 'rencor', npcId) === NIVEL_MAX &&
        new Set(progresoDeReparacion(estadoCaso, npcId)).size < REPARACIONES_PREVIAS,
    );
  if (conRencorGrave.length === 0) return estadoCaso;
  const habilitados = estadoCaso.reparacionHabilitada ?? [];
  const nuevos = [...hitosDe(estadoMundo)]
    .sort(porId)
    .filter(
      (h) =>
        esPasoDeReparacion(h) &&
        !(estadoCaso.hitosBloqueados ?? []).includes(h.id) &&
        !habilitados.includes(h.id) &&
        conRencorGrave.includes(npcDeReparacion(h, estadoCaso, estadoMundo)),
    )
    .map((h) => h.id);
  if (nuevos.length === 0) return estadoCaso;
  return { ...estadoCaso, reparacionHabilitada: [...habilitados, ...nuevos] };
}

/**
 * 24 horas de reloj sin avance → pista_conocida nivel 1 de la siguiente ranura habilitada.
 * Avance: el último hito disparado (o la instanciación) o la última siembra.
 */
export function antiTrabaSinAvance(estadoCaso, estadoMundo) {
  const desde = estadoCaso.ultimoAvance?.hora ?? estadoCaso.hitoPrevio?.hora ?? 0;
  if (estadoMundo.hora - desde < HORAS_SIN_AVANCE) return estadoCaso;
  const pista = siguienteRanuraHabilitada(estadoCaso);
  if (!pista) return estadoCaso;
  const tags = escribirTag(estadoCaso.tags ?? [], {
    tipo: 'pista_conocida',
    objetivo: pista.conocimientoId,
    nivel: NIVEL_VISTA,
    hora: estadoMundo.hora,
    hito: estadoCaso.contadorHitos ?? 0,
    casoId: estadoCaso.casoId ?? null,
    origen: 'anti_traba:sin_avance',
  });
  return { ...estadoCaso, tags, ultimoAvance: { hora: estadoMundo.hora } };
}

/** Todos los finales bloqueados → se habilita el desenlace neutro por abandono. */
export function antiTrabaFinalesBloqueados(estadoCaso, estadoMundo) {
  if (estadoCaso.abandonoHabilitado) return estadoCaso;
  const finales = hitosDe(estadoMundo).filter((h) => h.final);
  const bloqueados = estadoCaso.hitosBloqueados ?? [];
  if (finales.length === 0 || !finales.every((h) => bloqueados.includes(h.id))) return estadoCaso;
  return { ...estadoCaso, abandonoHabilitado: true };
}

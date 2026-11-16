// Hitos del motor de caso (docs/motor-caso-v1-operativo.md, sección 5).
// Funciones puras: reciben el estado del caso y el del mundo y devuelven estados nuevos.
//
// estadoCaso: {
//   casoId, instancia: { pistas: [{ ranura, conocimientoId, npcId, orden }] },
//   tags, contadorHitos, hitoPrevio: { id, hora, escena, contador },
//   hitosAlcanzados: [id], hitosListos: [id], listosDesde: { id: hora }, hitosBloqueados: [id],
//   entregasMovidas: { id: escena }, reparados: [npcId], umbralesBajados: [id], reparacionHabilitada: [id],
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

/** NPCs de ranura con un tag medio o grave que una reparación de este hito puede quitar, sin reparar todavía. */
export function npcsPorReparar(hito, estadoCaso) {
  const tags = estadoCaso.tags ?? [];
  const reparados = estadoCaso.reparados ?? [];
  const pendiente = (npcId) =>
    TAGS_REPARABLES.some((tipo) => {
      const nivel = nivelDeTag(tags, tipo, npcId);
      if (nivel < NIVEL_ENTENDIDA) return false;
      return !(tipo === 'rencor' && nivel === NIVEL_MAX && !hito.repara_rencor_grave);
    });
  return [...pistasDe(estadoCaso)]
    .sort((a, b) => a.orden - b.orden)
    .map((p) => p.npcId)
    .filter((npcId, i, todos) => todos.indexOf(npcId) === i && !reparados.includes(npcId) && pendiente(npcId));
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
 * Un hito de reparación habilitado por anti-traba (rencor grave) se cumple sin otras condiciones.
 */
export function evaluarCondiciones(hito, estadoCaso, estadoMundo) {
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

/** Un hito ya disparado no vuelve, salvo el de reparación mientras quede un NPC por reparar. */
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

/** Escena donde se entrega el hito: la movida por el gancho, la fija, la del dueño de una ranura, o null (cualquiera). */
export function escenaDeEntrega(hito, estadoCaso, estadoMundo) {
  const movida = estadoCaso.entregasMovidas?.[hito.id];
  if (movida) return movida;
  if (hito.escena_entrega === null || hito.escena_entrega === undefined) return null;
  return resolver(hito.escena_entrega, estadoCaso, estadoMundo);
}

/** Hitos listos, en orden de prioridad: reparación con tags pendientes > el que bloquea ramas > menor id. */
function listosPorPrioridad(estadoCaso, estadoMundo) {
  const ids = estadoCaso.hitosListos ?? [];
  const peso = (h) => (h.es_reparacion && npcsPorReparar(h, estadoCaso).length > 0 ? 0 : lista(h.bloquea).length > 0 ? 1 : 2);
  return hitosDe(estadoMundo)
    .filter((h) => ids.includes(h.id))
    .sort((a, b) => peso(a) - peso(b) || porId(a, b));
}

const entregableAca = (hito, estadoCaso, estadoMundo) => {
  const escena = escenaDeEntrega(hito, estadoCaso, estadoMundo);
  return escena === null || escena === estadoMundo.escena;
};

/**
 * Hito a disparar este turno, o null. Máximo 1 por turno: si ya se disparó uno en este turno, null.
 * Solo entran los listos cuya escena de entrega es la del jugador, o null.
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
 * La reparación va sobre `hito.npc_reparacion` (si lo trae) o sobre el primer NPC de ranura con algo por reparar:
 * quita un tag medio/grave, baja el resto 1, suma +15 de relación y levanta bloqueadoConocimientos. Una vez por NPC.
 * @returns {{estadoCaso:object, estadoMundo:object, hito:object, reparado:string|null}}
 */
export function dispararHito(hito, estadoCaso, estadoMundo) {
  const contadorHitos = (estadoCaso.contadorHitos ?? 0) + 1;
  const marca = { hora: estadoMundo.hora, hito: contadorHitos, casoId: estadoCaso.casoId ?? null, origen: `hito:${hito.id}` };

  let mundo = estadoMundo;
  let tags = estadoCaso.tags ?? [];
  for (const efecto of lista(hito.efectos)) {
    ({ tags, estadoMundo: mundo } = aplicarEfecto(efecto, tags, estadoCaso, mundo, marca));
  }

  const bloqueados = [...new Set([...(estadoCaso.hitosBloqueados ?? []), ...lista(hito.bloquea)])];

  let reparados = estadoCaso.reparados ?? [];
  let reparado = null;
  if (hito.es_reparacion) {
    const conTags = { ...estadoCaso, tags };
    const pedido = hito.npc_reparacion ? resolver(hito.npc_reparacion, estadoCaso, mundo) : null;
    const pendientes = npcsPorReparar(hito, conTags);
    const npcId = pedido ? (pendientes.includes(pedido) ? pedido : null) : (pendientes[0] ?? null);
    if (npcId) {
      tags = aplicarReparacion(conTags, npcId, { reparaRencorGrave: hito.repara_rencor_grave === true }).tags;
      mundo = cambiarNpc(mundo, npcId, (npc) => ({
        relacion: acotarRelacion((npc.relacion ?? 0) + RELACION_REPARACION),
        bloqueadoConocimientos: false,
      }));
      reparados = [...reparados, npcId];
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

/** NPC de ranura más cercano al jugador: por `estadoMundo.distancia` si viene; si no, el de su escena o el primero en el orden. */
function npcDeRanuraMasCercano(estadoCaso, estadoMundo) {
  const conEscena = [...pistasDe(estadoCaso)]
    .sort((a, b) => a.orden - b.orden)
    .map((p) => ({ npcId: p.npcId, escena: escenaDeNpc(estadoMundo, p.npcId) }))
    .filter((p) => p.escena);
  if (conEscena.length === 0) return null;
  const distancia = (escena) => {
    if (escena === estadoMundo.escena) return 0;
    return typeof estadoMundo.distancia === 'function' ? estadoMundo.distancia(estadoMundo.escena, escena) : 1;
  };
  return conEscena.reduce((mejor, p) => (distancia(p.escena) < distancia(mejor.escena) ? p : mejor));
}

/**
 * Gancho de un hito listo que no se puede entregar en la escena del jugador.
 * Devuelve el del hito de mayor prioridad: { hitoId, escena, npcId, movido }. npcId: el NPC de ranura que está en
 * esa escena (o el de la ranura de `escena(pN)`); null si no hay ninguno.
 * A las 12 horas de reloj de estar listo sin entregarse, la entrega se mueve a la escena del NPC de ranura
 * más cercano, salvo que el hito tenga `escena_alternativa: false`.
 * @returns {{estadoCaso:object, gancho:object|null}}
 */
export function ganchoFueraDeEscena(estadoCaso, estadoMundo) {
  const hito = listosPorPrioridad(estadoCaso, estadoMundo).find((h) => !entregableAca(h, estadoCaso, estadoMundo));
  if (!hito) return { estadoCaso, gancho: null };

  let estado = estadoCaso;
  let movido = false;
  const desde = estadoCaso.listosDesde?.[hito.id] ?? estadoMundo.hora;
  const yaMovida = estadoCaso.entregasMovidas?.[hito.id] !== undefined;
  if (!yaMovida && hito.escena_alternativa !== false && estadoMundo.hora - desde >= HORAS_GANCHO) {
    const cercano = npcDeRanuraMasCercano(estadoCaso, estadoMundo);
    if (cercano && cercano.escena !== escenaDeEntrega(hito, estadoCaso, estadoMundo)) {
      estado = { ...estadoCaso, entregasMovidas: { ...(estadoCaso.entregasMovidas ?? {}), [hito.id]: cercano.escena } };
      movido = true;
    }
  }

  const escena = escenaDeEntrega(hito, estado, estadoMundo);
  // Se movió a la escena del jugador: ya se puede entregar acá, no hace falta gancho.
  if (escena === estadoMundo.escena) return { estadoCaso: estado, gancho: null };
  const deRanura = typeof hito.escena_entrega === 'string' && !movido && !yaMovida ? hito.escena_entrega.match(/^escena\((p\d)\)$/) : null;
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
 * Un NPC de ranura con rencor grave (sin reparar) → se habilita el hito de reparación sin otras condiciones.
 * Se prefiere el hito con repara_rencor_grave; sin él no hay nada que habilitar (una reparación común no quita rencor grave).
 */
export function antiTrabaRencorGrave(estadoCaso, estadoMundo) {
  const reparados = estadoCaso.reparados ?? [];
  const hayRencorGrave = pistasDe(estadoCaso).some(
    (p) => !reparados.includes(p.npcId) && nivelDeTag(estadoCaso.tags ?? [], 'rencor', p.npcId) === NIVEL_MAX,
  );
  if (!hayRencorGrave) return estadoCaso;
  const habilitados = estadoCaso.reparacionHabilitada ?? [];
  const hito = [...hitosDe(estadoMundo)]
    .sort(porId)
    .find((h) => h.es_reparacion && h.repara_rencor_grave && !(estadoCaso.hitosBloqueados ?? []).includes(h.id));
  if (!hito || habilitados.includes(hito.id)) return estadoCaso;
  return { ...estadoCaso, reparacionHabilitada: [...habilitados, hito.id] };
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

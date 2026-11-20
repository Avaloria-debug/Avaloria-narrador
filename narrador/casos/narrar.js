// Un turno del motor de caso (docs/motor-caso-v1-operativo.md §5, §8, §9).
// Integra acciones → tags, decaimiento, anti-traba, hitos, texto, desenlace y persistencia.
//
// Orden (§5, ciclo por turno):
//   1. Acción → tags (y relación). Traición (rencor sobre un NPC): gratitud grave baja a medio y, si el NPC es el
//      npc_reparacion de algún hito del caso, se reinicia su progreso de reparación.
//   2. Reloj → decaimiento por horas (solo si avanzó).
//   3. Anti-traba y condiciones cumplidas → hitosListos.
//   4. Disparar si el jugador está en escena_entrega o escena_alternativa.
//   5. Prioridad: reparación > bloquea ramas > menor id. Máx. 1 por turno.
//   6. Al disparar: contadorHitos+1, hitoPrevio, efectos, bloqueos, decaimiento por hitos, texto (§8).
//   Sin disparo: gancho fuera de escena. Final alcanzado o abandono: desenlace (§9).

import { crearRng, semillaAEntero } from '../azar.js';
import { escribirTag, subirTag, quitarTag, ajustarReputacion, aplicarTraicion, deltaRelacion } from './tags.js';
import { tagsDeAccion, OBJETIVOS, OPS } from './acciones.js';
import { aplicarDecaimientoPorHoras } from './decaimiento.js';
import {
  actualizarListos, elegirDisparo, dispararHito, ganchoFueraDeEscena, resolver, reiniciarProgresoReparacion,
  antiTrabaSinListos, antiTrabaRencorGrave, antiTrabaSinAvance, antiTrabaFinalesBloqueados, antiTrabaCaminoP1,
} from './hitos.js';
import { elegirDesenlace, aplicarDesenlace } from './desenlaces.js';

const lista = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const acotar = (n) => Math.max(-100, Math.min(100, n));

/** Id concreto de una clase de objetivo de la acción, o null si la acción no lo trae. */
function objetivoDe(clase, accion, mundo) {
  switch (clase) {
    case OBJETIVOS.NPC: return accion.npcId ?? null;
    case OBJETIVOS.ESCENA: return accion.escenaId ?? mundo.escena ?? null;
    case OBJETIVOS.JUGADOR: return 'jugador';
    case OBJETIVOS.CIUDAD: return accion.ciudad ?? null;
    case OBJETIVOS.CONOCIMIENTO: return accion.conocimientoId ?? null;
    case OBJETIVOS.BANDO: return accion.bando ?? null;
    case OBJETIVOS.FACCION: return accion.faccion ?? null;
    case OBJETIVOS.CAMINO: return accion.camino ?? null;
    default: return null;
  }
}

/** NPCs que son npc_reparacion de algún hito del caso, en esta instancia. */
function npcsDeReparacion(caso, estadoCaso, mundo) {
  const ids = new Set();
  for (const h of lista(caso?.hitos)) {
    if (!h.es_reparacion || !h.npc_reparacion) continue;
    try {
      ids.add(resolver(h.npc_reparacion, estadoCaso, mundo));
    } catch {
      // ranura que la instancia no tiene: no cuenta
    }
  }
  return ids;
}

/**
 * Paso 1: la acción escribe sus tags. Devuelve { estadoCaso, npcs, traicionados }.
 * Las filas cuyo objetivo la acción no trae no se escriben.
 */
export function aplicarAccion(estadoCaso, accion, mundo, caso) {
  if (!accion?.accionId) return { estadoCaso, npcs: mundo.npcs, traicionados: [] };
  const marca = { hora: mundo.hora, hito: estadoCaso.contadorHitos ?? 0, casoId: estadoCaso.casoId ?? null, origen: `accion:${accion.accionId}` };
  let tags = estadoCaso.tags ?? [];
  let npcs = mundo.npcs ?? {};
  const traicionados = [];
  for (const op of tagsDeAccion(accion.accionId, accion.contexto ?? {})) {
    const objetivo = objetivoDe(op.objetivo, accion, mundo);
    if (!objetivo) continue;
    if (op.op === OPS.QUITAR) tags = quitarTag(tags, op.tipo, objetivo);
    else if (op.op === OPS.REPUTACION) tags = ajustarReputacion(tags, { objetivo, paso: op.paso, ...marca });
    else if (op.op === OPS.SUBIR) tags = subirTag(tags, { tipo: op.tipo, objetivo, ...marca });
    else {
      tags = escribirTag(tags, { tipo: op.tipo, objetivo, nivel: op.nivel, ...marca });
      const delta = deltaRelacion(op.tipo, op.nivel);
      if (delta !== 0 && npcs[objetivo]) npcs = { ...npcs, [objetivo]: { ...npcs[objetivo], relacion: acotar((npcs[objetivo].relacion ?? 0) + delta) } };
    }
    if (op.tipo === 'rencor' && op.objetivo === OBJETIVOS.NPC && op.op !== OPS.QUITAR) {
      tags = aplicarTraicion(tags, objetivo);
      traicionados.push(objetivo);
    }
  }
  let nuevo = { ...estadoCaso, tags };
  const deReparacion = npcsDeReparacion(caso, nuevo, { ...mundo, npcs });
  const reiniciar = traicionados.filter((id) => deReparacion.has(id));
  if (reiniciar.length > 0) nuevo = reiniciarProgresoReparacion(nuevo, reiniciar);
  return { estadoCaso: nuevo, npcs, traicionados };
}

/**
 * Reemplaza `{npc:pN}` por el nombre del dueño, `{conocimiento:pN}` por el contenido del conocimiento y
 * `{escena:pN}` por el nombre de la escena donde está el dueño (necesita `mundo`).
 */
/**
 * Conocimientos que un texto de hito narra con `{conocimiento:pN}`: quedan revelados para las consultas siguientes,
 * así la respuesta de una consulta no contradice lo que el jugador acaba de leer.
 * @returns {{ npcId: string, conocimientoId: string }[]}
 */
export function conocimientosNarrados(texto, estadoCaso) {
  const pistas = estadoCaso.instancia?.pistas ?? [];
  const vistos = [];
  for (const [, ranura] of String(texto).matchAll(/\{conocimiento:(p\d+)\}/g)) {
    const pista = pistas.find((p) => p.ranura === ranura);
    if (pista?.npcId && pista.conocimientoId && !vistos.some((v) => v.conocimientoId === pista.conocimientoId)) {
      vistos.push({ npcId: pista.npcId, conocimientoId: pista.conocimientoId });
    }
  }
  return vistos;
}

export function completarMarcadores(texto, estadoCaso, contenido, mundo = null) {
  const pistas = estadoCaso.instancia?.pistas ?? [];
  return String(texto).replace(/\{(npc|conocimiento|escena):(p\d+)\}/g, (todo, clase, ranura) => {
    const pista = pistas.find((p) => p.ranura === ranura);
    const npc = (contenido?.npcs ?? []).find((n) => n.id === pista?.npcId);
    if (!pista || !npc) return todo;
    if (clase === 'npc') return npc.nombre ?? todo;
    if (clase === 'escena') {
      const escenaId = mundo?.npcs?.[pista.npcId]?.escena ?? null;
      return (contenido?.escenas ?? []).find((e) => e.id === escenaId)?.nombre ?? todo;
    }
    return (npc.conocimientos ?? []).find((k) => k.id === pista.conocimientoId)?.contenido ?? todo;
  });
}

/**
 * Elige el texto de un hito (§8): los 4 menos los ya usados en la partida; menor uso del jugador; empate por semilla.
 * @param {Map<string, number>} usos uso de cada texto por el jugador
 */
export function elegirTexto(hito, estadoCaso, usos, semilla) {
  const textos = lista(hito.textos);
  if (textos.length === 0) return null;
  const usados = estadoCaso.textosUsados ?? [];
  const libres = textos.filter((t) => !usados.includes(t.id));
  const pool = libres.length > 0 ? libres : textos;
  const menor = Math.min(...pool.map((t) => usos.get(t.id) ?? 0));
  const empatados = pool.filter((t) => (usos.get(t.id) ?? 0) === menor);
  const rng = crearRng(semillaAEntero(`${semilla}:${hito.id}:${estadoCaso.contadorHitos ?? 0}`));
  return empatados[Math.floor(rng() * empatados.length)];
}

/**
 * Un turno del motor de caso.
 * @param {{
 *   estadoCaso: object, caso: object,
 *   accion?: {accionId:string, npcId?, conocimientoId?, escenaId?, ciudad?, bando?, faccion?, camino?, contexto?}|null,
 *   mundo: {hora:number, turno:number, escena:string, estadoEvento:string, npcs:object, distancia?:Function},
 *   horasAvanzadas?: number, sinDesenlace?: boolean, contenido?: object, semilla?: number|string, abandonar?: boolean,
 *   persistencia?: object|null, jugadorId?: string|null, partidaId?: string|null,
 * }} p
 * @returns {Promise<{estadoCaso, npcs, hito, reparado, texto:{id,texto}|null, gancho, desenlace, pistaCamino}>}
 */
export async function turnoDeCaso(p) {
  const { caso, contenido = null, semilla = 0, persistencia = null, jugadorId = null, partidaId = null } = p;
  const horasAvanzadas = p.horasAvanzadas ?? 0;
  const vacio = { hito: null, reparado: null, texto: null, gancho: null, desenlace: null, revelados: [] };
  if (p.estadoCaso?.cerrado) return { estadoCaso: p.estadoCaso, npcs: p.mundo.npcs, ...vacio };

  // 1. Acción → tags.
  const accion = aplicarAccion(p.estadoCaso, p.accion, p.mundo, caso);
  let estado = accion.estadoCaso;
  let mundo = { ...p.mundo, caso, npcs: accion.npcs };

  // 2. Reloj → decaimiento por horas.
  const { hora: _hora, ...decaido } = aplicarDecaimientoPorHoras({ ...estado, hora: mundo.hora }, horasAvanzadas);
  estado = decaido;

  // 3. Anti-traba y listos.
  estado = antiTrabaSinAvance(estado, mundo);
  estado = antiTrabaRencorGrave(estado, mundo);
  estado = actualizarListos(estado, mundo);
  const caminoP1 = antiTrabaCaminoP1(estado, mundo);
  estado = caminoP1.estadoCaso;
  if (caminoP1.camino) estado = actualizarListos(estado, mundo);
  const antes = estado;
  estado = antiTrabaSinListos(estado, mundo);
  if (estado !== antes) estado = actualizarListos(estado, mundo);
  estado = antiTrabaFinalesBloqueados(estado, mundo);

  // 4–6. Disparo, texto o gancho.
  let hito = null;
  let reparado = null;
  let texto = null;
  let gancho = null;
  let usoTexto = null;
  let revelados = [];
  // `sinDesenlace` (consultas): un hito final no se dispara; queda para un turno de acción.
  const candidato = elegirDisparo(estado, mundo);
  const elegido = p.sinDesenlace === true && candidato?.final ? null : candidato;
  if (elegido) {
    const r = dispararHito(elegido, estado, mundo);
    estado = r.estadoCaso;
    mundo = r.estadoMundo;
    hito = elegido;
    reparado = r.reparado;
    const usos = new Map();
    if (persistencia && jugadorId) {
      for (const t of lista(elegido.textos)) usos.set(t.id, await persistencia.usoDeTexto(jugadorId, t.id));
    }
    const t = elegirTexto(elegido, estado, usos, semilla);
    if (t) {
      texto = { id: t.id, texto: completarMarcadores(t.texto, estado, contenido) };
      revelados = conocimientosNarrados(t.texto, estado);
      estado = { ...estado, textosUsados: [...(estado.textosUsados ?? []), t.id] };
      usoTexto = t.id;
    }
  } else {
    const g = ganchoFueraDeEscena(estado, mundo);
    estado = g.estadoCaso;
    gancho = g.gancho;
  }

  // Pista de camino a p1: se narra solo si el caso trae textos_pista_camino (sin texto, queda el tag).
  let pistaCamino = null;
  if (caminoP1.camino) {
    const t = elegirTexto({ id: 'pista_camino_p1', textos: caso?.textos_pista_camino }, estado, new Map(), semilla);
    pistaCamino = { ...caminoP1.camino, texto: t ? { id: t.id, texto: completarMarcadores(t.texto, estado, contenido, mundo) } : null };
    if (!texto && pistaCamino.texto) texto = pistaCamino.texto;
  }

  // Desenlace: al alcanzar un final o al abandonar.
  let desenlace = null;
  if (p.sinDesenlace !== true && ((hito?.final && estado.finalAlcanzado) || p.abandonar === true)) {
    desenlace = elegirDesenlace(caso, estado, mundo).desenlace;
    estado = aplicarDesenlace(desenlace, estado, mundo);
  }

  // Persistencia: una transacción por turno.
  if (persistencia && (partidaId || (usoTexto && jugadorId))) {
    await persistencia.turno(async (t) => {
      if (usoTexto && jugadorId) await t.sumarUsoTexto(jugadorId, usoTexto);
      if (partidaId) await t.guardarEstadoCaso(partidaId, estado);
    });
  }

  return { estadoCaso: estado, npcs: mundo.npcs, hito, reparado, texto, gancho, desenlace, pistaCamino, revelados };
}

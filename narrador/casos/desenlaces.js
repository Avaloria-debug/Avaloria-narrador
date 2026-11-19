// Desenlaces del motor de caso (docs/motor-caso-v1-operativo.md §9; docs/motor-caso-v1.md §8).
// Funciones puras: eligen el desenlace al final o al abandonar, y aplican sus efectos_post.
//
// Desenlace: { id, tipo: 'positivo'|'neutro'|'negativo', requiere: Condiciones (§2b), prioridad, efectos_post: Efecto[] }
// Orden: candidatos con requiere cumplido → mayor prioridad → mayor coincidencia → neutro default.
// Negativos: solo si su requiere trae una condición causada por el jugador (un tag que el jugador escribió, con `>=` o `==`).
// Nunca por azar ni como default.

import { evaluarCondiciones, resolver } from './hitos.js';
import { escribirTag, subirTag, quitarTag, ajustarReputacion, TIPOS_TAG } from './tags.js';
import { aplicarCierreDeCaso, TABLA_DECAIMIENTO, CIERRE } from './decaimiento.js';

export const TIPOS_DESENLACE = Object.freeze(['positivo', 'neutro', 'negativo']);

/** Tags que duran hasta el cierre del caso: un efecto_post no puede escribirlos. */
export const TAGS_CIERRE = Object.freeze(TIPOS_TAG.filter((t) => TABLA_DECAIMIENTO[t].every((r) => r === CIERRE)));

const lista = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const condicionesDe = (requiere) => (requiere && typeof requiere === 'object' ? requiere : {});

/** ¿El requiere está vacío? (sin ninguna condición) */
export const requiereVacio = (desenlace) => Object.keys(condicionesDe(desenlace.requiere)).length === 0;

/** El neutro por defecto: tipo neutro y requiere vacío. */
export const esNeutroDefault = (d) => d.tipo === 'neutro' && requiereVacio(d);

/** Condiciones de tag causadas por el jugador: piden que un tag exista (>=, == con nivel ≥ 1). */
function condicionesDelJugador(desenlace) {
  return lista(condicionesDe(desenlace.requiere).tags).filter((t) => (t.op === '>=' || t.op === '==') && t.nivel >= 1);
}

/** Un negativo vale solo si su requiere tiene al menos una condición causada por el jugador. */
export const negativoValido = (d) => d.tipo !== 'negativo' || condicionesDelJugador(d).length > 0;

/** Coincidencia: cuántas condiciones de tag del requiere se cumplen. */
export function coincidencia(desenlace, estadoCaso, estadoMundo) {
  return lista(condicionesDe(desenlace.requiere).tags).filter((t) =>
    evaluarCondiciones({ id: '_coincidencia', condiciones: { tags: [t] } }, estadoCaso, estadoMundo),
  ).length;
}

/** ¿Se cumple el requiere del desenlace? */
export function cumpleRequiere(desenlace, estadoCaso, estadoMundo) {
  return evaluarCondiciones({ id: `_${desenlace.id}`, condiciones: condicionesDe(desenlace.requiere) }, estadoCaso, estadoMundo);
}

/**
 * Elige el desenlace del caso.
 * @param {{desenlaces:object[]}} caso
 * @param {object} estadoCaso
 * @param {object} estadoMundo
 * @returns {{desenlace:object, porDefecto:boolean}}
 */
export function elegirDesenlace(caso, estadoCaso, estadoMundo) {
  const desenlaces = lista(caso?.desenlaces);
  const porDefecto = desenlaces.find(esNeutroDefault);
  if (!porDefecto) throw new Error(`desenlaces: el caso "${caso?.id}" no tiene neutro por defecto`);
  const candidatos = desenlaces
    .filter((d) => d !== porDefecto && !requiereVacio(d))
    .filter((d) => negativoValido(d) && cumpleRequiere(d, estadoCaso, estadoMundo))
    .map((d) => ({ d, prioridad: d.prioridad ?? 0, coincide: coincidencia(d, estadoCaso, estadoMundo) }))
    .sort((a, b) => b.prioridad - a.prioridad || b.coincide - a.coincide || desenlaces.indexOf(a.d) - desenlaces.indexOf(b.d));
  if (candidatos.length === 0) return { desenlace: porDefecto, porDefecto: true };
  return { desenlace: candidatos[0].d, porDefecto: false };
}

/** Efectos_post que escriben un tag de cierre de caso (no permitidos). */
export const efectosDeCierre = (desenlace) => lista(desenlace.efectos_post).filter((e) => TAGS_CIERRE.includes(e.tipo));

/**
 * Aplica el desenlace: efectos_post y luego el cierre de caso (se quitan los tags de cierre).
 * Lanza si un efecto_post escribe un tag de cierre.
 * @returns {object} estadoCaso con `desenlaceId` y `cerrado: true`
 */
export function aplicarDesenlace(desenlace, estadoCaso, estadoMundo) {
  const prohibidos = efectosDeCierre(desenlace);
  if (prohibidos.length > 0) throw new Error(`desenlaces: "${desenlace.id}" escribe tags de cierre (${prohibidos.map((e) => e.tipo).join(', ')})`);
  const marca = { hora: estadoMundo.hora, hito: estadoCaso.contadorHitos ?? 0, casoId: estadoCaso.casoId ?? null, origen: `desenlace:${desenlace.id}` };
  let tags = estadoCaso.tags ?? [];
  for (const efecto of lista(desenlace.efectos_post)) {
    const objetivo = resolver(efecto.objetivo, estadoCaso, estadoMundo);
    const op = efecto.op ?? 'escribir';
    if (op === 'quitar') tags = quitarTag(tags, efecto.tipo, objetivo);
    else if (op === 'reputacion') tags = ajustarReputacion(tags, { objetivo, paso: efecto.paso, ...marca });
    else if (op === 'subir') tags = subirTag(tags, { tipo: efecto.tipo, objetivo, ...marca });
    else tags = escribirTag(tags, { tipo: efecto.tipo, objetivo, nivel: efecto.nivel, ...marca });
  }
  const cerrado = aplicarCierreDeCaso({ ...estadoCaso, tags });
  return { ...cerrado, desenlaceId: desenlace.id, cerrado: true };
}

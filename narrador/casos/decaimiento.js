// Decaimiento de tags (docs/motor-caso-v1-operativo.md, sección 7).
// Dos relojes: horas del reloj del mundo (solo cuando avanza) y contador de hitos (global de la partida).
// Funciones puras sobre el estado del caso: { tags, hora, contadorHitos, ... } → estado nuevo.
//  - estado.hora: hora total del reloj del mundo, ya avanzada.
//  - estado.contadorHitos: hitos disparados en la partida, ya sumado el que se acaba de disparar.
// Cada tag cuenta desde su creadoHora / creadoHito (escribirlo de nuevo reinicia la cuenta: ver tags.js).

import { TIPOS_TAG, NIVEL_MIN, NIVEL_MAX } from './tags.js';

export const RELOJES = Object.freeze({ HORAS: 'horas', HITOS: 'hitos' });

/** Cómo termina un plazo: el tag se quita, baja un paso (hacia 0) o sube un nivel. */
export const EFECTOS = Object.freeze({ QUITAR: 'quitar', BAJAR: 'bajar', SUBIR: 'subir' });

/** No decae con ningún reloj: solo por reparación, traición, respuesta o pago, o nunca. */
const NO = null;
/** Se quita al cerrar el caso. */
export const CIERRE = 'cierre';

const horas = (plazo, efecto = EFECTOS.QUITAR) => ({ reloj: RELOJES.HORAS, plazo, efecto });
const hitos = (plazo, efecto = EFECTOS.QUITAR) => ({ reloj: RELOJES.HITOS, plazo, efecto });
/** La misma regla para los tres niveles. */
const siempre = (regla) => [regla, regla, regla];

/** Regla por tipo de tag y nivel: [leve, medio, grave]. */
export const TABLA_DECAIMIENTO = Object.freeze({
  desconfianza: [hitos(2), hitos(4), NO],
  rencor: [hitos(3), NO, NO],
  gratitud: [hitos(3), hitos(6), NO],
  miedo: [horas(6), horas(24), NO],
  curiosidad: [hitos(4), hitos(4), NO],
  deuda_personal: [hitos(4, EFECTOS.SUBIR), hitos(4, EFECTOS.SUBIR), NO],
  favor_debido: siempre(hitos(6)),
  secreto_compartido: siempre(NO),
  reputacion_ciudad: siempre(horas(24, EFECTOS.BAJAR)),
  fama_violenta: siempre(horas(12, EFECTOS.BAJAR)),
  vigilancia_escena: [horas(3), horas(6), horas(12)],
  chisme_activo: siempre(horas(6)),
  pista_conocida: siempre(NO),
  lealtad_caravana: siempre(hitos(8)),
  alerta_camino: siempre(horas(6)),
  sospecha_crimen: siempre(CIERRE),
  favor_casa_aster: siempre(CIERRE),
  favor_archivo: siempre(CIERRE),
  pacto_caso: siempre(CIERRE),
  alianza_npc: siempre(CIERRE),
});

/** Tags que una reparación puede quitar o bajar. */
export const TAGS_REPARABLES = Object.freeze(['rencor', 'desconfianza', 'miedo']);
const NIVEL_MEDIO = 2;

/** Regla de un tag en su nivel actual (reputacion_ciudad usa el valor absoluto). */
export function reglaDe(tag) {
  const fila = TABLA_DECAIMIENTO[tag.tipo];
  if (!fila) throw new Error(`decaimiento: tipo de tag desconocido "${tag.tipo}"`);
  const nivel = Math.max(NIVEL_MIN, Math.min(NIVEL_MAX, Math.abs(tag.nivel)));
  return fila[nivel - 1];
}

/**
 * Aplica a un tag los plazos cumplidos de un reloj. Devuelve el tag (igual o cambiado) o null si se quita.
 * `ahora` es la hora o el contador de hitos; `campo` es creadoHora o creadoHito.
 */
function decaerTag(tag, reloj, ahora, campo) {
  let actual = tag;
  for (;;) {
    const regla = reglaDe(actual);
    if (!regla || regla === CIERRE || regla.reloj !== reloj) return actual;
    if (ahora - actual[campo] < regla.plazo) return actual;
    if (regla.efecto === EFECTOS.QUITAR) return null;
    // Por pasos: un paso por plazo cumplido; la cuenta sigue desde el fin de ese plazo.
    const nivel = regla.efecto === EFECTOS.SUBIR ? actual.nivel + 1 : actual.nivel - Math.sign(actual.nivel);
    if (nivel === 0) return null;
    actual = { ...actual, nivel, [campo]: actual[campo] + regla.plazo };
  }
}

function decaer(estado, reloj, ahora, campo) {
  const tags = [];
  let cambio = false;
  for (const tag of estado.tags ?? []) {
    const nuevo = decaerTag(tag, reloj, ahora, campo);
    if (nuevo !== tag) cambio = true;
    if (nuevo) tags.push(nuevo);
  }
  return cambio ? { ...estado, tags } : estado;
}

/**
 * Decaimiento por horas. Solo corre si el reloj avanzó: con horasAvanzadas 0 (acciones de 0 horas) no hace nada.
 * @param {{tags:object[], hora:number}} estado  estado.hora ya incluye las horas avanzadas
 * @param {number} horasAvanzadas
 */
export function aplicarDecaimientoPorHoras(estado, horasAvanzadas) {
  if (!(horasAvanzadas > 0)) return estado;
  if (!Number.isFinite(estado.hora)) throw new Error('decaimiento: falta estado.hora');
  return decaer(estado, RELOJES.HORAS, estado.hora, 'creadoHora');
}

/**
 * Decaimiento por hitos. Se llama al disparar un hito, con contadorHitos ya sumado.
 * @param {{tags:object[], contadorHitos:number}} estado
 */
export function aplicarDecaimientoPorHitos(estado) {
  if (!Number.isInteger(estado.contadorHitos)) throw new Error('decaimiento: falta estado.contadorHitos');
  return decaer(estado, RELOJES.HITOS, estado.contadorHitos, 'creadoHito');
}

/** Cierre de caso: quita los tags que duran hasta el cierre. */
export function aplicarCierreDeCaso(estado) {
  const tags = (estado.tags ?? []).filter((t) => reglaDe(t) !== CIERRE);
  return tags.length === (estado.tags ?? []).length ? estado : { ...estado, tags };
}

/**
 * Reparación sobre un NPC: quita un tag medio o grave de rencor, desconfianza o miedo, y baja 1 nivel
 * los otros de esos tres (en nivel 1 se quitan). El rencor grave solo se toca con reparaRencorGrave.
 * Se quita el de mayor nivel; con empate, en el orden rencor, desconfianza, miedo. `tipo` fuerza cuál.
 * Sin tag medio o grave reparable, el estado no cambia.
 * @param {{tags:object[]}} estado
 * @param {string} npcId
 * @param {{tipo?:string, reparaRencorGrave?:boolean}} [opciones]
 */
export function aplicarReparacion(estado, npcId, { tipo = null, reparaRencorGrave = false } = {}) {
  if (tipo !== null && !TAGS_REPARABLES.includes(tipo)) throw new Error(`reparación: el tag "${tipo}" no se repara`);
  const tags = estado.tags ?? [];
  const delNpc = (t) => t.objetivo === npcId && TAGS_REPARABLES.includes(t.tipo);
  const intocable = (t) => t.tipo === 'rencor' && t.nivel === NIVEL_MAX && !reparaRencorGrave;

  const candidatos = tags
    .filter((t) => delNpc(t) && t.nivel >= NIVEL_MEDIO && !intocable(t) && (tipo === null || t.tipo === tipo))
    .sort((a, b) => b.nivel - a.nivel || TAGS_REPARABLES.indexOf(a.tipo) - TAGS_REPARABLES.indexOf(b.tipo));
  const quitado = candidatos[0];
  if (!quitado) return estado;

  const nuevos = [];
  for (const t of tags) {
    if (t === quitado) continue;
    if (!delNpc(t) || intocable(t)) nuevos.push(t);
    else if (t.nivel > NIVEL_MIN) nuevos.push({ ...t, nivel: t.nivel - 1 });
  }
  return { ...estado, tags: nuevos };
}

// La tabla cubre los 20 tipos (se comprueba al cargar el módulo).
for (const tipo of TIPOS_TAG) {
  if (!TABLA_DECAIMIENTO[tipo]) throw new Error(`decaimiento: falta la regla de "${tipo}"`);
}

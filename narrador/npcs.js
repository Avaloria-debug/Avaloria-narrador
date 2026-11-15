// Efectos de una acción sobre un NPC, según `transiciones` del contenido.
// Estado de un NPC: { relacion, disposicion, temor, bloqueadoConocimientos, conocimientosRevelados }.
import { deltaDisposicionPorEventos } from './efectosEventos.js';

export const RELACION_MIN = -100;
export const RELACION_MAX = 100;
export const DISPOSICION_MIN = -2;
export const DISPOSICION_MAX = 2;

// vocabulario-v1.md, sección 7.3: disposición en palabras, de -2 a 2.
export const PALABRAS_DISPOSICION = Object.freeze(['hostil', 'desconfiado', 'neutral', 'amable', 'cercano']);

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const clampRelacion = (v) => clamp(v, RELACION_MIN, RELACION_MAX);
export const clampDisposicion = (v) => clamp(v, DISPOSICION_MIN, DISPOSICION_MAX);

/** Número de disposición -> palabra. */
export function palabraDeDisposicion(numero) {
  return PALABRAS_DISPOSICION[clampDisposicion(Math.round(numero)) - DISPOSICION_MIN];
}

/** Palabra de disposición del contenido ("neutral") -> número. */
export function numeroDeDisposicion(palabra) {
  const i = PALABRAS_DISPOSICION.indexOf(palabra);
  return i < 0 ? 0 : i + DISPOSICION_MIN;
}

/** Estado inicial de un NPC, desde su definición. */
export function npcInicial(npcDef) {
  return {
    relacion: clampRelacion(npcDef.relacionInicial ?? 0),
    disposicion: numeroDeDisposicion(npcDef.disposicionInicial),
    temor: 0,
    bloqueadoConocimientos: false,
    conocimientosRevelados: [],
  };
}

/** Disposición que se muestra: la propia más los efectos de los eventos activos, entre -2 y 2. */
export function disposicionEfectiva(npcId, npcEstado, eventosActivos, contenido) {
  return clampDisposicion(npcEstado.disposicion + deltaDisposicionPorEventos(npcId, eventosActivos, contenido));
}

/**
 * Aplica la transición de un verbo sobre un NPC. No modifica el estado recibido.
 * - Relación: delta del resultado × sensibilidad del NPC, recortada a [-100, 100].
 * - Disposición: `disposicion` fija, o `disposicionExito` / `disposicionFallo`, recortada a [-2, 2].
 *   Presionar con fallo la fija en -2.
 * - `bloqueaConocimientos`: bloquea los conocimientos del NPC para siempre.
 * - Calmar con éxito: si el NPC tiene temor, baja el temor; si no, sube la disposición.
 * @param {object} npcEstado
 * @param {{ sensibilidad: number }} npcDef
 * @param {string} verbo id de verbo
 * @param {'exito'|'fallo'|'neutro'} resultado
 * @param {object} transiciones `transiciones` del contenido
 * @param {{ conValor?: boolean }} [opciones] negociar ofreciendo un objeto
 * @returns {{ npc: object, cambios: { relacion: number, disposicion: number, temor: number, bloqueoConocimientos: boolean } }}
 */
export function aplicarTransicion(npcEstado, npcDef, verbo, resultado, transiciones, { conValor = false } = {}) {
  const t = transiciones?.[verbo];
  const sinCambios = { relacion: 0, disposicion: 0, temor: 0, bloqueoConocimientos: false };
  if (!t || (resultado !== 'exito' && resultado !== 'fallo')) return { npc: npcEstado, cambios: sinCambios };

  const exito = resultado === 'exito';
  const delta = exito && conValor && typeof t.exitoConValor === 'number' ? t.exitoConValor : t[resultado] ?? 0;
  const relacion = clampRelacion(npcEstado.relacion + delta * (npcDef.sensibilidad ?? 1));

  let disposicion = npcEstado.disposicion;
  let temor = npcEstado.temor ?? 0;
  if (typeof t.disposicion === 'number') {
    disposicion = t.disposicion;
  } else if (verbo === 'calmar_la_situacion') {
    if (exito) {
      if (temor > 0) temor -= 1;
      else disposicion += 1;
    }
  } else if (verbo === 'presionar' && !exito) {
    disposicion = t.disposicionFallo;
  } else {
    disposicion += (exito ? t.disposicionExito : t.disposicionFallo) ?? 0;
  }
  disposicion = clampDisposicion(disposicion);

  const bloquea = t.bloqueaConocimientos === true;
  const npc = {
    ...npcEstado,
    relacion,
    disposicion,
    temor,
    bloqueadoConocimientos: npcEstado.bloqueadoConocimientos || bloquea,
  };
  return {
    npc,
    cambios: {
      relacion: relacion - npcEstado.relacion,
      disposicion: disposicion - npcEstado.disposicion,
      temor: temor - (npcEstado.temor ?? 0),
      bloqueoConocimientos: bloquea && !npcEstado.bloqueadoConocimientos,
    },
  };
}

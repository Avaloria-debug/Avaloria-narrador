// Acciones del motor de caso y los tags que escribe cada una (docs/motor-caso-v1-operativo.md, sección 6).
// Solo la tabla y su lectura: no resuelve objetivos concretos ni toca el estado.
//
// Fila de tag: { tipo, objetivo, nivel, hasta?, nivelSi?, si?, op?, paso? }
//  - objetivo: clase de objetivo (OBJETIVOS); quien aplica la acción la cambia por el id concreto.
//  - nivel / hasta: nivel fijo, o rango nivel–hasta (se elige con contexto.nivel; por defecto el mínimo).
//  - nivelSi: [condición, nivel] — nivel que reemplaza al base cuando la condición se cumple.
//  - si: condición necesaria para que la fila se escriba.
//  - op: 'escribir' (por defecto), 'subir' (+1), 'quitar' o 'reputacion' (usa paso).

import { NIVEL_MAX } from './tags.js';

export const OBJETIVOS = Object.freeze({
  NPC: 'npc',
  ESCENA: 'escena',
  JUGADOR: 'jugador',
  CIUDAD: 'ciudad',
  CONOCIMIENTO: 'conocimiento',
  BANDO: 'bando',
  FACCION: 'faccion',
  CAMINO: 'camino',
});

export const OPS = Object.freeze({ ESCRIBIR: 'escribir', SUBIR: 'subir', QUITAR: 'quitar', REPUTACION: 'reputacion' });

/** Por dónde entra la acción hoy: una intención del contenido, una consulta, o nada (sin entrada). */
export const ENTRADAS = Object.freeze({ INTENCION: 'intencion', CONSULTA: 'consulta', NINGUNA: null });

const { NPC, ESCENA, JUGADOR, CIUDAD, CONOCIMIENTO, BANDO, FACCION, CAMINO } = OBJETIVOS;

/** Condiciones que se leen del contexto de la acción. */
const CONDICIONES = Object.freeze({
  detectado: (c) => c.detectado === true,
  reincide: (c) => c.reincide === true,
  precio_alto: (c) => c.precioAlto === true,
  visto: (c) => c.visto === true,
  no_visto: (c) => c.visto !== true,
  con_objeto: (c) => c.conObjeto === true,
  falla_sigilo: (c) => c.fallaSigilo === true,
  pista_habilitada: (c) => c.superaUmbral === true && c.ranuraHabilitada === true,
  faccion_casa_aster: (c) => c.faccion === 'casa_aster',
  faccion_archivo: (c) => c.faccion === 'archivo',
  noche_o_fama: (c) => c.noche === true || (c.famaViolenta ?? 0) >= 2,
  tenso_o_peligroso: (c) => c.estadoEvento === 'tenso' || c.estadoEvento === 'peligroso',
});

/**
 * Las 20 acciones. `intenciones`: ids del contenido que la disparan (vacío si no hay ninguna).
 * Una acción con más de una intención o con una sola aproximada lleva `aproximada: true`.
 */
export const ACCIONES = Object.freeze({
  hablar_amable: {
    intenciones: ['intencion_hablar_con'], aproximada: true,
    tags: [{ tipo: 'curiosidad', objetivo: NPC, nivel: 1 }],
  },
  ayudar: {
    intenciones: ['intencion_ayudar'],
    tags: [
      { tipo: 'gratitud', objetivo: NPC, nivel: 1, hasta: 2 },
      { tipo: 'favor_debido', objetivo: NPC, nivel: 1 },
    ],
  },
  regalar_objeto: {
    intenciones: [],
    tags: [{ tipo: 'gratitud', objetivo: NPC, nivel: 1, nivelSi: ['precio_alto', 2] }],
  },
  mentir: {
    intenciones: [],
    tags: [{ tipo: 'desconfianza', objetivo: NPC, nivel: 1, nivelSi: ['reincide', 2], si: 'detectado' }],
  },
  amenazar: {
    intenciones: ['intencion_presionar'], aproximada: true,
    tags: [
      { tipo: 'miedo', objetivo: NPC, nivel: 2, nivelSi: ['tenso_o_peligroso', 3] },
      { tipo: 'rencor', objetivo: NPC, nivel: 1 },
      { tipo: 'chisme_activo', objetivo: ESCENA, nivel: 1 },
    ],
  },
  atacar: {
    intenciones: ['intencion_atacar'],
    tags: [
      { tipo: 'miedo', objetivo: NPC, nivel: 3 },
      { tipo: 'rencor', objetivo: NPC, nivel: 2 },
      { tipo: 'fama_violenta', objetivo: JUGADOR, nivel: 2 },
      { tipo: 'vigilancia_escena', objetivo: ESCENA, nivel: 2 },
      { tipo: 'sospecha_crimen', objetivo: JUGADOR, nivel: 1 },
    ],
  },
  robar: {
    intenciones: [],
    tags: [
      { tipo: 'desconfianza', objetivo: NPC, nivel: 2, si: 'visto' },
      { tipo: 'vigilancia_escena', objetivo: ESCENA, nivel: 2, si: 'visto' },
      { tipo: 'sospecha_crimen', objetivo: JUGADOR, nivel: 2, si: 'visto' },
      { tipo: 'reputacion_ciudad', objetivo: CIUDAD, op: OPS.REPUTACION, paso: -1, si: 'visto' },
      { tipo: 'vigilancia_escena', objetivo: ESCENA, nivel: 1, si: 'no_visto' },
    ],
  },
  pedir_prestado: {
    intenciones: [],
    tags: [{ tipo: 'deuda_personal', objetivo: NPC, nivel: 1 }],
  },
  pagar_deuda: {
    intenciones: [],
    tags: [
      { tipo: 'deuda_personal', objetivo: NPC, op: OPS.QUITAR },
      { tipo: 'gratitud', objetivo: NPC, nivel: 1 },
    ],
  },
  cobrar_favor: {
    intenciones: [],
    tags: [{ tipo: 'favor_debido', objetivo: NPC, op: OPS.QUITAR }],
  },
  preguntar_clave: {
    intenciones: [], entrada: ENTRADAS.CONSULTA,
    tags: [
      { tipo: 'pista_conocida', objetivo: CONOCIMIENTO, op: OPS.SUBIR, si: 'pista_habilitada' },
      { tipo: 'curiosidad', objetivo: NPC, nivel: 1 },
    ],
  },
  examinar: {
    intenciones: ['intencion_examinar'],
    tags: [{ tipo: 'pista_conocida', objetivo: CONOCIMIENTO, nivel: 1, nivelSi: ['con_objeto', 2] }],
  },
  escuchar_oculto: {
    intenciones: ['intencion_ocultarse', 'intencion_observar'], aproximada: true,
    tags: [
      { tipo: 'pista_conocida', objetivo: CONOCIMIENTO, nivel: 1, hasta: 2 },
      { tipo: 'vigilancia_escena', objetivo: ESCENA, nivel: 1, si: 'falla_sigilo' },
    ],
  },
  guardar_secreto: {
    intenciones: [],
    tags: [
      { tipo: 'secreto_compartido', objetivo: NPC, nivel: 1 },
      { tipo: 'gratitud', objetivo: NPC, nivel: 1 },
    ],
  },
  revelar_secreto: {
    intenciones: [],
    tags: [
      { tipo: 'rencor', objetivo: NPC, nivel: 2 },
      { tipo: 'chisme_activo', objetivo: ESCENA, nivel: 2 },
    ],
  },
  ponerse_de_lado: {
    intenciones: [],
    tags: [
      { tipo: 'pacto_caso', objetivo: BANDO, nivel: 1, hasta: 3 },
      { tipo: 'favor_casa_aster', objetivo: FACCION, nivel: 1, si: 'faccion_casa_aster' },
      { tipo: 'favor_archivo', objetivo: FACCION, nivel: 1, si: 'faccion_archivo' },
    ],
  },
  aliarse: {
    intenciones: [],
    tags: [{ tipo: 'alianza_npc', objetivo: NPC, nivel: 1 }],
  },
  viajar_camino: {
    intenciones: ['intencion_viajar'], aproximada: true,
    tags: [{ tipo: 'alerta_camino', objetivo: CAMINO, nivel: 1, si: 'noche_o_fama' }],
  },
  escoltar_caravana: {
    intenciones: [],
    tags: [{ tipo: 'lealtad_caravana', objetivo: FACCION, nivel: 1, hasta: 2 }],
  },
  comerciar_justo: {
    intenciones: ['intencion_comprar', 'intencion_negociar'], aproximada: true,
    tags: [{ tipo: 'reputacion_ciudad', objetivo: CIUDAD, op: OPS.REPUTACION, paso: 1 }],
  },
});

export const IDS_ACCIONES = Object.freeze(Object.keys(ACCIONES));

/** Entrada de una acción: intención, consulta o ninguna. */
export function entradaDeAccion(accionId) {
  const accion = ACCIONES[accionId];
  if (!accion) throw new Error(`acción desconocida "${accionId}"`);
  if (accion.intenciones.length > 0) return ENTRADAS.INTENCION;
  return accion.entrada ?? ENTRADAS.NINGUNA;
}

/** Acciones que ninguna intención del contenido dispara. */
export function accionesSinIntencion() {
  return IDS_ACCIONES.filter((id) => ACCIONES[id].intenciones.length === 0);
}

/** Acciones que dispara una intención del contenido. */
export function accionesDeIntencion(intencionId) {
  return IDS_ACCIONES.filter((id) => ACCIONES[id].intenciones.includes(intencionId));
}

/**
 * Operaciones de tag de una acción en un contexto.
 * @param {string} accionId
 * @param {object} [contexto] detectado, reincide, precioAlto, visto, conObjeto, fallaSigilo, superaUmbral,
 *   ranuraHabilitada, faccion ('casa_aster' | 'archivo'), noche, famaViolenta, estadoEvento, nivel (para rangos).
 * @returns {{op:string, tipo:string, objetivo:string, nivel?:number, paso?:number}[]}
 */
export function tagsDeAccion(accionId, contexto = {}) {
  const accion = ACCIONES[accionId];
  if (!accion) throw new Error(`acción desconocida "${accionId}"`);
  const cumple = (condicion) => CONDICIONES[condicion](contexto);
  const salida = [];
  for (const fila of accion.tags) {
    if (fila.si && !cumple(fila.si)) continue;
    const op = fila.op ?? OPS.ESCRIBIR;
    const base = { op, tipo: fila.tipo, objetivo: fila.objetivo };
    if (op === OPS.REPUTACION) salida.push({ ...base, paso: fila.paso });
    else if (op !== OPS.ESCRIBIR) salida.push(base);
    else {
      let nivel = fila.nivel;
      if (fila.hasta) nivel = Math.max(fila.nivel, Math.min(fila.hasta, contexto.nivel ?? fila.nivel));
      if (fila.nivelSi && cumple(fila.nivelSi[0])) nivel = fila.nivelSi[1];
      // En estado social el chisme sale un nivel más alto.
      if (fila.tipo === 'chisme_activo' && contexto.estadoEvento === 'social') nivel = Math.min(NIVEL_MAX, nivel + 1);
      salida.push({ ...base, nivel });
    }
  }
  return salida;
}

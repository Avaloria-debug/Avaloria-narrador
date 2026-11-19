// Tags del motor de caso (docs/motor-caso-v1-operativo.md, secciones 2 y 6).
// Funciones puras: reciben la lista de tags y devuelven una lista nueva; no tocan estado ni persistencia.
// Tag: { tipo, objetivo, nivel, creadoHora, creadoHito, casoId, origen }. Único por (tipo, objetivo).

/** Los 20 tipos de tag. */
export const TIPOS_TAG = Object.freeze([
  'desconfianza',
  'rencor',
  'gratitud',
  'miedo',
  'curiosidad',
  'deuda_personal',
  'favor_debido',
  'secreto_compartido',
  'reputacion_ciudad',
  'fama_violenta',
  'vigilancia_escena',
  'chisme_activo',
  'pista_conocida',
  'lealtad_caravana',
  'alerta_camino',
  'sospecha_crimen',
  'favor_casa_aster',
  'favor_archivo',
  'pacto_caso',
  'alianza_npc',
]);

export const NIVEL_MIN = 1; // leve
export const NIVEL_MAX = 3; // grave

/** reputacion_ciudad es el único tag con signo: va de -RANGO_REPUTACION a +RANGO_REPUTACION, sin 0. */
export const TIPO_REPUTACION = 'reputacion_ciudad';
export const RANGO_REPUTACION = 3;

/** Relación numérica por nivel del tag escrito. */
export const RELACION_POR_TAG = Object.freeze({ gratitud: 5, rencor: -8, desconfianza: -4, miedo: -3 });
export const RELACION_REPARACION = 15;

const esTipo = (tipo) => TIPOS_TAG.includes(tipo);

function exigirTipoYObjetivo(tipo, objetivo) {
  if (!esTipo(tipo)) throw new Error(`tag: tipo desconocido "${tipo}"`);
  if (typeof objetivo !== 'string' || objetivo === '') throw new Error(`tag ${tipo}: falta el objetivo`);
}

function exigirNivel(tipo, nivel) {
  if (!Number.isInteger(nivel) || nivel < NIVEL_MIN || nivel > NIVEL_MAX) {
    throw new Error(`tag ${tipo}: nivel fuera de ${NIVEL_MIN}–${NIVEL_MAX} (${nivel})`);
  }
}

/** Datos de creación de un tag a partir del contexto del turno. */
function marca({ hora = 0, hito = 0, casoId = null, origen = null } = {}) {
  return { creadoHora: hora, creadoHito: hito, casoId, origen };
}

/** Tag de (tipo, objetivo), o null. */
export function buscarTag(tags, tipo, objetivo) {
  return tags.find((t) => t.tipo === tipo && t.objetivo === objetivo) ?? null;
}

/** Nivel de (tipo, objetivo); 0 si no existe. */
export function nivelDeTag(tags, tipo, objetivo) {
  return buscarTag(tags, tipo, objetivo)?.nivel ?? 0;
}

/** Lista sin el tag (tipo, objetivo). */
export function quitarTag(tags, tipo, objetivo) {
  return tags.filter((t) => !(t.tipo === tipo && t.objetivo === objetivo));
}

/** Reemplaza o agrega el tag, conservando el orden. */
function poner(tags, tag) {
  const i = tags.findIndex((t) => t.tipo === tag.tipo && t.objetivo === tag.objetivo);
  if (i === -1) return [...tags, tag];
  const copia = [...tags];
  copia[i] = tag;
  return copia;
}

/** Baja un tag un nivel; en nivel 1 lo quita. */
function bajarUno(tags, tipo, objetivo) {
  const actual = buscarTag(tags, tipo, objetivo);
  if (!actual) return tags;
  if (actual.nivel <= NIVEL_MIN) return quitarTag(tags, tipo, objetivo);
  return poner(tags, { ...actual, nivel: actual.nivel - 1 });
}

/**
 * Escribe un tag. Si ya existe (tipo, objetivo), combina:
 *  - nivel nuevo mayor: sube al nuevo;
 *  - mismo nivel: +1 (máximo 3);
 *  - nivel nuevo menor: el nivel queda y se reinicia el decaimiento (creadoHora y creadoHito).
 * Rencor escrito baja 1 nivel la gratitud del mismo objetivo. Gratitud escrita no baja rencor.
 * @param {object[]} tags
 * @param {{tipo:string, objetivo:string, nivel:number, hora?:number, hito?:number, casoId?:string|null, origen?:string|null}} nuevo
 * @returns {object[]} lista nueva
 */
export function escribirTag(tags, nuevo) {
  const { tipo, objetivo, nivel } = nuevo;
  exigirTipoYObjetivo(tipo, objetivo);
  if (tipo === TIPO_REPUTACION) throw new Error('tag reputacion_ciudad: se mueve con ajustarReputacion');
  exigirNivel(tipo, nivel);

  const actual = buscarTag(tags, tipo, objetivo);
  const creado = marca(nuevo);
  let tag;
  if (!actual) tag = { tipo, objetivo, nivel, ...creado };
  else if (nivel > actual.nivel) tag = { tipo, objetivo, nivel, ...creado };
  else if (nivel === actual.nivel) tag = { tipo, objetivo, nivel: Math.min(NIVEL_MAX, nivel + 1), ...creado };
  else tag = { ...actual, creadoHora: creado.creadoHora, creadoHito: creado.creadoHito };

  let salida = poner(tags, tag);
  if (tipo === 'rencor') salida = bajarUno(salida, 'gratitud', objetivo);
  return salida;
}

/**
 * Sube un tag un nivel (máximo 3); si no existe lo crea en nivel 1. Es el "+1" de pista_conocida.
 */
export function subirTag(tags, { tipo, objetivo, ...ctx }) {
  exigirTipoYObjetivo(tipo, objetivo);
  if (tipo === TIPO_REPUTACION) throw new Error('tag reputacion_ciudad: se mueve con ajustarReputacion');
  const nivel = Math.min(NIVEL_MAX, nivelDeTag(tags, tipo, objetivo) + 1);
  let salida = poner(tags, { tipo, objetivo, nivel, ...marca(ctx) });
  if (tipo === 'rencor') salida = bajarUno(salida, 'gratitud', objetivo);
  return salida;
}

/** Traición: la gratitud grave del objetivo baja a medio. Otros niveles no cambian. */
export function aplicarTraicion(tags, objetivo) {
  const gratitud = buscarTag(tags, 'gratitud', objetivo);
  if (!gratitud || gratitud.nivel !== NIVEL_MAX) return tags;
  return poner(tags, { ...gratitud, nivel: NIVEL_MAX - 1 });
}

/**
 * Mueve reputacion_ciudad `paso` pasos (positivo o negativo), dentro de -3 a +3. En 0 el tag se quita.
 */
export function ajustarReputacion(tags, { objetivo, paso, ...ctx }) {
  exigirTipoYObjetivo(TIPO_REPUTACION, objetivo);
  if (!Number.isInteger(paso) || paso === 0) throw new Error(`tag reputacion_ciudad: paso inválido (${paso})`);
  const suma = nivelDeTag(tags, TIPO_REPUTACION, objetivo) + paso;
  const nivel = Math.max(-RANGO_REPUTACION, Math.min(RANGO_REPUTACION, suma));
  if (nivel === 0) return quitarTag(tags, TIPO_REPUTACION, objetivo);
  return poner(tags, { tipo: TIPO_REPUTACION, objetivo, nivel, ...marca(ctx) });
}

/** Cambio de relación (−100 a 100) por escribir un tag de ese tipo y nivel. 0 si el tipo no mueve relación. */
export function deltaRelacion(tipo, nivel) {
  return (RELACION_POR_TAG[tipo] ?? 0) * nivel;
}

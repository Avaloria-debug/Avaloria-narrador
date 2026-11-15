// Narración por plantillas. Módulo puro: todo el texto sale de `plantillas` del contenido.
// No escribe texto propio: solo elige una plantilla, completa sus placeholders y une frases con un espacio.
// La ventana de aperturas entra y sale como dato; este módulo no la guarda.
import { resolverPlantillas } from './contenido.js';
import { destinosDeViaje } from './comprension.js';
import { BLOQUE_REFORMULACION, MOTIVOS, REPETIR_SEGUNDA, YA_EN_DESTINO } from './motivos.js';

export const VENTANA_APERTURAS = 5;
export const PLACEHOLDERS = Object.freeze(['npc', 'objeto', 'lugar', 'conocimiento', 'nombres']);
export const SEPARADOR_NOMBRES = ', ';

const BLOQUE_REVELAR = 'revelar_conocimiento';
const BLOQUE_MOSTRAR = 'mostrar_narrativo';
const PATRON = /\{([^{}]*)\}/g;

const porId = (lista, id) => (lista ?? []).find((x) => x.id === id);
const textoUtil = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** Nombres de los placeholders de una plantilla, sin repetir. */
export function placeholdersDe(plantilla) {
  return [...new Set([...String(plantilla).matchAll(PATRON)].map((m) => m[1]))];
}

/** Apertura de un texto: su primera palabra, en minúsculas y sin signos. */
export function aperturaDe(texto) {
  const palabra = String(texto).trim().split(/\s+/)[0] ?? '';
  return palabra.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** Deja solo los valores que sirven: textos no vacíos; `nombres` puede llegar como lista. */
export function limpiarValores(valores = {}) {
  const limpios = {};
  for (const nombre of PLACEHOLDERS) {
    const v = valores[nombre];
    const texto = Array.isArray(v) ? textoUtil(v.map(textoUtil).filter(Boolean).join(SEPARADOR_NOMBRES)) : textoUtil(v);
    // Un valor con llaves no se usa: dejaría un placeholder a la vista.
    if (texto && !/[{}]/.test(texto)) limpios[nombre] = texto;
  }
  return limpios;
}

/** Completa una plantilla. Devuelve null si le falta algún valor. */
export function completar(plantilla, valores) {
  if (typeof plantilla !== 'string') return null;
  const limpios = limpiarValores(valores);
  if (!placeholdersDe(plantilla).every((p) => Object.hasOwn(limpios, p))) return null;
  const texto = plantilla.replace(PATRON, (_, nombre) => limpios[nombre]);
  return /[{}]/.test(texto) ? null : texto;
}

/** Agrega una apertura a la ventana y deja las últimas 5. No modifica la recibida. */
export function anotarApertura(aperturas, apertura) {
  return [...(aperturas ?? []), apertura].slice(-VENTANA_APERTURAS);
}

/**
 * Elige una plantilla de la lista y la completa.
 * - Descarta las que necesitan un valor que falta.
 * - Entre las que quedan, elige al azar una cuya apertura no esté en la ventana.
 * - Si todas están en la ventana, usa la que se usó hace más tiempo.
 * @returns {{ texto: string, apertura: string }|null} null si ninguna plantilla se puede completar
 */
export function elegirPlantilla(plantillas, valores, { rng, aperturas = [] } = {}) {
  if (typeof rng !== 'function') throw new TypeError('elegirPlantilla necesita un rng');
  const ventana = (aperturas ?? []).slice(-VENTANA_APERTURAS);
  const candidatas = [];
  for (const plantilla of Array.isArray(plantillas) ? plantillas : []) {
    const texto = completar(plantilla, valores);
    if (texto) candidatas.push({ texto, apertura: aperturaDe(texto) });
  }
  if (candidatas.length === 0) return null;
  const libres = candidatas.filter((c) => !ventana.includes(c.apertura));
  if (libres.length > 0) return libres.length === 1 ? libres[0] : libres[Math.min(libres.length - 1, Math.floor(rng() * libres.length))];
  return candidatas.reduce((mejor, c) => (ventana.lastIndexOf(c.apertura) < ventana.lastIndexOf(mejor.apertura) ? c : mejor));
}

/** Texto de la reformulación `no_entendido`: el respaldo cuando ninguna plantilla sirve. */
function respaldo(contenido, opciones) {
  const elegida = elegirPlantilla(contenido?.plantillas?.[BLOQUE_REFORMULACION]?.[MOTIVOS.NO_ENTENDIDO], {}, opciones);
  if (!elegida) throw new Error('el contenido no trae plantillas.reformulacion.no_entendido');
  return elegida;
}

/**
 * Texto de una reformulación (`plantillas.reformulacion[clave]`).
 * @returns {{ texto: string, apertura: string, respaldo: boolean }}
 */
export function narrarReformulacion(contenido, clave, valores, opciones) {
  const elegida = elegirPlantilla(contenido?.plantillas?.[BLOQUE_REFORMULACION]?.[clave], valores, opciones);
  return elegida ? { ...elegida, respaldo: false } : { ...respaldo(contenido, opciones), respaldo: true };
}

/**
 * Texto de un resultado (`plantillas[bloque][resultado]`; el bloque puede ser un verbo o un id de intención).
 * @returns {{ texto: string, apertura: string, respaldo: boolean }}
 */
export function narrarResultado(contenido, bloque, resultado, valores, opciones) {
  const elegida = elegirPlantilla(resolverPlantillas(contenido, bloque, resultado), valores, opciones);
  return elegida ? { ...elegida, respaldo: false } : { ...respaldo(contenido, opciones), respaldo: true };
}

/** Nombre de un destino de viaje (escena, camino, lugar o ciudad). */
function nombreDeDestino(destino, contenido) {
  return destinosDeViaje(contenido.escenas).find((d) => d.id === destino)?.nombre ?? null;
}

/**
 * Valores de los placeholders para un turno de acción.
 * - npc, objeto: nombres del NPC y del objeto de la acción.
 * - lugar: en un viaje, el destino; si no, la escena donde se actuó.
 * - conocimiento: el texto del conocimiento revelado en el turno.
 */
export function valoresDeAccion(accion, contenido) {
  const parametros = accion.parametros ?? {};
  const npc = porId(contenido.npcs, parametros.npcId);
  const revelado = (accion.efectos ?? []).find((e) => e.tipo === 'conocimiento_revelado');
  const dueno = revelado ? porId(contenido.npcs, revelado.npcId) : null;
  const lugar =
    accion.verbo === 'viajar'
      ? nombreDeDestino(parametros.destino, contenido) ?? porId(contenido.escenas, accion.escenaNueva)?.nombre
      : porId(contenido.escenas, accion.escenaAnterior)?.nombre;
  return limpiarValores({
    npc: npc?.nombre,
    objeto: porId(contenido.objetos, parametros.objetoId)?.nombre,
    lugar,
    conocimiento: porId(dueno?.conocimientos, revelado?.conocimientoId)?.contenido,
  });
}

/**
 * Texto de un turno ya ejecutado (resultado de `ejecutarTurno`).
 * - `accion`: plantilla de la intención y su resultado. Mostrar un objeto narrativo usa `mostrar_narrativo`.
 *   Si en el turno se reveló un conocimiento, sigue una frase de `revelar_conocimiento`.
 *   Viajar a donde ya se está usa la reformulación `ya_en_destino`. Si quedó una segunda acción sin hacer, sigue `repetir_segunda`.
 * - `reformular`: plantilla del motivo.
 * - `ia` y `error`: sin texto (null); no los narra este módulo.
 * @param {object} turno
 * @param {{ contenido: object, rng: () => number, aperturas?: string[] }} dependencias
 * @returns {{ texto: string|null, aperturas: string[], respaldo: boolean }}
 */
export function narrarTurno(turno, { contenido, rng, aperturas = [] }) {
  if (typeof rng !== 'function') throw new TypeError('narrarTurno necesita un rng');
  const ventana = (aperturas ?? []).slice(-VENTANA_APERTURAS);
  const opciones = { rng, aperturas: ventana };
  const salida = (partes) => ({
    texto: partes.map((p) => p.texto).join(' '),
    aperturas: anotarApertura(ventana, partes[0].apertura),
    respaldo: partes.some((p) => p.respaldo),
  });

  if (turno?.tipo === 'reformular') {
    return salida([narrarReformulacion(contenido, turno.motivo, { nombres: turno.datos?.nombres }, opciones)]);
  }
  if (turno?.tipo !== 'accion' || !turno.accion) return { texto: null, aperturas: ventana, respaldo: false };

  const accion = turno.accion;
  const valores = valoresDeAccion(accion, contenido);
  if (accion.verbo === 'viajar' && accion.motivo === YA_EN_DESTINO) {
    return salida([narrarReformulacion(contenido, YA_EN_DESTINO, valores, opciones)]);
  }

  const revelado = (accion.efectos ?? []).some((e) => e.tipo === 'conocimiento_revelado');
  const muestra =
    accion.verbo === 'usar' && accion.parametros?.npcId != null && porId(contenido.objetos, accion.parametros.objetoId)?.tipo === 'narrativo';
  const partes = [narrarResultado(contenido, muestra ? BLOQUE_MOSTRAR : accion.intencionId, accion.resultado, valores, opciones)];
  // Las frases que siguen no cuentan como apertura, pero evitan la de la primera.
  const despues = { rng, aperturas: anotarApertura(ventana, partes[0].apertura) };
  if (revelado && !partes[0].respaldo) partes.push(narrarResultado(contenido, BLOQUE_REVELAR, 'exito', valores, despues));
  if (turno.repetirIntencionId && !partes[0].respaldo) partes.push(narrarReformulacion(contenido, REPETIR_SEGUNDA, {}, despues));
  return salida(partes);
}

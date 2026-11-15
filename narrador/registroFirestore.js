// Adaptador de Firestore para los registros, detrás de una interfaz: enviar(registro), enviarLote(registros).
// Diseño: docs/prompt-maestro-fable-narrador-v3.md (5.8) y docs/vocabulario-v1.md (13 y 14).
// - Colección `registros`, un documento por registro, id reg_<codigoPartida>_<número de 6 dígitos>: reg_ABCDEF_000123.
//   El registro que devuelve `narrar` lleva el id corto de su partida (reg_000123); el adaptador arma el
//   id de Firestore con el código de partida (persistencia/codigoPartida.js), en el documento y en su campo `id`.
// - Un registro que ya está en Firestore con ese id y los mismos datos cuenta como enviado.
// - Rechazo de una regla (permission-denied) o datos inválidos: error permanente, no se reintenta solo.
// - El cliente de Firestore llega por parámetro: este módulo nunca lo crea ni inicia sesión.
// - Antes de enviar se valida la forma del registro. Si no cumple, no se envía.
// - Los límites de tamaño son los mismos que exige firestore.rules.
// `doc(db, coleccion, id)` y `setDoc(ref, datos)`: verificados con el SDK real contra el emulador, en Node.
// SIN VERIFICAR en un navegador ni contra el proyecto real de Firebase.
import { validarRegistro, crearColaDeRegistros, REVISIONES } from './registro.js';
import { esCodigoPartidaValido } from '../persistencia/codigoPartida.js';

export const COLECCION_REGISTROS = 'registros';

/** Tamaño máximo del documento (firestore.rules lo acota con los límites por campo de abajo). */
export const MAX_BYTES_DOCUMENTO = 16 * 1024;

/** Límites por campo. Iguales a los de firestore.rules: si cambian acá, cambian allá. */
export const LIMITES = Object.freeze({
  textoJugadorBytes: 6000,
  respuestaMostradaBytes: 4000,
  idCorto: 100, // caracteres: escena, estado_escena, intencion_detectada
  ultimosTurnos: 3,
  ultimoTurnoCaracteres: 200,
});

/** Códigos de error de Firestore que no se arreglan reintentando. */
export const CODIGOS_PERMANENTES = Object.freeze(['permission-denied', 'invalid-argument']);
/** Código de error de Firestore cuando el documento ya existe: cuenta como enviado. */
export const CODIGO_YA_EXISTE = 'already-exists';

/** Id del documento en Firestore: reg_ABCDEF_000123, a partir del id del registro en su partida (reg_000123). */
export function idDeDocumento(codigoPartida, idRegistro) {
  if (!esCodigoPartidaValido(codigoPartida)) throw new RangeError('código de partida inválido');
  const numero = /^reg_(\d{6,})$/.exec(String(idRegistro))?.[1];
  if (!numero) throw new RangeError(`id de registro inválido: ${idRegistro}`);
  return `reg_${codigoPartida}_${numero}`;
}

const bytes = (texto) => new TextEncoder().encode(texto).length;
const caracteres = (texto) => [...texto].length;

/** Error de un registro que no cumple la forma: no se envía ni se reintenta en la red. */
export class ErrorRegistroInvalido extends Error {
  constructor(errores) {
    super(`registro inválido: ${errores.join('; ')}`);
    this.name = 'ErrorRegistroInvalido';
    this.invalido = true;
    this.errores = errores;
  }
}

/**
 * Errores que impiden enviar un registro: la forma de vocabulario 13 más lo que exigen las reglas
 * de seguridad (revisión pendiente, notas vacías y tamaños).
 * @param {object} registro
 * @param {{ intenciones?: string[], escenas?: string[], estadosEscena?: string[] }} [permitidos]
 * @returns {string[]}
 */
export function erroresDeEnvio(registro, permitidos = {}) {
  if (registro === null || typeof registro !== 'object' || Array.isArray(registro)) return ['no es un registro'];
  const errores = validarRegistro(registro, permitidos);
  if (errores.length > 0) return errores;
  const r = registro;
  if (r.revision !== REVISIONES.PENDIENTE) errores.push('revision: un registro nuevo se envía como pendiente');
  if (r.notas !== '') errores.push('notas: un registro nuevo se envía sin notas');
  if (bytes(r.texto_jugador) > LIMITES.textoJugadorBytes) errores.push('texto_jugador: demasiado largo');
  if (bytes(r.respuesta_mostrada) > LIMITES.respuestaMostradaBytes) errores.push('respuesta_mostrada: demasiado largo');
  for (const campo of ['escena', 'estado_escena', 'intencion_detectada']) {
    if (typeof r[campo] === 'string' && caracteres(r[campo]) > LIMITES.idCorto) errores.push(`${campo}: demasiado largo`);
  }
  if (r.ultimos_turnos.length > LIMITES.ultimosTurnos) errores.push('ultimos_turnos: demasiados turnos');
  if (r.ultimos_turnos.some((t) => caracteres(t) > LIMITES.ultimoTurnoCaracteres)) errores.push('ultimos_turnos: turno demasiado largo');
  if (bytes(JSON.stringify(r)) >= MAX_BYTES_DOCUMENTO) errores.push('documento: supera los 16 KB');
  return errores;
}

/**
 * Adaptador de Firestore.
 * @param {{ db: object, doc: Function, setDoc: Function }} cliente las funciones del SDK web modular
 *   (`import { doc, setDoc } from 'firebase/firestore'`) y la base ya creada, con sesión anónima iniciada.
 * @param {{ codigoPartida: string, permitidos?: object }} opciones el código de la partida de estos registros;
 *   `permitidos`: ids permitidos, si se quieren validar también
 * @returns {{ enviar: (registro: object) => Promise<void>, enviarLote: (registros: object[]) => Promise<{ enviados: string[], fallidos: { id: string|null, motivo: string, invalido: boolean, permanente: boolean }[] }> }}
 */
export function crearAdaptadorFirestore(cliente, { codigoPartida, permitidos } = {}) {
  const { db, doc, setDoc } = cliente ?? {};
  if (typeof doc !== 'function' || typeof setDoc !== 'function' || db === undefined || db === null) {
    throw new TypeError('crearAdaptadorFirestore necesita el cliente: { db, doc, setDoc }');
  }
  if (!esCodigoPartidaValido(codigoPartida)) throw new TypeError('crearAdaptadorFirestore necesita un código de partida válido');

  /**
   * Envía un registro. Rechaza con `ErrorRegistroInvalido` si no cumple la forma, o con el error de Firestore
   * (con `permanente: true` si lo rechazó una regla). Si el documento ya existe, cuenta como enviado.
   * @returns {Promise<string>} el id del documento
   */
  async function enviar(registro) {
    const errores = erroresDeEnvio(registro, permitidos);
    if (errores.length > 0) throw new ErrorRegistroInvalido(errores);
    const id = idDeDocumento(codigoPartida, registro.id);
    try {
      await setDoc(doc(db, COLECCION_REGISTROS, id), { ...registro, id });
    } catch (e) {
      if (e?.code === CODIGO_YA_EXISTE) return id;
      if (CODIGOS_PERMANENTES.includes(e?.code)) {
        throw Object.assign(new Error(`rechazado por Firestore: ${e.code}`), { code: e.code, permanente: true });
      }
      throw e;
    }
    return id;
  }

  /** Envía varios, en orden, cada uno por separado: el fallo de uno no arrastra a los demás. Nunca rechaza. */
  async function enviarLote(registros) {
    const enviados = [];
    const fallidos = [];
    for (const registro of Array.isArray(registros) ? registros : []) {
      try {
        enviados.push(await enviar(registro));
      } catch (e) {
        fallidos.push({
          id: typeof registro?.id === 'string' ? registro.id : null,
          motivo: e instanceof Error ? e.message : String(e),
          invalido: e?.invalido === true,
          permanente: e?.invalido === true || e?.permanente === true,
        });
      }
    }
    return { enviados, fallidos };
  }

  return { enviar, enviarLote };
}

/**
 * La cola de narrador/registro.js conectada a Firestore. Es la que se pasa a `narrar` en `opciones.cola`.
 * Un registro rechazado de forma permanente (inválido, o rechazado por una regla) pasa a `fallidos()`
 * con su motivo y no traba a los siguientes. Un fallo de red lo deja en la cola para el próximo lote.
 * @param {{ db: object, doc: Function, setDoc: Function }} cliente
 * @param {{ codigoPartida: string, permitidos?: object, numeroInicial?: number }} opciones
 */
export function crearColaFirestore(cliente, { codigoPartida, permitidos, numeroInicial } = {}) {
  const adaptador = crearAdaptadorFirestore(cliente, { codigoPartida, permitidos });
  return crearColaDeRegistros({ enviar: adaptador.enviar, validarAlAgregar: false, ...(numeroInicial ? { numeroInicial } : {}) });
}

/**
 * Cliente en memoria que simula Firestore, para los tests. Misma forma que el cliente real.
 * Como las reglas: reescribir un documento con los mismos datos se acepta sin cambios; con datos
 * distintos falla con permission-denied.
 */
export function crearFirestoreEnMemoria() {
  const documentos = new Map();
  let fallosPendientes = 0;
  let fallaSi = null;
  let respuestasPerdidas = 0;
  let escrituras = 0;
  const clave = (ref) => `${ref.coleccion}/${ref.id}`;
  const error = (code) => Object.assign(new Error(code), { code });
  return {
    db: { enMemoria: true },
    doc: (_db, coleccion, id) => ({ coleccion, id }),
    async setDoc(ref, datos) {
      escrituras++;
      if (fallosPendientes > 0) {
        fallosPendientes--;
        throw error('unavailable');
      }
      if (fallaSi && fallaSi(ref, datos, escrituras)) throw error('unavailable');
      const nuevo = JSON.stringify(datos);
      if (documentos.has(clave(ref)) && JSON.stringify(documentos.get(clave(ref))) !== nuevo) throw error('permission-denied');
      documentos.set(clave(ref), JSON.parse(nuevo));
      if (respuestasPerdidas > 0) {
        respuestasPerdidas--;
        throw error('unavailable');
      }
    },
    /** Las próximas `n` escrituras llegan al servidor, pero la respuesta se pierde (falla como corte de red). */
    perderRespuestas(n) {
      respuestasPerdidas = n;
    },
    /** Las próximas `n` escrituras fallan como un corte de red. */
    fallarProximas(n) {
      fallosPendientes = n;
    },
    /** Falla cuando `fn(ref, datos, numeroDeEscritura)` da true. `null` lo saca. */
    fallarSi(fn) {
      fallaSi = fn;
    },
    /** Documentos de una colección: `{ id: datos }`. */
    coleccion(nombre) {
      const salida = {};
      for (const [k, v] of documentos) if (k.startsWith(`${nombre}/`)) salida[k.slice(nombre.length + 1)] = JSON.parse(JSON.stringify(v));
      return salida;
    },
    escrituras: () => escrituras,
  };
}

// Registro de turnos con forma fija: interfaz RegistroTurnos y validación.
// Campos (todos obligatorios, en este orden): version, versionEsquema, fecha, escena, relacion, frase, motivo,
// intencion, respuestaIA, sinDatosPersonales. Nada más: un campo desconocido invalida el registro.
// Nunca lleva claves de Groq ni datos de localStorage: `frase` es solo lo que escribió el jugador en el turno.

export const VERSION_ESQUEMA = '1';

export const CAMPOS_REGISTRO_TURNO = Object.freeze([
  'version', 'versionEsquema', 'fecha', 'escena', 'relacion', 'frase', 'motivo', 'intencion', 'respuestaIA', 'sinDatosPersonales',
]);

// Clave de Groq (`gsk_…`): si aparece en cualquier texto del registro, no se guarda.
const CLAVE_GROQ = /gsk_[A-Za-z0-9_]{6,}/;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const textoONull = (v) => v === null || typeof v === 'string';

/** Errores de un registro de turno; lista vacía si es válido. */
export function erroresDeRegistroTurno(r) {
  if (r === null || typeof r !== 'object' || Array.isArray(r)) return ['el registro tiene que ser un objeto'];
  const errores = [];
  if (typeof r.version !== 'string' || r.version.trim() === '') errores.push('version: obligatoria (texto no vacío, primer nivel)');
  if (r.versionEsquema !== VERSION_ESQUEMA) errores.push(`versionEsquema: tiene que ser "${VERSION_ESQUEMA}"`);
  if (typeof r.fecha !== 'string' || !FECHA_ISO.test(r.fecha) || Number.isNaN(Date.parse(r.fecha))) errores.push('fecha: ISO 8601');
  if (typeof r.escena !== 'string' || r.escena === '') errores.push('escena: texto no vacío');
  if (!(r.relacion === null || (typeof r.relacion === 'number' && Number.isFinite(r.relacion)))) errores.push('relacion: número o null');
  if (typeof r.frase !== 'string') errores.push('frase: texto');
  if (!textoONull(r.motivo)) errores.push('motivo: texto o null');
  if (!textoONull(r.intencion)) errores.push('intencion: texto o null');
  if (!textoONull(r.respuestaIA)) errores.push('respuestaIA: texto o null');
  if (r.sinDatosPersonales !== true) errores.push('sinDatosPersonales: tiene que ser true');
  for (const k of Object.keys(r)) if (!CAMPOS_REGISTRO_TURNO.includes(k)) errores.push(`campo desconocido: ${k}`);
  for (const k of ['frase', 'motivo', 'intencion', 'respuestaIA', 'escena']) {
    if (typeof r[k] === 'string' && CLAVE_GROQ.test(r[k])) errores.push(`${k}: parece una clave de Groq; no se guarda`);
  }
  return errores;
}

/** Error de un registro que no cumple la forma. */
export class ErrorRegistroTurno extends Error {
  constructor(errores) {
    super(`registro de turno inválido: ${errores.join('; ')}`);
    this.name = 'ErrorRegistroTurno';
    this.errores = errores;
  }
}

/** Lanza ErrorRegistroTurno si el registro no es válido. */
export function exigirRegistroTurno(r) {
  const errores = erroresDeRegistroTurno(r);
  if (errores.length > 0) throw new ErrorRegistroTurno(errores);
  return r;
}

/**
 * Arma un registro con la forma fija. `respuestaIA` va solo si hubo llamada a la IA (si no, null).
 * No valida: lo hace `guardar` de cada destino.
 */
export function crearRegistroTurno({ version, fecha, escena, relacion = null, frase, motivo = null, intencion = null, respuestaIA = null }) {
  const iso = fecha instanceof Date ? fecha.toISOString() : typeof fecha === 'number' ? new Date(fecha).toISOString() : fecha;
  return {
    version,
    versionEsquema: VERSION_ESQUEMA,
    fecha: iso,
    escena,
    relacion,
    frase,
    motivo,
    intencion,
    respuestaIA,
    sinDatosPersonales: true,
  };
}

/**
 * Registro de un turno de texto libre a partir de lo que devuelve `narrar`. Los botones no se registran (null).
 * `relacion` y `motivo` quedan en null: `narrar` no los devuelve. `respuestaIA` solo si la respuesta vino de la IA.
 * @param {{ version: string, fecha: Date|string|number, entrada: { tipo: string, texto?: string },
 *   estadoAntes: { jugador: { escenaId: string } }, salida: { tipo: string, texto?: string, registro?: { intencion_detectada?: string|null }|null } }} datos
 */
export function registroDesdeTurno({ version, fecha, entrada, estadoAntes, salida }) {
  if (entrada?.tipo !== 'texto' || typeof entrada.texto !== 'string' || salida?.tipo === 'error') return null;
  return crearRegistroTurno({
    version,
    fecha,
    escena: estadoAntes.jugador.escenaId,
    frase: entrada.texto,
    intencion: salida?.registro?.intencion_detectada ?? null,
    respuestaIA: salida?.tipo === 'dialogo_ia' && typeof salida.texto === 'string' ? salida.texto : null,
  });
}

/** Interfaz: `guardar(registro)` devuelve una promesa. Cada destino la implementa. */
export class RegistroTurnos {
  // eslint-disable-next-line no-unused-vars
  guardar(_registro) {
    return Promise.reject(new Error('RegistroTurnos.guardar no está implementado'));
  }
}

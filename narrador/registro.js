// Registro de turnos con texto libre y cola local en memoria.
// Formato: docs/sistema-registro-aprendizaje-narrador.md (sección 3) y docs/vocabulario-v1.md (sección 13).
// - El texto del jugador se guarda completo, sin limpieza. Solo se lee: nunca es respuesta ni instrucción.
// - Un registro solo lleva los campos de su formato: nada más (por ejemplo, la clave de Groq) puede entrar.
// - Sin Firestore: el envío se inyecta. `enviadorANube` adapta la nube en memoria de la beta.
import { normalizar } from './comprension.js';

export const RUTAS = Object.freeze({ GRUPO_1: 'grupo_1', GRUPO_2: 'grupo_2', REFORMULACION: 'reformulacion' });
export const ORIGENES = Object.freeze({ CODIGO: 'codigo', IA: 'ia' });
export const REVISIONES = Object.freeze({ PENDIENTE: 'pendiente', APROBADA: 'aprobada', DESCARTADA: 'descartada' });
export const MAX_ULTIMOS_TURNOS = 3;

export const CAMPOS_REGISTRO = Object.freeze([
  'id', 'fecha', 'escena', 'estado_escena', 'ultimos_turnos', 'texto_jugador', 'ruta', 'intento_reformulacion',
  'intencion_detectada', 'origen_respuesta', 'respuesta_mostrada', 'revision', 'notas', 'contaminacion',
]);

// Frases que parecen instrucciones para un modelo (sistema de registro, sección 5), ya normalizadas.
export const PATRONES_CONTAMINACION = Object.freeze(['ignora', 'responde como', 'sos un', 'sos una']);

/** ¿El texto trae instrucciones para un modelo? Solo marca el registro: no cambia lo que hace el narrador. */
export function detectarContaminacion(texto) {
  const palabras = ` ${normalizar(String(texto ?? ''))} `;
  return PATRONES_CONTAMINACION.some((p) => palabras.includes(` ${p} `));
}

/** Id de registro: reg_000001. */
export function idDeRegistro(numero) {
  if (!Number.isInteger(numero) || numero < 1) throw new RangeError(`número de registro inválido: ${numero}`);
  return `reg_${String(numero).padStart(6, '0')}`;
}

/** Fecha del registro: 2026-11-13T21:14:00 (ISO, sin milisegundos ni zona). */
export function fechaDeRegistro(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) throw new RangeError('fecha de registro inválida');
  return d.toISOString().slice(0, 19);
}

/**
 * Errores de un registro. Sin errores, está completo y con valores permitidos.
 * @param {object} registro
 * @param {{ intenciones?: string[], escenas?: string[], estadosEscena?: string[] }} [permitidos] si se pasan, también se validan esos ids
 * @returns {string[]}
 */
export function validarRegistro(registro, permitidos = {}) {
  const errores = [];
  const r = registro ?? {};
  for (const campo of CAMPOS_REGISTRO) if (!(campo in r)) errores.push(`falta el campo ${campo}`);
  for (const campo of Object.keys(r)) if (!CAMPOS_REGISTRO.includes(campo)) errores.push(`campo desconocido ${campo}`);
  const texto = (campo, vacioVale = false) => {
    if (campo in r && (typeof r[campo] !== 'string' || (!vacioVale && r[campo] === ''))) errores.push(`${campo}: no es un texto`);
  };
  if ('id' in r && !/^reg_\d{6,}$/.test(String(r.id))) errores.push('id: no tiene la forma reg_000001');
  if ('fecha' in r && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(String(r.fecha))) errores.push('fecha: no tiene la forma AAAA-MM-DDTHH:MM:SS');
  texto('escena');
  texto('estado_escena');
  texto('texto_jugador');
  texto('respuesta_mostrada');
  texto('notas', true);
  if ('ultimos_turnos' in r && !(Array.isArray(r.ultimos_turnos) && r.ultimos_turnos.every((t) => typeof t === 'string'))) {
    errores.push('ultimos_turnos: no es una lista de textos');
  }
  if ('ruta' in r && !Object.values(RUTAS).includes(r.ruta)) errores.push(`ruta: valor no permitido ${JSON.stringify(r.ruta)}`);
  if ('origen_respuesta' in r && !Object.values(ORIGENES).includes(r.origen_respuesta)) {
    errores.push(`origen_respuesta: valor no permitido ${JSON.stringify(r.origen_respuesta)}`);
  }
  if ('revision' in r && !Object.values(REVISIONES).includes(r.revision)) errores.push(`revision: valor no permitido ${JSON.stringify(r.revision)}`);
  if ('intento_reformulacion' in r && typeof r.intento_reformulacion !== 'boolean') errores.push('intento_reformulacion: no es true ni false');
  if ('contaminacion' in r && typeof r.contaminacion !== 'boolean') errores.push('contaminacion: no es true ni false');
  if ('intencion_detectada' in r && r.intencion_detectada !== null) {
    if (typeof r.intencion_detectada !== 'string' || r.intencion_detectada === '') errores.push('intencion_detectada: no es un id ni null');
    else if (permitidos.intenciones && !permitidos.intenciones.includes(r.intencion_detectada)) {
      errores.push(`intencion_detectada: intención desconocida ${JSON.stringify(r.intencion_detectada)}`);
    }
  }
  if (permitidos.escenas && typeof r.escena === 'string' && !permitidos.escenas.includes(r.escena)) {
    errores.push(`escena: escena desconocida ${JSON.stringify(r.escena)}`);
  }
  if (permitidos.estadosEscena && typeof r.estado_escena === 'string' && !permitidos.estadosEscena.includes(r.estado_escena)) {
    errores.push(`estado_escena: valor no permitido ${JSON.stringify(r.estado_escena)}`);
  }
  if (r.ruta !== RUTAS.GRUPO_2 && Object.values(RUTAS).includes(r.ruta) && r.origen_respuesta === ORIGENES.IA) {
    errores.push(`ruta ${r.ruta} con origen_respuesta ia`);
  }
  if (r.origen_respuesta === ORIGENES.IA && r.intencion_detectada !== null) errores.push('origen_respuesta ia con intencion_detectada');
  return errores;
}

/**
 * Arma un registro. Toma solo los datos de su formato; cualquier otro dato que llegue se ignora.
 * Un registro incompleto o con valores no permitidos es un error.
 * @param {{
 *   numero: number, fecha: Date|string|number, escena: string, estadoEscena: string, ultimosTurnos?: string[],
 *   textoJugador: string, ruta: 'grupo_1'|'grupo_2'|'reformulacion', intentoReformulacion?: boolean,
 *   intencionDetectada?: string|null, origenRespuesta: 'codigo'|'ia', respuestaMostrada: string,
 * }} datos
 */
export function crearRegistro(datos) {
  const d = datos ?? {};
  const registro = {
    id: idDeRegistro(d.numero),
    fecha: fechaDeRegistro(d.fecha),
    escena: d.escena,
    estado_escena: d.estadoEscena,
    ultimos_turnos: (Array.isArray(d.ultimosTurnos) ? d.ultimosTurnos : []).slice(-MAX_ULTIMOS_TURNOS),
    texto_jugador: d.textoJugador,
    ruta: d.ruta,
    intento_reformulacion: d.intentoReformulacion === true,
    intencion_detectada: d.intencionDetectada ?? null,
    origen_respuesta: d.origenRespuesta,
    respuesta_mostrada: d.respuestaMostrada,
    revision: REVISIONES.PENDIENTE,
    notas: '',
    contaminacion: detectarContaminacion(d.textoJugador),
  };
  const errores = validarRegistro(registro);
  if (errores.length > 0) throw new Error(`registro incompleto: ${errores.join('; ')}`);
  return registro;
}

/**
 * Registro de un turno ya resuelto. Solo los turnos con texto libre se registran: un botón devuelve null.
 * - Turno resuelto por el código, sin reformulación ni IA: grupo_1, origen codigo.
 * - Turno en que el código pide reformular: ruta reformulacion, origen codigo.
 * - Turno que pasó a la IA: grupo_2, sin intención; origen ia, o codigo si se mostró una plantilla.
 * @param {{
 *   entrada: { tipo: 'texto'|'boton', texto?: string }, turno: { tipo: string, intencionId?: string|null },
 *   estadoAntes: { jugador: { escenaId: string }, reformulacionPendiente?: boolean }, estadoEscena: string,
 *   respuestaMostrada: string, origenRespuesta?: 'codigo'|'ia', ultimosTurnos?: string[],
 *   numero: number, fecha: Date|string|number,
 * }} datos `estadoAntes`: el estado antes del turno. `estadoEscena`: el estado de esa escena al actuar.
 */
export function registroDeTurno({ entrada, turno, estadoAntes, estadoEscena, respuestaMostrada, origenRespuesta, ultimosTurnos, numero, fecha }) {
  if (entrada?.tipo !== 'texto') return null;
  const porIa = turno?.tipo === 'ia';
  return crearRegistro({
    numero,
    fecha,
    escena: estadoAntes.jugador.escenaId,
    estadoEscena,
    ultimosTurnos,
    textoJugador: entrada.texto,
    ruta: porIa ? RUTAS.GRUPO_2 : turno?.tipo === 'reformular' ? RUTAS.REFORMULACION : RUTAS.GRUPO_1,
    intentoReformulacion: estadoAntes.reformulacionPendiente === true,
    intencionDetectada: porIa ? null : turno?.intencionId ?? null,
    origenRespuesta: porIa ? origenRespuesta ?? ORIGENES.CODIGO : ORIGENES.CODIGO,
    respuestaMostrada,
  });
}

/**
 * Cola local de registros, en memoria. `enviar(registro)` se inyecta: si rechaza, el registro
 * queda en la cola y se reintenta en el próximo envío. Se envía en orden, de a uno.
 * No se pierden registros mientras la cola exista.
 * @param {{ enviar: (registro: object) => Promise<void>, numeroInicial?: number }} opciones
 */
export function crearColaDeRegistros({ enviar, numeroInicial = 1 } = {}) {
  if (typeof enviar !== 'function') throw new TypeError('crearColaDeRegistros necesita una función enviar');
  let cola = [];
  let siguiente = numeroInicial;
  let enviados = 0;
  let enCurso = null;

  async function vaciar() {
    let enviadosAhora = 0;
    let error = null;
    while (cola.length > 0) {
      const registro = cola[0];
      try {
        await enviar(JSON.parse(JSON.stringify(registro)));
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        break;
      }
      // Sale de la cola recién cuando el envío terminó bien.
      cola = cola.filter((r) => r !== registro);
      enviadosAhora++;
      enviados++;
    }
    return { enviados: enviadosAhora, pendientes: cola.length, error };
  }

  return {
    /** Número para el próximo registro; cada llamada lo avanza. */
    siguienteNumero() {
      return siguiente++;
    },
    /** Agrega un registro a la cola. No lo envía. */
    agregar(registro) {
      const errores = validarRegistro(registro);
      if (errores.length > 0) throw new Error(`registro incompleto: ${errores.join('; ')}`);
      cola = [...cola, JSON.parse(JSON.stringify(registro))];
      return cola.length;
    },
    /** Copia de los registros que faltan enviar, en orden. */
    pendientes() {
      return JSON.parse(JSON.stringify(cola));
    },
    /** Cantidad enviada desde que existe la cola. */
    totalEnviados() {
      return enviados;
    },
    /**
     * Envía lo pendiente, en orden. Frena en el primer fallo y deja el resto en la cola.
     * Si ya hay un envío en curso, devuelve ese mismo.
     * @returns {Promise<{ enviados: number, pendientes: number, error: string|null }>}
     */
    enviarPendientes() {
      if (!enCurso) {
        enCurso = vaciar().finally(() => {
          enCurso = null;
        });
      }
      return enCurso;
    },
  };
}

/** Código del documento de registros de una partida en la nube. */
export const codigoDeRegistros = (codigoPartida) => `registros_${codigoPartida}`;

/**
 * Envío a una nube con el contrato de la beta (`guardarPartida`, `cargarPartida`), como
 * persistencia/adaptadores/nubeEnMemoria.js. Guarda los registros de la partida en un documento.
 * Un registro que ya está (mismo id) no se duplica: reintentar es seguro.
 * @param {{ guardarPartida: (payload: object) => Promise<void>, cargarPartida: (codigo: string) => Promise<object|null> }} nube
 * @param {{ codigoPartida: string }} opciones
 * @returns {(registro: object) => Promise<void>}
 */
export function enviadorANube(nube, { codigoPartida }) {
  const codigo = codigoDeRegistros(codigoPartida);
  return async (registro) => {
    const documento = (await nube.cargarPartida(codigo)) ?? { codigoPartida: codigo, registros: [] };
    const registros = Array.isArray(documento.registros) ? documento.registros : [];
    if (registros.some((r) => r.id === registro.id)) return;
    await nube.guardarPartida({ codigoPartida: codigo, registros: [...registros, registro] });
  };
}

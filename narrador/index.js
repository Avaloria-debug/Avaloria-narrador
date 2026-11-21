// Contrato público del narrador (docs/cierre-diseno-v1.md, sección 6):
//   crearPartida(opciones?)                 -> estado
//   cargarPartida(json)                     -> estado
//   narrar(estado, entrada, { groqKey? })   -> Promise<{ texto, estado, tipo, registro, errores }>
// - La interfaz no toca el estado: lo recibe y lo devuelve.
// - `narrar` nunca lanza: los errores van en `errores`, como códigos para el log.
// - La clave de Groq solo entra por `groqKey`: no queda en el estado, en el registro ni en `errores`.
// - Todo el texto sale de las plantillas del contenido o de la IA ya validada.
// SIN VERIFICAR: la carga del contenido por `fetch` en el navegador.
import { exigirContenidoValido } from './contenido.js';
import { estadoInicial, VERSION_ESTADO } from './estado.js';
import { crearRng, semillaAEntero, semillaAlAzar } from './azar.js';
import { ejecutarTurno, npcsPresentes, TIPOS_TURNO, RESULTADOS_CONSULTA } from './turno.js';
import { ranuraHabilitada } from './casos/hitos.js';
import { VERSION } from './version.js';
import { registroDeTurnoNoResuelto } from './registro/registroTurnos.js';

// Línea de registro de análisis de una reformulación, en espera del turno siguiente. Clave: el RegistroTurnos.
// Vive solo en memoria: la frase del jugador no entra al estado de la partida.
const lineasPendientes = new WeakMap();
import { narrarTurno, narrarReformulacion, VENTANA_APERTURAS, anotarApertura } from './narracion.js';
import { separarAcciones } from './lectura.js';
import { conHistorial, anotarTexto } from './historial.js';
import { pedirRespuestaIA, datosDeContexto, armarContexto, validarSalida, aperturaIa, SIN_IA, MOTIVOS_IA } from './ia.js';
import { registroDeTurno, ORIGENES, MAX_ULTIMOS_TURNOS } from './registro.js';

import { estadoDeEscena } from './estadoEscena.js';
import { destinosDeViaje, prepararDiccionarios } from './comprension.js';
import { cargarDiccionarios, problemasDeDiccionarios, textoDeProblemasDeDiccionarios } from './diccionarios.js';
import { npcInicial, clampRelacion, clampDisposicion } from './npcs.js';
import { esHora } from './reloj.js';
import { MOTIVOS, CLAVES_REFORMULACION } from './motivos.js';
import { minutosAbsolutos } from './reloj.js';
import { posicionesDeNpcs } from './movimientoNpcs.js';
import { turnoDeCaso } from './casos/narrar.js';
import { accionesDeIntencion } from './casos/acciones.js';
import { aplicarAmpliado } from './ampliado.js';
import { turnoDeFoco } from './focos.js';
import { turnoDeCharla } from './charla.js';
import { turnoDeEconomia } from './economia/index.js';
import { hechosCoherencia } from './coherencia.js';
import { climaEn } from './ambiente.js';
import { franjaDe } from './seleccion.js';

// B (vacío): con el ampliado, las piezas que se juntan («… limpia. el ruido …», «ovejas… me») arrancan en mayúscula.
export function mayusculasDeOracion(t) {
  return String(t).split('\n').map((p) => p
    .replace(/^(\s*[«¿¡"]?)([a-záéíóúñ])/, (_, a, c) => a + c.toUpperCase())
    .replace(/([.!?]»? +[«¿¡]?)([a-záéíóúñ])/g, (_, a, c) => a + c.toUpperCase())).join('\n');
}

export const TIPOS_SALIDA = Object.freeze({
  NARRACION: 'narracion',
  REFORMULACION: 'reformulacion',
  DIALOGO_IA: 'dialogo_ia',
  ERROR: 'error',
});

export const ERRORES = Object.freeze({
  ENTRADA_INVALIDA: 'entrada_invalida',
  ESTADO_INVALIDO: 'estado_invalido',
  ERROR_INTERNO: 'error_interno',
  TEXTO_INVALIDO: 'texto_invalido',
  NARRACION_DE_RESPALDO: 'narracion_de_respaldo',
  REGISTRO: 'registro',
  IA: 'ia',
  CASO: 'caso',
  AMPLIADO: 'ampliado',
});

export const AVISO_VERSION_CONTENIDO = 'version_contenido';

async function leerContenidoPorDefecto() {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { leerContenido } = await import('./cargarContenido.js');
    return leerContenido();
  }
  // SIN VERIFICAR: navegador.
  const respuesta = await fetch(new URL('../data/contenido/contenido-v3.json', import.meta.url));
  return respuesta.json();
}

/** Contenido validado. Se carga una vez, al importar el módulo. */
export const contenido = exigirContenidoValido(await leerContenidoPorDefecto());

/**
 * Diccionarios de la comprensión, cargados una vez. `cargarDiccionarios` no lanza: anota en cada diccionario lo que
 * falló. Son obligatorios: si falta uno o viene vacío, `problemasDiccionarios` lo dice (con el archivo), se escribe en la
 * consola y `crearPartida` y `cargarPartida` se niegan a arrancar una partida (`exigirDiccionarios`).
 * SIN VERIFICAR: la carga por `fetch` en el navegador.
 */
const diccionariosCargados = await cargarDiccionarios(contenido);
export const diccionarios = prepararDiccionarios(diccionariosCargados, contenido.intenciones);
export const problemasDiccionarios = problemasDeDiccionarios(diccionariosCargados);
if (problemasDiccionarios.length > 0) console.error(textoDeProblemasDeDiccionarios(problemasDiccionarios));

/**
 * Error de arranque por diccionarios que faltan. `opciones.problemasDiccionarios` es para tests.
 * @throws {Error} con el archivo que falta
 */
function exigirDiccionarios(opciones) {
  const problemas = Array.isArray(opciones?.problemasDiccionarios) ? opciones.problemasDiccionarios : problemasDiccionarios;
  if (problemas.length > 0) throw new Error(textoDeProblemasDeDiccionarios(problemas));
}

const lista = (v) => (Array.isArray(v) ? v : []);
const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const porId = (l, id) => lista(l).find((x) => x.id === id);

/**
 * Estado inicial de una partida: escena inicial, reloj día 1 08:00, dinero sorteado según
 * `reglas.dineroInicial`, NPCs en su estado inicial, sin eventos activos, inventario y marcas vacíos.
 * @param {{ semilla?: number|string }} [opciones] con semilla, la partida es reproducible
 */
export function crearPartida(opciones = {}) {
  exigirDiccionarios(opciones);
  const semilla = opciones?.semilla;
  const rng = crearRng(semilla === undefined || semilla === null ? semillaAlAzar() : semillaAEntero(semilla));
  const base = estadoInicial(contenido, { rng });
  return {
    ...base,
    eventosActivos: [],
    ventanaAperturas: [],
    ventanaAperturasIa: [],
    diagnosticoAperturasIa: { aperturasRepetidas: 0, ultimaRepetida: null, aperturasRecortadas: 0 },
    ultimosTurnos: [],
    numeroRegistro: 0,
    iaAgotadaDia: null,
    avisos: [],
    caso: null,
    semilla: rng.estado(),
  };
}

/** Pregunta de destino pendiente: [{ id, nombre }] con turno, o null. */
function destinoPendienteValido(p) {
  if (!esObjeto(p) || !Array.isArray(p.opciones)) return null;
  const opciones = p.opciones.filter((o) => esObjeto(o) && typeof o.id === 'string' && typeof o.nombre === 'string').map((o) => ({ id: o.id, nombre: o.nombre }));
  return opciones.length > 0 ? { opciones, turno: Number.isInteger(p.turno) && p.turno >= 0 ? p.turno : 0 } : null;
}

/** Motivo de la última reformulación: solo un id de motivo conocido (nunca texto del jugador), o null. */
function motivoReformulacionValido(m) {
  return typeof m === 'string' && CLAVES_REFORMULACION.includes(m) ? m : null;
}

function exigirFormaMinima(e) {
  const falta = (que) => {
    throw new Error(`cargarPartida: el estado no tiene la forma mínima (${que})`);
  };
  if (!esObjeto(e)) falta('no es un objeto');
  if (typeof e.version !== 'string') falta('version');
  if (e.version !== VERSION_ESTADO) falta(`version ${JSON.stringify(e.version)} desconocida`);
  if (!esObjeto(e.jugador)) falta('jugador');
  if (typeof e.jugador.escenaId !== 'string') falta('jugador.escenaId');
  for (const moneda of ['bronce', 'plata']) {
    if (!(Number.isFinite(e.jugador[moneda]) && e.jugador[moneda] >= 0)) falta(`jugador.${moneda}`);
  }
  if (!esObjeto(e.reloj) || !Number.isInteger(e.reloj.dia) || e.reloj.dia < 1 || !esHora(e.reloj.hora)) falta('reloj');
  if (!esObjeto(e.npcs)) falta('npcs');
  for (const [id, n] of Object.entries(e.npcs)) {
    if (!esObjeto(n) || !Number.isFinite(n.relacion) || !Number.isFinite(n.disposicion) || !Array.isArray(n.conocimientosRevelados)) falta(`npcs.${id}`);
  }
  if (!Array.isArray(e.eventosActivos) || !e.eventosActivos.every((a) => esObjeto(a) && typeof a.id === 'string' && typeof a.escenaId === 'string')) {
    falta('eventosActivos');
  }
  if (!Array.isArray(e.inventario) || !e.inventario.every((i) => esObjeto(i) && typeof i.objetoId === 'string')) falta('inventario');
  if (!Array.isArray(e.marcas) || !e.marcas.every((m) => typeof m === 'string')) falta('marcas');
}

/** Completa los campos que no son de la forma mínima. */
function conValoresPorDefecto(e) {
  return {
    version: e.version,
    versionContenido: typeof e.versionContenido === 'string' ? e.versionContenido : null,
    jugador: { nombre: typeof e.jugador.nombre === 'string' ? e.jugador.nombre : '', escenaId: e.jugador.escenaId, bronce: e.jugador.bronce, plata: e.jugador.plata },
    reloj: { dia: e.reloj.dia, hora: e.reloj.hora },
    npcs: Object.fromEntries(
      Object.entries(e.npcs).map(([id, n]) => [
        id,
        {
          relacion: clampRelacion(n.relacion),
          disposicion: clampDisposicion(n.disposicion),
          bloqueadoConocimientos: n.bloqueadoConocimientos === true,
          conocimientosRevelados: n.conocimientosRevelados.filter((k) => typeof k === 'string'),
        },
      ]),
    ),
    eventosActivos: e.eventosActivos.map((a) => ({
      id: a.id,
      escenaId: a.escenaId,
      turnosRestantes: Number.isInteger(a.turnosRestantes) ? a.turnosRestantes : null,
      horaFin: esObjeto(a.horaFin) && Number.isInteger(a.horaFin.dia) && esHora(a.horaFin.hora) ? { dia: a.horaFin.dia, hora: a.horaFin.hora } : null,
    })),
    inventario: e.inventario.map((i) => ({ objetoId: i.objetoId, usosRestantes: Number.isInteger(i.usosRestantes) ? i.usosRestantes : null })),
    marcas: [...e.marcas],
    reformulacionPendiente: e.reformulacionPendiente === true,
    destinoPendiente: destinoPendienteValido(e.destinoPendiente),
    motivoReformulacion: motivoReformulacionValido(e.motivoReformulacion),
    ventanaAperturas: lista(e.ventanaAperturas).filter((a) => typeof a === 'string').slice(-VENTANA_APERTURAS),
    // Aperturas de las últimas respuestas de IA (dos palabras), con la misma ventana de 5 que las plantillas.
    ventanaAperturasIa: lista(e.ventanaAperturasIa).filter((a) => typeof a === 'string').slice(-VENTANA_APERTURAS),
    // Diagnóstico de aperturas de IA: cuántas respuestas repitieron una apertura reciente (y la última, sin la frase del
    // jugador) y en cuántos pedidos la línea de aperturas a evitar se recortó por el tope del contexto.
    diagnosticoAperturasIa: diagnosticoAperturasIaValido(e.diagnosticoAperturasIa),
    ultimosTurnos: lista(e.ultimosTurnos).filter((t) => typeof t === 'string').slice(-MAX_ULTIMOS_TURNOS),
    numeroRegistro: Number.isInteger(e.numeroRegistro) && e.numeroRegistro >= 0 ? e.numeroRegistro : 0,
    iaAgotadaDia: typeof e.iaAgotadaDia === 'string' ? e.iaAgotadaDia : null,
    ...(Number.isFinite(e.iaGroqPausaHasta) ? { iaGroqPausaHasta: e.iaGroqPausaHasta } : {}),
    avisos: lista(e.avisos).filter(esObjeto).map((a) => ({ ...a })),
    // Estado del motor de caso (tags, hitos, instancia): se conserva tal cual, copiado.
    caso: esObjeto(e.caso) ? structuredClone(e.caso) : null,
    // Estado del contenido ampliado (narrador/ampliado.js): solo si existe.
    ...(esObjeto(e.ext) ? { ext: structuredClone(e.ext) } : {}),
    semilla: Number.isInteger(e.semilla) ? e.semilla | 0 : semillaAlAzar(),
  };
}

/** Deja en el estado solo lo que existe en el contenido actual, y completa lo que falta. */
function reconstruir(e) {
  const escenas = new Set(contenido.escenas.map((x) => x.id));
  const eventos = new Set(contenido.eventos.map((x) => x.id));
  const objetos = new Set(contenido.objetos.map((x) => x.id));
  const marcas = new Set(Object.keys(contenido.reglas.marcas ?? {}));
  const npcs = {};
  for (const def of contenido.npcs) {
    const guardado = e.npcs[def.id];
    const conocimientos = new Set(lista(def.conocimientos).map((k) => k.id));
    npcs[def.id] = guardado
      ? { ...guardado, conocimientosRevelados: guardado.conocimientosRevelados.filter((k) => conocimientos.has(k)) }
      : npcInicial(def);
  }
  return {
    ...e,
    jugador: { ...e.jugador, escenaId: escenas.has(e.jugador.escenaId) ? e.jugador.escenaId : contenido.reglas.escenaInicial },
    npcs,
    eventosActivos: e.eventosActivos.filter((a) => eventos.has(a.id) && escenas.has(a.escenaId)),
    inventario: e.inventario.filter((i) => objetos.has(i.objetoId)),
    marcas: e.marcas.filter((m) => marcas.has(m)),
  };
}

/**
 * Restaura una partida guardada. Acepta el objeto o su texto JSON.
 * Lanza un error si no tiene la forma mínima (cierre-diseno-v1.md, sección 5).
 * Si la versión del contenido guardada no es la actual, reconstruye lo que se puede
 * (saca lo que ya no existe, agrega los NPCs nuevos) y deja un aviso en `estado.avisos`.
 * @param {string|object} json
 */
const enteroNoNegativo = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
function diagnosticoAperturasIaValido(d) {
  const x = d && typeof d === 'object' ? d : {};
  return { aperturasRepetidas: enteroNoNegativo(x.aperturasRepetidas), ultimaRepetida: typeof x.ultimaRepetida === 'string' ? x.ultimaRepetida : null, aperturasRecortadas: enteroNoNegativo(x.aperturasRecortadas) };
}

export function cargarPartida(json, opciones = {}) {
  exigirDiccionarios(opciones);
  let crudo = json;
  if (typeof json === 'string') {
    try {
      crudo = JSON.parse(json);
    } catch {
      throw new Error('cargarPartida: el texto no es JSON');
    }
  }
  exigirFormaMinima(crudo);
  const estado = conValoresPorDefecto(crudo);
  if (estado.versionContenido === contenido.version) {
    if (!porId(contenido.escenas, estado.jugador.escenaId)) throw new Error('cargarPartida: el estado no tiene la forma mínima (escena desconocida)');
    for (const def of contenido.npcs) {
      if (!estado.npcs[def.id]) throw new Error(`cargarPartida: el estado no tiene la forma mínima (falta el NPC ${def.id})`);
    }
    return estado;
  }
  const reconstruido = reconstruir(estado);
  return {
    ...reconstruido,
    versionContenido: contenido.version,
    avisos: [...reconstruido.avisos, { tipo: AVISO_VERSION_CONTENIDO, guardada: estado.versionContenido, actual: contenido.version }],
  };
}

/** Texto corto de una acción hecha, para los últimos turnos: la primera forma de la intención y los nombres. */
function etiquetaDeAccion(accion) {
  const intencion = porId(contenido.intenciones, accion.intencionId);
  const forma = lista(intencion?.formas)[0] ?? '';
  const p = accion.parametros ?? {};
  const nombres = [
    porId(contenido.npcs, p.npcId)?.nombre,
    porId(contenido.objetos, p.objetoId)?.nombre,
    p.destino != null ? destinosDeViaje(contenido.escenas).find((d) => d.id === p.destino)?.nombre : null,
  ].filter(Boolean);
  const texto = [forma, ...nombres].join(' ').trim();
  return texto === '' ? null : texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** ¿El texto se puede mostrar? Sin ids, corchetes ni placeholders. */
function textoMostrable(texto) {
  return typeof texto === 'string' && texto.trim() !== '' && !/[{}[\]<>]/.test(texto) && !/[\p{L}\p{N}]_[\p{L}\p{N}]/u.test(texto);
}

/**
 * Motor de caso en un turno de acción. Solo corre si el estado tiene un caso activo (`estado.caso` con casoId,
 * sin cerrar) y su plantilla llega en `opciones.casos`. Sin caso activo devuelve null y el turno no cambia.
 * El contenido v3 no trae casos: la plantilla entra por opciones (SUPUESTO, docs/SUPUESTOS.md).
 * @returns {Promise<null|{caso:object, npcs:object, texto:string|null}>}
 */
async function turnoConCaso(partida, turno, opciones) {
  const estadoCaso = partida.caso;
  if (!esObjeto(estadoCaso) || typeof estadoCaso.casoId !== 'string' || estadoCaso.cerrado) return null;
  // Consulta: solo la que revela un conocimiento entra como `preguntar_clave` (docs/auditoria-motor-caso.md, B4).
  const esConsulta = turno.tipo === TIPOS_TURNO.CONSULTA;
  if (esConsulta ? turno.consulta?.resultado !== RESULTADOS_CONSULTA.EXITO : turno.tipo !== TIPOS_TURNO.ACCION) return null;
  const plantilla = lista(opciones?.casos).find((c) => c?.id === estadoCaso.casoId);
  if (!plantilla) return null;
  if (esConsulta) return turnoConCasoDeConsulta(partida, turno, plantilla, opciones);

  const nuevo = turno.estado;
  const posiciones = posicionesDeNpcs(nuevo.reloj, contenido);
  const npcs = Object.fromEntries(
    Object.entries(nuevo.npcs).map(([id, n]) => [id, { escena: posiciones[id] ?? null, relacion: n.relacion, bloqueadoConocimientos: n.bloqueadoConocimientos === true }]),
  );
  const parametros = turno.accion.parametros ?? {};
  const accionId = accionesDeIntencion(turno.accion.intencionId)[0] ?? null;
  const escenaAccion = porId(contenido.escenas, turno.accion.escenaAnterior);
  const contadorTurnos = (estadoCaso.contadorTurnos ?? 0) + 1;
  const r = await turnoDeCaso({
    estadoCaso,
    caso: plantilla,
    accion: accionId ? { accionId, npcId: parametros.npcId ?? null, escenaId: turno.accion.escenaAnterior, ciudad: escenaAccion?.ciudad ?? null } : null,
    mundo: {
      hora: minutosAbsolutos(nuevo.reloj) / 60,
      turno: contadorTurnos,
      escena: nuevo.jugador.escenaId,
      estadoEvento: turno.escena?.estado ?? null,
      npcs,
    },
    horasAvanzadas: turno.accion.costoHoras ?? 0,
    contenido,
    semilla: partida.semilla,
    persistencia: opciones?.persistenciaCasos ?? null,
    jugadorId: opciones?.jugadorId ?? null,
    partidaId: opciones?.partidaId ?? null,
  });
  const npcsNuevos = Object.fromEntries(
    Object.entries(nuevo.npcs).map(([id, n]) => {
      const m = r.npcs[id];
      return [id, m ? { ...n, relacion: clampRelacion(m.relacion), bloqueadoConocimientos: m.bloqueadoConocimientos === true } : n];
    }),
  );
  return { caso: { ...r.estadoCaso, contadorTurnos }, npcs: npcsNuevos, texto: r.texto?.texto ?? null };
}

/** Pregunta que reveló un conocimiento: `preguntar_clave` en el motor de caso, sin horas y sin desenlace. */
async function turnoConCasoDeConsulta(partida, turno, plantilla, opciones) {
  const estadoCaso = partida.caso;
  const nuevo = turno.estado;
  const posiciones = posicionesDeNpcs(nuevo.reloj, contenido);
  const npcs = Object.fromEntries(
    Object.entries(nuevo.npcs).map(([id, n]) => [id, { escena: posiciones[id] ?? null, relacion: n.relacion, bloqueadoConocimientos: n.bloqueadoConocimientos === true }]),
  );
  const { npcId, conocimientoId } = turno.consulta;
  const escenaId = nuevo.jugador.escenaId;
  const pista = lista(estadoCaso.instancia?.pistas).find((p) => p.conocimientoId === conocimientoId);
  const contadorTurnos = (estadoCaso.contadorTurnos ?? 0) + 1;
  const r = await turnoDeCaso({
    estadoCaso,
    caso: plantilla,
    accion: {
      accionId: 'preguntar_clave', npcId, conocimientoId, escenaId, ciudad: porId(contenido.escenas, escenaId)?.ciudad ?? null,
      // La consulta ya pasó el umbral de revelación del conocimiento (`puedeRevelar`).
      contexto: { superaUmbral: true, ranuraHabilitada: pista ? ranuraHabilitada(estadoCaso, pista.ranura) : false },
    },
    mundo: { hora: minutosAbsolutos(nuevo.reloj) / 60, turno: contadorTurnos, escena: escenaId, estadoEvento: estadoDeEscena(escenaId, nuevo.eventosActivos ?? [], contenido), npcs },
    horasAvanzadas: 0,
    sinDesenlace: true,
    contenido,
    semilla: partida.semilla,
    persistencia: opciones?.persistenciaCasos ?? null,
    jugadorId: opciones?.jugadorId ?? null,
    partidaId: opciones?.partidaId ?? null,
  });
  const npcsNuevos = Object.fromEntries(
    Object.entries(nuevo.npcs).map(([id, n]) => {
      const m = r.npcs[id];
      return [id, m ? { ...n, relacion: clampRelacion(m.relacion), bloqueadoConocimientos: m.bloqueadoConocimientos === true } : n];
    }),
  );
  return { caso: { ...r.estadoCaso, contadorTurnos }, npcs: npcsNuevos, texto: r.texto?.texto ?? null };
}

// X1: tras un 429 sin retry-after, Groq queda en pausa 10 min (va a la IA local).
const PAUSA_GROQ_MS = 10 * 60 * 1000;
const diaReal = (fecha) => new Date(fecha).toISOString().slice(0, 10);

/** Fecha real del turno. Si el reloj inyectado falla o da algo que no es una fecha, usa el del sistema. */
function fechaActual(ahora) {
  try {
    const fecha = typeof ahora === 'function' ? ahora() : Date.now();
    return Number.isNaN(new Date(fecha).getTime()) ? Date.now() : fecha;
  } catch {
    return Date.now();
  }
}

/**
 * Ejecuta un turno y devuelve lo que la interfaz muestra y guarda.
 * Flujo: comprender (turno.js) -> si reformula, texto de reformulación -> si ejecuta, turno y narración por plantillas
 * -> si el código no entendió ni tras reformular, IA (con clave y cupo); si la IA no responde, plantilla -> registro.
 * @param {object} estado estado de `crearPartida`, `cargarPartida` o de un `narrar` anterior
 * @param {{ tipo: 'boton', intencionId: string, parametros?: object } | { tipo: 'texto', texto: string }} entrada
 * @param {{
 *   groqKey?: string|null,
 *   iaLocal?: { listo: () => boolean, pedir: (o: { contexto: object }) => Promise<object> },
 *   http?: Function, esperar?: (ms: number) => Promise<void>, ahora?: () => Date|number|string,
 *   cola?: { agregar: (registro: object) => unknown }, diccionarios?: object|null,
 *   casos?: object[], persistenciaCasos?: object, jugadorId?: string, partidaId?: string,
 * }} [opciones] `http`, `esperar` y `ahora` son para tests: por defecto, `fetch` y el reloj del sistema.
 *   `cola`: la cola de registros (narrador/registroFirestore.js); si llega, el registro del turno se encola.
 * @returns {Promise<{
 *   texto: string, estado: object, tipo: 'narracion'|'reformulacion'|'dialogo_ia'|'error',
 *   registro: object|null, errores: string[],
 * }>}
 */
export async function narrar(estado, entrada, opciones = {}) {
  // Fase 6 (V7): con ampliado, «miro la puerta y después toco la ventana» son dos turnos seguidos (máx. 3).
  if (esObjeto(opciones?.ampliado) && entrada?.tipo === 'texto' && typeof entrada.texto === 'string' && !opciones.__parte) {
    const partes = separarAcciones(entrada.texto);
    if (partes.length > 1) {
      let e = estado; const textos = []; const errs = []; let ultima = null;
      for (const p of partes) {
        ultima = await narrar(e, { ...entrada, texto: p }, { ...opciones, __parte: true });
        textos.push(ultima.texto); errs.push(...ultima.errores); e = ultima.estado;
        if (ultima.tipo === TIPOS_SALIDA.REFORMULACION || ultima.tipo === 'error') break;
      }
      return { ...ultima, texto: textos.filter(Boolean).join('\n\n'), errores: errs };
    }
  }
  const errores = [];
  // W2: anti-repetición global, solo con ampliado (sin ampliado: idéntico a antes).
  // Coherencia (B): hechos de la escena para filtrar candidatas (clima del turno, franja, interior/llegada).
  const coh = (est) => {
    if (!esObjeto(opciones?.ampliado) || !est?.jugador) return null;
    const ext = est.ext ?? {};
    const clima = Number.isInteger(ext.semillaBase) ? climaEn(ext.semillaBase, est.reloj, opciones.ampliado.guia?.umbrales?.clima_cambia_cada_horas) : null;
    const llegada = est !== estado && est.jugador.escenaId !== estado?.jugador?.escenaId;
    return { ...hechosCoherencia({ estado: est, clima, franja: franjaDe(est.reloj?.hora ?? '08:00') }), llegada };
  };
  const conLineas = (fn, est = estado) => (esObjeto(opciones?.ampliado) ? conHistorial(estado?.ext?.lineas, fn, coh(est)) : fn());
  const groqKey = opciones?.groqKey;
  // Ningún mensaje de error puede llevar la clave.
  const anotar = (codigo, detalle = '') => {
    let texto = detalle ? `${codigo}: ${detalle}` : codigo;
    if (typeof groqKey === 'string' && groqKey !== '') texto = texto.split(groqKey).join('***');
    errores.push(texto);
  };
  const rngDeRespaldo = crearRng(Number.isInteger(estado?.semilla) ? estado.semilla : 0);
  const textoDeRespaldo = (ventana = []) => {
    try {
      return narrarReformulacion(contenido, MOTIVOS.NO_ENTENDIDO, {}, { rng: rngDeRespaldo, aperturas: ventana }).texto;
    } catch {
      return '';
    }
  };
  const error = (codigo, detalle) => {
    anotar(codigo, detalle);
    return { texto: textoDeRespaldo(), estado, tipo: TIPOS_SALIDA.ERROR, registro: null, errores };
  };

  try {
    let partida;
    try {
      partida = cargarPartida(estado);
    } catch (e) {
      return error(ERRORES.ESTADO_INVALIDO, e instanceof Error ? e.message : '');
    }
    const ahora = fechaActual(opciones?.ahora);
    const rng = crearRng(partida.semilla);
    const ventana = partida.ventanaAperturas;

    // `opciones.diccionarios`: para tests; `null` los apaga.
    const dic = esObjeto(opciones) && 'diccionarios' in opciones ? opciones.diccionarios : diccionarios;
    // Fase 3: con ampliado, un verbo sobre un foco activo (o un fijo de la escena) gana antes de la comprensión.
    let turno = null;
    if (esObjeto(opciones?.ampliado) && entrada?.tipo === 'texto') {
      try {
        // A4: charla directa (saludo con nombre, quién sos / qué hacés / de dónde sos, «qué dice X»).
        const ch = conHistorial(partida.ext?.lineas, () => turnoDeCharla({ amp: opciones.ampliado, contenido, partida, texto: entrada.texto }), coh(partida));
        if (ch?.turno) turno = ch.turno;
        if (!turno) turno = conHistorial(partida.ext?.lineas, () => turnoDeEconomia({ amp: opciones.ampliado, contenido, partida, texto: entrada.texto }), coh(partida));
        if (!turno) turno = conHistorial(partida.ext?.lineas, () => turnoDeFoco({ amp: opciones.ampliado, contenido, partida, texto: ch?.reescrito ?? entrada.texto, dic }), coh(partida));
      } catch (e) {
        anotar(ERRORES.AMPLIADO, e instanceof Error ? e.message : '');
      }
    }
    turno ??= ejecutarTurno(partida, entrada, { contenido, rng, diccionarios: dic });
    if (turno.tipo === TIPOS_TURNO.ERROR) return error(ERRORES.ENTRADA_INVALIDA, turno.error);

    let texto = null;
    let tipo = TIPOS_SALIDA.NARRACION;
    let origen = ORIGENES.CODIGO;
    let aperturas = ventana;
    let ventanaIa = partida.ventanaAperturasIa;
    let diagnosticoIa = partida.diagnosticoAperturasIa;
    let iaAgotadaDia = partida.iaAgotadaDia;
    let iaGroqPausaHasta = partida.iaGroqPausaHasta ?? null;

    if (turno.tipo === TIPOS_TURNO.IA) {
      // El código no entendió ni tras reformular: IA, si hay clave y cupo.
      const hayClave = typeof groqKey === 'string' && groqKey.trim() !== '';
      const sinCupoHoy = iaAgotadaDia !== null && iaAgotadaDia === diaReal(ahora);
      const iaLocal = opciones?.iaLocal;
      const aceptar = (respuesta, recientesIa) => {
        if (respuesta.ok && validarSalida(respuesta.texto).ok) {
          const apertura = aperturaIa(respuesta.texto);
          if (recientesIa.includes(apertura)) diagnosticoIa = { ...diagnosticoIa, aperturasRepetidas: diagnosticoIa.aperturasRepetidas + 1, ultimaRepetida: apertura };
          texto = respuesta.texto;
          tipo = TIPOS_SALIDA.DIALOGO_IA;
          origen = ORIGENES.IA;
          ventanaIa = anotarApertura(partida.ventanaAperturasIa, apertura);
          return true;
        }
        anotar(ERRORES.IA, [respuesta.error, respuesta.motivo, respuesta.detalle].filter(Boolean).join(': '));
        return false;
      };
      // X1: prioridad fija código → Groq → IA local → plantilla. Silencioso para el jugador.
      const ahoraMs = new Date(ahora).getTime();
      const groqEnPausa = Number.isFinite(iaGroqPausaHasta) && ahoraMs < iaGroqPausaHasta;
      let usarLocal = false;
      if (!hayClave) {
        anotar(ERRORES.IA, `${SIN_IA}: ${MOTIVOS_IA.SIN_CLAVE}`);
        usarLocal = true;
      } else if (sinCupoHoy) {
        anotar(ERRORES.IA, `${SIN_IA}: ${MOTIVOS_IA.RPD_AGOTADO}`);
        usarLocal = true;
      } else if (groqEnPausa) {
        anotar(ERRORES.IA, `${SIN_IA}: ${MOTIVOS_IA.CUPO}: pausa`);
        usarLocal = true;
      } else {
        const http = typeof opciones?.http === 'function' ? opciones.http : globalThis.fetch?.bind(globalThis);
        if (typeof http !== 'function') {
          anotar(ERRORES.IA, MOTIVOS_IA.ERROR_RED);
          usarLocal = true;
        } else {
          const recientesIa = partida.ventanaAperturasIa;
          const datos = datosDeContexto(partida, contenido, { frase: entrada.texto, ultimasAcciones: partida.ultimosTurnos, evitarAperturas: recientesIa });
          let respuesta;
          try {
            respuesta = await pedirRespuestaIA({
              groqKey,
              contexto: datos,
              http,
              ...(typeof opciones?.esperar === 'function' ? { esperar: opciones.esperar } : {}),
            });
          } catch (e) {
            respuesta = { ok: false, error: null, motivo: MOTIVOS_IA.ERROR_RED, detalle: e instanceof Error ? e.message : '' };
          }
          let recortadas = false;
          try { recortadas = armarContexto(datos).aperturasRecortadas; } catch { /* el contexto no entra: pedirRespuestaIA no llama */ }
          if (recortadas) diagnosticoIa = { ...diagnosticoIa, aperturasRecortadas: diagnosticoIa.aperturasRecortadas + 1 };
          if (!aceptar(respuesta, recientesIa)) {
            if (respuesta.error === SIN_IA && respuesta.motivo === MOTIVOS_IA.RPD_AGOTADO) iaAgotadaDia = diaReal(ahora);
            if (respuesta.motivo === MOTIVOS_IA.CUPO) iaGroqPausaHasta = ahoraMs + (Number.isFinite(respuesta.esperaMs) && respuesta.esperaMs > 0 ? respuesta.esperaMs : PAUSA_GROQ_MS);
            usarLocal = true;
          }
        }
      }
      if (usarLocal && texto === null && typeof iaLocal?.listo === 'function' && iaLocal.listo()) {
        // IA local: nunca recibe la clave de Groq.
        const recientesIa = partida.ventanaAperturasIa;
        const datos = datosDeContexto(partida, contenido, { frase: entrada.texto, ultimasAcciones: partida.ultimosTurnos, evitarAperturas: recientesIa });
        let respuesta;
        try { respuesta = await iaLocal.pedir({ contexto: datos }); } catch (e) { respuesta = { ok: false, error: null, motivo: 'local_error', detalle: e instanceof Error ? e.message : '' }; }
        aceptar(respuesta ?? { ok: false, motivo: 'local_error' }, recientesIa);
      }
      if (texto === null) {
        // Modo código: la plantilla de "no entendí".
        const plantilla = conLineas(() => narrarReformulacion(contenido, MOTIVOS.NO_ENTENDIDO, {}, { rng, aperturas: ventana }));
        texto = plantilla.texto;
        aperturas = anotarApertura(ventana, plantilla.apertura);
      }
    } else if (turno.tipo === 'foco') {
      texto = turno.texto;
    } else {
      const narracion = conLineas(() => narrarTurno(turno, { contenido, rng, aperturas: ventana }));
      texto = narracion.texto;
      aperturas = narracion.aperturas;
      if (narracion.respaldo) anotar(ERRORES.NARRACION_DE_RESPALDO, turno.intencionId ?? '');
      if (turno.tipo === TIPOS_TURNO.REFORMULAR) tipo = TIPOS_SALIDA.REFORMULACION;
    }

    if (!textoMostrable(texto)) {
      anotar(ERRORES.TEXTO_INVALIDO);
      texto = textoDeRespaldo(ventana);
      if (tipo === TIPOS_SALIDA.DIALOGO_IA) {
        tipo = TIPOS_SALIDA.NARRACION;
        origen = ORIGENES.CODIGO;
      }
    }

    // Motor de caso: solo con caso activo. Sin caso, el turno queda igual.
    let conCaso = null;
    try {
      conCaso = await turnoConCaso(partida, turno, opciones);
    } catch (e) {
      anotar(ERRORES.CASO, e instanceof Error ? e.message : '');
    }
    if (conCaso?.texto) {
      if (textoMostrable(conCaso.texto)) texto = `${texto}\n\n${conCaso.texto}`;
      else anotar(ERRORES.TEXTO_INVALIDO, 'caso');
    }

    // Contenido ampliado: solo si llega `opciones.ampliado`. Un fallo deja el turno como estaba.
    let ext = partida.ext;
    if (esObjeto(opciones?.ampliado)) {
      try {
        const r = conLineas(() => aplicarAmpliado({ amp: opciones.ampliado, contenido, antes: partida, despues: turno.estado, turno, entrada, texto, aperturas, tipo, densidad: opciones.densidad }), turno.estado);
        if (textoMostrable(r.texto)) texto = mayusculasDeOracion(r.texto);
        aperturas = r.aperturas;
        ext = r.ext;
      } catch (e) {
        anotar(ERRORES.AMPLIADO, e instanceof Error ? e.message : '');
      }
      if (esObjeto(ext)) {
        // B (conocimiento): NPC cuyo nombre ya salió en el texto o lo escribió el jugador.
        const oidos = new Set(Array.isArray(partida.ext?.nombresOidos) ? partida.ext.nombresOidos : []);
        const visto = `${texto}\n${entrada?.tipo === 'texto' ? entrada.texto : ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        for (const n of contenido.npcs ?? []) { const c = n.nombre.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); if (new RegExp(`\\b${c}\\b`).test(visto)) oidos.add(n.id); }
        ext = { ...ext, lineas: anotarTexto(partida.ext?.lineas, texto), nombresOidos: [...oidos] };
        // Fase 8: un sistema (regateo, trabajo) no sobrevive a un cambio de escena.
        if (ext.sistema?.sub?.escena && ext.sistema.sub.escena !== turno.estado.jugador.escenaId) ext = { ...ext, sistema: null };
      }
    }

    // Registro: solo los turnos con texto libre.
    let registro = null;
    let numeroRegistro = partida.numeroRegistro;
    if (entrada?.tipo === 'texto') {
      try {
        registro = registroDeTurno({
          entrada,
          turno,
          estadoAntes: partida,
          estadoEscena: estadoDeEscena(partida.jugador.escenaId, partida.eventosActivos, contenido),
          respuestaMostrada: texto,
          origenRespuesta: origen,
          ultimosTurnos: partida.ultimosTurnos,
          numero: numeroRegistro + 1,
          fecha: ahora,
        });
        numeroRegistro += 1;
      } catch (e) {
        anotar(ERRORES.REGISTRO, e instanceof Error ? e.message : '');
      }
      // Cola de envío (narrador/registroFirestore.js), si la interfaz la pasa. Solo encola: no envía.
      if (registro && typeof opciones?.cola?.agregar === 'function') {
        try {
          opciones.cola.agregar(registro);
        } catch (e) {
          anotar(ERRORES.REGISTRO, e instanceof Error ? e.message : '');
        }
      }
    }

    const etiqueta = turno.tipo === TIPOS_TURNO.ACCION ? etiquetaDeAccion(turno.accion) : null;
    const nuevo = {
      ...turno.estado,
      ...(conCaso ? { caso: conCaso.caso, npcs: conCaso.npcs } : {}),
      ventanaAperturas: aperturas,
      ventanaAperturasIa: ventanaIa,
      diagnosticoAperturasIa: diagnosticoIa,
      ultimosTurnos: etiqueta ? [...partida.ultimosTurnos, etiqueta].slice(-MAX_ULTIMOS_TURNOS) : partida.ultimosTurnos,
      numeroRegistro,
      iaAgotadaDia,
      ...(iaGroqPausaHasta !== null ? { iaGroqPausaHasta } : {}),
      ...(ext ? { ext } : {}),
      semilla: rng.estado(),
    };
    // Registro de turnos (narrador/registro/): solo con `opciones.registroTurnos` (un RegistroTurnos). Una línea por
    // frase no resuelta por regla (docs/fase2-aprendizaje.md):
    // - reformulación registrable: la línea queda PENDIENTE en memoria (nunca en el estado, que guarda solo el id del motivo);
    // - turno siguiente que pasa a la IA (o a sin_ia): se escribe solo la línea de la IA, con el motivo original;
    // - turno siguiente de texto resuelto por regla o pedido de aclaración: la pendiente se descarta;
    // - turno siguiente que no es texto (botón): la pendiente se escribe una vez, al cerrar ese turno.
    // Un fallo al guardar no rompe el turno.
    if (typeof opciones?.registroTurnos?.guardar === 'function') {
      try {
        const destino = opciones.registroTurnos;
        const pendiente = lineasPendientes.get(destino);
        lineasPendientes.delete(destino);
        // Vale solo si la partida sigue en esa reformulación (mismo id de motivo en el estado).
        const vigente = pendiente && pendiente.motivo === partida.motivoReformulacion ? pendiente : null;
        if (entrada?.tipo === 'texto') {
          const presente = npcsPresentes(partida, contenido)[0];
          const registroTurno = registroDeTurnoNoResuelto({
            version: VERSION,
            fecha: new Date(ahora),
            entrada,
            escena: partida.jugador.escenaId,
            turno,
            origen,
            motivoPrevio: partida.motivoReformulacion ?? null,
            respuesta: texto,
            relacion: presente ? partida.npcs?.[presente.id]?.relacion ?? null : null,
          });
          if (registroTurno && turno.tipo === TIPOS_TURNO.REFORMULAR) {
            // SUPUESTO: dos reformulaciones registrables seguidas son dos frases distintas; la anterior se escribe.
            if (vigente) await destino.guardar(vigente.linea);
            lineasPendientes.set(destino, { linea: registroTurno, motivo: turno.motivo });
          } else if (registroTurno) {
            await destino.guardar(registroTurno); // turno de IA: una sola línea, la pendiente no se escribe
          }
        } else if (vigente) {
          await destino.guardar(vigente.linea);
        }
      } catch (e) {
        anotar(ERRORES.REGISTRO, e instanceof Error ? e.message : '');
      }
    }
    return { texto, estado: nuevo, tipo, registro, errores };
  } catch (e) {
    return error(ERRORES.ERROR_INTERNO, e instanceof Error ? e.message : '');
  }
}

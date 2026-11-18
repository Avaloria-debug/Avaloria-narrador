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
import { ejecutarTurno, TIPOS_TURNO } from './turno.js';
import { narrarTurno, narrarReformulacion, VENTANA_APERTURAS, anotarApertura } from './narracion.js';
import { pedirRespuestaIA, datosDeContexto, validarSalida, SIN_IA, MOTIVOS_IA } from './ia.js';
import { registroDeTurno, ORIGENES, MAX_ULTIMOS_TURNOS } from './registro.js';
import { estadoDeEscena } from './estadoEscena.js';
import { destinosDeViaje, prepararDiccionarios } from './comprension.js';
import { cargarDiccionarios, problemasDeDiccionarios, textoDeProblemasDeDiccionarios } from './diccionarios.js';
import { npcInicial, clampRelacion, clampDisposicion } from './npcs.js';
import { esHora } from './reloj.js';
import { MOTIVOS } from './motivos.js';
import { minutosAbsolutos } from './reloj.js';
import { posicionesDeNpcs } from './movimientoNpcs.js';
import { turnoDeCaso } from './casos/narrar.js';
import { accionesDeIntencion } from './casos/acciones.js';

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
    ventanaAperturas: lista(e.ventanaAperturas).filter((a) => typeof a === 'string').slice(-VENTANA_APERTURAS),
    ultimosTurnos: lista(e.ultimosTurnos).filter((t) => typeof t === 'string').slice(-MAX_ULTIMOS_TURNOS),
    numeroRegistro: Number.isInteger(e.numeroRegistro) && e.numeroRegistro >= 0 ? e.numeroRegistro : 0,
    iaAgotadaDia: typeof e.iaAgotadaDia === 'string' ? e.iaAgotadaDia : null,
    avisos: lista(e.avisos).filter(esObjeto).map((a) => ({ ...a })),
    // Estado del motor de caso (tags, hitos, instancia): se conserva tal cual, copiado.
    caso: esObjeto(e.caso) ? structuredClone(e.caso) : null,
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
  if (turno.tipo !== TIPOS_TURNO.ACCION) return null;
  const plantilla = lista(opciones?.casos).find((c) => c?.id === estadoCaso.casoId);
  if (!plantilla) return null;

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
  const errores = [];
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
    const turno = ejecutarTurno(partida, entrada, { contenido, rng, diccionarios: dic });
    if (turno.tipo === TIPOS_TURNO.ERROR) return error(ERRORES.ENTRADA_INVALIDA, turno.error);

    let texto = null;
    let tipo = TIPOS_SALIDA.NARRACION;
    let origen = ORIGENES.CODIGO;
    let aperturas = ventana;
    let iaAgotadaDia = partida.iaAgotadaDia;

    if (turno.tipo === TIPOS_TURNO.IA) {
      // El código no entendió ni tras reformular: IA, si hay clave y cupo.
      const hayClave = typeof groqKey === 'string' && groqKey.trim() !== '';
      const sinCupoHoy = iaAgotadaDia !== null && iaAgotadaDia === diaReal(ahora);
      if (!hayClave) {
        anotar(ERRORES.IA, `${SIN_IA}: ${MOTIVOS_IA.SIN_CLAVE}`);
      } else if (sinCupoHoy) {
        anotar(ERRORES.IA, `${SIN_IA}: ${MOTIVOS_IA.RPD_AGOTADO}`);
      } else {
        const http = typeof opciones?.http === 'function' ? opciones.http : globalThis.fetch?.bind(globalThis);
        if (typeof http !== 'function') {
          anotar(ERRORES.IA, MOTIVOS_IA.ERROR_RED);
        } else {
          const datos = datosDeContexto(partida, contenido, { frase: entrada.texto, ultimasAcciones: partida.ultimosTurnos });
          const respuesta = await pedirRespuestaIA({
            groqKey,
            contexto: datos,
            http,
            ...(typeof opciones?.esperar === 'function' ? { esperar: opciones.esperar } : {}),
          });
          if (respuesta.ok && validarSalida(respuesta.texto).ok) {
            texto = respuesta.texto;
            tipo = TIPOS_SALIDA.DIALOGO_IA;
            origen = ORIGENES.IA;
          } else {
            const detalle = [respuesta.error, respuesta.motivo, respuesta.detalle].filter(Boolean).join(': ');
            anotar(ERRORES.IA, detalle);
            if (respuesta.error === SIN_IA && respuesta.motivo === MOTIVOS_IA.RPD_AGOTADO) iaAgotadaDia = diaReal(ahora);
          }
        }
      }
      if (texto === null) {
        // Modo código: la plantilla de "no entendí".
        const plantilla = narrarReformulacion(contenido, MOTIVOS.NO_ENTENDIDO, {}, { rng, aperturas: ventana });
        texto = plantilla.texto;
        aperturas = anotarApertura(ventana, plantilla.apertura);
      }
    } else {
      const narracion = narrarTurno(turno, { contenido, rng, aperturas: ventana });
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
      ultimosTurnos: etiqueta ? [...partida.ultimosTurnos, etiqueta].slice(-MAX_ULTIMOS_TURNOS) : partida.ultimosTurnos,
      numeroRegistro,
      iaAgotadaDia,
      semilla: rng.estado(),
    };
    return { texto, estado: nuevo, tipo, registro, errores };
  } catch (e) {
    return error(ERRORES.ERROR_INTERNO, e instanceof Error ? e.message : '');
  }
}

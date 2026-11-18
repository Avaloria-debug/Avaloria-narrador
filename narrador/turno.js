// Motor de turnos. Orden fijo (prompt maestro, sección 5.4):
// comprender -> resolver -> efectos sobre NPC -> avanzar reloj -> disparar y cerrar eventos -> mover NPCs.
// Devuelve resultados estructurados, sin texto: la narración es del bloque 4.
// No modifica el estado recibido.
import { decidir, resolverNpc, resolverObjeto, salirDeEscena, responderDestino, prepararDiccionarios, MOTIVOS } from './comprension.js';
import { resolverAccion, aplicarEfectos, objetoDisponible, entradaDeInventario, MOTIVOS_FALLO } from './resolver.js';
import { aplicarTransicion, disposicionEfectiva } from './npcs.js';
import { conocimientoARevelar, conocimientoPorNarrativo, puedeRevelar, revelar, MOTIVOS_NO_REVELA } from './conocimientos.js';
import { procesarEventos } from './eventos.js';
import { estadoDeEscena } from './estadoEscena.js';
import { avanzar } from './reloj.js';
import { moverNpcs, npcsEnEscena } from './movimientoNpcs.js';

export const TIPOS_TURNO = Object.freeze({ ACCION: 'accion', CONSULTA: 'consulta', SALUDO: 'saludo', RECONOCIMIENTO: 'reconocimiento', REFORMULAR: 'reformular', IA: 'ia', ERROR: 'error' });

// Resultado de una consulta: el NPC cuenta el conocimiento, no lo cuenta por ahora, o no sabe del tema.
export const RESULTADOS_CONSULTA = Object.freeze({ EXITO: 'exito', FALLO: 'fallo', NO_SE: 'no_se' });

export const TIPOS_EFECTO_NPC = Object.freeze({
  RELACION: 'relacion', // { npcId, delta, valor }
  DISPOSICION: 'disposicion', // { npcId, delta, valor }
  CONOCIMIENTOS_BLOQUEADOS: 'conocimientos_bloqueados', // { npcId }
  CONOCIMIENTO_REVELADO: 'conocimiento_revelado', // { npcId, conocimientoId, por: 'conversacion'|'narrativo'|'consulta' }
  NARRATIVO_SIN_CONOCIMIENTO: 'narrativo_sin_conocimiento', // { npcId, objetoId, motivo }
});

const porId = (lista, id) => (lista ?? []).find((x) => x.id === id);

/** NPCs presentes en la escena del jugador, con su relación (forma que usa la comprensión). */
export function npcsPresentes(estado, contenido) {
  return npcsEnEscena(estado.jugador.escenaId, estado.reloj, contenido).map((n) => ({
    id: n.id,
    nombre: n.nombre,
    alias: n.alias,
    relacion: estado.npcs[n.id]?.relacion ?? 0,
    conocimientos: n.conocimientos ?? [],
  }));
}

/**
 * Objetos que un verbo puede tomar ahora:
 * - comprar: los que se venden en la escena.
 * - atacar: las armas del inventario (objetos utilizables para atacar).
 * - los demás: el inventario, más los objetos narrativos de la escena.
 */
export function objetosAplicables(estado, contenido, verbo) {
  const escenaId = estado.jugador.escenaId;
  if (verbo === 'comprar') return contenido.objetos.filter((o) => o.precio && o.escenaVenta === escenaId);
  const aMano = contenido.objetos.filter((o) => objetoDisponible(estado, o));
  if (verbo === 'atacar') return aMano.filter((o) => entradaDeInventario(estado, o.id) && o.utilizableComo.includes('atacar'));
  return aMano;
}

/** Arma el contexto de la comprensión desde el estado. */
function contextoDeComprension(estado, contenido, diccionarios = null) {
  return {
    intenciones: contenido.intenciones,
    escenas: contenido.escenas,
    escena: { id: estado.jugador.escenaId },
    npcsPresentes: npcsPresentes(estado, contenido),
    npcsAusentes: contenido.npcs,
    objetosAplicables: (verbo) => objetosAplicables(estado, contenido, verbo),
    reformulacionPrevia: estado.reformulacionPendiente === true,
    saludos: contenido.saludos,
    reconocimientos: contenido.reconocimientos,
    ...(diccionarios ? { diccionarios } : {}),
  };
}

/**
 * Comprender una entrada de botón: valida la intención y completa los parámetros que falten
 * con las mismas reglas que el texto libre. Un botón nunca pasa a IA.
 */
function decidirBoton(entrada, estado, contenido) {
  const intencion = porId(contenido.intenciones, entrada.intencionId);
  if (!intencion) return { tipo: 'error', error: `intención desconocida: ${JSON.stringify(entrada.intencionId)}` };
  const ctx = contextoDeComprension(estado, contenido);
  const dados = entrada.parametros ?? {};
  const parametros = {};
  const reportes = [];
  const reformular = (motivo, datos = { nombres: [] }) => ({ tipo: 'reformular', motivo, intencionId: intencion.id, datos });

  // Retirarse sin destino: el mismo camino que la frase "salir de acá".
  if (intencion.verbo === 'retirarse') {
    const salida = salirDeEscena(ctx);
    if (salida?.tipo === 'reformular') return reformular(salida.motivo, salida.datos);
    if (salida) return { ...salida, repetirIntencionId: null, reportes };
  }
  if (intencion.verbo === 'viajar') {
    if (typeof dados.destino !== 'string') return reformular(MOTIVOS.FALTA_DESTINO);
    parametros.destino = dados.destino;
  }
  if (dados.npcId != null) {
    if (!ctx.npcsPresentes.some((n) => n.id === dados.npcId)) return reformular(MOTIVOS.NPC_AUSENTE);
    parametros.npcId = dados.npcId;
  } else {
    const npc = resolverNpc('', ctx.escena, ctx.npcsPresentes, intencion.verbo);
    if (npc.estado === 'reformular') return reformular(npc.motivo, npc.datos);
    if (npc.estado === 'resuelto') {
      parametros.npcId = npc.npcId;
      reportes.push(...npc.reportes);
    }
  }
  const aplicables = ctx.objetosAplicables(intencion.verbo);
  if (dados.objetoId != null) {
    if (!aplicables.some((o) => o.id === dados.objetoId)) return reformular(MOTIVOS.SIN_OBJETOS);
    parametros.objetoId = dados.objetoId;
  } else {
    const objeto = resolverObjeto('', intencion.verbo, aplicables);
    if (objeto.estado === 'reformular') return reformular(objeto.motivo, objeto.datos);
    if (objeto.estado === 'resuelto') parametros.objetoId = objeto.objetoId;
  }
  return { tipo: 'ejecutar', intencionId: intencion.id, parametros, repetirIntencionId: null, reportes };
}

/** Paso 1: comprender. */
function comprender(entrada, estado, contenido, diccionarios) {
  if (entrada?.tipo === 'boton') return decidirBoton(entrada, estado, contenido);
  if (entrada?.tipo === 'texto' && typeof entrada.texto === 'string') {
    return decidir(entrada.texto, contextoDeComprension(estado, contenido, diccionarios));
  }
  return { tipo: 'error', error: 'entrada inválida' };
}

/**
 * Paso 3: efectos sobre el NPC de la acción, y conocimientos.
 * @returns {{ estado: object, efectos: object[], resultado: string }} `resultado` puede cambiar
 *   al mostrar un objeto narrativo: éxito si revela, fallo si no.
 */
function efectosSobreNpc(estado, accion, resolucion, contenido, conValor) {
  const efectos = [];
  const npcId = accion.parametros.npcId;
  const npcDef = npcId != null ? porId(contenido.npcs, npcId) : null;
  if (!npcDef || !estado.npcs[npcId] || resolucion.motivo === MOTIVOS_FALLO.BLOQUEADO) {
    return { estado, efectos, resultado: resolucion.resultado };
  }
  const objetoDef = accion.parametros.objetoId != null ? porId(contenido.objetos, accion.parametros.objetoId) : null;

  const antes = estado.npcs[npcId];
  let { npc, cambios } = aplicarTransicion(antes, npcDef, resolucion.verbo, resolucion.resultado, contenido.transiciones, { conValor });
  if (cambios.relacion !== 0) efectos.push({ tipo: TIPOS_EFECTO_NPC.RELACION, npcId, delta: cambios.relacion, valor: npc.relacion });
  if (cambios.disposicion !== 0) {
    efectos.push({ tipo: TIPOS_EFECTO_NPC.DISPOSICION, npcId, delta: cambios.disposicion, valor: npc.disposicion });
  }
  if (cambios.bloqueoConocimientos) efectos.push({ tipo: TIPOS_EFECTO_NPC.CONOCIMIENTOS_BLOQUEADOS, npcId });

  let resultado = resolucion.resultado;
  const conNpc = { ...estado, npcs: { ...estado.npcs, [npcId]: npc } };

  // Mostrar un objeto narrativo a su NPC: revela sin pedir relación.
  if (resolucion.verbo === 'usar' && objetoDef?.tipo === 'narrativo' && resolucion.resultado === 'exito') {
    const { conocimiento, motivo } = conocimientoPorNarrativo(objetoDef, npcDef, npc, conNpc, contenido);
    if (conocimiento) {
      npc = revelar(npc, conocimiento.id);
      efectos.push({ tipo: TIPOS_EFECTO_NPC.CONOCIMIENTO_REVELADO, npcId, conocimientoId: conocimiento.id, por: 'narrativo' });
    } else {
      resultado = 'fallo';
      efectos.push({ tipo: TIPOS_EFECTO_NPC.NARRATIVO_SIN_CONOCIMIENTO, npcId, objetoId: objetoDef.id, motivo });
    }
  }
  // Hablar con éxito: revela el conocimiento si se cumplen sus condiciones.
  if (resolucion.verbo === 'hablar_con' && resolucion.resultado === 'exito') {
    const { conocimiento } = conocimientoARevelar(npcDef, npc, conNpc, contenido);
    if (conocimiento) {
      npc = revelar(npc, conocimiento.id);
      efectos.push({ tipo: TIPOS_EFECTO_NPC.CONOCIMIENTO_REVELADO, npcId, conocimientoId: conocimiento.id, por: 'conversacion' });
    }
  }
  return { estado: { ...estado, npcs: { ...estado.npcs, [npcId]: npc } }, efectos, resultado };
}

/**
 * Consulta de tema: una pregunta a un NPC presente. No gasta tiempo ni mueve eventos o NPCs.
 * - Tema de un conocimiento del NPC que se puede revelar: lo cuenta y queda revelado (`exito`).
 * - Tema de un conocimiento ya revelado o sin la relación que pide: `fallo`.
 * - Sin tema, con los conocimientos del NPC bloqueados, o con su evento o marca sin cumplir: `no_se`.
 *   En ese último caso queda pendiente: se revela al preguntar con la condición cumplida.
 * - Sin NPC presente no hay a quién preguntar: sigue como una frase no entendida.
 */
function ejecutarConsulta(estado, decision, contenido) {
  const npcDef = porId(contenido.npcs, decision.npcId);
  const npcEstado = npcDef ? estado.npcs[npcDef.id] : null;
  if (!npcDef || !npcEstado) {
    if (estado.reformulacionPendiente === true) {
      return { tipo: TIPOS_TURNO.IA, estado: { ...estado, reformulacionPendiente: false }, intencionId: null };
    }
    return {
      tipo: TIPOS_TURNO.REFORMULAR,
      estado: { ...estado, reformulacionPendiente: true },
      intencionId: null,
      motivo: MOTIVOS.NO_ENTENDIDO,
      datos: {},
    };
  }
  const npcId = npcDef.id;
  const conocimiento = porId(npcDef.conocimientos, decision.conocimientoId) ?? null;
  const consulta = { npcId, conocimientoId: conocimiento?.id ?? null, resultado: RESULTADOS_CONSULTA.NO_SE, efectos: [] };
  let npc = npcEstado;
  if (conocimiento) {
    const r = puedeRevelar(conocimiento, npcId, npcEstado, estado, contenido);
    if (r.puede) {
      npc = revelar(npcEstado, conocimiento.id);
      consulta.resultado = RESULTADOS_CONSULTA.EXITO;
      consulta.efectos.push({ tipo: TIPOS_EFECTO_NPC.CONOCIMIENTO_REVELADO, npcId, conocimientoId: conocimiento.id, por: 'consulta' });
    } else {
      consulta.motivo = r.motivo;
      // Bloqueado, o con su evento o marca sin cumplir: `no_se`; queda pendiente y se revela al preguntar con la condición cumplida.
      const pendiente = [MOTIVOS_NO_REVELA.BLOQUEADO, MOTIVOS_NO_REVELA.EVENTO, MOTIVOS_NO_REVELA.MARCA].includes(r.motivo);
      if (!pendiente) consulta.resultado = RESULTADOS_CONSULTA.FALLO;
    }
  }
  return {
    tipo: TIPOS_TURNO.CONSULTA,
    estado: { ...estado, reformulacionPendiente: false, npcs: { ...estado.npcs, [npcId]: npc } },
    intencionId: null,
    consulta,
  };
}

/**
 * Ejecuta un turno.
 * @param {object} estado
 * @param {{ tipo: 'boton', intencionId: string, parametros?: object } | { tipo: 'texto', texto: string }} entrada
 * @param {{ contenido: object, rng: () => number, diccionarios?: object }} dependencias `diccionarios`: los de la comprensión del texto libre (opcional)
 * @returns {{
 *   tipo: 'accion'|'consulta'|'saludo'|'reconocimiento'|'reformular'|'ia'|'error', estado: object,
 *   consulta?: { npcId: string, conocimientoId: string|null, resultado: 'exito'|'fallo'|'no_se', motivo?: string, efectos: object[] },
 *   intencionId?: string|null, motivo?: string, datos?: object, error?: string,
 *   accion?: { intencionId: string, verbo: string, parametros: object, resultado: string, motivo?: string,
 *     efectos: object[], costoHoras: number, escenaAnterior: string, escenaNueva: string, viaje?: object, precio?: object },
 *   eventos?: { disparados: object[], cerrados: object[] }, npcsMovidos?: object[],
 *   escena?: { id: string, estado: string, npcs: { id: string, disposicion: number }[] },
 *   repetirIntencionId?: string|null, reportes?: object[],
 * }}
 */
export function ejecutarTurno(estado, entrada, dependencias) {
  const r = ejecutarTurnoSinPendiente(estado, entrada, dependencias);
  if (r.tipo === TIPOS_TURNO.ERROR) return r;
  // Pregunta de destino pendiente: solo la deja una pregunta de destino ambiguo (con ids); cualquier otro turno la borra.
  const { opciones, ids } = r.datos ?? {};
  const pregunta = r.tipo === TIPOS_TURNO.REFORMULAR && [MOTIVOS.DESTINO_AMBIGUO, MOTIVOS.DESTINO_REPETIDO].includes(r.motivo) && Array.isArray(ids) && Array.isArray(opciones);
  const destinoPendiente = pregunta
    ? { opciones: ids.map((id, i) => ({ id, nombre: opciones[i] })), turno: (estado.numeroRegistro ?? 0) + 1 }
    : null;
  return { ...r, estado: { ...r.estado, destinoPendiente } };
}

/**
 * Respuesta corta a la pregunta de destino pendiente: solo si la frase no se entendió como otra cosa.
 * Una opción → viajar; varias o ninguna → vuelve a preguntar con las mismas opciones.
 */
function respuestaADestinoPendiente(estado, entrada, decision, contenido, diccionarios) {
  const pend = estado.destinoPendiente;
  const sinEntender = decision.tipo === 'ia' || (decision.tipo === 'reformular' && decision.motivo === MOTIVOS.NO_ENTENDIDO);
  if (!pend || !Array.isArray(pend.opciones) || entrada?.tipo !== 'texto' || !sinEntender) return null;
  const dic = prepararDiccionarios(diccionarios, contenido.intenciones);
  const r = responderDestino(entrada.texto, pend.opciones, { lexico: dic?.lexicoEscena });
  if (r.estado === 'resuelto') {
    const viajar = contenido.intenciones.find((i) => i.verbo === 'viajar');
    return { tipo: 'ejecutar', intencionId: viajar.id, parametros: { destino: r.destino }, repetirIntencionId: null, reportes: [] };
  }
  return {
    tipo: 'reformular',
    // Coincide con más de una opción: "No me quedó claro…"; no coincide con ninguna: la misma pregunta.
    motivo: r.estado === 'ambiguo' ? MOTIVOS.DESTINO_REPETIDO : MOTIVOS.DESTINO_AMBIGUO,
    intencionId: null,
    datos: { opciones: pend.opciones.map((o) => o.nombre), ids: pend.opciones.map((o) => o.id) },
  };
}

function ejecutarTurnoSinPendiente(estado, entrada, { contenido, rng, diccionarios = null }) {
  if (typeof rng !== 'function') throw new TypeError('ejecutarTurno necesita un rng');

  // 1. Comprender.
  let decision = comprender(entrada, estado, contenido, diccionarios);
  decision = respuestaADestinoPendiente(estado, entrada, decision, contenido, diccionarios) ?? decision;
  if (decision.tipo === 'error') return { tipo: TIPOS_TURNO.ERROR, estado, error: decision.error };
  if (decision.tipo === 'consulta') return ejecutarConsulta(estado, decision, contenido);
  // Saludo o reconocimiento ("hola", "ok"): lo responde el primer NPC presente. No gasta tiempo, no cambia nada,
  // no reformula y no pasa a la IA. Su `intencionId` es `saludo` o `reconocimiento` (intenciones de registro).
  if (decision.tipo === 'saludo' || decision.tipo === 'reconocimiento') {
    return {
      tipo: decision.tipo,
      estado: { ...estado, reformulacionPendiente: false },
      intencionId: decision.tipo,
      npcId: decision.npcId,
    };
  }
  if (decision.tipo === 'reformular') {
    return {
      tipo: TIPOS_TURNO.REFORMULAR,
      estado: { ...estado, reformulacionPendiente: true },
      intencionId: decision.intencionId,
      motivo: decision.motivo,
      datos: decision.datos,
    };
  }
  if (decision.tipo === 'ia') {
    return { tipo: TIPOS_TURNO.IA, estado: { ...estado, reformulacionPendiente: false }, intencionId: decision.intencionId };
  }

  // 2. Resolver.
  const escenaAnterior = estado.jugador.escenaId;
  const relojAntes = estado.reloj;
  const accion = { intencionId: decision.intencionId, parametros: { ...decision.parametros } };
  // Usar un objeto narrativo se lo muestra a su NPC asociado, si está en la escena.
  const narrativo = porId(contenido.objetos, accion.parametros.objetoId);
  if (
    accion.parametros.npcId == null &&
    narrativo?.tipo === 'narrativo' &&
    porId(contenido.intenciones, accion.intencionId)?.verbo === 'usar' &&
    npcsPresentes(estado, contenido).some((n) => n.id === narrativo.npcAsociado)
  ) {
    accion.parametros.npcId = narrativo.npcAsociado;
  }
  // Negociar "con valor": el jugador ofrece un objeto que tiene a mano (se mira antes de gastarlo).
  const ofrecido = porId(contenido.objetos, accion.parametros.objetoId);
  const conValor = ofrecido != null && objetoDisponible(estado, ofrecido);
  const resolucion = resolverAccion(estado, accion, { contenido, rng });
  let nuevo = aplicarEfectos({ ...estado, reformulacionPendiente: false }, resolucion.efectos);

  // 3. Efectos sobre NPC (el NPC se evalúa en la escena donde se actuó).
  const sobreNpc = efectosSobreNpc({ ...nuevo, jugador: { ...nuevo.jugador, escenaId: escenaAnterior } }, accion, resolucion, contenido, conValor);
  nuevo = { ...sobreNpc.estado, jugador: nuevo.jugador };
  const resultado = sobreNpc.resultado;

  // 4. Avanzar reloj.
  const reloj = avanzar(relojAntes, resolucion.costoHoras);

  // 5. Disparar y cerrar eventos.
  const eventos = procesarEventos(nuevo.eventosActivos, {
    contenido,
    relojAntes,
    reloj,
    rng,
    escenaAccionId: escenaAnterior,
    escenaJugadorId: nuevo.jugador.escenaId,
    accion: { verbo: resolucion.verbo, resultado, npcId: accion.parametros.npcId ?? null },
  });
  nuevo = { ...nuevo, reloj, eventosActivos: eventos.activos };

  // 6. Mover NPCs.
  const npcsMovidos = moverNpcs(relojAntes, reloj, contenido);

  // 7. Resultado, sin texto.
  const escenaId = nuevo.jugador.escenaId;
  return {
    tipo: TIPOS_TURNO.ACCION,
    estado: nuevo,
    intencionId: accion.intencionId,
    accion: {
      intencionId: accion.intencionId,
      verbo: resolucion.verbo,
      parametros: accion.parametros,
      resultado,
      ...(resolucion.motivo ? { motivo: resolucion.motivo } : {}),
      efectos: [...resolucion.efectos, ...sobreNpc.efectos],
      costoHoras: resolucion.costoHoras,
      escenaAnterior,
      escenaNueva: escenaId,
      ...(resolucion.viaje ? { viaje: resolucion.viaje } : {}),
      ...(resolucion.precio ? { precio: resolucion.precio } : {}),
    },
    eventos: { disparados: eventos.disparados, cerrados: eventos.cerrados },
    npcsMovidos,
    escena: {
      id: escenaId,
      estado: estadoDeEscena(escenaId, nuevo.eventosActivos, contenido),
      npcs: npcsEnEscena(escenaId, reloj, contenido).map((n) => ({
        id: n.id,
        disposicion: disposicionEfectiva(n.id, nuevo.npcs[n.id], nuevo.eventosActivos, contenido),
      })),
    },
    repetirIntencionId: decision.repetirIntencionId ?? null,
    reportes: decision.reportes ?? [],
  };
}

// Resuelve una acción ya comprendida (intención + parámetros). Módulo puro: no modifica
// el estado; devuelve el resultado y una lista de efectos que aplica el turno.
// No calcula los efectos sobre NPCs ni los conocimientos (npcs.js, conocimientos.js).
import { clasificarViaje, TIPOS_VIAJE } from './viaje.js';
import { eventoQueBloquea, precioEfectivo } from './efectosEventos.js';
import { enteroEntre } from './estado.js';

export const PROBABILIDAD_EXITO = 0.6;
/** Horas de reloj que gasta un verbo, según `reglas.costoHorasPorVerbo`. Un viaje cuesta lo que diga la ruta. */
export function costoHorasDeVerbo(verbo, contenido) {
  return contenido?.reglas?.costoHorasPorVerbo?.[verbo] ?? 0;
}

// Acciones con chequeo de éxito o fallo.
export const VERBOS_CON_CHEQUEO = Object.freeze([
  'hablar_con', 'ayudar', 'negociar', 'presionar', 'calmar_la_situacion', 'atacar', 'emboscar', 'defender', 'distraer',
  'huir', 'ocultarse', 'avanzar_cautela', 'explorar', 'observar', 'examinar',
]);

export const TIPOS_EFECTO_ACCION = Object.freeze({
  DINERO: 'dinero', // { moneda, delta }
  OBJETO_AGREGADO: 'objeto_agregado', // { objetoId, usosRestantes }
  OBJETO_USADO: 'objeto_usado', // { objetoId, usosRestantes, agotado }
  MARCA: 'marca', // { marca }
  MOVIMIENTO: 'movimiento', // { desde, hasta }
  BLOQUEO: 'bloqueo', // { eventoId }
});

export const MOTIVOS_FALLO = Object.freeze({
  BLOQUEADO: 'bloqueado',
  SIN_DINERO: 'sin_dinero',
  NO_SE_VENDE: 'no_se_vende',
  SIN_OBJETO: 'sin_objeto',
  SIN_RUTA: 'sin_ruta',
});

const porId = (lista, id) => (lista ?? []).find((x) => x.id === id);

/** Primera entrada del inventario con ese objeto. */
export function entradaDeInventario(estado, objetoId) {
  return (estado.inventario ?? []).find((i) => i.objetoId === objetoId) ?? null;
}

/**
 * ¿El jugador tiene el objeto a mano? En el inventario, o es un objeto narrativo de la escena.
 */
export function objetoDisponible(estado, objetoDef) {
  if (!objetoDef) return false;
  if (entradaDeInventario(estado, objetoDef.id)) return true;
  return objetoDef.tipo === 'narrativo' && objetoDef.escenaAparece === estado.jugador.escenaId;
}

/**
 * @param {object} estado
 * @param {{ intencionId: string, parametros?: { npcId?: string, objetoId?: string, destino?: string } }} accion
 * @param {{ contenido: object, rng: () => number }} dependencias
 * @returns {{
 *   intencionId: string, verbo: string, resultado: 'exito'|'fallo'|'neutro', efectos: object[],
 *   costoHoras: number, escenaNueva?: string, motivo?: string, viaje?: object,
 * }}
 */
export function resolverAccion(estado, accion, { contenido, rng }) {
  if (typeof rng !== 'function') throw new TypeError('resolverAccion necesita un rng');
  const intencion = porId(contenido.intenciones, accion.intencionId);
  if (!intencion) throw new Error(`intención desconocida: ${JSON.stringify(accion.intencionId)}`);
  const verbo = intencion.verbo;
  const parametros = accion.parametros ?? {};
  const escenaId = estado.jugador.escenaId;
  const escena = porId(contenido.escenas, escenaId);
  const objeto = parametros.objetoId != null ? porId(contenido.objetos, parametros.objetoId) : null;

  const efectos = [];
  const salida = (resultado, extra = {}) => ({
    intencionId: intencion.id,
    verbo,
    resultado,
    efectos,
    costoHoras: costoHorasDeVerbo(verbo, contenido),
    ...extra,
  });
  const bloqueadoPor = (eventoId, extra = {}) => {
    efectos.push({ tipo: TIPOS_EFECTO_ACCION.BLOQUEO, eventoId });
    return salida('fallo', { motivo: MOTIVOS_FALLO.BLOQUEADO, ...extra });
  };
  // Gasta un uso del objeto del inventario. Sin usos (null) no se gasta.
  const gastarUso = () => {
    const entrada = objeto ? entradaDeInventario(estado, objeto.id) : null;
    if (!entrada || entrada.usosRestantes == null) return;
    const usosRestantes = entrada.usosRestantes - 1;
    efectos.push({ tipo: TIPOS_EFECTO_ACCION.OBJETO_USADO, objetoId: objeto.id, usosRestantes, agotado: usosRestantes <= 0 });
  };

  // --- Viajar ---
  if (verbo === 'viajar') {
    const viaje = clasificarViaje(parametros.destino, escenaId, contenido);
    if (viaje.tipo === TIPOS_VIAJE.SIN_RUTA) return salida('fallo', { motivo: MOTIVOS_FALLO.SIN_RUTA, viaje });
    if (viaje.tipo === TIPOS_VIAJE.MISMA_ESCENA) return salida('neutro', { motivo: viaje.motivo, costoHoras: 0, viaje });
    const bloqueo = eventoQueBloquea(
      { verbo, viaje: { destino: parametros.destino, escenaLlegada: viaje.escenaLlegada, escenasDeRuta: viaje.escenasDeRuta } },
      escenaId,
      estado.eventosActivos,
      contenido,
    );
    if (bloqueo) return bloqueadoPor(bloqueo, { viaje });
    efectos.push({ tipo: TIPOS_EFECTO_ACCION.MOVIMIENTO, desde: escenaId, hasta: viaje.escenaLlegada });
    return salida('exito', { escenaNueva: viaje.escenaLlegada, costoHoras: viaje.horas, viaje });
  }

  // --- Bloqueos de eventos (usar un objeto, hablar con un NPC) ---
  const bloqueo = eventoQueBloquea(
    { verbo, npcId: parametros.npcId ?? null, objetoId: parametros.objetoId ?? null },
    escenaId,
    estado.eventosActivos,
    contenido,
  );
  if (bloqueo) return bloqueadoPor(bloqueo);

  // --- Trabajar: sin chequeo, gana bronce ---
  if (verbo === 'trabajar') {
    const { min, max } = contenido.reglas.economia.trabajar.ganaBronce;
    efectos.push({ tipo: TIPOS_EFECTO_ACCION.DINERO, moneda: 'bronce', delta: enteroEntre(rng, min, max) });
    return salida('exito');
  }

  // --- Comprar: sin chequeo; falla sin descontar si no alcanza ---
  if (verbo === 'comprar') {
    if (!objeto) return salida('fallo', { motivo: MOTIVOS_FALLO.SIN_OBJETO });
    const precio = precioEfectivo(objeto, estado.eventosActivos, contenido);
    if (!precio || objeto.escenaVenta !== escenaId) return salida('fallo', { motivo: MOTIVOS_FALLO.NO_SE_VENDE });
    if ((estado.jugador[precio.moneda] ?? 0) < precio.cantidad) return salida('fallo', { motivo: MOTIVOS_FALLO.SIN_DINERO, precio });
    efectos.push({ tipo: TIPOS_EFECTO_ACCION.DINERO, moneda: precio.moneda, delta: -precio.cantidad });
    efectos.push({ tipo: TIPOS_EFECTO_ACCION.OBJETO_AGREGADO, objetoId: objeto.id, usosRestantes: objeto.usos ?? null });
    return salida('exito', { precio });
  }

  // --- Usar: sin chequeo; gasta un uso ---
  if (verbo === 'usar') {
    if (!objeto || !objetoDisponible(estado, objeto)) return salida('fallo', { motivo: MOTIVOS_FALLO.SIN_OBJETO });
    gastarUso();
    return salida('exito');
  }

  // El objeto que acompaña a otro verbo (atacar con un arma, negociar con algo) tiene que estar a mano.
  const conObjeto = objeto && objetoDisponible(estado, objeto);

  // --- Leer: sin chequeo; en la escena de la marca, la activa ---
  if (verbo === 'leer') {
    for (const [marca, def] of Object.entries(contenido.reglas.marcas ?? {})) {
      const a = def.activaCon ?? {};
      if (a.verbo === verbo && a.escenaId === escenaId && !(estado.marcas ?? []).includes(marca)) {
        efectos.push({ tipo: TIPOS_EFECTO_ACCION.MARCA, marca });
      }
    }
    return salida(efectos.length > 0 ? 'exito' : 'neutro');
  }

  // --- Examinar sin objeto: mira la escena, sin chequeo ---
  if (verbo === 'examinar' && !conObjeto) return salida('neutro');

  // --- Sin chequeo: descansar, retirarse, abortar, rendirse ---
  if (!VERBOS_CON_CHEQUEO.includes(verbo)) return salida('neutro');

  // --- Con chequeo: 60% de éxito ---
  const resultado = rng() < PROBABILIDAD_EXITO ? 'exito' : 'fallo';
  if (conObjeto && verbo !== 'examinar') gastarUso();

  // Huir con éxito mueve al jugador a la primera salida de la escena, si tiene.
  if (verbo === 'huir' && resultado === 'exito') {
    const hasta = (escena?.salidas ?? [])[0];
    if (hasta) {
      efectos.push({ tipo: TIPOS_EFECTO_ACCION.MOVIMIENTO, desde: escenaId, hasta });
      return salida(resultado, { escenaNueva: hasta });
    }
  }
  return salida(resultado);
}

/**
 * Aplica los efectos de una acción al estado. Devuelve un estado nuevo.
 * El dinero nunca queda en negativo. Un objeto que llega a 0 usos sale del inventario.
 */
export function aplicarEfectos(estado, efectos) {
  let jugador = estado.jugador;
  let inventario = estado.inventario ?? [];
  let marcas = estado.marcas ?? [];
  for (const e of efectos ?? []) {
    if (e.tipo === TIPOS_EFECTO_ACCION.DINERO) {
      jugador = { ...jugador, [e.moneda]: Math.max(0, (jugador[e.moneda] ?? 0) + e.delta) };
    } else if (e.tipo === TIPOS_EFECTO_ACCION.OBJETO_AGREGADO) {
      inventario = [...inventario, { objetoId: e.objetoId, usosRestantes: e.usosRestantes }];
    } else if (e.tipo === TIPOS_EFECTO_ACCION.OBJETO_USADO) {
      const i = inventario.findIndex((x) => x.objetoId === e.objetoId);
      if (i >= 0) {
        inventario = e.agotado
          ? inventario.filter((_, j) => j !== i)
          : inventario.map((x, j) => (j === i ? { ...x, usosRestantes: e.usosRestantes } : x));
      }
    } else if (e.tipo === TIPOS_EFECTO_ACCION.MARCA) {
      if (!marcas.includes(e.marca)) marcas = [...marcas, e.marca];
    } else if (e.tipo === TIPOS_EFECTO_ACCION.MOVIMIENTO) {
      jugador = { ...jugador, escenaId: e.hasta };
    }
  }
  return { ...estado, jugador, inventario, marcas };
}

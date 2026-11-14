// Eventos: disparo y fin. Módulo puro; el azar se inyecta como `rng`.
// No aplica los efectos de los eventos (eso es del bloque 3b).
//
// Evento activo: { id, escenaId, turnosRestantes, horaFin }
//   turnosRestantes: turnos que le quedan, o null si no termina por turnos.
//   horaFin: reloj { dia, hora } en que termina, o null si no termina por hora.
import { avanzar, comparar, proximaOcurrencia, ultimaOcurrencia, yaPaso } from './reloj.js';
import { PSEUDO_VERBOS } from './contenido.js';

export const MAX_EVENTOS_POR_ESCENA = 2;
export const SALIR_ESCENA = PSEUDO_VERBOS[0];

export const MOTIVOS_CIERRE = Object.freeze({ TIEMPO: 'tiempo', HORA: 'hora', ACCION: 'accion' });

const lista = (v) => (Array.isArray(v) ? v : []);

/** Un evento con escenas vacías o inválidas no se dispara. */
function escenasValidas(evento, idsEscena) {
  return lista(evento.escenas).filter((id) => idsEscena.has(id));
}

function cupo(activos, escenaId) {
  return activos.filter((a) => a.escenaId === escenaId).length < MAX_EVENTOS_POR_ESCENA;
}

function estaActivo(activos, eventoId, escenaId) {
  return activos.some((a) => a.id === eventoId && a.escenaId === escenaId);
}

/**
 * Arma el evento activo: cuánto dura y cuándo termina.
 * - fin `tiempo`: por la duración (turnos u horas).
 * - fin `hora`: a la hora fija de `fin.valor` o de `duracion.valor`; sin valor, inicio + duración en horas.
 * - fin `accion`: por los verbos; si además trae duración en turnos u horas, también termina por tiempo.
 * @param {object} evento definición del contenido
 * @param {string} escenaId
 * @param {{dia: number, hora: string}} inicio
 */
export function activarEvento(evento, escenaId, inicio) {
  const duracion = evento.duracion ?? {};
  const fin = evento.fin ?? {};
  let turnosRestantes = null;
  let horaFin = null;

  const horaFija = fin.valor ?? (duracion.tipo === 'hasta_hora' ? duracion.valor : undefined);
  if (fin.tipo === 'hora' && horaFija !== undefined) {
    horaFin = proximaOcurrencia(inicio, horaFija);
  } else if (duracion.tipo === 'horas') {
    horaFin = avanzar(inicio, duracion.n);
  } else if (duracion.tipo === 'turnos') {
    turnosRestantes = duracion.n;
  }
  return { id: evento.id, escenaId, turnosRestantes, horaFin };
}

/** Verbos que cierran un evento por acción (de `fin.verbos` y de `duracion`). */
export function verbosDeCierre(evento) {
  if (evento.fin?.tipo !== 'accion') return [];
  const d = evento.duracion ?? {};
  return [...new Set([...lista(evento.fin.verbos), ...lista(d.verbos), ...(d.verbo != null ? [d.verbo] : [])])];
}

/**
 * Cierra los eventos que terminan en este turno.
 * - Por acción: el verbo ejecutado, sin fallo, en la escena del evento; o `salir_escena` si el jugador dejó esa escena.
 * - Por tiempo: se descuenta un turno a todos los activos; el que llega a 0 termina.
 * - Por hora: el reloj llegó a `horaFin`. Vale para todas las escenas, esté o no el jugador.
 * @returns {{ activos: object[], cerrados: {id: string, escenaId: string, motivo: string}[] }}
 */
export function cerrarEventos(activos, { contenido, reloj, accion = null, escenaAccionId = null, escenaJugadorId = null }) {
  const porId = new Map(lista(contenido?.eventos).map((e) => [e.id, e]));
  const salio = escenaAccionId !== null && escenaJugadorId !== null && escenaAccionId !== escenaJugadorId;
  const siguen = [];
  const cerrados = [];

  for (const a of lista(activos)) {
    const evento = porId.get(a.id);
    const cerrar = (motivo) => cerrados.push({ id: a.id, escenaId: a.escenaId, motivo });
    // Un evento que ya no está en el contenido se cierra.
    if (!evento) {
      cerrar(MOTIVOS_CIERRE.TIEMPO);
      continue;
    }
    if (a.escenaId === escenaAccionId) {
      const verbos = verbosDeCierre(evento);
      const porVerbo = accion && accion.resultado !== 'fallo' && verbos.includes(accion.verbo);
      if (porVerbo || (salio && verbos.includes(SALIR_ESCENA))) {
        cerrar(MOTIVOS_CIERRE.ACCION);
        continue;
      }
    }
    if (a.horaFin && yaPaso(reloj, a.horaFin)) {
      cerrar(MOTIVOS_CIERRE.HORA);
      continue;
    }
    if (a.turnosRestantes !== null) {
      const turnosRestantes = a.turnosRestantes - 1;
      if (turnosRestantes <= 0) {
        cerrar(MOTIVOS_CIERRE.TIEMPO);
        continue;
      }
      siguen.push({ ...a, turnosRestantes });
      continue;
    }
    siguen.push(a);
  }
  return { activos: siguen, cerrados };
}

/**
 * Dispara eventos, en el orden del contenido. Respeta el máximo de 2 activos por escena
 * y no repite un evento que ya está activo en esa escena.
 * - `accion`: el verbo ejecutado en la escena de la acción (con `objetivo` y `escena`/`escenas` del disparo, si los trae).
 * - `hora`: el reloj llegó a la hora, en todas las escenas del evento. Si ya terminó dentro del mismo salto de reloj, no se activa.
 * - `azar`: probabilidad `p` por turno, en la escena del jugador.
 * @param {object[]} activos
 * @param {{
 *   contenido: object, relojAntes: object, reloj: object, rng: () => number,
 *   escenaJugadorId: string|null, accion?: {verbo: string, npcId?: string|null}|null, escenaAccionId?: string|null,
 *   incluirInicio?: boolean, excluir?: {id: string, escenaId: string}[],
 * }} datos `incluirInicio`: la hora de `relojAntes` también dispara (primer turno de la partida).
 *   `excluir`: eventos que no se vuelven a disparar en este turno (los que se acaban de cerrar).
 * @returns {{ activos: object[], disparados: object[] }}
 */
export function dispararEventos(activos, datos) {
  const { contenido, relojAntes, reloj, rng, escenaJugadorId = null, accion = null } = datos;
  const escenaAccionId = datos.escenaAccionId ?? escenaJugadorId;
  if (typeof rng !== 'function') throw new TypeError('dispararEventos necesita un rng');

  const idsEscena = new Set(lista(contenido?.escenas).map((e) => e.id));
  const excluidos = new Set(lista(datos.excluir).map((x) => `${x.id}@${x.escenaId}`));
  const resultado = [...lista(activos)];
  const disparados = [];

  const intentar = (evento, escenaId, inicio) => {
    if (excluidos.has(`${evento.id}@${escenaId}`)) return;
    if (estaActivo(resultado, evento.id, escenaId) || !cupo(resultado, escenaId)) return;
    const activo = activarEvento(evento, escenaId, inicio);
    // Empezó y terminó dentro del mismo salto de reloj.
    if (activo.horaFin && comparar(inicio, reloj) < 0 && yaPaso(reloj, activo.horaFin)) return;
    resultado.push(activo);
    disparados.push(activo);
  };

  for (const evento of lista(contenido?.eventos)) {
    const validas = escenasValidas(evento, idsEscena);
    if (validas.length === 0) continue;
    const disparo = evento.disparo ?? {};

    if (disparo.tipo === 'accion') {
      if (!accion || accion.verbo !== disparo.verbo || !validas.includes(escenaAccionId)) continue;
      if (disparo.objetivo != null && disparo.objetivo !== accion.npcId) continue;
      const limite = disparo.escenas ?? (disparo.escena != null ? [disparo.escena] : null);
      if (limite && !limite.includes(escenaAccionId)) continue;
      intentar(evento, escenaAccionId, reloj);
    } else if (disparo.tipo === 'hora') {
      const inicio = ultimaOcurrencia(relojAntes, reloj, disparo.valor, { incluirDesde: datos.incluirInicio === true });
      if (!inicio) continue;
      for (const escenaId of validas) intentar(evento, escenaId, inicio);
    } else if (disparo.tipo === 'azar') {
      if (!validas.includes(escenaJugadorId)) continue;
      if (estaActivo(resultado, evento.id, escenaJugadorId) || !cupo(resultado, escenaJugadorId)) continue;
      if (excluidos.has(`${evento.id}@${escenaJugadorId}`)) continue;
      if (rng() < disparo.p) intentar(evento, escenaJugadorId, reloj);
    }
  }
  return { activos: resultado, disparados };
}

/**
 * Paso de eventos de un turno: primero cierra, después dispara.
 * @param {object[]} activos eventos activos antes del turno
 * @param {{
 *   contenido: object, relojAntes: object, reloj: object, rng: () => number,
 *   escenaAccionId: string|null, escenaJugadorId: string|null,
 *   accion?: {verbo: string, resultado?: string, npcId?: string|null}|null, incluirInicio?: boolean,
 * }} datos `escenaAccionId`: donde estaba el jugador al actuar. `escenaJugadorId`: donde quedó.
 * @returns {{ activos: object[], disparados: object[], cerrados: object[] }}
 */
export function procesarEventos(activos, datos) {
  const cierre = cerrarEventos(activos, datos);
  const disparo = dispararEventos(cierre.activos, { ...datos, excluir: cierre.cerrados });
  return { activos: disparo.activos, disparados: disparo.disparados, cerrados: cierre.cerrados };
}

/** Eventos activos de una escena. */
export function eventosDeEscena(activos, escenaId) {
  return lista(activos).filter((a) => a.escenaId === escenaId);
}

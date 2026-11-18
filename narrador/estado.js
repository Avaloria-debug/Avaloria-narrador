// Estado de la partida del narrador (docs/cierre-diseno-v1.md, sección 5).
// El contrato público (crearPartida, cargarPartida) es del bloque 7; acá está la forma y el estado inicial.
import { relojInicial } from './reloj.js';
import { npcInicial } from './npcs.js';
import { dispararEventos } from './eventos.js';

export const VERSION_ESTADO = 'v1';

/** Entero al azar entre min y max, incluidos, con el generador inyectado. */
export function enteroEntre(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Estado inicial: escena inicial, dinero sorteado, reloj 08:00, NPCs con su relación inicial
 * y los eventos que se disparan a la hora de inicio.
 * @param {object} contenido
 * @param {{ rng: () => number, nombre?: string }} opciones
 */
export function estadoInicial(contenido, { rng, nombre = '' } = {}) {
  if (typeof rng !== 'function') throw new TypeError('estadoInicial necesita un rng');
  const { dineroInicial, escenaInicial } = contenido.reglas;
  const bronce = enteroEntre(rng, dineroInicial.bronce.min, dineroInicial.bronce.max);
  const plata = enteroEntre(rng, dineroInicial.plata.min, dineroInicial.plata.max);
  const reloj = relojInicial(contenido);
  // Solo los eventos por hora de la hora inicial. El azar empieza en el primer turno.
  const { activos } = dispararEventos([], {
    contenido,
    relojAntes: reloj,
    reloj,
    rng: () => 1,
    escenaJugadorId: escenaInicial,
    incluirInicio: true,
  });
  return {
    version: VERSION_ESTADO,
    versionContenido: contenido.version,
    jugador: { nombre, escenaId: escenaInicial, bronce, plata },
    reloj,
    npcs: Object.fromEntries(contenido.npcs.map((n) => [n.id, npcInicial(n)])),
    eventosActivos: activos,
    inventario: [],
    marcas: [],
    reformulacionPendiente: false,
    destinoPendiente: null,
  };
}

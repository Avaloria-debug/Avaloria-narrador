// Conocimientos de los NPCs: cuándo se revelan.
import { conocimientoHabilitado } from './efectosEventos.js';

export const MOTIVOS_NO_REVELA = Object.freeze({
  BLOQUEADO: 'bloqueado',
  YA_REVELADO: 'ya_revelado',
  UMBRAL: 'umbral',
  EVENTO: 'evento',
  MARCA: 'marca',
  INEXISTENTE: 'inexistente',
  ORDEN: 'orden',
});

/** `requiereEvento`: el evento está activo en alguna escena, o un evento activo habilita el conocimiento. Sin requisito: cumplido. */
export function eventoCumplido(conocimiento, npcId, eventosActivos, contenido) {
  if (conocimiento?.requiereEvento == null) return true;
  const activo = (eventosActivos ?? []).some((a) => a.id === conocimiento.requiereEvento);
  return activo || conocimientoHabilitado(npcId, conocimiento.id, eventosActivos, contenido);
}

/**
 * ¿Se puede revelar este conocimiento ahora?
 * - Bloqueado para siempre si el jugador atacó o emboscó al NPC.
 * - Una sola vez por NPC.
 * - Relación mayor o igual al umbral, salvo `sinUmbral` (mostrar un objeto narrativo).
 * - `requiereEvento`: el evento está activo en alguna escena, o un evento activo habilita el conocimiento.
 * - `requiereMarca`: el jugador tiene la marca.
 * @returns {{ puede: boolean, motivo: string|null }}
 */
export function puedeRevelar(conocimiento, npcId, npcEstado, estado, contenido, { sinUmbral = false, umbral = null } = {}) {
  const no = (motivo) => ({ puede: false, motivo });
  if (!conocimiento) return no(MOTIVOS_NO_REVELA.INEXISTENTE);
  if (npcEstado.bloqueadoConocimientos) return no(MOTIVOS_NO_REVELA.BLOQUEADO);
  if (npcEstado.conocimientosRevelados.includes(conocimiento.id)) return no(MOTIVOS_NO_REVELA.YA_REVELADO);
  if (!sinUmbral && npcEstado.relacion < (umbral ?? conocimiento.umbralRelacion)) return no(MOTIVOS_NO_REVELA.UMBRAL);
  if (!eventoCumplido(conocimiento, npcId, estado.eventosActivos, contenido)) return no(MOTIVOS_NO_REVELA.EVENTO);
  if (conocimiento.requiereMarca != null && !(estado.marcas ?? []).includes(conocimiento.requiereMarca)) {
    return no(MOTIVOS_NO_REVELA.MARCA);
  }
  return { puede: true, motivo: null };
}

/** ¿Hay un conocimiento anterior del mismo NPC sin revelar? El _2 nunca se revela antes que el _1. */
export function anteriorSinRevelar(npcDef, npcEstado, conocimiento) {
  const lista = npcDef?.conocimientos ?? [];
  const i = lista.findIndex((k) => k.id === conocimiento?.id);
  return i > 0 && lista.slice(0, i).some((k) => !npcEstado.conocimientosRevelados.includes(k.id));
}

/**
 * Conocimiento del NPC que se puede revelar ahora, por conversación: el primero sin revelar, en orden.
 * El _2 nunca se revela antes que el _1.
 * @returns {{ conocimiento: object|null, motivo: string|null }} `motivo`: por qué no se reveló el primero pendiente
 */
export function conocimientoARevelar(npcDef, npcEstado, estado, contenido) {
  // En orden (_1 antes que _2): solo el primer conocimiento sin revelar puede revelarse.
  const lista = npcDef.conocimientos ?? [];
  const pendiente = lista.find((k) => !npcEstado.conocimientosRevelados.includes(k.id)) ?? lista.at(-1);
  if (!pendiente) return { conocimiento: null, motivo: null };
  const r = puedeRevelar(pendiente, npcDef.id, npcEstado, estado, contenido);
  return r.puede ? { conocimiento: pendiente, motivo: null } : { conocimiento: null, motivo: r.motivo };
}

/**
 * Mostrarle un objeto narrativo a su NPC asociado: revela el conocimiento del objeto sin pedir relación.
 * Siguen valiendo el bloqueo, la única vez, el evento y la marca.
 * @returns {{ conocimiento: object|null, motivo: string|null }}
 */
export function conocimientoPorNarrativo(objetoDef, npcDef, npcEstado, estado, contenido) {
  if (objetoDef?.tipo !== 'narrativo' || objetoDef.npcAsociado !== npcDef?.id) {
    return { conocimiento: null, motivo: MOTIVOS_NO_REVELA.INEXISTENTE };
  }
  const k = (npcDef.conocimientos ?? []).find((x) => x.id === objetoDef.conocimientoDesbloquea);
  const r = puedeRevelar(k, npcDef.id, npcEstado, estado, contenido, { sinUmbral: true });
  return r.puede ? { conocimiento: k, motivo: null } : { conocimiento: null, motivo: r.motivo };
}

/** Marca el conocimiento como revelado. No modifica el estado recibido. */
export function revelar(npcEstado, conocimientoId) {
  if (npcEstado.conocimientosRevelados.includes(conocimientoId)) return npcEstado;
  return { ...npcEstado, conocimientosRevelados: [...npcEstado.conocimientosRevelados, conocimientoId] };
}

/**
 * Umbral de relación del primer contacto por pista: el jugador llegó al dueño de p1 por la pista de camino narrada.
 * Rige solo para el _1 de ese NPC y solo en la primera consulta con tema a ese NPC; después vuelve el umbral original.
 */
export const UMBRAL_PRIMER_CONTACTO_PISTA = 0;

/** Umbral que rige esta consulta (o null si es el original). */
export function umbralDeConsulta(npcDef, conocimiento, estado) {
  const marca = estado?.caso?.primerContactoPista;
  if (!marca || marca.usado || marca.npcId !== npcDef?.id) return null;
  if (conocimiento?.id !== npcDef.conocimientos?.[0]?.id) return null;
  return Math.min(UMBRAL_PRIMER_CONTACTO_PISTA, conocimiento.umbralRelacion);
}

/** Después de la primera consulta con tema al NPC de la pista, la marca queda usada. */
export function usarPrimerContacto(estado, npcId) {
  const marca = estado?.caso?.primerContactoPista;
  if (!marca || marca.usado || marca.npcId !== npcId) return estado;
  return { ...estado, caso: { ...estado.caso, primerContactoPista: { ...marca, usado: true } } };
}

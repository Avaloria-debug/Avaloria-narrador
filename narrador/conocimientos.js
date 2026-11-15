// Conocimientos de los NPCs: cuándo se revelan.
import { conocimientoHabilitado } from './efectosEventos.js';

export const MOTIVOS_NO_REVELA = Object.freeze({
  BLOQUEADO: 'bloqueado',
  YA_REVELADO: 'ya_revelado',
  UMBRAL: 'umbral',
  EVENTO: 'evento',
  MARCA: 'marca',
  INEXISTENTE: 'inexistente',
});

/**
 * ¿Se puede revelar este conocimiento ahora?
 * - Bloqueado para siempre si el jugador atacó o emboscó al NPC.
 * - Una sola vez por NPC.
 * - Relación mayor o igual al umbral, salvo `sinUmbral` (mostrar un objeto narrativo).
 * - `requiereEvento`: el evento está activo en alguna escena, o un evento activo habilita el conocimiento.
 * - `requiereMarca`: el jugador tiene la marca.
 * @returns {{ puede: boolean, motivo: string|null }}
 */
export function puedeRevelar(conocimiento, npcId, npcEstado, estado, contenido, { sinUmbral = false } = {}) {
  const no = (motivo) => ({ puede: false, motivo });
  if (!conocimiento) return no(MOTIVOS_NO_REVELA.INEXISTENTE);
  if (npcEstado.bloqueadoConocimientos) return no(MOTIVOS_NO_REVELA.BLOQUEADO);
  if (npcEstado.conocimientosRevelados.includes(conocimiento.id)) return no(MOTIVOS_NO_REVELA.YA_REVELADO);
  if (!sinUmbral && npcEstado.relacion < conocimiento.umbralRelacion) return no(MOTIVOS_NO_REVELA.UMBRAL);
  if (conocimiento.requiereEvento != null) {
    const activo = (estado.eventosActivos ?? []).some((a) => a.id === conocimiento.requiereEvento);
    if (!activo && !conocimientoHabilitado(npcId, conocimiento.id, estado.eventosActivos, contenido)) {
      return no(MOTIVOS_NO_REVELA.EVENTO);
    }
  }
  if (conocimiento.requiereMarca != null && !(estado.marcas ?? []).includes(conocimiento.requiereMarca)) {
    return no(MOTIVOS_NO_REVELA.MARCA);
  }
  return { puede: true, motivo: null };
}

/**
 * Primer conocimiento del NPC que se puede revelar ahora, por conversación.
 * @returns {{ conocimiento: object|null, motivo: string|null }} `motivo`: por qué no se reveló el primero pendiente
 */
export function conocimientoARevelar(npcDef, npcEstado, estado, contenido) {
  let motivo = null;
  for (const k of npcDef.conocimientos ?? []) {
    const r = puedeRevelar(k, npcDef.id, npcEstado, estado, contenido);
    if (r.puede) return { conocimiento: k, motivo: null };
    motivo ??= r.motivo;
  }
  return { conocimiento: null, motivo };
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

// Movimiento de NPCs. La posición sale del reloj: no se guarda en el estado.
// - `rotacion` (Sarin) y `alternancia` (Brenn): el NPC recorre `caminos` en orden y vuelve a empezar,
//   cambiando cada `cadaHorasReloj` horas del reloj. Arranca en su escena inicial.
// - Sin movimiento: se queda en su escena inicial.
import { minutosAbsolutos, relojInicial } from './reloj.js';

/** Escena donde está un NPC a esa hora del reloj. */
export function escenaDeNpc(npcDef, reloj, contenido) {
  const m = npcDef.movimiento;
  const caminos = m?.caminos;
  if (!m || !Array.isArray(caminos) || caminos.length === 0 || !(m.cadaHorasReloj > 0)) return npcDef.escenaInicialId;
  const horas = Math.max(0, (minutosAbsolutos(reloj) - minutosAbsolutos(relojInicial(contenido))) / 60);
  const arranque = Math.max(0, caminos.indexOf(npcDef.escenaInicialId));
  return caminos[(arranque + Math.floor(horas / m.cadaHorasReloj)) % caminos.length];
}

/** Escena de cada NPC: { npcId: escenaId }. */
export function posicionesDeNpcs(reloj, contenido) {
  return Object.fromEntries((contenido.npcs ?? []).map((n) => [n.id, escenaDeNpc(n, reloj, contenido)]));
}

/** Definiciones de los NPCs que están en una escena a esa hora, en el orden del contenido. */
export function npcsEnEscena(escenaId, reloj, contenido) {
  return (contenido.npcs ?? []).filter((n) => escenaDeNpc(n, reloj, contenido) === escenaId);
}

/**
 * NPCs que cambiaron de escena entre dos horas del reloj.
 * @returns {{ npcId: string, desde: string, hasta: string }[]}
 */
export function moverNpcs(relojAntes, reloj, contenido) {
  const antes = posicionesDeNpcs(relojAntes, contenido);
  const despues = posicionesDeNpcs(reloj, contenido);
  return Object.keys(despues)
    .filter((id) => antes[id] !== despues[id])
    .map((id) => ({ npcId: id, desde: antes[id], hasta: despues[id] }));
}

// Consecuencias visibles (P15): un hecho del jugador deja un efecto pequeño y temporal en una escena (t21, canon).
// Tabla en data: efectos[{ id, npc, escena, hecho, duracionH, aparece[], expira[] }]. Estado en ext.efectos.
import { minutosAbsolutos } from './reloj.js';
import { PESO_MINIMO } from './rumores.js';

/** Efectos guardados (partida vieja → []). */
export const efectosGuardados = (ext) => (Array.isArray(ext?.efectos) ? ext.efectos.filter((e) => e && typeof e.id === 'string') : []);

/** Activa los efectos que dispara un hecho (mismo verbo y NPC, peso ≥2). Sin duplicar uno activo. */
export function activarPorHecho(activos, tabla, hecho, reloj) {
  if (!hecho || hecho.peso < PESO_MINIMO) return activos;
  const ahora = minutosAbsolutos(reloj);
  let r = activos;
  for (const def of tabla ?? []) {
    if (def.hecho !== hecho.tipo || def.npc !== hecho.npc || r.some((e) => e.id === def.id)) continue;
    r = [...r, { id: def.id, escena: def.escena, hasta: ahora + (def.duracionH ?? 24) * 60, visto: false }];
  }
  return r;
}

/** Separa los vencidos. @returns {{ activos: object[], vencidos: object[] }} */
export function vencer(activos, reloj) {
  const ahora = minutosAbsolutos(reloj);
  return { activos: activos.filter((e) => e.hasta > ahora), vencidos: activos.filter((e) => e.hasta <= ahora) };
}

/** Ids de efectos activos en una escena (para la condición `efecto`). */
export const efectosEn = (activos, escena) => activos.filter((e) => e.escena === escena).map((e) => e.id);

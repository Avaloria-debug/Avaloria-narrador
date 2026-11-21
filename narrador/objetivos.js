// Objetivos personales por NPC (P16, t22: canon A APROBAR). Avanzan solos con el reloj, aunque el jugador no esté.
// Estado en ext.objetivos = { [npc]: { paso, proximo, impulso } }. Azar: derivado "objetivos" por NPC y tick.
import { derivar } from './azar.js';
import { minutosAbsolutos } from './reloj.js';

export const IMPULSO_MAX = 3;
const MAX_AVANCES_POR_TURNO = 10;

/** Estado de objetivos (partida vieja → vacío). */
export const objetivosGuardados = (ext) => (ext?.objetivos && typeof ext.objetivos === 'object' ? structuredClone(ext.objetivos) : {});

/**
 * Avanza los objetivos hasta el reloj dado. prob del paso + 0.1×impulso, acotada a [0, 1].
 * @param {object} estados ext.objetivos
 * @param {object} tabla amp.objetivos
 */
export function avanzarObjetivos(estados, tabla, { reloj, semillaBase }) {
  const ahora = minutosAbsolutos(reloj);
  const r = { ...estados };
  for (const [npc, obj] of Object.entries(tabla ?? {})) {
    const pasos = obj.pasos ?? [];
    const e = { paso: 0, proximo: ahora + (pasos[0]?.avanzaCadaH ?? 24) * 60, impulso: 0, ...(r[npc] ?? {}) };
    let n = 0;
    while (e.paso < pasos.length && ahora >= e.proximo && n++ < MAX_AVANCES_POR_TURNO) {
      const paso = pasos[e.paso];
      const p = Math.max(0, Math.min(1, (paso.prob ?? 0.5) + 0.1 * e.impulso));
      const tiro = derivar(semillaBase, `objetivos:${npc}:${e.proximo}`)();
      const t = e.proximo;
      if (tiro < p) e.paso += 1;
      e.proximo = t + (pasos[Math.min(e.paso, pasos.length - 1)]?.avanzaCadaH ?? 24) * 60;
    }
    r[npc] = e;
  }
  return r;
}

/** Un hecho del jugador acelera (+) o frena (−) el objetivo del NPC según su afinidad. */
export function impulsar(estados, tabla, { npc, verbo }) {
  const af = tabla?.[npc]?.afinidad?.[verbo];
  if (!af || !estados[npc]) return estados;
  const e = estados[npc];
  return { ...estados, [npc]: { ...e, impulso: Math.max(-IMPULSO_MAX, Math.min(IMPULSO_MAX, (e.impulso ?? 0) + Math.sign(af))) } };
}

/** objetivoPaso para las condiciones: "<id>.<paso>". */
export const objetivoPasoDe = (estados, tabla, npc) => (tabla?.[npc] && estados?.[npc] ? `${tabla[npc].id}.${estados[npc].paso}` : null);

/** Paso en curso (para charla/rumor): el último alcanzado; null si todavía no empezó. */
export function pasoActual(estados, tabla, npc) {
  const e = estados?.[npc];
  const pasos = tabla?.[npc]?.pasos ?? [];
  if (!e || !pasos.length) return null;
  return pasos[Math.min(e.paso, pasos.length - 1)];
}

// Ambiente, clima y franja (P4). Sin texto propio: las líneas salen de ambiente (t02, t13) y npcs.rutina (t03).
import { derivar } from './azar.js';
import { minutosAbsolutos } from './reloj.js';
import { elegir } from './seleccion.js';

export const CLIMAS = Object.freeze(['despejado', 'nublado', 'lluvia', 'niebla']);
// Pesos del sorteo de clima (despejado más probable). Números de reglas, no texto.
const PESOS_CLIMA = [0.4, 0.3, 0.2, 0.1];
export const CLIMA_CADA_HORAS = 6;
export const PROB_AMBIENTE = 0.25;
export const VENTANA_AMBIENTE = 8;

/** Clima del bloque de 6 h del reloj, con rng derivado "clima". Sin semilla base: despejado. */
export function climaEn(semillaBase, reloj, cadaHoras = CLIMA_CADA_HORAS) {
  if (semillaBase === undefined || semillaBase === null || !reloj) return 'despejado';
  const bloque = Math.floor(minutosAbsolutos(reloj) / (cadaHoras * 60));
  const r = derivar(semillaBase, `clima:${bloque}`)();
  let acum = 0;
  for (let i = 0; i < CLIMAS.length; i++) { acum += PESOS_CLIMA[i]; if (r < acum) return CLIMAS[i]; }
  return CLIMAS[0];
}

/**
 * Línea de ambiente para este turno, o null.
 * - prob 0.25 (rng), nunca dos turnos seguidos, sin repetir dentro de las últimas 8 líneas.
 * - Si hay NPCs presentes con quienes el jugador no interactúa, puede salir su rutina (t03) en lugar del ambiente.
 * @param {{ ext: object, amp: object, hechos: object, escenaId: string, presentes?: string[], npcTurno?: string|null, rng: () => number }} p
 * @returns {{ texto: string, ext: object }|null}
 */
export function mensajeAmbiental({ ext, amp, hechos, escenaId, presentes = [], npcTurno = null, rng }) {
  const ventana = ext.ventanaAmbiente ?? [];
  if (ext.ultimoAmbiente !== undefined && ext.ultimoAmbiente === ext.turno - 1) return null;
  if (rng() >= PROB_AMBIENTE) return null;
  const ajenos = presentes.filter((n) => n !== npcTurno && amp.npcsRutina?.[n]?.rutina?.length);
  let variantes = amp.ambiente?.[escenaId] ?? [];
  if (ajenos.length && rng() < 0.5) {
    const npc = ajenos[Math.floor(rng() * ajenos.length)];
    variantes = amp.npcsRutina[npc].rutina;
  }
  const libres = variantes.filter((v) => !ventana.includes(typeof v === 'string' ? v : v.t));
  const elegida = elegir(libres, hechos, { rng });
  if (!elegida) return null;
  return {
    texto: elegida.variante.t,
    ext: { ...ext, ultimoAmbiente: ext.turno, ventanaAmbiente: [...ventana, elegida.variante.t].slice(-VENTANA_AMBIENTE) },
  };
}

// Memoria de hechos (P6): lo que el jugador le hizo a cada NPC. Vive en estado.ext.hechos.
import { minutosAbsolutos } from './reloj.js';

export const VERBOS_HECHO = Object.freeze(['presionar', 'atacar', 'ayudar', 'negociar', 'emboscar', 'defender']);
export const MAX_HECHOS = 200;
export const PESOS = Object.freeze({ atacar: 3 });
export const PESO_BASE = 2;
export const HORAS_RECIENTE = 48;

/** Hechos guardados (partida vieja → []). */
export const hechosGuardados = (ext) => (Array.isArray(ext?.hechos) ? ext.hechos.filter((h) => h && typeof h === 'object') : []);

/** Recorta a MAX_HECHOS: se va el de menor peso y, entre ellos, el más viejo. */
export function recortar(lista, max = MAX_HECHOS) {
  const l = [...lista];
  while (l.length > max) {
    let peor = 0;
    for (let i = 1; i < l.length; i++) if (l[i].peso < l[peor].peso || (l[i].peso === l[peor].peso && l[i].tick < l[peor].tick)) peor = i;
    l.splice(peor, 1);
  }
  return l;
}

/** Registra un hecho si el verbo cuenta. Devuelve la lista nueva. */
export function registrarHecho(lista, { verbo, npc, escena, reloj }) {
  if (!VERBOS_HECHO.includes(verbo)) return lista;
  const tick = minutosAbsolutos(reloj);
  const id = `h${tick}_${lista.length}_${verbo}`;
  return recortar([...lista, { id, tipo: verbo, npc: npc ?? null, escena, tick, peso: PESOS[verbo] ?? PESO_BASE }]);
}

/** rec (verbos que el NPC recuerda, del más reciente al más viejo) y ant (reciente | lejano) del último. */
export function recuerdosDe(lista, npc, reloj, horasReciente = HORAS_RECIENTE) {
  if (!npc) return {};
  const suyos = lista.filter((h) => h.npc === npc).sort((a, b) => b.tick - a.tick);
  if (!suyos.length) return {};
  const ahora = minutosAbsolutos(reloj);
  return { rec: [...new Set(suyos.map((h) => h.tipo))], ant: ahora - suyos[0].tick <= horasReciente * 60 ? 'reciente' : 'lejano', ultimo: suyos[0] };
}

/** Línea de memoria (t06/t18): memoria.<npc>.<verbo>[reciente|lejano], o genericas. null si no hay. */
export function lineaDeMemoria(amp, npc, recuerdo, rng) {
  if (!recuerdo?.ultimo) return null;
  const verbo = recuerdo.ultimo.tipo;
  const i = recuerdo.ant === 'reciente' ? 0 : 1;
  const lista = amp.memoria?.[npc]?.[verbo]?.[i]?.length ? amp.memoria[npc][verbo][i] : amp.genericas?.[verbo]?.[i];
  if (!lista?.length) return null;
  return lista[Math.min(lista.length - 1, Math.floor(rng() * lista.length))];
}

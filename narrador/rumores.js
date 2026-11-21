// Rumores (P9): los hechos del jugador viajan entre NPCs de escenas conectadas, cada 6 h de reloj.
// Estado en ext.rumores = { [npcId]: [{ hecho, tipo, npc, escena, fuerza, contado }] }. Sin texto propio.
import { minutosAbsolutos } from './reloj.js';
import { posicionesDeNpcs } from './movimientoNpcs.js';

export const MENSAJEROS = Object.freeze(['sarin_mensajera', 'brenn_arriero']);
export const RUMOR_CADA_HORAS = 6;
export const PESO_MINIMO = 2;

/** Bloques de 6 h cruzados entre dos relojes (0 si no avanzó de bloque). */
export function bloquesCruzados(antes, despues, cada = RUMOR_CADA_HORAS) {
  const b = (r) => Math.floor(minutosAbsolutos(r) / (cada * 60));
  return Math.max(0, b(despues) - b(antes));
}

const vecinas = (contenido, esc) => new Set([...(contenido.escenas.find((e) => e.id === esc)?.salidas ?? []), ...contenido.escenas.filter((e) => (e.salidas ?? []).includes(esc)).map((e) => e.id)]);

/**
 * Una ronda de propagación.
 * - Hechos de peso ≥2 que nadie conoce: los NPCs de la escena del hecho y de las vecinas los oyen con fuerza peso-1.
 * - Quien ya sabe un rumor lo pasa a los NPCs de escenas vecinas con fuerza-1 (los mensajeros, con fuerza completa).
 * - Fuerza 0 no se propaga. Un NPC no guarda dos veces el mismo hecho (se queda con la fuerza mayor).
 */
export function propagar(rumores, hechos, { contenido, reloj }) {
  const pos = posicionesDeNpcs(reloj, contenido);
  const npcsEn = (esc) => Object.entries(pos).filter(([, e]) => e === esc).map(([id]) => id);
  const r = Object.fromEntries(Object.entries(rumores ?? {}).map(([k, l]) => [k, l.map((x) => ({ ...x }))]));
  const dar = (npc, rumor, fuerza) => {
    if (fuerza <= 0 || npc === rumor.npc) return;
    const lista = (r[npc] ??= []);
    const previo = lista.find((x) => x.hecho === rumor.hecho);
    if (previo) { if (fuerza > previo.fuerza) previo.fuerza = fuerza; return; }
    lista.push({ hecho: rumor.hecho, tipo: rumor.tipo, npc: rumor.npc, escena: rumor.escena, fuerza, contado: false });
  };
  const conocidos = new Set(Object.values(r).flat().map((x) => x.hecho));
  const fotos = Object.entries(r).flatMap(([npc, l]) => l.map((x) => [npc, { ...x }]));
  for (const h of hechos ?? []) {
    if (h.peso < PESO_MINIMO || conocidos.has(h.id)) continue;
    const rumor = { hecho: h.id, tipo: h.tipo, npc: h.npc, escena: h.escena };
    for (const esc of [h.escena, ...vecinas(contenido, h.escena)]) for (const n of npcsEn(esc)) dar(n, rumor, h.peso - 1);
  }
  for (const [npc, rumor] of fotos) {
    if (rumor.fuerza <= 0) continue;
    const f = MENSAJEROS.includes(npc) ? rumor.fuerza : rumor.fuerza - 1;
    for (const esc of vecinas(contenido, pos[npc])) for (const n of npcsEn(esc)) dar(n, rumor, f);
  }
  return r;
}

/** fz de un rumor: fuerte (≥2) o difuso. */
export const fuerzaDe = (f) => (f >= 2 ? 'fuerte' : 'difuso');

/** El rumor que un NPC todavía no contó (el más fuerte), o null. */
export function rumorPendiente(rumores, npc) {
  const l = (rumores?.[npc] ?? []).filter((x) => !x.contado);
  return l.length ? l.reduce((a, b) => (b.fuerza > a.fuerza ? b : a)) : null;
}

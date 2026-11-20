// Selección por especificidad (P2). Sin texto propio: elige entre variantes del contenido.
// Variante: string (0 claves) o { c?, t }. Gana la que cumple más claves de `c`; desempata la ventana de aperturas y el rng.
import { VENTANA_APERTURAS } from './narracion.js';

// Umbrales por defecto (los mismos de data/contenido/ampliado/t00-guia.json; si llega la guía, mandan los de la guía).
export const UMBRALES = Object.freeze({
  franjas: { madrugada: [0, 6], manana: [6, 12], tarde: [12, 19], noche: [19, 24] },
  relacion: { mala: [-100, -20], neutra: [-19, 39], buena: [40, 100] },
  tension: { baja: [0, 5], alta: [6, 10] },
  recuerdo: { reciente_horas: 48 },
});
const CATEGORIA = { ciudad: 'ciudad', mercado: 'ciudad', conocimiento: 'ciudad', camino: 'camino' };

const enRango = (tabla, v) => Object.entries(tabla).find(([, [a, b]]) => v >= a && v <= b)?.[0] ?? null;
export const cubeta = (n) => (n >= 3 ? '3+' : n === 2 ? '2' : n === 1 ? '1' : null);

/** Franja horaria de una hora "HH:MM". */
export function franjaDe(hora, umbrales = UMBRALES) {
  const h = Number(String(hora).slice(0, 2));
  return Object.entries(umbrales.franjas).find(([, [a, b]]) => h >= a && h < b)?.[0] ?? 'noche';
}

/**
 * Hechos del contexto para las condiciones `c`. Lo que no se sabe queda ausente (y no cumple).
 * @param {object} estado estado de la partida (con `ext` opcional)
 * @param {{ contenido: object, npcId?: string|null, escenaId?: string, umbrales?: object, extra?: object }} contexto
 */
export function hechosDe(estado, { contenido, npcId = null, escenaId, umbrales = UMBRALES, extra = {} } = {}) {
  const ext = estado?.ext ?? {};
  const esc = escenaId ?? estado?.jugador?.escenaId;
  const escena = (contenido?.escenas ?? []).find((e) => e.id === esc);
  const h = { f: franjaDe(estado?.reloj?.hora ?? '08:00', umbrales), esc, cat: CATEGORIA[escena?.categoria] ?? 'otro' };
  if (ext.clima) h.cl = ext.clima;
  h.ts = enRango(umbrales.tension, Number.isFinite(ext.tension) ? ext.tension : 0);
  const vis = cubeta(ext.visitas?.[esc] ?? 0);
  if (vis) h.vis = vis;
  const rep = cubeta(ext.repeticion?.n ?? 0);
  if (rep) h.rep = rep;
  if (npcId) {
    h.npc = npcId;
    const rel = estado?.npcs?.[npcId]?.relacion;
    if (Number.isFinite(rel)) h.r = enRango(umbrales.relacion, Math.max(-100, Math.min(100, rel)));
  }
  for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined) h[k] = v;
  return h;
}

/** ¿Los hechos cumplen la condición? Lista = cualquiera; "3+" = ≥3; clave ausente en hechos = no cumple. */
export function cumple(c, hechos) {
  if (!c) return true;
  for (const [k, v] of Object.entries(c)) {
    const h = hechos?.[k];
    if (h === undefined || h === null) return false;
    const buscados = (Array.isArray(v) ? v : [v]).map(String);
    const tiene = (Array.isArray(h) ? h : [h]).map(String);
    if (!buscados.some((b) => tiene.includes(b) || (b === '3+' && tiene.some((x) => x === '3+' || Number(x) >= 3)))) return false;
  }
  return true;
}

export const normalizar = (v) => (typeof v === 'string' ? { t: v } : v && typeof v === 'object' && typeof v.t === 'string' ? v : null);
export const especificidad = (v) => (v?.c ? Object.keys(v.c).length : 0);

/**
 * Elige la variante más específica que cumple. `completar(t)` opcional: transforma el texto y descarta si devuelve null.
 * @returns {{ texto: string, apertura: string, variante: object, claves: number }|null}
 */
export function elegir(variantes, hechos, { rng, aperturas = [], completar = (t) => t, aperturaDe = (t) => String(t).split(/\s+/)[0].toLowerCase() } = {}) {
  if (typeof rng !== 'function') throw new TypeError('elegir necesita un rng');
  const ventana = (aperturas ?? []).slice(-VENTANA_APERTURAS);
  const candidatas = [];
  for (const v of Array.isArray(variantes) ? variantes : []) {
    const n = normalizar(v);
    if (!n || !cumple(n.c, hechos)) continue;
    const texto = completar(n.t);
    if (texto) candidatas.push({ texto, apertura: aperturaDe(texto), variante: n, claves: especificidad(n) });
  }
  if (!candidatas.length) return null;
  const max = Math.max(...candidatas.map((c) => c.claves));
  const mejores = candidatas.filter((c) => c.claves === max);
  const libres = mejores.filter((c) => !ventana.includes(c.apertura));
  const pool = libres.length ? libres : mejores;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

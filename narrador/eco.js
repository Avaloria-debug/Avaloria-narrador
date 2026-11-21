// Eco del jugador (P14): una sola palabra de lo que escribió, ya filtrada, para plantillas con {eco} (t20).
// Nunca una frase completa: si el texto es una sola palabra, no hay eco.
// Filtro: sin palabras vacías, sin números, 4..12 letras, no es nombre de NPC/objeto/lugar ni forma de intención, y
// tiene que existir en el vocabulario del propio contenido (así ningún insulto ni dato personal llega a la salida).
import { normalizar, tokenizar } from './comprension.js';

export const ECO_CADA_TURNOS = 4;
const vocabularios = new WeakMap();

function textosDe(o, out) {
  if (typeof o === 'string') out.push(o);
  else if (Array.isArray(o)) o.forEach((x) => textosDe(x, out));
  else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => k !== 'c' && textosDe(v, out));
  return out;
}

/** Vocabulario normalizado del contenido (v3 + ampliado), sin nombres propios de NPC/objeto/escena. */
export function vocabularioDe(contenido, amp) {
  const clave = amp ?? contenido;
  if (vocabularios.has(clave)) return vocabularios.get(clave);
  const palabras = new Set(textosDe([contenido.plantillas, amp?.plantillas, amp?.ambiente, amp?.charla, amp?.simbolos], []).flatMap((t) => normalizar(t).split(' ')));
  const propios = new Set([
    ...contenido.npcs.flatMap((n) => [n.nombre, ...(n.alias ?? [])]),
    ...contenido.objetos.map((o) => o.nombre),
    ...contenido.escenas.map((e) => e.nombre),
    ...contenido.intenciones.flatMap((i) => i.formas ?? []),
  ].flatMap((x) => normalizar(x).split(' ')));
  const r = { palabras, propios };
  vocabularios.set(clave, r);
  return r;
}

/** Palabra libre para el eco, o null. */
export function palabraDeEco(texto, { contenido, amp }) {
  if (typeof texto !== 'string') return null;
  const todas = normalizar(texto).split(' ').filter(Boolean);
  if (todas.length < 2) return null;
  const { palabras, propios } = vocabularioDe(contenido, amp);
  const ok = tokenizar(texto).filter((p) => /^[a-zñ]{4,12}$/.test(p) && !propios.has(p) && palabras.has(p));
  if (!ok.length) return null;
  return ok.reduce((a, b) => (b.length > a.length ? b : a));
}

/** ¿Toca eco este turno? (máx. 1 cada 4 turnos) */
export const puedeEco = (ext) => !(Number.isInteger(ext?.ultimoEco) && ext.turno - ext.ultimoEco < ECO_CADA_TURNOS);

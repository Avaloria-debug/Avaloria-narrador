// X3 (fase 8): monedas y precios. Montos internos en bronce (enteros); se muestran en la moneda más natural.
// data/config/precios.json es provisional (A APROBAR). Sin ajustes por origen del jugador todavía: `ajusteOrigen` es el
// punto de extensión (hoy devuelve 1; el jugador es veridoniano).
import precios from '../../data/config/precios.json' with { type: 'json' };
import { derivar } from '../azar.js';
import { precioEfectivo } from '../efectosEventos.js';

export const PRECIOS = precios;
export const MONEDAS = Object.freeze({ ...precios.monedas });
const ORDEN = Object.freeze(['platino', 'oro', 'plata', 'bronce']);

const entero = (n) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);

/** Dinero del jugador en bronce. El estado guarda bronce y plata (más oro/platino si los hubiera). */
export function totalBronce(jugador) {
  return ORDEN.reduce((t, m) => t + entero(jugador?.[m]) * MONEDAS[m], 0);
}

/**
 * Jugador con un total nuevo (nunca negativo). Se guarda como plata + bronce para no cambiar el esquema del estado
 * ni del registro (oro y platino, si existían, pasan a plata).
 */
export function conTotal(jugador, total) {
  const t = entero(total);
  const j = { ...jugador, bronce: t % MONEDAS.plata, plata: Math.floor(t / MONEDAS.plata) };
  if ('oro' in j) j.oro = 0;
  if ('platino' in j) j.platino = 0;
  return j;
}

const NOMBRE = Object.freeze({ bronce: 'bronce', plata: 'plata', oro: 'oro', platino: 'platino' });
/** «5 de plata», «1 de plata y 20 de bronce», «2 de oro, 3 de plata y 1 de bronce». Siempre con moneda. */
export function formatoMonto(bronce) {
  let r = entero(bronce);
  if (r === 0) return '0 de bronce';
  const partes = [];
  for (const m of ORDEN) {
    const n = Math.floor(r / MONEDAS[m]);
    r -= n * MONEDAS[m];
    if (n > 0) partes.push(`${n} de ${NOMBRE[m]}`);
  }
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
}

/** Punto de extensión: ajuste de precio por origen del jugador (fase futura). */
export const ajusteOrigen = (_origen, _clave) => 1;

/** Base de un producto en bronce: fija, o del rango con RNG derivado fijo por día, vendedor y producto. */
export function baseDe(clave, { semillaBase = 0, dia = 1, vendedor = 'nadie', tabla = precios.base } = {}) {
  const b = tabla[clave];
  if (Number.isFinite(b)) return b;
  if (Array.isArray(b) && b.length === 2) {
    const rng = derivar(semillaBase, `precio:${dia}:${vendedor}:${clave}`);
    return b[0] + Math.floor(rng() * (b[1] - b[0] + 1));
  }
  return null;
}

/**
 * Precio efectivo en bronce = base × modificadores (clima, estación, festividad, importado, relación, eventos activos).
 * @returns {number|null} null si el producto no tiene precio.
 */
export function precioDe(clave, ctx = {}) {
  const base = baseDe(clave, ctx);
  if (base === null) return null;
  const m = precios.modificadores;
  let f = 1;
  if (typeof ctx.clima === 'string' && ctx.clima.includes('lluvia')) f *= m.lluvia?.[clave] ?? 1;
  if (ctx.festividad) f *= m.festividad?.[clave] ?? 1;
  if (typeof ctx.estacion === 'string') f *= m[ctx.estacion]?.[clave] ?? 1;
  if (ctx.importado || clave.endsWith('_caelumia')) f *= m.importado_caelumia ?? 1;
  if (Number.isInteger(ctx.relacion)) f *= m.relacion?.[String(ctx.relacion)] ?? 1;
  f *= ajusteOrigen(ctx.origen ?? 'veridonia', clave);
  let cantidad = base * f;
  // Eventos activos (precioEfectivo existente): como objeto en bronce de la categoría del producto.
  if (ctx.contenido && Array.isArray(ctx.eventosActivos) && ctx.eventosActivos.length) {
    const p = precioEfectivo({ id: ctx.objetoId ?? clave, tipo: ctx.categoria ?? 'consumible', precio: { cantidad: Math.max(1, Math.round(cantidad)), moneda: 'bronce' } }, ctx.eventosActivos, ctx.contenido);
    if (p) cantidad = p.cantidad;
  }
  return Math.max(1, entero(cantidad));
}

/** Convierte un precio del contenido ({cantidad, moneda}) a bronce. */
export const aBronce = (p) => (p && Number.isFinite(p.cantidad) && MONEDAS[p.moneda] ? entero(p.cantidad * MONEDAS[p.moneda]) : null);

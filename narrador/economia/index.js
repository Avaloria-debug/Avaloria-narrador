// Fase 8: economía con el ampliado («todo tiene un precio»). Precios, compra, venta y pago (X3); los sistemas
// (regateo, trabajos), favores, información y exhibir dinero se suman en sus pasos. El mundo es neutral: nada favorece
// al jugador. Sin ampliado no se llama (salida idéntica).
import { normalizar } from '../comprension.js';
import { npcsPresentes } from '../turno.js';
import { estacionDe, festividadActiva } from '../calendario.js';
import { totalBronce, conTotal, formatoMonto, precioDe, aBronce } from './monedas.js';
import { elegirLinea } from './textos.js';

// Productos de precios.json: palabras que los nombran, objeto del contenido (si existe) y quién los vende.
export const PRODUCTOS = Object.freeze({
  pan_viejo: { palabras: ['pan viejo', 'pan duro'], objetoId: 'objeto_pan_duro', vendedores: ['serel_panadero'], nombre: 'pan viejo' },
  pan_fresco: { palabras: ['pan fresco', 'pan', 'hogaza'], objetoId: 'objeto_pan_fresco', vendedores: ['serel_panadero'], nombre: 'pan fresco' },
  comida_taberna: { palabras: ['comida', 'plato', 'guiso', 'almuerzo', 'cena', 'sopa'], vendedores: ['naela_tabernera'], nombre: 'un plato' },
  bebida: { palabras: ['bebida', 'cerveza', 'vino', 'trago'], objetoId: 'objeto_vino_barato', vendedores: ['naela_tabernera'], nombre: 'una bebida' },
  pescado: { palabras: ['pescado', 'pescados', 'pez', 'peces'], vendedores: ['ysolde_pescadora'], nombre: 'pescado' },
  fruta: { palabras: ['fruta', 'frutas', 'manzana', 'manzanas', 'higo', 'higos'], vendedores: null, nombre: 'fruta' },
  vela: { palabras: ['vela', 'velas'], vendedores: null, nombre: 'una vela' },
  cuerda: { palabras: ['cuerda', 'soga'], objetoId: 'objeto_cuerda', vendedores: ['brenn_arriero'], nombre: 'una cuerda' },
  cuchillo: { palabras: ['cuchillo'], objetoId: 'objeto_cuchillo_cocina', vendedores: null, nombre: 'un cuchillo' },
  herramienta_caelumia: { palabras: ['herramienta', 'herramientas'], vendedores: ['ivor_cambista'], nombre: 'una herramienta de Caelumia', categoria: 'herramienta' },
  habitacion_lujosa: { palabras: ['habitacion lujosa', 'cuarto lujoso', 'habitacion buena'], vendedores: ['naela_tabernera'], nombre: 'una habitación buena' },
  habitacion_pobre: { palabras: ['habitacion', 'cuarto', 'cama'], vendedores: ['naela_tabernera'], nombre: 'una habitación' },
  peaje: { palabras: ['peaje', 'paso'], vendedores: ['dario_guardia'], nombre: 'el peaje' },
  copia_documento: { palabras: ['copia', 'copias', 'documento'], vendedores: ['maren_archivista'], nombre: 'una copia' },
  rumor: { palabras: ['rumor', 'rumores', 'chisme'], vendedores: null, nombre: 'un rumor' },
});
const ORDEN_PRODUCTOS = Object.entries(PRODUCTOS).flatMap(([clave, p]) => p.palabras.map((w) => [w, clave])).sort((a, b) => b[0].length - a[0].length);

export function productoEn(n) {
  for (const [w, clave] of ORDEN_PRODUCTOS) if (new RegExp(`(^| )${w}( |$)`).test(n)) return clave;
  return null;
}

const RE = Object.freeze({
  precio: /(^| )(cuanto (cuesta|cuestan|sale|salen|vale|valen|cobras|cobra|es)|precio de|precio del|que precio|a cuanto)( |$)/,
  compra: /(^| )(compro|comprar|comprarte|comprarle|quiero comprar|me llevo|llevo|dame|deme)( |$)/,
  venta: /(^| )(vendo|vender|venderte|venderle|te vendo|le vendo)( |$)/,
  pago: /^(pago|le pago|te pago|pagar|pagarle|pagarte|pagale)( |$)/,
});

/** Intención económica de una frase (o null). */
export function leerEconomia(texto) {
  const n = normalizar(texto);
  if (!n) return null;
  const producto = productoEn(n);
  if (RE.precio.test(n)) return producto ? { tipo: 'precio', producto } : null;
  if (RE.venta.test(n)) return { tipo: 'venta', n };
  if (RE.compra.test(n)) return producto ? { tipo: 'compra', producto } : null;
  if (RE.pago.test(n)) return { tipo: 'pago', producto };
  return null;
}

/** Contexto de precio para un vendedor en la escena actual. */
export function ctxPrecio({ amp, contenido, partida, vendedor }) {
  const escenaDef = (contenido.escenas ?? []).find((x) => x.id === partida.jugador.escenaId);
  return {
    semillaBase: partida.ext?.semillaBase ?? 0,
    dia: partida.reloj.dia,
    vendedor: vendedor ?? 'nadie',
    clima: partida.ext?.clima ?? 'despejado',
    estacion: estacionDe(partida.reloj.dia),
    festividad: amp ? festividadActiva(amp.festividades, amp.calendario, { dia: partida.reloj.dia, escena: escenaDef }) : null,
    relacion: vendedor ? partida.npcs[vendedor]?.relacion ?? 0 : undefined,
    eventosActivos: partida.eventosActivos,
    contenido,
  };
}

/** Vendedor presente de un producto: el suyo si está; si el producto no tiene dueño, el primer presente. */
export function vendedorDe(producto, presentes) {
  const v = PRODUCTOS[producto]?.vendedores;
  if (Array.isArray(v)) return presentes.find((p) => v.includes(p.id))?.id ?? null;
  return presentes[0]?.id ?? null;
}

export const nombreNpc = (contenido, id) => (contenido.npcs ?? []).find((n) => n.id === id)?.nombre.split(' ')[0] ?? 'alguien';

/** Cobra un monto: null si no alcanza (el dinero nunca queda negativo). */
export function cobrar(partida, monto) {
  const total = totalBronce(partida.jugador);
  if (!Number.isFinite(monto) || monto < 0 || total < monto) return null;
  return { ...partida, jugador: conTotal(partida.jugador, total - monto) };
}
export const acreditar = (partida, monto) => ({ ...partida, jugador: conTotal(partida.jugador, totalBronce(partida.jugador) + Math.max(0, Math.round(monto) || 0)) });

const conObjeto = (partida, contenido, objetoId) => {
  const o = objetoId ? (contenido.objetos ?? []).find((x) => x.id === objetoId) : null;
  return o ? { ...partida, inventario: [...(partida.inventario ?? []), { objetoId: o.id, usosRestantes: o.usos ?? 1 }] } : partida;
};

const turnoTexto = (partida, texto, economia, extra = {}) => ({
  tipo: 'foco', estado: { ...partida, reformulacionPendiente: false }, intencionId: null, texto,
  foco: { id: null, verbo: 'economia' }, extFocos: { economia, ...extra },
});

/** Turno económico (ampliado). null → sigue el flujo normal. */
export function turnoDeEconomia({ amp, contenido, partida, texto }) {
  const lec = leerEconomia(texto);
  if (!lec) return null;
  const presentes = npcsPresentes(partida, contenido);
  const eco = { ...(partida.ext?.economia ?? {}) };
  const sal = (s) => (amp?.economia?.semilla ?? 0) + (partida.ext?.turno ?? 0) + s;
  const L = (clave, valores = {}) => elegirLinea(amp, clave, valores, sal(clave.length));

  if (lec.tipo === 'venta') {
    const inv = partida.inventario ?? [];
    const item = inv.find((x) => {
      const o = (contenido.objetos ?? []).find((y) => y.id === x.objetoId);
      return o && normalizar(o.nombre).split(' ').some((w) => w.length > 3 && lec.n.includes(w));
    });
    if (!item) return turnoTexto(partida, L('venta_nada'), eco);
    const comprador = presentes[0]?.id ?? null;
    if (!comprador) return turnoTexto(partida, L('nadie'), eco);
    const o = contenido.objetos.find((y) => y.id === item.objetoId);
    const monto = Math.floor((aBronce(o.precio) ?? 0) / 2);
    if (monto <= 0) return turnoTexto(partida, L('venta_no', { npc: nombreNpc(contenido, comprador) }), eco);
    const i = partida.inventario.indexOf(item);
    const sin = { ...partida, inventario: partida.inventario.filter((_, j) => j !== i) };
    return turnoTexto(acreditar(sin, monto), L('venta', { npc: nombreNpc(contenido, comprador), monto: formatoMonto(monto) }), eco);
  }

  const producto = lec.producto ?? eco.ultimo?.producto ?? null;
  if (!producto) return turnoTexto(partida, L('pago_que'), eco);
  const vendedor = vendedorDe(producto, presentes);
  if (!vendedor) return turnoTexto(partida, L('nadie'), eco);
  const precio = precioDe(producto, { ...ctxPrecio({ amp, contenido, partida, vendedor }), objetoId: PRODUCTOS[producto].objetoId, categoria: PRODUCTOS[producto].categoria ?? 'consumible' });
  const npc = nombreNpc(contenido, vendedor);
  eco.ultimo = { producto, vendedor, precio, dia: partida.reloj.dia };
  if (lec.tipo === 'precio') return turnoTexto(partida, L('precio', { npc, monto: formatoMonto(precio), producto: PRODUCTOS[producto].nombre }), eco);

  // compra o pago
  const pagado = cobrar(partida, precio);
  if (!pagado) return turnoTexto(partida, L('sin_dinero', { npc }), eco);
  delete eco.ultimo;
  const final = conObjeto(pagado, contenido, PRODUCTOS[producto].objetoId);
  return turnoTexto(final, L('compra', { npc, monto: formatoMonto(precio), producto: PRODUCTOS[producto].nombre }), eco);
}

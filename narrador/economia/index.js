// Fase 8: economía con el ampliado («todo tiene un precio»). Precios, compra, venta y pago (X3); los sistemas
// (regateo, trabajos), favores, información y exhibir dinero se suman en sus pasos. El mundo es neutral: nada favorece
// al jugador. Sin ampliado no se llama (salida idéntica).
import { normalizar } from '../comprension.js';
import { npcsPresentes } from '../turno.js';
import { estacionDe, festividadActiva } from '../calendario.js';
import { totalBronce, conTotal, formatoMonto, precioDe, aBronce } from './monedas.js';
import { elegirLinea, elegirDe } from './textos.js';
import { abrirSistema, turnoSistema, sistemaActivo, aplicarEfectosSistema } from '../sistemas/index.js';
import { nuevoFavor, avanzarFavores, respuestaCobro, pideCobrar, pideFiado, cuentaInfo, curiosidad, infoEnFrase, yaLoSabe, lineasInformacion, DESCUENTO_INFO } from './favores.js';
import { pideTrabajo, trabajoEn } from './trabajos.js';
import { abreRegateo, formatoAcuerdo, rasgoDinero } from './regateo.js';

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
// Texto de cada sistema según `sub.ultimo` (los módulos no escriben texto: solo eligen la clave).
export const TEXTO_SISTEMA = {
  regateo(sub, { L, contenido }) {
    const npc = nombreNpc(contenido, sub.npc);
    const v = { npc, monto: formatoAcuerdo(sub), producto: sub.nombre };
    const t41 = (k) => L(`regateo.${sub.npc}.${k}`, v);
    switch (sub.ultimo) {
      case 'abre': return `${L('regateo_abre', v)} ${L('cifra', { ...v, monto: formatoMonto(sub.actual) })} ${L('regateo_opciones', v)}`;
      case 'acepta': {
        if (sub.trueque) { const o = (contenido.objetos ?? []).find((x) => x.id === sub.trueque); return `${t41('acepta')} ${L('trueque', { ...v, objeto: o ? o.nombre.toLowerCase() : 'eso' })}`; }
        return `${t41('acepta')} ${L('compra', v)}`;
      }
      case 'rechaza': return t41('rechaza');
      case 'contraoferta': return `${t41('contraoferta')} ${L('cifra', { ...v, monto: formatoMonto(sub.actual) })}`;
      case 'sale': return L('regateo_sale', v);
      case 'sin_dinero': return L('pagos.sin_dinero', v);
      case 'pago_mas': return `${L('regateo_pago_mas', v)} ${L('compra', v)}`;
      case 'trueque_no': return L('regateo_trueque_no', v);
      default: return L('regateo_opciones', v);
    }
  },
  trabajo(sub, { L, contenido }) {
    const npc = nombreNpc(contenido, sub.npc);
    const t41 = (k) => L(`trabajos.${sub.trabajo}.${k}`, { npc });
    const extra = sub.evento === 'contratiempo' ? ` ${L('trabajo_contratiempo', { npc })}` : sub.evento === 'rumor' ? ` ${L('trabajo_rumor', { npc })}` : '';
    switch (sub.ultimo) {
      case 'oferta': return `${t41('oferta')} ${L('trabajo_pregunta', { npc })}`;
      case 'rechaza': return L('trabajo_rechaza', { npc });
      case 'durante': return `${t41('durante')}${extra}`;
      case 'abandona': return L('trabajo_abandona', { npc });
      case 'fin': return [extra.trim(), t41('fin'), L('trabajo_paga', { npc, monto: formatoMonto(sub.jornal) })].filter(Boolean).join(' ');
      default: return L('trabajo_sigue', { npc });
    }
  },
};

function turnoConSistema({ amp, contenido, partida, texto, eco, L, abrir = null }) {
  const base = abrir ? abrirSistema(partida, abrir.id, abrir.ctx) : partida;
  const r = abrir && !abrir.procesar
    ? { id: abrir.id, sub: base.ext.sistema.sub, estado: base, terminado: false }
    : turnoSistema(base, { tipo: 'texto', texto }, () => 0, { contenido, amp });
  const t = TEXTO_SISTEMA[r.id]?.(r.sub, { L, contenido, amp, partida }) ?? '';
  const estado = { ...r.estado, ext: partida.ext };
  return turnoTexto(estado, t, eco, { sistema: r.terminado ? null : r.estado.ext.sistema, hechosSistema: r.estado.ext?.hechosSistema ?? null });
}

/** X6: responder un cobro, cobrar un favor, fiado y pagar con información. null si la frase no es de favores. */
function favoresDeTurno({ amp, contenido, partida, n, texto, eco, L, presentes }) {
  const ids = presentes.map((p) => p.id);
  const favores = partida.ext?.favores ?? [];
  const dia = partida.reloj.dia;
  const nom = (id) => nombreNpc(contenido, id);
  const cambia = (lista, f, estado) => lista.map((x) => (x === f ? { ...x, estado } : x));
  const cobrando = favores.find((f) => f.estado === 'cobrando' && f.deudor === 'jugador' && ids.includes(f.npc));
  if (cobrando) {
    const resp = respuestaCobro(texto);
    if (resp === 'saldar') {
      const e = aplicarEfectosSistema(partida, [{ tipo: 'reloj', horas: 2 }]);
      return turnoTexto(e, `${L('favor_cumple')} ${L('favores.saldado', { npc: nom(cobrando.npc) })}`, eco, { favores: cambia(favores, cobrando, 'saldado') });
    }
    if (resp === 'negar') {
      const e = aplicarEfectosSistema(partida, [{ tipo: 'relacion', npc: cobrando.npc, delta: -1 }]);
      return turnoTexto(e, L('favores.incumplido', { npc: nom(cobrando.npc) }), eco, { favores: cambia(favores, cobrando, 'incumplido'), hechosSistema: { ...(partida.ext?.hechosSistema ?? {}), [`rumor_incumplido:${cobrando.npc}`]: dia } });
    }
  }
  if (pideCobrar(n)) {
    const f = favores.find((x) => x.deudor === 'npc' && x.estado === 'pendiente' && ids.includes(x.npc));
    if (!f) return turnoTexto(partida, L('favor_nadie'), eco);
    return turnoTexto(partida, L('favores.saldado', { npc: nom(f.npc) }), { ...eco, descuentos: { ...(eco.descuentos ?? {}), [f.npc]: DESCUENTO_INFO } }, { favores: cambia(favores, f, 'saldado') });
  }
  if (pideFiado(n) && eco.ultimo && ids.includes(eco.ultimo.vendedor)) {
    const { producto, vendedor } = eco.ultimo;
    if ((partida.npcs[vendedor]?.relacion ?? 0) < 1) return turnoTexto(partida, L('fiado_no', { npc: nom(vendedor) }), eco);
    const e = conObjeto(partida, contenido, PRODUCTOS[producto].objetoId);
    const resto = { ...eco }; delete resto.ultimo;
    return turnoTexto(e, L('fiado', { npc: nom(vendedor), producto: PRODUCTOS[producto].nombre }), resto, { favores: nuevoFavor(favores, { npc: vendedor, deudor: 'jugador', motivo: `fiado:${producto}`, dia }) });
  }
  if (cuentaInfo(n)) {
    const destino = presentes.find((p) => n.includes(normalizar(p.nombre.split(' ')[0])) || (p.alias ?? []).some((a) => new RegExp(`(^| )${normalizar(a)}( |$)`).test(n)))?.id ?? ids[0];
    if (!destino) return null;
    const info = infoEnFrase(n, { estado: partida, contenido });
    if (!info) return turnoTexto(partida, L('info_nada', { npc: nom(destino) }), eco);
    const { vale, sabia } = lineasInformacion(amp);
    const contadas = eco.contadas ?? {};
    const pick = (l, prov) => (l.length ? elegirDe(l, { npc: nom(destino) }) : L(prov, { npc: nom(destino) }));
    if (yaLoSabe(destino, info, contadas)) return turnoTexto(partida, pick(sabia, 'info_sabia'), eco);
    const eco2 = { ...eco, contadas: { ...contadas, [destino]: [...(contadas[destino] ?? []), info.id] } };
    if (curiosidad(amp, destino) >= 1) return turnoTexto(partida, pick(vale, 'info_vale'), eco2, { favores: nuevoFavor(favores, { npc: destino, deudor: 'npc', motivo: `info:${info.id}`, dia }) });
    eco2.descuentos = { ...(eco.descuentos ?? {}), [destino]: DESCUENTO_INFO };
    return turnoTexto(partida, pick(vale, 'info_vale'), eco2);
  }
  return null;
}

/** Tick de economía de cada turno con ampliado: favores nuevos por ayudar, cobros, incumplidos y deudas vencidas. */
export function tickEconomia({ amp, contenido, turno, estado, ext }) {
  let favores = ext?.favores ?? [];
  const lineas = [];
  const dia = estado.reloj.dia;
  const presentes = npcsPresentes(estado, contenido).map((p) => p.id);
  const L = (clave, v) => elegirLinea(amp, clave, v, (ext?.turno ?? 0) + clave.length);
  const a = turno?.accion;
  if (turno?.tipo === 'accion' && a?.verbo === 'ayudar' && a.resultado !== 'fallo' && a.parametros?.npcId) {
    const antes = favores;
    favores = nuevoFavor(favores, { npc: a.parametros.npcId, deudor: 'npc', motivo: 'ayuda', dia });
    if (favores !== antes) lineas.push(L('favores.pide', { npc: nombreNpc(contenido, a.parametros.npcId) }));
  }
  const r = avanzarFavores(favores, { dia, presentes, semillaBase: ext?.semillaBase ?? 0 });
  for (const l of r.lineas) lineas.push(L(l.clave, { npc: nombreNpc(contenido, l.npc) }));
  const nuevoEstado = r.relacion.length ? aplicarEfectosSistema(estado, r.relacion.map((x) => ({ tipo: 'relacion', ...x }))) : estado;
  const hechos = Object.keys(r.hechos).length ? { hechosSistema: { ...(ext?.hechosSistema ?? {}), ...r.hechos } } : {};
  const cambio = r.favores !== (ext?.favores ?? []) && JSON.stringify(r.favores) !== JSON.stringify(ext?.favores ?? []);
  return { estado: nuevoEstado, ext: cambio || Object.keys(hechos).length ? { ...ext, favores: r.favores, ...hechos } : ext, lineas: lineas.filter(Boolean) };
}

export function turnoDeEconomia({ amp, contenido, partida, texto }) {
  const presentes = npcsPresentes(partida, contenido);
  const eco = { ...(partida.ext?.economia ?? {}) };
  const sal = (s) => (amp?.economia?.semilla ?? 0) + (partida.ext?.turno ?? 0) + s;
  const L = (clave, valores = {}) => elegirLinea(amp, clave, valores, sal(clave.length));
  if (sistemaActivo(partida)) return turnoConSistema({ amp, contenido, partida, texto, eco, L });
  const n = normalizar(texto);
  const fav = favoresDeTurno({ amp, contenido, partida, n, texto, eco, L, presentes });
  if (fav) return fav;
  if (abreRegateo(n)) {
    const producto = productoEn(n) ?? eco.ultimo?.producto ?? null;
    if (!producto) return turnoTexto(partida, L('pago_que'), eco);
    const vendedor = vendedorDe(producto, presentes);
    if (!vendedor) return turnoTexto(partida, L('nadie'), eco);
    const precio = precioDe(producto, { ...ctxPrecio({ amp, contenido, partida, vendedor }), objetoId: PRODUCTOS[producto].objetoId, categoria: PRODUCTOS[producto].categoria ?? 'consumible' });
    const ctx = { npc: vendedor, producto, objetoId: PRODUCTOS[producto].objetoId ?? null, nombre: PRODUCTOS[producto].nombre, escena: partida.jugador.escenaId, precio, rasgoDinero: rasgoDinero(amp, vendedor), relacion: partida.npcs[vendedor]?.relacion ?? 0 };
    return turnoConSistema({ amp, contenido, partida, texto, eco, L, abrir: { id: 'regateo', ctx, procesar: /\d/.test(n) } });
  }
  if (pideTrabajo(n)) {
    const t = trabajoEn(amp, partida.jugador.escenaId, presentes);
    if (!t) return turnoTexto(partida, presentes.length ? L('trabajo_nada', { npc: nombreNpc(contenido, presentes[0].id) }) : L('nadie'), eco);
    const hechos = partida.ext?.hechosSistema ?? {};
    if (hechos[`trabajo:${t.npc}`] === partida.reloj.dia) return turnoTexto(partida, L('trabajo_hecho', { npc: nombreNpc(contenido, t.npc) }), eco);
    const ctx = { trabajo: t.id, npc: t.npc, escena: partida.jugador.escenaId, dia: partida.reloj.dia, semillaBase: partida.ext?.semillaBase ?? 0 };
    return turnoConSistema({ amp, contenido, partida, texto, eco, L, abrir: { id: 'trabajo', ctx } });
  }
  const lec = leerEconomia(texto);
  if (!lec) return null;

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

  // compra o pago (con el descuento ganado con información o un favor saldado, una vez)
  const desc = eco.descuentos?.[vendedor] ?? 0;
  const final$ = desc > 0 ? Math.max(1, Math.ceil(precio * (1 - desc))) : precio;
  const pagado = cobrar(partida, final$);
  if (!pagado) return turnoTexto(partida, L('sin_dinero', { npc }), eco);
  delete eco.ultimo;
  if (desc > 0) { eco.descuentos = { ...eco.descuentos }; delete eco.descuentos[vendedor]; }
  const final = conObjeto(pagado, contenido, PRODUCTOS[producto].objetoId);
  return turnoTexto(final, L('compra', { npc, monto: formatoMonto(final$), producto: PRODUCTOS[producto].nombre }), eco);
}

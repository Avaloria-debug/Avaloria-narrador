// X4 (fase 8): regateo, primer módulo de sistema. El NPC acepta solo si le conviene (mundo neutral).
// Rebaja máxima por rasgo `dinero` (valores.json) y precios.json `regateo`; la relación la corre ±25 % por punto.
// Máx. 3 rondas: insistir de más cierra el trato y baja la relación.
import { registrarSistema } from '../sistemas/index.js';
import { PRECIOS, aBronce, formatoMonto, totalBronce } from './monedas.js';
import { normalizar } from '../comprension.js';
import valoresJson from '../../data/contenido/ampliado/valores.json' with { type: 'json' };

/** Rasgo `dinero` (-2..2): el del ampliado cargado o, si no vino (canon sin aprobar), el de valores.json. */
export const rasgoDinero = (amp, npc) => amp?.valores?.[npc]?.dinero ?? valoresJson.valores?.[npc]?.dinero ?? 0;

export const MAX_RONDAS = 3;
export const VALOR_HALLAZGO = 100; // bronce, supuesto: un objeto narrativo sin precio
export const INTERESADOS_HALLAZGOS = Object.freeze(['ivor_cambista', 'maren_archivista']);

export function rebajaMaxima(rasgoDinero, relacion = 0) {
  const tabla = PRECIOS.regateo.rebaja_max_por_rasgo_dinero;
  const base = tabla[String(Math.max(-2, Math.min(2, rasgoDinero | 0)))] ?? 0.1;
  return Math.max(0, Math.min(base * 1.5, base * (1 + 0.25 * (relacion | 0))));
}

/** Monto en bronce de la frase («te doy 8», «2 de plata», «1 plata y 20»). null si no hay número. */
export function montoEn(n) {
  const re = /(\d+)\s*(de\s+)?(bronce|plata|oro|platino)?/g;
  let total = 0; let hay = false; let m;
  while ((m = re.exec(n))) { hay = true; total += Number(m[1]) * (PRECIOS.monedas[m[3] ?? 'bronce'] ?? 1); }
  return hay ? total : null;
}

export function valorTrueque(objeto, npc) {
  if (!objeto) return 0;
  const p = aBronce(objeto.precio);
  if (p) return Math.floor(p / 2);
  return INTERESADOS_HALLAZGOS.includes(npc) ? VALOR_HALLAZGO * 2 : Math.floor(VALOR_HALLAZGO / 2);
}

const RE = Object.freeze({
  aceptar: /(^| )(acepto|aceptar|aceptado|trato hecho|trato|dale|esta bien|de acuerdo|listo|me lo llevo)( |$)/,
  pagarMas: /(^| )(pago de mas|te pago mas|pago mas|te doy mas|le doy mas|quedate con el cambio|de propina)( |$)/,
  rebaja: /(^| )(rebaja|rebajame|mas barato|descuento|bajame|baja el precio|bajar)( |$)/,
  trueque: /(^| )(cambio|cambiar|trueque|a cambio|te cambio|le cambio)( |$)/,
  irse: /(^| )(me voy|no gracias|nada|olvidalo|dejalo|irme)( |$)/,
});
export const abreRegateo = (n) => /(^| )(regatear|regateo|regateamos|regateo|mas barato|rebaja|descuento)( |$)/.test(n) || /(^| )(te doy|le doy|ofrezco|te ofrezco) \d+/.test(n);

/**
 * sub: { npc, producto, objetoId, nombre, escena, precio, actual, minimo, rondas, ultimo, acuerdo, pagoMas, trueque, insistio }
 * `ultimo`: 'abre'|'acepta'|'rechaza'|'contraoferta'|'opciones'|'sale'|'sin_dinero'|'pago_mas'|'trueque_no' (el texto lo arma economia/index.js).
 */
export const regateo = registrarSistema({
  id: 'regateo',
  iniciar(_estado, ctx) {
    const rebaja = rebajaMaxima(ctx.rasgoDinero ?? 0, ctx.relacion ?? 0);
    return {
      npc: ctx.npc, producto: ctx.producto, objetoId: ctx.objetoId ?? null, nombre: ctx.nombre ?? '', escena: ctx.escena,
      precio: ctx.precio, actual: ctx.precio, minimo: Math.max(1, Math.ceil(ctx.precio * (1 - rebaja))),
      rondas: 0, ultimo: 'abre', acuerdo: null, pagoMas: false, trueque: null, insistio: false,
    };
  },
  cerrable: () => true,
  turno(sub, entrada, _rng, ctx) {
    const n = normalizar(entrada?.texto ?? '');
    const dinero = totalBronce(ctx.estado?.jugador);
    const fin = (s, ultimo) => ({ texto: '', sub: { ...s, ultimo }, terminado: true });
    const sigue = (s, ultimo) => ({ texto: '', sub: { ...s, ultimo }, terminado: false });
    const comprar = (s, monto, ultimo = 'acepta') => (dinero < monto ? fin({ ...s, acuerdo: null }, 'sin_dinero') : fin({ ...s, acuerdo: monto }, ultimo));
    if (ctx.salir || RE.irse.test(n)) return fin(sub, 'sale');
    if (RE.pagarMas.test(n)) return comprar({ ...sub, pagoMas: true }, Math.ceil(sub.actual * 1.2), 'pago_mas');
    if (RE.trueque.test(n)) {
      const inv = ctx.estado?.inventario ?? [];
      const objetos = ctx.contenido?.objetos ?? [];
      const item = inv.map((x) => objetos.find((o) => o.id === x.objetoId)).find((o) => o && normalizar(o.nombre).split(' ').some((w) => w.length > 3 && n.includes(w)));
      if (!item) return sigue(sub, 'trueque_no');
      const valor = valorTrueque(item, sub.npc);
      const rondas = sub.rondas + 1;
      if (valor >= sub.minimo && (valor >= sub.actual || rondas >= 2)) return fin({ ...sub, rondas, acuerdo: 0, trueque: item.id }, 'acepta');
      return rondas > MAX_RONDAS ? fin({ ...sub, rondas, insistio: true }, 'rechaza') : sigue({ ...sub, rondas }, 'rechaza');
    }
    if (RE.aceptar.test(n) && montoEn(n) === null) return comprar(sub, sub.actual);
    let oferta = montoEn(n);
    if (oferta === null && RE.rebaja.test(n)) oferta = Math.max(sub.minimo, sub.actual - Math.ceil((sub.precio - sub.minimo) / 2));
    if (oferta === null) return sigue(sub, 'opciones');
    const rondas = sub.rondas + 1;
    if (rondas > MAX_RONDAS) return fin({ ...sub, rondas, insistio: true }, 'rechaza');
    if (oferta >= sub.actual) return comprar({ ...sub, rondas }, sub.actual);
    if (oferta < sub.minimo) return sigue({ ...sub, rondas }, 'rechaza');
    if (rondas >= 2 || oferta === sub.minimo && rondas >= 2) return comprar({ ...sub, rondas }, oferta);
    const contra = Math.max(sub.minimo, Math.ceil((oferta + sub.actual) / 2));
    return sigue({ ...sub, rondas, actual: contra }, 'contraoferta');
  },
  resultado(sub) {
    if (sub.forzado) return [];
    const ef = [];
    if (sub.acuerdo !== null) {
      if (sub.acuerdo > 0) ef.push({ tipo: 'pago', monto: sub.acuerdo });
      if (sub.trueque) ef.push({ tipo: 'objeto_usado', objetoId: sub.trueque, agotado: true });
      if (sub.objetoId) ef.push({ tipo: 'objeto_agregado', objetoId: sub.objetoId, usosRestantes: 1 });
      if (sub.pagoMas) ef.push({ tipo: 'relacion', npc: sub.npc, delta: PRECIOS.regateo.pagar_de_mas_relacion });
    }
    if (sub.insistio) ef.push({ tipo: 'relacion', npc: sub.npc, delta: -1 });
    return ef;
  },
});

export const formatoAcuerdo = (sub) => formatoMonto(sub.acuerdo ?? sub.actual);

// Fase 8: textos de economía. Primero t41 (amp.economia, A APROBAR); si falta la clave, los provisionales de acá.
// A APROBAR (prov): líneas de precio, compra, venta y avisos de sistema que t41 no trae.
import { sinRepetir } from '../historial.js';

export const TEXTOS_ECONOMIA = Object.freeze({
  prov: true,
  precio: ['«{producto}: {monto}», dice {npc}.', '«Eso te sale {monto}», dice {npc}.', '{npc} lo piensa. «{monto}.»'],
  compra: ['Pagás {monto} y {npc} te da {producto}.', '{npc} cuenta las monedas: {monto}. Te llevás {producto}.', 'Dejás {monto} sobre la mesa. {npc} te alcanza {producto}.'],
  venta: ['{npc} revisa la cosa y te da {monto}.', '«Te doy {monto}, ni uno más», dice {npc}, y paga.'],
  venta_no: ['{npc} niega con la cabeza. «Eso no vale nada.»'],
  venta_nada: ['No tenés eso para vender.', 'Buscás en tus cosas. Eso no lo tenés.'],
  nadie: ['Acá no hay nadie que venda eso.', 'Mirás alrededor. Nadie vende eso acá.'],
  pago_que: ['¿Pagar qué?', 'Nadie te está cobrando nada.'],
  sin_dinero: ['Contás lo que tenés. No alcanza.', 'Revolvés la bolsa. Faltan monedas.'],
  regateo_abre: ['{npc} se cruza de brazos. «A ver, ¿qué ofrecés?»', '«¿Regatear? Probá», dice {npc}.'],
  acepta: ['«Está bien», dice {npc}.'],
  rechaza: ['«No», dice {npc}.'],
  contraoferta: ['«Puedo bajar algo», dice {npc}.'],
  cifra: ['Te pide {monto}.', 'La cifra queda en {monto}.', '{npc} marca {monto} con los dedos.'],
  trueque: ['Le das {objeto} y te llevás {producto}.'],
  regateo_sale: ['Lo dejás ahí. {npc} vuelve a lo suyo.', 'Te vas sin cerrar trato.'],
  regateo_opciones: ['Podés pedir rebaja, ofrecer un monto, ofrecer algo a cambio, pagar de más, aceptar o irte.'],
  regateo_pago_mas: ['Le das {monto}, más de lo que pidió. {npc} te mira distinto.'],
  regateo_trueque_no: ['No tenés eso para cambiar.'],
  trabajo_nada: ['«Hoy no tengo nada para vos», dice {npc}.', '{npc} niega con la cabeza. «Hoy no hay trabajo.»'],
  trabajo_hecho: ['«Ya trabajaste hoy. Volvé mañana», dice {npc}.'],
  trabajo_acepta: ['«Bien. Empezamos», dice {npc}.'],
  trabajo_rechaza: ['«Como quieras», dice {npc}.'],
  trabajo_sigue: ['Seguís con el trabajo.'],
  trabajo_abandona: ['Dejás el trabajo a medias. {npc} no dice nada, pero lo anota.'],
  trabajo_contratiempo: ['Algo sale mal y se pierde parte del día. La paga va a ser menor.'],
  trabajo_paga: ['Te pagan {monto}.'],
  favor_cumple: ['Hacés lo que te pide.'],
  info_nada: ['No tenés nada que contarle que no sepa.'],
});
const NUM = /\{(\w+)\}/g;
export const completar = (t, v) => t.replace(NUM, (m, k) => (v[k] !== undefined ? String(v[k]) : m));
const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Línea t41 por ruta («pagos.sin_dinero», «regateo.serel_panadero.acepta») o provisional por clave. */
export function lineasDe(amp, clave) {
  const eco = amp?.economia;
  if (eco) {
    const partes = clave.split('.');
    let x = eco;
    for (const p of partes) x = x?.[p];
    if (Array.isArray(x) && x.length) return x;
    if (partes.length === 1 && Array.isArray(eco.pagos?.[clave]) && clave === 'sin_dinero') return eco.pagos[clave];
  }
  const ultima = clave.split('.').at(-1);
  return TEXTOS_ECONOMIA[clave] ?? TEXTOS_ECONOMIA[ultima] ?? [];
}
export function elegirLinea(amp, clave, valores = {}, sal = 0) {
  const l = lineasDe(amp, clave).map((t) => mayus(completar(t, valores)));
  if (!l.length) return '';
  const libres = sinRepetir(l);
  return libres[Math.abs(sal | 0) % libres.length];
}

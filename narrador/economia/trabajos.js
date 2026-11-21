// X5 (fase 8): trabajos de un día como módulo de sistema: oferta → aceptar → 2–3 pasos (2–4 h cada uno) → fin con jornal.
// Un paso puede traer un rumor (hecho) o un contratiempo (paga × 0,6). Abandonar: sin paga y relación −1.
// Un trabajo por NPC por día (hecho `trabajo:<npc>` = día).
import { registrarSistema } from '../sistemas/index.js';
import { PRECIOS } from './monedas.js';
import { derivar } from '../azar.js';
import { normalizar } from '../comprension.js';

export const FACTOR_CONTRATIEMPO = 0.6;
const SI = /(^| )(si|acepto|dale|bueno|trato|vamos|empiezo|de acuerdo|ok)( |$)/;
const NO = /(^| )(no|paso|otro dia|no gracias)( |$)/;
export const pideTrabajo = (n) => /(^| )(busco trabajo|buscando trabajo|tenes trabajo|tiene trabajo|hay trabajo|necesitas ayuda|necesita ayuda|quiero trabajar|puedo trabajar|necesitas brazos|dame trabajo|algun trabajo|trabajo para mi)( |$)/.test(n);

export const trabajo = registrarSistema({
  id: 'trabajo',
  iniciar(_e, ctx) {
    const rng = derivar(ctx.semillaBase ?? 0, `trabajo:${ctx.dia}:${ctx.npc}`);
    return { trabajo: ctx.trabajo, npc: ctx.npc, escena: ctx.escena, dia: ctx.dia, semillaBase: ctx.semillaBase ?? 0, fase: 'oferta', paso: 0, pasos: 2 + Math.floor(rng() * 2), horas: 0, contratiempo: false, rumor: false, jornal: null, ultimo: 'oferta', abandono: false, aceptado: false };
  },
  cerrable: () => true,
  turno(sub, entrada, _rng, ctx) {
    const n = normalizar(entrada?.texto ?? '');
    if (sub.fase === 'oferta') {
      if (SI.test(n) && !NO.test(n)) return this.turno({ ...sub, fase: 'durante', aceptado: true }, { texto: '' }, _rng, { ...ctx, salir: false });
      if (ctx.salir || NO.test(n)) return { texto: '', sub: { ...sub, ultimo: 'rechaza' }, terminado: true };
      return { texto: '', sub: { ...sub, ultimo: 'oferta' }, terminado: false };
    }
    if (ctx.salir) return { texto: '', sub: { ...sub, ultimo: 'abandona', abandono: true }, terminado: true };
    const rng = derivar(sub.semillaBase, `trabajo:${sub.dia}:${sub.npc}:${sub.paso + 1}`);
    const horas = 2 + Math.floor(rng() * 3);
    const azar = rng();
    const paso = sub.paso + 1;
    const nuevo = { ...sub, paso, horas: sub.horas + horas, contratiempo: sub.contratiempo || azar < 0.15, rumor: sub.rumor || (azar >= 0.15 && azar < 0.3), evento: azar < 0.15 && !sub.contratiempo ? 'contratiempo' : azar >= 0.15 && azar < 0.3 && !sub.rumor ? 'rumor' : null };
    if (paso < sub.pasos) return { texto: '', sub: { ...nuevo, ultimo: 'durante' }, terminado: false };
    const [min, max] = PRECIOS.jornal[sub.trabajo] ?? [100, 100];
    const base = min + Math.floor(rng() * (max - min + 1));
    const jornal = Math.max(0, Math.round(base * (nuevo.contratiempo ? FACTOR_CONTRATIEMPO : 1)));
    return { texto: '', sub: { ...nuevo, jornal, ultimo: 'fin', fase: 'fin' }, terminado: true };
  },
  resultado(sub) {
    if (sub.forzado || !sub.aceptado) return [];
    const ef = [{ tipo: 'hecho', clave: `trabajo:${sub.npc}`, valor: sub.dia }];
    if (sub.horas > 0) ef.push({ tipo: 'reloj', horas: sub.horas });
    if (sub.abandono) ef.push({ tipo: 'relacion', npc: sub.npc, delta: -1 });
    else if (sub.jornal) ef.push({ tipo: 'cobro', monto: sub.jornal });
    if (sub.rumor) ef.push({ tipo: 'hecho', clave: `rumor_trabajo:${sub.trabajo}`, valor: sub.dia });
    return ef;
  },
});

/** Trabajo disponible con un NPC presente en esta escena (o null). */
export function trabajoEn(amp, escena, presentes) {
  for (const [id, t] of Object.entries(amp?.economia?.trabajos ?? {})) {
    if (t.escenas?.includes(escena) && presentes.some((p) => p.id === t.npc)) return { id, npc: t.npc };
  }
  return null;
}

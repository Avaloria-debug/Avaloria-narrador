// X6 (fase 8): favores, deudas e información como pago. Favores en `ext.favores`:
// { npc, deudor: 'jugador'|'npc', motivo, dia, estado: 'pendiente'|'cobrando'|'saldado'|'incumplido', cobro? }.
// - Ayudar a un NPC (verbo ayudar con éxito) → el NPC te debe (t41 favores.pide).
// - Llevarse algo fiado → el jugador debe. El acreedor cobra entre 2 y 6 días después (prob. diaria; al 6.º, seguro).
//   Sí → saldado. No, o 2 días sin responder → incumplido: relación −1 y rumor (hecho `rumor_incumplido:<npc>`).
// - Deuda de un NPC sin cobrar en 10 días → incumplido (sin castigo para el jugador).
// - Pagar con información: un conocimiento o hallazgo que el NPC no tenga → descuento o favor (según curiosidad).
import { derivar } from '../azar.js';
import { normalizar } from '../comprension.js';
import valoresJson from '../../data/contenido/ampliado/valores.json' with { type: 'json' };

export const DIAS_MIN_COBRO = 2;
export const DIAS_MAX_COBRO = 6;
export const DIAS_RESPUESTA = 2;
export const DIAS_DEUDA_NPC = 10;
export const PROB_COBRO_DIA = 0.35;
export const DESCUENTO_INFO = 0.25;
export const MAX_FAVORES = 30;

export const abiertos = (favores) => (favores ?? []).filter((f) => f.estado === 'pendiente' || f.estado === 'cobrando');

export function nuevoFavor(favores, f) {
  const l = favores ?? [];
  if (abiertos(l).some((x) => x.npc === f.npc && x.deudor === f.deudor)) return l;
  return [...l, { ...f, estado: 'pendiente' }].slice(-MAX_FAVORES);
}

/**
 * Avance diario/por turno de los favores. Devuelve favores nuevos, cambios de relación, hechos y líneas (claves t41).
 * @returns {{ favores, relacion: {npc, delta}[], hechos: object, lineas: {clave, npc}[] }}
 */
export function avanzarFavores(favores, { dia, presentes = [], semillaBase = 0 }) {
  const relacion = []; const hechos = {}; const lineas = [];
  const out = (favores ?? []).map((f) => {
    if (f.deudor === 'npc' && f.estado === 'pendiente' && dia - f.dia > DIAS_DEUDA_NPC) return { ...f, estado: 'incumplido' };
    if (f.deudor !== 'jugador') return f;
    if (f.estado === 'cobrando' && dia - f.cobro >= DIAS_RESPUESTA) {
      relacion.push({ npc: f.npc, delta: -1 });
      hechos[`rumor_incumplido:${f.npc}`] = dia;
      if (presentes.includes(f.npc)) lineas.push({ clave: 'favores.incumplido', npc: f.npc });
      return { ...f, estado: 'incumplido' };
    }
    if (f.estado === 'pendiente' && dia - f.dia >= DIAS_MIN_COBRO) {
      const seguro = dia - f.dia >= DIAS_MAX_COBRO;
      const azar = derivar(semillaBase, `favor:${f.npc}:${f.dia}:${dia}`)();
      if (seguro || (presentes.includes(f.npc) && azar < PROB_COBRO_DIA)) {
        if (presentes.includes(f.npc)) lineas.push({ clave: 'favores.cobra', npc: f.npc });
        return { ...f, estado: 'cobrando', cobro: dia };
      }
    }
    return f;
  });
  return { favores: out, relacion, hechos, lineas };
}

const SI = /(^| )(si|lo hago|te ayudo|le ayudo|dale|claro|cuenta conmigo|de acuerdo|acepto|bueno)( |$)/;
const NO = /(^| )(no|ni loco|no puedo|no quiero|olvidate)( |$)/;
/** Respuesta a un cobro en curso de un NPC presente: 'saldar' | 'negar' | null. */
export function respuestaCobro(texto) {
  const n = normalizar(texto);
  if (NO.test(n) && !/(^| )no hay problema( |$)/.test(n)) return 'negar';
  if (SI.test(n)) return 'saldar';
  return null;
}
export const pideCobrar = (n) => /(^| )(me debes una|me debe una|me debes un favor|me debe un favor|cobro el favor|cobrar el favor|devolveme el favor|estamos a mano)( |$)/.test(n);
export const pideFiado = (n) => /(^| )(fiado|fiame|me lo fias|me lo fia|te lo debo|se lo debo|despues te pago|despues le pago|te pago despues|le pago despues|anotalo)( |$)/.test(n);
export const cuentaInfo = (n) => /(^| )(te cuento|le cuento|te digo|le digo|sabias|sabia que|te aviso|le aviso)( |$)/.test(n);

/** Rasgo curiosidad (−2..2) del NPC: con curiosidad ≥ 1 la información le vale un favor; si no, un descuento. */
export const curiosidad = (amp, npc) => amp?.valores?.[npc]?.curiosidad ?? valoresJson.valores?.[npc]?.curiosidad ?? 0;

/**
 * Información que el jugador puede contar: conocimientos que le revelaron y hallazgos (objetos narrativos) que lleva.
 * Busca en la frase una palabra clave. Devuelve { id, deNpc } o null.
 */
export function infoEnFrase(n, { estado, contenido }) {
  for (const npc of contenido.npcs ?? []) {
    for (const k of npc.conocimientos ?? []) {
      if (!(estado.npcs?.[npc.id]?.conocimientosRevelados ?? []).includes(k.id)) continue;
      if ((k.palabrasClave ?? []).some((p) => n.includes(normalizar(p)))) return { id: k.id, deNpc: npc.id };
    }
  }
  for (const it of estado.inventario ?? []) {
    const o = (contenido.objetos ?? []).find((x) => x.id === it.objetoId);
    if (o?.tipo === 'narrativo' && normalizar(o.nombre).split(' ').some((w) => w.length > 3 && n.includes(w))) return { id: o.id, deNpc: null };
  }
  return null;
}

/** ¿Ya lo sabía? Es su propio conocimiento o ya se lo contaron. */
export const yaLoSabe = (npc, info, contadas) => info.deNpc === npc || (contadas?.[npc] ?? []).includes(info.id);

/** Líneas t41 pagos.informacion separadas: las que valoran y la de «ya lo sabía». */
export function lineasInformacion(amp) {
  const l = amp?.economia?.pagos?.informacion ?? [];
  const sabia = l.filter((t) => /ya lo sab|no vale/i.test(t));
  return { vale: l.filter((t) => !sabia.includes(t)), sabia };
}

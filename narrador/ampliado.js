// Orquestador del contenido ampliado. Solo corre si narrar recibe `opciones.ampliado` (contenidoAmpliado.js).
// Sin ampliado, narrar no llama a este módulo y la salida es idéntica a la de siempre.
// Estado propio en `estado.ext` (se guarda con la partida; partida vieja → valores por defecto).
// Azar: solo generadores derivados (azar.derivar) de ext.semillaBase y el número de turno; nunca el principal.
import { derivar } from './azar.js';
import { hechosDe, UMBRALES } from './seleccion.js';
import { expandir, aplicarGenero } from './gramatica.js';
import { climaEn, mensajeAmbiental } from './ambiente.js';
import { npcsPresentes } from './turno.js';
import { valoresDeAccion, aperturaDe } from './narracion.js';
import { resolverPlantillas } from './contenido.js';
import { elegir } from './seleccion.js';

const porId = (l, id) => (l ?? []).find((x) => x.id === id);

/** Completa {x} con los valores; null si falta alguno o queda una llave. */
export function completarAmp(t, valores) {
  if (typeof t !== 'string') return null;
  let falta = false;
  const r = t.replace(/\{(\w+)\}/g, (_, k) => {
    const v = valores?.[k];
    if (typeof v !== 'string' || !v.trim()) { falta = true; return ''; }
    return v;
  });
  return falta || /[{}]/.test(r) ? null : r;
}

/** ¿Es un turno de acción simple (una sola frase de resultado)? */
function accionSimple(turno, contenido) {
  const a = turno?.accion;
  if (turno?.tipo !== 'accion' || !a || turno.repetirIntencionId) return false;
  if ((a.efectos ?? []).some((e) => e.tipo === 'conocimiento_revelado')) return false;
  if (a.motivo) return false;
  if (a.verbo === 'usar' && a.parametros?.npcId != null && porId(contenido.objetos, a.parametros.objetoId)?.tipo === 'narrativo') return false;
  return true;
}

/**
 * P5: la frase principal del turno desde el contenido ampliado.
 * - acción simple: plantillas v3 + ampliado de la intención/resultado, por especificidad; hablar_con con NPC: a veces charla.
 * - saludo, consulta (no_se / revelar): la voz del NPC reemplaza la genérica.
 * @returns {{ texto: string, apertura: string }|null} null = queda la narración base
 */
export function fraseAmpliada({ amp, contenido, turno, ctx, aperturas, valoresExtra = {} }) {
  const rng = ctx.rng('seleccion');
  const ventana = (aperturas ?? []).slice(0, -1);
  const opc = (valores) => ({ rng, aperturas: ventana, aperturaDe, completar: (t) => completarAmp(ctx.expandirTexto(t), { ...valores, ...valoresExtra }) });
  if (accionSimple(turno, contenido)) {
    const a = turno.accion;
    const valores = valoresDeAccion(a, contenido);
    const npc = a.parametros?.npcId;
    if (a.verbo === 'hablar_con' && npc && amp.charla?.[npc]?.length && rng() < 0.5) {
      const r = elegir(amp.charla[npc], ctx.hechos(), opc(valores));
      if (r) return r;
    }
    const extra = amp.plantillas?.[a.intencionId]?.[a.resultado] ?? [];
    if (!extra.length) return null;
    return elegir([...(resolverPlantillas(contenido, a.intencionId, a.resultado) ?? []), ...extra], ctx.hechos(), opc(valores));
  }
  if (turno?.tipo === 'saludo' && amp.voces?.[turno.npcId]?.saludo?.length) {
    const npc = porId(contenido.npcs, turno.npcId);
    return elegir(amp.voces[turno.npcId].saludo, ctx.hechos(), opc({ npc: npc?.nombre }));
  }
  if (turno?.tipo === 'consulta' && turno.consulta) {
    const { npcId, conocimientoId, resultado } = turno.consulta;
    const voz = amp.voces?.[npcId];
    const npc = porId(contenido.npcs, npcId);
    const k = porId(npc?.conocimientos, conocimientoId) ?? porId(amp.conocimientos?.[npcId], conocimientoId);
    const lista = resultado === 'no_se' ? voz?.no_se : resultado === 'exito' ? voz?.revelar : null;
    if (lista?.length) return elegir(lista, ctx.hechos(), opc({ npc: npc?.nombre, conocimiento: k?.contenido }));
  }
  return null;
}

/** ext con valores por defecto (partida vieja o nueva). */
export function extInicial(ext, semilla = 0) {
  const e = ext && typeof ext === 'object' ? ext : {};
  return {
    ...e,
    semillaBase: Number.isInteger(e.semillaBase) ? e.semillaBase : semilla | 0,
    visitas: e.visitas && typeof e.visitas === 'object' ? { ...e.visitas } : {},
    repeticion: e.repeticion && typeof e.repeticion === 'object' ? { ...e.repeticion } : { verbo: null, n: 0 },
    turno: Number.isInteger(e.turno) ? e.turno : 0,
    clima: typeof e.clima === 'string' ? e.clima : 'despejado',
    ventanaAmbiente: Array.isArray(e.ventanaAmbiente) ? [...e.ventanaAmbiente] : [],
    avisos: Array.isArray(e.avisos) ? e.avisos.slice(-20) : [],
  };
}

export const verboDe = (turno, contenido) => {
  const id = turno?.accion?.intencionId ?? turno?.intencionId ?? null;
  return (contenido.intenciones.find((i) => i.id === id)?.verbo) ?? null;
};

/** Contabilidad del turno: visitas a la escena y repetición del mismo verbo. */
export function contabilizar(ext, { antes, despues, turno, contenido }) {
  const e = extInicial(ext, antes.semilla);
  e.turno += 1;
  const esc = despues.jugador.escenaId;
  if (e.turno === 1 || antes.jugador.escenaId !== esc) e.visitas[esc] = (e.visitas[esc] ?? 0) + 1;
  const verbo = verboDe(turno, contenido);
  if (verbo) e.repeticion = e.repeticion.verbo === verbo ? { verbo, n: e.repeticion.n + 1 } : { verbo, n: 1 };
  return e;
}

/** NPC con quien es el turno (acción, consulta, saludo). */
export const npcDelTurno = (turno) => turno?.accion?.parametros?.npcId ?? turno?.consulta?.npcId ?? turno?.npcId ?? null;

/** Contexto común de un turno ampliado. */
export function contexto({ amp, contenido, despues, turno, ext }) {
  const rng = (nombre) => derivar(`${ext.semillaBase}:${ext.turno}`, nombre);
  const npcId = npcDelTurno(turno);
  const umbrales = amp.guia?.umbrales ? { ...UMBRALES, ...amp.guia.umbrales } : UMBRALES;
  const estado = { ...despues, ext };
  const hechos = (extra = {}, npc = npcId) => hechosDe(estado, { contenido, npcId: npc, umbrales, extra });
  const expandirTexto = (t, h = hechos(), npc = npcId, objetoId = turno?.accion?.parametros?.objetoId) => {
    const simbolos = npc && amp.npcsRutina?.[npc]?.gestos?.length ? { ...amp.simbolos, gesto: amp.npcsRutina[npc].gestos.map((g) => (typeof g === 'string' ? g : g.t)) } : amp.simbolos;
    return aplicarGenero(expandir(t, simbolos, { rng: rng('gramatica'), hechos: h, avisos: ext.avisos }), { npcId: npc, objetoId, genero: amp.guia?.genero });
  };
  return { rng, npcId, hechos, expandirTexto, estado };
}

/**
 * Aplica las extensiones al turno ya narrado.
 * @returns {{ texto: string, aperturas: string[], ext: object }}
 */
export function aplicarAmpliado({ amp, contenido, antes, despues, turno, texto, aperturas, tipo }) {
  let ext = contabilizar(antes.ext, { antes, despues, turno, contenido });
  ext.clima = climaEn(ext.semillaBase, despues.reloj, amp.guia?.umbrales?.clima_cambia_cada_horas);
  const ctx = contexto({ amp, contenido, despues, turno, ext });
  const partes = [texto];
  if (tipo === 'narracion') {
    const frase = fraseAmpliada({ amp, contenido, turno, ctx, aperturas });
    if (frase) {
      partes[0] = frase.texto;
      aperturas = [...(aperturas ?? []).slice(0, -1), frase.apertura];
    }
    const presentes = npcsPresentes(despues, contenido).map((n) => n.id);
    const amb = mensajeAmbiental({ ext, amp, hechos: ctx.hechos(), escenaId: despues.jugador.escenaId, presentes, npcTurno: ctx.npcId, rng: ctx.rng('ambiente') });
    if (amb) {
      ext = amb.ext;
      partes.push(ctx.expandirTexto(amb.texto));
    }
  }
  return { texto: partes.filter(Boolean).join(' '), aperturas, ext };
}

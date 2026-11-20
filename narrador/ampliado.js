// Orquestador del contenido ampliado. Solo corre si narrar recibe `opciones.ampliado` (contenidoAmpliado.js).
// Sin ampliado, narrar no llama a este módulo y la salida es idéntica a la de siempre.
// Estado propio en `estado.ext` (se guarda con la partida; partida vieja → valores por defecto).
// Azar: solo generadores derivados (azar.derivar) de ext.semillaBase y el número de turno; nunca el principal.
import { derivar } from './azar.js';
import { hechosDe, UMBRALES } from './seleccion.js';
import { expandir, aplicarGenero } from './gramatica.js';
import { climaEn, mensajeAmbiental } from './ambiente.js';
import { npcsPresentes } from './turno.js';

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
    const presentes = npcsPresentes(despues, contenido).map((n) => n.id);
    const amb = mensajeAmbiental({ ext, amp, hechos: ctx.hechos(), escenaId: despues.jugador.escenaId, presentes, npcTurno: ctx.npcId, rng: ctx.rng('ambiente') });
    if (amb) {
      ext = amb.ext;
      partes.push(ctx.expandirTexto(amb.texto));
    }
  }
  return { texto: partes.filter(Boolean).join(' '), aperturas, ext };
}

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
import { ajustarTension, ajustarObjetivo, elegirPorSaliencia, NIVEL_CATEGORIA } from './eventos.js';
import { cumple, especificidad, normalizar } from './seleccion.js';
import { propagar, bloquesCruzados, rumorPendiente, fuerzaDe, MENSAJEROS } from './rumores.js';
import { temaDe, conocimientoQueCoincide, unicoDisponible } from './temas.js';
import { palabraDeEco, puedeEco } from './eco.js';
import { efectosGuardados, activarPorHecho, vencer, efectosEn } from './consecuencias.js';
import { objetivosGuardados, avanzarObjetivos, impulsar, objetivoPasoDe, pasoActual } from './objetivos.js';
import { diarioGuardado, anotar as anotarDiario, textoDiario } from './diario.js';
import { normalizar as normalizarTexto } from './comprension.js';
import { derivarApodo, apodoPara } from './apodo.js';
import { afinidadAccion } from './etiquetasVerbos.js';
import { hechosGuardados, registrarHecho, recuerdosDe, lineaDeMemoria } from './hechos.js';

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

// P11 (t11): motivos del código → claves nuevas de reformulación (si el contenido las trae).
export const CLAVES_REFORMULACION_NUEVAS = Object.freeze({ npc_ausente: 'nombre_desconocido', sin_objetos: 'objeto_desconocido', falta_destino: 'destino_invalido', sin_salidas: 'cerrado' });

/** Reformulación con el contenido ampliado: clave diferenciada si existe; si no, la del motivo (v3 + ampliado). */
export function reformulacionAmpliada({ amp, contenido, turno, ctx, aperturas }) {
  const ref = amp.plantillas?.reformulacion ?? {};
  const nueva = CLAVES_REFORMULACION_NUEVAS[turno.motivo];
  const lista = nueva && ref[nueva]?.length ? ref[nueva] : [...(contenido.plantillas.reformulacion?.[turno.motivo] ?? []), ...(ref[turno.motivo] ?? [])];
  if (!lista.length || (!(nueva && ref[nueva]?.length) && !(ref[turno.motivo]?.length))) return null;
  const valores = { nombres: (turno.datos?.nombres ?? []).filter((x) => typeof x === 'string').join(', ') };
  return elegir(lista, ctx.hechos(), { rng: ctx.rng('reformulacion'), aperturas: (aperturas ?? []).slice(0, -1), aperturaDe, completar: (t) => completarAmp(ctx.expandirTexto(t), valores) });
}

/**
 * P10: consulta sin conocimiento v3 que coincida. Conocimiento ampliado (revelar, o pista si falta relación);
 * si ninguno coincide, respuesta por tema. El texto del jugador solo se usa para buscar palabras clave.
 */
export function consultaAmpliada({ amp, contenido, turno, ctx, entrada, ext }) {
  const npcId = turno.consulta.npcId;
  const rng = ctx.rng('conocimientos');
  const pick = (l) => (l?.length ? l[Math.min(l.length - 1, Math.floor(rng() * l.length))] : null);
  const relacion = (ctx.estado.npcs?.[npcId]?.relacion ?? 0);
  const m = conocimientoQueCoincide(amp.conocimientos?.[npcId], entrada.texto, { relacion, marcas: ctx.estado.marcas, eventosActivos: ctx.estado.eventosActivos, revelados: ext.reveladosAmp });
  let t = null;
  if (m) {
    t = pick(m.puede ? m.k.revelar : m.k.pista);
    if (t && m.puede) ext.reveladosAmp.push(m.k.id);
  } else {
    const tema = temaDe(entrada.texto);
    t = tema ? amp.temas?.[npcId]?.[tema] ?? null : null;
  }
  const texto = t && completarAmp(ctx.expandirTexto(t), { npc: porId(contenido.npcs, npcId)?.nombre, conocimiento: m?.k?.contenido });
  return texto ? { texto, apertura: aperturaDe(texto) } : null;
}

/**
 * P5: la frase principal del turno desde el contenido ampliado.
 * - acción simple: plantillas v3 + ampliado de la intención/resultado, por especificidad; hablar_con con NPC: a veces charla.
 * - saludo, consulta (no_se / revelar): la voz del NPC reemplaza la genérica.
 * @returns {{ texto: string, apertura: string }|null} null = queda la narración base
 */
export function fraseAmpliada({ amp, contenido, turno, ctx, aperturas, valoresExtra = {}, entrada = null }) {
  const rng = ctx.rng('seleccion');
  const ventana = (aperturas ?? []).slice(0, -1);
  const opc = (valores) => ({ rng, aperturas: ventana, aperturaDe, completar: (t) => completarAmp(ctx.expandirTexto(t), { ...valores, ...valoresExtra }) });
  if (accionSimple(turno, contenido)) {
    const a = turno.accion;
    const valores = valoresDeAccion(a, contenido);
    const npc = a.parametros?.npcId;
    // P14: eco de una palabra del jugador (t20), máx. 1 cada 4 turnos.
    const eco = typeof entrada?.texto === 'string' && puedeEco(ctx.ext) ? palabraDeEco(entrada.texto, { contenido, amp }) : null;
    if (eco && amp.eco?.[a.intencionId]?.length) {
      const r = elegir(amp.eco[a.intencionId], ctx.hechos({ eco: '1' }), opc({ ...valores, eco }));
      if (r && !r.texto.includes(entrada.texto)) { ctx.ext.ultimoEco = ctx.ext.turno; return r; }
    }
    // P16: charla del paso en curso del objetivo del NPC.
    const pasoObj = a.verbo === 'hablar_con' && npc ? pasoActual(ctx.ext.objetivos, amp.objetivos, npc) : null;
    if (pasoObj?.charla?.length && rng() < 0.3) {
      const r = elegir(pasoObj.charla, ctx.hechos(), opc(valores));
      if (r) return r;
    }
    if (a.verbo === 'hablar_con' && npc && amp.charla?.[npc]?.length && rng() < 0.5) {
      const r = elegir(amp.charla[npc], ctx.hechos(), opc(valores));
      if (r) return r;
    }
    const extra = amp.plantillas?.[a.intencionId]?.[a.resultado] ?? [];
    if (!extra.length) return null;
    return elegir([...(resolverPlantillas(contenido, a.intencionId, a.resultado) ?? []), ...extra], ctx.hechos(), opc(valores));
  }
  // P18: saludo con el apodo (t24 usos), 30%.
  if (turno?.tipo === 'saludo' && amp.apodos?.usos?.length && ctx.ext.apodo && rng() < 0.3) {
    const npc = porId(contenido.npcs, turno.npcId);
    const apodo = apodoPara(ctx.ext.apodo, amp.apodos.base, ctx.hechos({}, turno.npcId).r);
    const r = elegir(amp.apodos.usos, ctx.hechos(), opc({ npc: npc?.nombre, apodo }));
    if (r) return r;
  }
  if (turno?.tipo === 'saludo' && amp.voces?.[turno.npcId]?.saludo?.length) {
    const npc = porId(contenido.npcs, turno.npcId);
    return elegir(amp.voces[turno.npcId].saludo, ctx.hechos(), opc({ npc: npc?.nombre }));
  }
  if (turno?.tipo === 'consulta' && turno.consulta?.resultado === 'no_se' && typeof entrada?.texto === 'string') {
    const r = consultaAmpliada({ amp, contenido, turno, ctx, entrada, ext: ctx.ext });
    if (r) return r;
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
    hechos: hechosGuardados(e),
    tension: Number.isFinite(e.tension) ? e.tension : 0,
    tensionObjetivo: Number.isFinite(e.tensionObjetivo) ? e.tensionObjetivo : 3,
    sinEvento: Number.isInteger(e.sinEvento) ? e.sinEvento : 0,
    usosEvento: e.usosEvento && typeof e.usosEvento === 'object' ? { ...e.usosEvento } : {},
    rumores: e.rumores && typeof e.rumores === 'object' ? structuredClone(e.rumores) : {},
    unicasUsadas: Array.isArray(e.unicasUsadas) ? [...e.unicasUsadas] : [],
    reveladosAmp: Array.isArray(e.reveladosAmp) ? [...e.reveladosAmp] : [],
    efectos: efectosGuardados(e),
    objetivos: objetivosGuardados(e),
    diario: diarioGuardado(e),
    apodo: e.apodo && typeof e.apodo === 'object' ? { ...e.apodo } : null,
    afinidad: e.afinidad && typeof e.afinidad === 'object' ? { ...e.afinidad } : {},
    ultimoRecuerdo: e.ultimoRecuerdo && typeof e.ultimoRecuerdo === 'object' ? { ...e.ultimoRecuerdo } : {},
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
  // P7: la afinidad acumulada por valores del NPC se suma a la relación al leer las condiciones (r).
  const npcsAjustados = Object.fromEntries(Object.entries(despues.npcs ?? {}).map(([id, n]) => [id, { ...n, relacion: n.relacion + (ext.afinidad?.[id] ?? 0) }]));
  const estado = { ...despues, npcs: npcsAjustados, ext };
  const recuerdo = (npc) => recuerdosDe(ext.hechos ?? [], npc, despues.reloj, umbrales.recuerdo?.reciente_horas);
  const hechos = (extra = {}, npc = npcId) => {
    const { rec, ant } = recuerdo(npc);
    const rumor = npc ? rumorPendiente(ext.rumores, npc) : null;
    if (rumor) extra = { escuchoDe: rumor.tipo, fz: fuerzaDe(rumor.fuerza), ...extra };
    const objetivoPaso = npc ? objetivoPasoDe(ext.objetivos, amp.objetivos, npc) : null;
    if (objetivoPaso) extra = { objetivoPaso, ...extra };
    if (ext.apodo) extra = { apodo: ext.apodo.verbo, ...extra };
    const efecto = efectosEn(ext.efectos ?? [], estado.jugador.escenaId);
    if (efecto.length) extra = { efecto, ...extra };
    const verbo = turno?.accion?.verbo;
    const afin = npc && verbo ? afinidadAccion(amp, npc, verbo) : 0;
    return hechosDe(estado, { contenido, npcId: npc, umbrales, extra: { rec, ant, ...(afin ? { afinidadAccion: afin } : {}), ...extra } });
  };
  const expandirTexto = (t, h = hechos(), npc = npcId, objetoId = turno?.accion?.parametros?.objetoId) => {
    const simbolos = npc && amp.npcsRutina?.[npc]?.gestos?.length ? { ...amp.simbolos, gesto: amp.npcsRutina[npc].gestos.map((g) => (typeof g === 'string' ? g : g.t)) } : amp.simbolos;
    return aplicarGenero(expandir(t, simbolos, { rng: rng('gramatica'), hechos: h, avisos: ext.avisos }), { npcId: npc, objetoId, genero: amp.guia?.genero });
  };
  return { rng, npcId, hechos, expandirTexto, estado, recuerdo, ext };
}

/**
 * P9: un NPC cuenta un rumor que oyó (rumores.<verbo>.<fz>, o la voz del mensajero), con remate de ciudad y su reacción.
 */
export function narrarRumor({ amp, contenido, despues, ext, ctx, npc }) {
  const rumor = rumorPendiente(ext.rumores, npc);
  if (!rumor) return null;
  const rng = ctx.rng('rumores');
  const pick = (l) => (l?.length ? l[Math.min(l.length - 1, Math.floor(rng() * l.length))] : null);
  const valores = { npc: porId(contenido.npcs, rumor.npc)?.nombre ?? '', lugar: porId(contenido.escenas, rumor.escena)?.nombre ?? '' };
  const base = MENSAJEROS.includes(npc) && amp.mensajeros?.[npc]?.length ? pick(amp.mensajeros[npc]) : pick(amp.rumores?.[rumor.tipo]?.[fuerzaDe(rumor.fuerza)]);
  const linea = base && completarAmp(ctx.expandirTexto(base), valores);
  if (!linea) return null;
  rumor.contado = true;
  const partes = [linea];
  const r = ctx.hechos({}, npc).r;
  const reac = r && pick(amp.reaccionNpc?.[r]);
  const t2 = reac && completarAmp(reac, { npc: porId(contenido.npcs, npc)?.nombre });
  if (t2) partes.push(t2);
  const ciudad = porId(contenido.escenas, despues.jugador.escenaId)?.ciudad;
  const remate = ciudad && rng() < 0.5 ? pick(amp.remateCiudad?.[ciudad]) : null;
  if (remate) partes.push(remate);
  return partes.join(' ');
}

/**
 * P15: vence efectos (línea de expiración si el jugador está ahí) y muestra la aparición de un efecto activo en la escena.
 */
export function narrarConsecuencias({ amp, despues, ext, ctx }) {
  if (!amp.efectos?.length) return null;
  const rng = ctx.rng('consecuencias');
  const pick = (l) => (l?.length ? l[Math.min(l.length - 1, Math.floor(rng() * l.length))] : null);
  const esc = despues.jugador.escenaId;
  const def = (id) => amp.efectos.find((x) => x.id === id);
  const { activos, vencidos } = vencer(ext.efectos, despues.reloj);
  ext.efectos = activos;
  const vencidoAqui = vencidos.find((e) => e.escena === esc && e.visto);
  if (vencidoAqui) return ctx.expandirTexto(pick(def(vencidoAqui.id)?.expira) ?? '') || null;
  const nuevo = ext.efectos.find((e) => e.escena === esc && !e.visto);
  if (!nuevo) return null;
  nuevo.visto = true;
  return ctx.expandirTexto(pick(def(nuevo.id)?.aparece) ?? '') || null;
}

/** P16: rumor sobre el objetivo de otro NPC que ya avanzó (pasos[paso-1].rumor), con prob 0.2. */
export function rumorDeObjetivo({ amp, ext, ctx, npc }) {
  const rng = ctx.rng('objetivos');
  if (rng() >= 0.2) return null;
  const otros = Object.entries(ext.objetivos ?? {}).filter(([n, e]) => n !== npc && e.paso >= 1 && amp.objetivos?.[n]?.pasos?.[e.paso - 1]?.rumor);
  if (!otros.length) return null;
  const [n, e] = otros[Math.min(otros.length - 1, Math.floor(rng() * otros.length))];
  return ctx.expandirTexto(amp.objetivos[n].pasos[e.paso - 1].rumor);
}

/**
 * P8: inicio de un evento nuevo en la escena del jugador (t09, t19) por saliencia, o cierre.<categoria> al expirar.
 * Actualiza ext (usos, objetivo de tensión). Devuelve el texto o null.
 */
export function narrarEventos({ amp, contenido, antes, despues, ext, ctx }) {
  const esc = despues.jugador.escenaId;
  const clave = (a) => `${a.id}@${a.escenaId}`;
  const previos = new Set((antes.eventosActivos ?? []).map(clave));
  const ahora = new Set((despues.eventosActivos ?? []).map(clave));
  const nuevos = (despues.eventosActivos ?? []).filter((a) => a.escenaId === esc && !previos.has(clave(a)));
  const hechos = ctx.hechos();
  const cand = [];
  for (const a of nuevos) {
    const def = porId(contenido.eventos, a.id);
    for (const v of amp.eventos?.[a.id] ?? []) {
      const n = normalizar(v);
      if (n && cumple(n.c, hechos)) cand.push({ clave: n.t, texto: n.t, especificidad: especificidad(n), nivel: NIVEL_CATEGORIA[def?.categoria] ?? 3 });
    }
  }
  let texto = null;
  if (cand.length) {
    const e = elegirPorSaliencia(cand, { usos: ext.usosEvento, turno: ext.turno, objetivo: ext.tensionObjetivo, rng: ctx.rng('eventos') });
    texto = e.texto;
    ext.usosEvento[e.clave] = ext.turno;
  } else if (esc === antes.jugador.escenaId) {
    const cerrado = (antes.eventosActivos ?? []).find((a) => a.escenaId === esc && !ahora.has(clave(a)));
    const cat = cerrado && porId(contenido.eventos, cerrado.id)?.categoria;
    const lista = cat ? amp.cierre?.[cat] : null;
    if (lista?.length) texto = elegir(lista, hechos, { rng: ctx.rng('eventos') })?.texto ?? null;
  }
  const hubo = Boolean(texto) && cand.length > 0;
  ext.sinEvento = hubo ? 0 : ext.sinEvento + 1;
  ext.tensionObjetivo = ajustarObjetivo(ext.tensionObjetivo, ext.sinEvento, hubo);
  return texto ? ctx.expandirTexto(texto) : null;
}

/**
 * Aplica las extensiones al turno ya narrado.
 * @returns {{ texto: string, aperturas: string[], ext: object }}
 */
export function aplicarAmpliado({ amp, contenido, antes, despues, turno, texto, aperturas, tipo, entrada = null }) {
  let ext = contabilizar(antes.ext, { antes, despues, turno, contenido });
  // P6: el recuerdo se lee ANTES de registrar el hecho de este turno.
  const hechosPrevios = ext.hechos;
  ext.tension = ajustarTension(ext.tension, verboDe(turno, contenido));
  ext.clima = climaEn(ext.semillaBase, despues.reloj, amp.guia?.umbrales?.clima_cambia_cada_horas);
  const ctx = contexto({ amp, contenido, despues, turno, ext });
  const partes = [texto];
  // P17: "diario" (texto exacto) muestra el diario en lugar de la respuesta.
  if (amp.diario && typeof entrada?.texto === 'string' && normalizarTexto(entrada.texto) === 'diario') {
    const d = textoDiario(ext.diario, { amp, contenido, rng: ctx.rng('diario') });
    if (d) return { texto: d, aperturas, ext };
  }
  // P11 (t11): reformulación diferenciada.
  if (tipo === 'reformulacion' && turno?.tipo === 'reformular') {
    const r = reformulacionAmpliada({ amp, contenido, turno, ctx, aperturas });
    if (r) {
      partes[0] = r.texto;
      aperturas = [...(aperturas ?? []).slice(0, -1), r.apertura];
    }
  }
  if (tipo === 'narracion') {
    // P6: memoria al saludar o hablar con un NPC que recuerda algo (una vez cada 6 turnos por NPC).
    const npcMem = turno?.tipo === 'saludo' ? turno.npcId : turno?.accion?.verbo === 'hablar_con' ? turno.accion.parametros?.npcId : null;
    if (npcMem && !(ext.turno - (ext.ultimoRecuerdo[npcMem] ?? -99) < 6)) {
      const linea = lineaDeMemoria(amp, npcMem, recuerdosDe(hechosPrevios, npcMem, despues.reloj, amp.guia?.umbrales?.recuerdo?.reciente_horas), ctx.rng('memoria'));
      const t = linea && completarAmp(ctx.expandirTexto(linea), { npc: porId(contenido.npcs, npcMem)?.nombre });
      if (t) { partes.push(t); ext.ultimoRecuerdo[npcMem] = ext.turno; }
      else {
        const rum = narrarRumor({ amp, contenido, despues, ext, ctx, npc: npcMem }) ?? rumorDeObjetivo({ amp, ext, ctx, npc: npcMem });
        if (rum) partes.push(rum);
      }
    }
    const frase = fraseAmpliada({ amp, contenido, turno, ctx, aperturas, entrada });
    if (frase) {
      partes[0] = frase.texto;
      aperturas = [...(aperturas ?? []).slice(0, -1), frase.apertura];
    }
    const cons = narrarConsecuencias({ amp, despues, ext, ctx });
    if (cons) partes.push(cons);
    const ev = narrarEventos({ amp, contenido, antes, despues, ext, ctx });
    if (ev) partes.push(ev);
    const unico = ext.ultimoAmbiente === ext.turno - 1 ? null : unicoDisponible(amp.unicos, ctx.hechos(), ext.unicasUsadas);
    if (unico) {
      ext.unicasUsadas.push(unico.id);
      ext.ultimoAmbiente = ext.turno;
      partes.push(ctx.expandirTexto(unico.t));
    }
    const presentes = npcsPresentes(despues, contenido).map((n) => n.id);
    const amb = mensajeAmbiental({ ext, amp, hechos: ctx.hechos(), escenaId: despues.jugador.escenaId, presentes, npcTurno: ctx.npcId, rng: ctx.rng('ambiente') });
    if (amb) {
      ext = amb.ext;
      partes.push(ctx.expandirTexto(amb.texto));
    }
  }
  // P16: objetivos que avanzan solos; los hechos del jugador los impulsan o frenan.
  if (amp.objetivos && Object.keys(amp.objetivos).length) {
    ext.objetivos = avanzarObjetivos(ext.objetivos, amp.objetivos, { reloj: despues.reloj, semillaBase: ext.semillaBase });
    const npcO = turno?.accion?.parametros?.npcId;
    if (npcO) ext.objetivos = impulsar(ext.objetivos, amp.objetivos, { npc: npcO, verbo: turno.accion.verbo });
  }
  // P9: rumores cada 6 h de reloj.
  for (let i = 0, n = Math.min(4, bloquesCruzados(antes.reloj, despues.reloj)); i < n; i++) ext.rumores = propagar(ext.rumores, ext.hechos, { contenido, reloj: despues.reloj });
  // P18: apodo (se recalcula con los hechos, con histéresis).
  if (amp.apodos) ext.apodo = derivarApodo(ext.apodo, ext.hechos, amp.apodos.tabla, ctx.rng('apodo'));
  // P17: entradas del diario.
  const dia = despues.reloj.dia;
  if (turno?.tipo === 'accion' && turno.accion) {
    const v = turno.accion.verbo;
    if (amp.diario?.entradas?.[v] && turno.accion.parametros?.npcId) ext.diario = anotarDiario(ext.diario, { dia, tipo: v, npc: turno.accion.parametros.npcId, escena: antes.jugador.escenaId });
    else if (antes.jugador.escenaId !== despues.jugador.escenaId) ext.diario = anotarDiario(ext.diario, { dia, tipo: 'viaje', npc: null, escena: despues.jugador.escenaId });
  }
  if (turno?.consulta?.resultado === 'exito') ext.diario = anotarDiario(ext.diario, { dia, tipo: 'conocimiento', npc: turno.consulta.npcId, escena: despues.jugador.escenaId });
  if (turno?.tipo === 'accion' && turno.accion) {
    const npcA = turno.accion.parametros?.npcId;
    const afin = npcA ? afinidadAccion(amp, npcA, turno.accion.verbo) : 0;
    if (afin) ext.afinidad[npcA] = Math.round(((ext.afinidad[npcA] ?? 0) + afin) * 100) / 100;
    const ultimoAntes = ext.hechos.at(-1);
    ext.hechos = registrarHecho(ext.hechos, { verbo: turno.accion.verbo, npc: turno.accion.parametros?.npcId, escena: antes.jugador.escenaId, reloj: despues.reloj });
    if (ext.hechos.at(-1) && ext.hechos.at(-1) !== ultimoAntes) ext.efectos = activarPorHecho(ext.efectos, amp.efectos, ext.hechos.at(-1), despues.reloj);
  }
  return { texto: partes.filter(Boolean).join(' '), aperturas, ext };
}

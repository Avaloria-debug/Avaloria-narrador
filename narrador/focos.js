// Focos (fase 3): todo lo que el texto emitido menciona y el jugador puede seguir/mirar/llamar/tocar/escuchar/preguntar/ignorar.
// Datos: data/contenido/ampliado/t30-focos.json (amp.focos). Sin texto propio: todo sale del contenido.
// Estado propio en ext: focos (activos), siguiendo, marcasFoco, interrupciones, ultimaCharla. Partida vieja → vacíos.
// Azar: generador derivado "focos" (ext.semillaBase y número de turno); nunca el principal.
import { derivar } from './azar.js';
import { normalizar, tokenizar, coincidePalabra, resolverObjeto } from './comprension.js';
import { objetosAplicables, npcsPresentes } from './turno.js';
import { avanzar, minutosAbsolutos } from './reloj.js';
import { MOTIVOS } from './motivos.js';

export const VERBOS_FOCO = Object.freeze(['seguir', 'mirar', 'llamar', 'tocar', 'escuchar', 'preguntar', 'ignorar']);
export const MAX_FOCOS = 8;
export const DURA_GENERADO = 3;
export const HORAS_REGRESO = 24;
// Familia de símbolo → clase y sustantivos que lo nombran.
export const FAMILIAS = Object.freeze({
  sonido: { clase: 'sonido', alias: ['ruido', 'sonido', 'sonidos', 'ruidos'] },
  olor: { clase: 'fenomeno', alias: ['olor', 'olores'] },
  luz: { clase: 'fenomeno', alias: ['luz', 'luces'] },
  cielo: { clase: 'fenomeno', alias: ['cielo', 'nubes'] },
  animal: { clase: 'animal', alias: ['animal', 'bicho'] },
  gente: { clase: 'persona', alias: ['gente', 'voces', 'persona', 'personas'] },
});
// Formas de los verbos (normalizadas). Las de una palabra toleran typos (coincidePalabra) desde 5 letras.
export const FORMAS = Object.freeze({
  seguir: ['seguir', 'sigo', 'segui', 'seguila', 'seguilo', 'seguirla', 'seguirlo', 'ir tras', 'voy tras', 'perseguir', 'persigo', 'persegui', 'acercarme a', 'me acerco a', 'acercate a', 'ir hacia', 'voy hacia', 'correr tras', 'corro tras'],
  mirar: ['mirar a', 'mirar al', 'mirar la', 'mirar el', 'mirar los', 'mirar las', 'mira a', 'mira la', 'mira el', 'miro a', 'miro la', 'miro el', 'mirala', 'miralo', 'mirar eso', 'mira eso', 'fijarme en', 'me fijo en', 'observar a', 'observar al', 'observo a', 'observala', 'observalo'],
  llamar: ['llamar', 'llamo', 'llama', 'llamala', 'llamalo', 'silbar', 'silbo', 'silbale', 'gritarle', 'le grito'],
  tocar: ['tocar', 'toco', 'toca', 'tocala', 'tocalo', 'agarrar', 'agarro', 'acariciar', 'acaricio', 'acariciala', 'acarícialo'],
  escuchar: ['escuchar', 'escucho', 'escucha', 'escuchalo', 'escuchala', 'oir', 'oigo', 'prestar oido', 'presto oido'],
  preguntar: ['preguntar por', 'pregunto por', 'pregunta por', 'preguntarle por', 'preguntale por'],
  ignorar: ['ignorar', 'ignoro', 'ignora', 'ignoralo', 'ignorala', 'dejar pasar', 'dejo pasar'],
  examinar: ['examinar', 'examino', 'examina', 'inspeccionar', 'inspecciono', 'revisar', 'reviso', 'mirar de cerca'],
});
const PRONOMBRES = ['eso', 'ese', 'esa', 'aquello', 'aquel', 'aquella', 'lo que', 'la que', 'el que'];
// Palabras sin referente propio (S1: "examinar el lugar" sigue siendo examinar la escena).
const GENERICAS = new Set(['lugar', 'alrededor', 'zona', 'todo', 'aca', 'aqui', 'sitio', 'escena', 'entorno', 'cosas', 'ahi', 'alla', 'mas', 'bien', 'cerca', 'atento', 'que', 'hay']);
const VACIAS_LARGAS = new Set(['desde', 'hasta', 'entre', 'sobre', 'donde', 'cuando', 'mientras', 'alguien', 'todos', 'todas', 'otros', 'otras', 'porque', 'tiene', 'tienen', 'hacia', 'parece', 'parecen', 'algun', 'alguna', 'algunos', 'mismo', 'misma', 'nadie', 'siempre', 'nunca', 'ahora', 'despues', 'antes', 'cerca', 'lejos', 'mucho', 'mucha', 'poco', 'todavia', 'apenas', 'luego', 'otra', 'cada', 'sobre', 'detras', 'delante', 'junto']);

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const palabras = (t) => { const n = normalizar(t); return n ? n.split(' ') : []; };
/** ¿El texto (normalizado) trae el alias como palabra(s) completa(s)? */
export const tieneAlias = (norm, alias) => { const a = normalizar(alias); return Boolean(a) && new RegExp(`(^| )${escapar(a)}( |$)`).test(norm); };
const pick = (l, rng) => (Array.isArray(l) && l.length ? l[Math.min(l.length - 1, Math.floor(rng() * l.length))] : null);

/** Bloque de focos del contenido ampliado, o null. */
export const datosFocos = (amp) => (amp?.focos && amp.focos.defs ? amp.focos : null);

/** Focos guardados (partida vieja → []). */
export function focosGuardados(ext) {
  return Array.isArray(ext?.focos) ? ext.focos.filter((f) => f && typeof f.id === 'string' && Number.isInteger(f.visto)).map((f) => ({ ...f, pasos: { ...(f.pasos ?? {}) }, alias: f.alias ? [...f.alias] : undefined })) : [];
}

/** Estado de focos de ext con valores por defecto. */
export function extFocos(ext) {
  const e = ext && typeof ext === 'object' ? ext : {};
  return {
    focos: focosGuardados(e),
    siguiendo: typeof e.siguiendo === 'string' ? e.siguiendo : null,
    marcasFoco: Array.isArray(e.marcasFoco) ? e.marcasFoco.filter((m) => typeof m === 'string') : [],
    interrupciones: e.interrupciones && typeof e.interrupciones === 'object' ? structuredClone(e.interrupciones) : {},
    ultimaCharla: e.ultimaCharla && typeof e.ultimaCharla.npc === 'string' ? { ...e.ultimaCharla } : null,
  };
}

const aliasDe = (f, F) => (f.gen ? f.alias ?? [] : F.defs[f.id]?.alias ?? []);
const claseDe = (f, F) => (f.gen ? f.clase : F.defs[f.id]?.clase) ?? 'objeto';
const duraDe = (f, F) => (f.gen ? DURA_GENERADO : F.defs[f.id]?.dura ?? DURA_GENERADO);

/** Vida: `dura` turnos o hasta cambiar de escena (salvo el que se sigue); máx. 8, salen los más viejos. */
export function vigentes(lista, { F, turno, escena, siguiendo = null }) {
  const vivos = lista.filter((f) => turno - f.visto < duraDe(f, F) && (f.escena === escena || f.id === siguiendo));
  return vivos.sort((a, b) => a.visto - b.visto).slice(-MAX_FOCOS);
}

function activar(lista, id, { turno, escena }) {
  const previo = lista.find((f) => f.id === id);
  if (previo) { previo.visto = turno; previo.escena = escena; return lista; }
  lista.push({ id, visto: turno, escena, pasos: {}, agotado: false });
  return lista;
}

/**
 * Detección tras narrar: alias de los focos en el texto emitido, y focos generados desde líneas de símbolos
 * (sonido/olor/luz/cielo/animal/gente) que ningún foco propio captura.
 * @param {{ familia: string, texto: string }[]} generadas
 */
export function detectar(lista, texto, { F, turno, escena, generadas = [] }) {
  const out = lista.map((f) => ({ ...f }));
  const norm = normalizar(texto ?? '');
  for (const [id, def] of Object.entries(F.defs)) if ((def.alias ?? []).some((a) => tieneAlias(norm, a))) activar(out, id, { turno, escena });
  generadas.forEach((g, i) => {
    const fam = FAMILIAS[g.familia];
    const n = normalizar(g.texto ?? '');
    if (!fam || !n || !norm.includes(n)) return;
    if (Object.values(F.defs).some((d) => (d.alias ?? []).some((a) => tieneAlias(n, a)))) return;
    const contenido = n.split(' ').filter((p) => p.length >= 5 && !VACIAS_LARGAS.has(p));
    const id = `gen_${g.familia}_${turno}_${i}`;
    if (!out.some((f) => f.id === id)) out.push({ id, gen: true, clase: fam.clase, alias: [...new Set([...fam.alias, ...contenido])], visto: turno, escena, pasos: {}, agotado: false });
  });
  return out.sort((a, b) => a.visto - b.visto).slice(-MAX_FOCOS);
}

/** Verbo de foco del texto: { verbo, usadas: Set<number> } o null. Primero el de forma más larga. */
export function verboFoco(texto) {
  const ws = palabras(texto);
  let mejor = null;
  for (const [verbo, formas] of Object.entries(FORMAS)) {
    for (const forma of formas) {
      const fs = normalizar(forma).split(' ');
      for (let i = 0; i + fs.length <= ws.length; i++) {
        const ok = fs.every((f, j) => ws[i + j] === f || (f.length >= 5 && ws[i + j].length >= 5 && ws[i + j][0] === f[0] && coincidePalabra(ws[i + j], f) >= 0));
        if (ok && (!mejor || fs.length > mejor.largo)) mejor = { verbo, largo: fs.length, usadas: new Set(fs.map((_, j) => i + j)), inicio: i };
      }
    }
  }
  return mejor ? { verbo: mejor.verbo, usadas: mejor.usadas, palabras: ws } : null;
}

/** Palabras de referente (sin el verbo, vacías ni genéricas). */
function restoDe(v) {
  const vacias = new Set(tokenizar(v.palabras.join(' ')));
  return v.palabras.filter((p, i) => !v.usadas.has(i) && vacias.has(p) && !GENERICAS.has(p) && !PRONOMBRES.includes(p));
}

const fijosDe = (F, escena) => Object.entries(F.fijos?.[escena] ?? {});
const conTypos = (norm, alias) => {
  if (tieneAlias(norm, alias)) return true;
  const a = normalizar(alias);
  return !a.includes(' ') && a.length >= 5 && norm.split(' ').some((p) => p.length >= 5 && p[0] === a[0] && coincidePalabra(p, a) >= 0);
};

/**
 * Referente del texto: { tipo: 'foco', f } | { tipo: 'fijo', id, o } | { tipo: 'no_visto' } | null (comportamiento anterior).
 * Alias de foco activo > fijo de la escena > pronombre/sin sustantivo (más reciente) > alias conocido no activo (no visto).
 */
export function resolverReferente(texto, v, { F, lista, escena }) {
  const norm = normalizar(texto);
  const cand = lista.filter((f) => aliasDe(f, F).some((a) => conTypos(norm, a))).sort((a, b) => b.visto - a.visto);
  if (cand.length) return { tipo: 'foco', f: cand[0] };
  const fijo = fijosDe(F, escena).find(([, o]) => (o.alias ?? []).some((a) => conTypos(norm, a)));
  if (fijo) return { tipo: 'fijo', id: fijo[0], o: fijo[1] };
  const resto = restoDe(v);
  const pronombre = PRONOMBRES.some((p) => tieneAlias(norm, p));
  if (v.verbo !== 'examinar' && (pronombre || resto.length === 0)) {
    const reciente = [...lista].sort((a, b) => b.visto - a.visto).find((f) => !f.agotado) ?? [...lista].sort((a, b) => b.visto - a.visto)[0];
    if (reciente) return { tipo: 'foco', f: reciente };
    return pronombre ? { tipo: 'no_visto' } : null;
  }
  const conocidos = [...Object.values(F.defs).flatMap((d) => d.alias ?? []), ...Object.values(FAMILIAS).flatMap((x) => x.alias)];
  if (v.verbo !== 'examinar' && conocidos.some((a) => tieneAlias(norm, a))) return { tipo: 'no_visto' };
  return null;
}

/** S1: examinar/tocar algo nombrado que no está en la escena (ni objeto, ni NPC, ni lugar) → true. */
export function referenteDesconocido(texto, v, { contenido, partida, dic }) {
  const resto = restoDe(v);
  if (!resto.length) return false;
  const aplicables = objetosAplicables(partida, contenido, 'examinar');
  if (resolverObjeto(texto, 'negociar', aplicables, { lexico: dic?.lexicoObjeto ?? null }).estado === 'resuelto') return false;
  const conocidas = new Set([
    ...npcsPresentes(partida, contenido).flatMap((n) => [n.nombre, ...(n.alias ?? [])]),
    ...contenido.escenas.map((e) => e.nombre),
    ...(contenido.escenas.find((e) => e.id === partida.jugador.escenaId)?.ciudad ? [contenido.escenas.find((e) => e.id === partida.jugador.escenaId).ciudad] : []),
  ].flatMap((x) => palabras(x)));
  return !resto.some((p) => conocidas.has(p));
}

/** Texto de un paso de rama (string o { t }). */
const pasoDe = (p) => (typeof p === 'string' ? { t: p } : p ?? null);

/**
 * Ejecuta el verbo sobre el referente. Muta `fx` (estado de focos). Devuelve { texto, minutos, fin, rama }.
 */
export function ejecutarVerbo({ F, fx, ref, verbo, rng, turno, escena }) {
  const clases = F.clases ?? {};
  if (ref.tipo === 'fijo') {
    const lista = verbo === 'tocar' ? ref.o.tocar : verbo === 'mirar' || verbo === 'examinar' ? ref.o.examinar : clases.objeto?.[verbo];
    return { texto: pick(lista, rng), minutos: 0, rama: verbo === 'tocar' || verbo === 'mirar' || verbo === 'examinar' };
  }
  const f = fx.focos.find((x) => x.id === ref.f.id) ?? ref.f;
  const clase = claseDe(f, F);
  const v = verbo === 'examinar' ? 'mirar' : verbo;
  const generico = (k) => pick(clases[clase]?.[k] ?? clases.objeto?.[k], rng);
  if (f.agotado) return { texto: generico('ignorar'), minutos: 0, rama: false, repetido: true };
  if (v === 'ignorar') { f.agotado = true; return { texto: generico('ignorar'), minutos: 0, rama: false }; }
  const rama = f.gen ? null : F.defs[f.id]?.ramas?.[v];
  const i = f.pasos[v] ?? 0;
  if (!Array.isArray(rama) || i >= rama.length) return { texto: generico(v), minutos: 0, rama: false };
  const p = pasoDe(rama[i]);
  f.pasos[v] = i + 1;
  for (const e of p.emite ?? []) if (F.defs[e]) activar(fx.focos, e, { turno, escena });
  if (p.fin) {
    f.agotado = true;
    if (p.fin === 'hallazgo' && !fx.marcasFoco.includes(`foco_${f.id}_hallazgo`)) fx.marcasFoco.push(`foco_${f.id}_hallazgo`);
  }
  return { texto: p.t, minutos: Number.isFinite(p.tiempoMin) ? p.tiempoMin : 0, fin: p.fin ?? null, rama: true };
}

/** S5: ¿el jugador deja a medias una charla? Devuelve el npc o null. */
export function interrumpe({ fx, verbo, turno, presentes, ref, F }) {
  if (!['seguir', 'llamar'].includes(verbo) || !fx.ultimaCharla) return null;
  const { npc, turno: t } = fx.ultimaCharla;
  if (turno - t > 2 || !presentes.includes(npc)) return null;
  const duenio = ref.tipo === 'foco' && !ref.f.gen ? F.defs[ref.f.id]?.npc : null;
  if (duenio === npc) return null;
  return F.interrupcion?.[npc]?.durante?.length ? npc : null;
}

/**
 * Turno de foco, antes de la comprensión. null = comportamiento anterior.
 * @returns {null | { tipo: 'foco'|'reformular', estado, intencionId: null, texto?, motivo?, datos?, foco?, extFocos? }}
 */
export function turnoDeFoco({ amp, contenido, partida, texto, dic = null }) {
  const F = datosFocos(amp);
  if (!F || typeof texto !== 'string') return null;
  const v = verboFoco(texto);
  if (!v) return null;
  const ext = partida.ext ?? {};
  const turno = (Number.isInteger(ext.turno) ? ext.turno : 0) + 1;
  const escena = partida.jugador.escenaId;
  const fx = extFocos(ext);
  fx.focos = vigentes(fx.focos, { F, turno, escena, siguiendo: fx.siguiendo });
  const rng = derivar(`${Number.isInteger(ext.semillaBase) ? ext.semillaBase : partida.semilla | 0}:${turno}`, 'focos');
  const ref = resolverReferente(texto, v, { F, lista: fx.focos, escena });
  if (!ref) {
    if ((v.verbo === 'examinar' || v.verbo === 'tocar') && referenteDesconocido(texto, v, { contenido, partida, dic })) {
      return { tipo: 'reformular', estado: partida, intencionId: null, motivo: MOTIVOS.SIN_OBJETOS, datos: { nombres: [] }, extFocos: fx };
    }
    return null;
  }
  if (ref.tipo === 'no_visto') return { tipo: 'foco', estado: partida, intencionId: null, texto: pick(F.no_visto, rng), foco: { id: null, verbo: v.verbo, noVisto: true }, extFocos: fx };
  const presentes = npcsPresentes(partida, contenido).map((n) => n.id);
  const npcInt = interrumpe({ fx, verbo: v.verbo, turno, presentes, ref, F });
  const r = ejecutarVerbo({ F, fx, ref, verbo: v.verbo, rng, turno, escena });
  if (!r.texto) return null;
  const partes = [];
  if (npcInt) {
    partes.push(pick(F.interrupcion[npcInt].durante, rng));
    const previo = fx.interrupciones[npcInt] ?? { veces: 0 };
    fx.interrupciones[npcInt] = { turno, veces: previo.veces + 1, minuto: minutosAbsolutos(partida.reloj), regreso: true };
    fx.ultimaCharla = null;
  }
  partes.push(r.texto);
  if (v.verbo === 'seguir' && ref.tipo === 'foco') fx.siguiendo = r.fin ? null : ref.f.id;
  const reloj = r.minutos ? avanzar(partida.reloj, r.minutos / 60) : partida.reloj;
  return {
    tipo: 'foco',
    estado: { ...partida, reloj, reformulacionPendiente: false },
    intencionId: null,
    texto: partes.filter(Boolean).join(' '),
    foco: { id: ref.tipo === 'fijo' ? `fijo:${ref.id}` : ref.f.id, verbo: v.verbo, rama: r.rama, fin: r.fin ?? null, interrupcion: npcInt, minutos: r.minutos },
    extFocos: fx,
  };
}

/** S5: tercera interrupción al mismo NPC → afinidad −1 (−2 si su valor `orden` ≥ 1). Devuelve el delta (0 si nada). */
export function castigoInterrupcion(fx, npc, valores) {
  const i = fx.interrupciones?.[npc];
  if (!i || i.veces !== 3 || i.castigado) return 0;
  i.castigado = true;
  return (valores?.[npc]?.orden ?? 0) >= 1 ? -2 : -1;
}

/** S5: al volver a hablar con el NPC dentro de 24 h, la línea de regreso (una vez). */
export function lineaDeRegreso(F, fx, npc, reloj, rng) {
  const i = fx.interrupciones?.[npc];
  if (!F || !i?.regreso) return null;
  i.regreso = false;
  if (minutosAbsolutos(reloj) - i.minuto > HORAS_REGRESO * 60) return null;
  return pick(F.interrupcion?.[npc]?.regreso, rng);
}

// Fase 6: lectura de la acción del jugador por etapas, sobre comprension.js (normalizar, distanciaEdicion, resolverDestino).
// Orden: normalizar → lematizar (+enclíticos) → sinónimos → tipeo → referencias → defaults → aclaración.
// Cada etapa es una función pura exportada. `leerAccion` las encadena según `etapas`.
import { normalizar, distanciaEdicion, resolverDestino } from './comprension.js';
import llevablesJson from '../data/config/llevables.json' with { type: 'json' };

/** Etapas activas por defecto (cada paso de la fase 6 enciende la suya). */
export const ETAPAS = Object.freeze({ lematizar: true, encliticos: true, tipeo: true, referencias: true, defaults: true, sinonimos: true, varias: true, negacion: true, modo: true });

/** Acciones que entiende la lectura. */
export const ACCIONES = Object.freeze(['seguir', 'mirar', 'tocar', 'escuchar', 'hablar', 'preguntar', 'ignorar', 'tomar', 'callar', 'viajar', 'mostrar', 'llamar']);

// A APROBAR (prov): preguntas de aclaración.
export const TEXTOS_ACLARACION = Object.freeze({ prov: true, opciones: '¿{a} o {b}?', falta: '¿Qué querés {verbo}?', npc: '¿Con quién?' });

// ---- léxico de verbos ----
// Infinitivo → acción. Los de `base` existen desde el principio; los de `sinonimos` los suma V6.
const BASE = { seguir: 'seguir', mirar: 'mirar', tocar: 'tocar', escuchar: 'escuchar', hablar: 'hablar', preguntar: 'preguntar', ignorar: 'ignorar', tomar: 'tomar', callar: 'callar', viajar: 'viajar', mostrar: 'mostrar', llamar: 'llamar', ir: 'viajar', agarrar: 'tomar', observar: 'mirar', oir: 'escuchar', perseguir: 'seguir' };
const SINONIMOS = {
  acompanar: 'seguir', rastrear: 'seguir',
  examinar: 'mirar', contemplar: 'mirar', ver: 'mirar', inspeccionar: 'mirar', revisar: 'mirar', fijar: 'mirar', vigilar: 'mirar',
  golpear: 'tocar', acariciar: 'tocar', palpar: 'tocar', empujar: 'tocar',
  charlar: 'hablar', conversar: 'hablar', saludar: 'hablar',
  consultar: 'preguntar',
  levantar: 'tomar', recoger: 'tomar', juntar: 'tomar', alzar: 'tomar', agarrar: 'tomar',
  volver: 'viajar', regresar: 'viajar', caminar: 'viajar', marchar: 'viajar',
  ensenar: 'mostrar', dar: 'mostrar',
  silbar: 'llamar', gritar: 'llamar',
  decir: 'hablar', hacer: null, pasar: null, prestar: null, dejar: null, correr: null,
};
// Verbos auxiliares de frases hechas (no son acción por sí solos).
const AUXILIARES = ['decir', 'hacer', 'pasar', 'prestar', 'dejar', 'correr', 'fijar'];

// Formas irregulares (normalizadas) → infinitivo.
const IRREGULARES = {
  seguir: ['sigo', 'sigue', 'sigues', 'siga', 'sigan', 'siguen', 'siguiendo', 'seguimos', 'segui', 'seguiste', 'siguio', 'seguia', 'seguis'],
  perseguir: ['persigo', 'persigue', 'persigues', 'persiga', 'persiguiendo', 'persegui', 'persiguio', 'perseguis'],
  oir: ['oigo', 'oye', 'oyes', 'oi', 'oiste', 'oyo', 'oyendo', 'oiga', 'oimos', 'ois'],
  ir: ['voy', 'vas', 'va', 'vamos', 'van', 'fui', 'fue', 'fuiste', 'yendo', 'vaya', 'anda', 'andate', 've'],
  ver: ['veo', 'ves', 'vi', 'vio', 'viendo', 'vea'],
  decir: ['digo', 'dice', 'dices', 'decis', 'dije', 'dijo', 'deci', 'diga', 'diciendo', 'di'],
  dar: ['doy', 'da', 'das', 'dio', 'dando'],
  hacer: ['hago', 'hace', 'haces', 'haces', 'hice', 'hizo', 'hace', 'haga', 'haciendo', 'hacé'],
  recoger: ['recojo', 'recoja', 'recoge'],
  volver: ['vuelvo', 'vuelve', 'vuelves', 'volves', 'volvi', 'volvio', 'vuelva'],
  mostrar: ['muestro', 'muestra', 'muestras', 'muestre', 'muestran'],
};
// No son verbos aunque parezcan (excepciones del lematizador).
export const NO_VERBOS = new Set(['vale', 'sale', 'vela', 'sola', 'solo', 'sala', 'mula', 'mesa', 'misa', 'casa', 'cosa', 'gata', 'gato', 'carta', 'sobre', 'puerta', 'campana', 'perro', 'perra', 'lampara', 'farol', 'nada', 'cada', 'para', 'pera', 'vino', 'como', 'cielo', 'luz', 'ves', 'vez', 'sea', 'era', 'eso', 'esto', 'esa', 'ese', 'este', 'esta', 'tras', 'mas', 'menos', 'lado', 'dado', 'mano', 'masa', 'malo', 'mala', 'pelo', 'velo', 'hola', 'gente', 'ruido', 'voces', 'bicho', 'dale', 'seguro', 'segura']);

function regulares(inf) {
  const t = inf.slice(-2);
  const s = inf.slice(0, -2);
  if (t === 'ar') {
    const q = s.endsWith('c') ? s.slice(0, -1) + 'qu' : s.endsWith('g') ? s + 'u' : s;
    return [inf, s + 'o', s + 'a', s + 'as', s + 'an', s + 'amos', s + 'ando', q + 'e', q + 'es', q + 'en', s + 'aste', s + 'aron', s + 'aba', s + 'ado', s + 'ais', q + 'emos'];
  }
  const v = t === 'er' ? 'e' : 'i';
  const sj = s.endsWith('g') ? s.slice(0, -1) + 'j' : s;
  return [inf, sj + 'o', s + 'es', s + 'e', s + 'en', s + v + 'mos', s + 'iendo', s + 'i', s + 'iste', s + 'io', sj + 'a', sj + 'as', s + 'ia', s + 'ido', s + v + 's'];
}

function construirFormas(conSinonimos) {
  const mapa = new Map(); // forma → infinitivo
  const infs = { ...BASE, ...(conSinonimos ? SINONIMOS : {}) };
  for (const inf of [...Object.keys(infs), ...AUXILIARES]) {
    // Verbos cortos (ir, ver, dar, oir): solo sus formas irregulares; las regulares darían «a», «e», «va»…
    for (const f of [...(inf.length <= 3 ? [inf] : regulares(inf)), ...(IRREGULARES[inf] ?? [])]) if (!mapa.has(f) && !NO_VERBOS.has(f)) mapa.set(f, inf);
  }
  return { mapa, infs };
}
/** V6: formas que comparten dos verbos con acciones distintas (deberían ser 0, salvo auxiliares). */
export function colisionesDeFormas() {
  const infs = { ...BASE, ...SINONIMOS };
  const de = new Map();
  for (const inf of Object.keys(infs)) for (const f of [...(inf.length <= 3 ? [inf] : regulares(inf)), ...(IRREGULARES[inf] ?? [])]) {
    if (NO_VERBOS.has(f)) continue;
    const a = infs[inf] ?? `aux:${inf}`;
    de.set(f, new Set([...(de.get(f) ?? []), a]));
  }
  return [...de].filter(([, as]) => as.size > 1).map(([f, as]) => ({ forma: f, acciones: [...as].sort() }));
}
const FORMAS_BASE = construirFormas(false);
const FORMAS_SIN = construirFormas(true);
const formas = (et) => (et.sinonimos ? FORMAS_SIN : FORMAS_BASE);

/** Infinitivo de un verbo conjugado (voseo, tuteo, usted, infinitivo, imperativo, gerundio, pasado). null si no es verbo. */
export function lematizar(palabra, { sinonimos = true } = {}) {
  const p = normalizar(palabra);
  if (!p || NO_VERBOS.has(p)) return null;
  return (sinonimos ? FORMAS_SIN : FORMAS_BASE).mapa.get(p) ?? null;
}

const ENCLITICOS = ['selos', 'selas', 'selo', 'sela', 'melo', 'mela', 'las', 'los', 'les', 'la', 'lo', 'le', 'me', 'se', 'te'];
/** Separa un enclítico: mirala → { verbo: 'mirar', forma: 'mira', pronombres: ['la'] }. null si no aplica. */
export function separarEncliticos(palabra, { sinonimos = true } = {}) {
  const p = normalizar(palabra);
  if (!p || NO_VERBOS.has(p) || lematizar(p, { sinonimos })) return null;
  for (const e of ENCLITICOS) {
    if (!p.endsWith(e) || p.length - e.length < 2) continue;
    const base = p.slice(0, -e.length);
    const inf = lematizar(base, { sinonimos });
    if (inf) return { verbo: inf, forma: base, pronombres: e.length >= 4 ? [e.slice(0, 2), e.slice(2)] : [e] };
  }
  return null;
}

// ---- tipeo (V3) ----
/** Distancia máxima por largo: 0 para ≤3 letras, 1 para 4–6, 2 para ≥7. */
export const toleranciaTipeo = (n) => (n <= 3 ? 0 : n <= 6 ? 1 : 2);
// Palabras comunes que nunca se corrigen («mesa» no es «misa»).
export const NO_CORREGIR = new Set(['aburro', 'aburre', 'aburrido', 'aburrida', 'mesa', 'casa', 'cosa', 'masa', 'mano', 'nada', 'algo', 'todo', 'otro', 'otra', 'bien', 'para', 'pero', 'como', 'esto', 'eso', 'esta', 'este', 'aqui', 'alla', 'despacio', 'rapido', 'luego', 'despues', 'donde', 'cuando', 'hola', 'sobre', 'cerca', 'lejos', 'calle', 'noche', 'tarde', 'mucho', 'poco', 'ahora', 'tambien', 'seguro', 'segura', 'hora', 'hoja']);

/** Con 4 letras solo se corrige un intercambio de letras vecinas o una letra que falta («isal», «selo»): «hora» no es «hoja». */
export function cuatroSeguro(w, destino) {
  if (w.length !== 4) return true;
  if (destino.length === 5) return true;
  if (destino.length !== 4) return false;
  const i = [...w].findIndex((c, k) => c !== destino[k]);
  return i >= 0 && i < 3 && w[i] === destino[i + 1] && w[i + 1] === destino[i] && w.slice(i + 2) === destino.slice(i + 2);
}

/**
 * Corrige una palabra contra un vocabulario { palabra → clave }. Empate entre claves distintas → sin corregir.
 * @returns {{ palabra: string, clave: any, distancia: number } | null}
 */
export function corregirTipeo(palabra, vocab) {
  const p = normalizar(palabra);
  if (!p || NO_CORREGIR.has(p)) return null;
  if (vocab.has(p)) return { palabra: p, clave: vocab.get(p), distancia: 0 };
  const tope = toleranciaTipeo(p.length);
  if (tope === 0) return null;
  let mejor = null; let empate = false;
  for (const [w, clave] of vocab) {
    if (Math.abs(w.length - p.length) > tope || toleranciaTipeo(w.length) === 0) continue;
    const d = distanciaEdicion(p, w, tope);
    if (d > tope) continue;
    if (!mejor || d < mejor.distancia) { mejor = { palabra: w, clave, distancia: d }; empate = false; } else if (d === mejor.distancia && String(clave) !== String(mejor.clave)) empate = true;
  }
  return mejor && !empate ? mejor : null;
}

// ---- vocabulario de cosas ----
const VACIAS = new Set(['a', 'al', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'con', 'por', 'x', 'en', 'y', 'que', 'le', 'lo', 'les', 'se', 'me', 'mi', 'tu', 'su', 'hacia', 'para', 'hasta', 'otra', 'vez', 'ahora', 'bien', 'muy', 'tras', 'atencion', 'oido', 'caso', 'nada', 'yo', 'vos', 'ya']);
const ARTICULOS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'al', 'del']);
const FUNCIONALES = new Set(['sobre', 'bajo', 'entre']); // alias que también son preposición: exigen artículo antes
const genero = (alias) => (/a(s)?$/.test(normalizar(alias).split(' ')[0]) ? 'f' : 'm');

/**
 * Contexto de lectura desde contenido + focos.
 * @param {{ focos?: object, npcs?: object[], presentes?: string[], escenas?: object[], reciente?: object, pendiente?: object }} o
 */
export function contextoLectura({ focos = {}, npcs = [], presentes = null, escenas = [], reciente = {}, pendiente = null, inventario = [] } = {}) {
  const cosas = [];
  for (const [id, d] of Object.entries(focos)) for (const a of d.alias ?? []) cosas.push({ tipo: 'foco', id, alias: normalizar(a), genero: genero(d.alias[0]), clase: d.clase });
  const npcsCtx = npcs.map((n) => ({ id: n.id, nombre: n.nombre, palabras: [...new Set([...normalizar(n.nombre).split(' '), ...(n.alias ?? []).map(normalizar)])].filter((w) => w && !VACIAS.has(w)) }));
  for (const n of npcsCtx) for (const w of n.palabras) cosas.push({ tipo: 'npc', id: n.id, alias: w });
  // W1: escena donde se vio cada foco (para el rótulo) y cosas transportables (objeto con fin hallazgo, o inventario).
  const escenaDe = Object.fromEntries(Object.entries(focos).filter(([, d]) => d.escena).map(([id, d]) => [id, d.escena]));
  const transportables = new Set([...inventario, ...Object.entries(focos).filter(([id, d]) => esTransportable(d) || LLEVABLES.has(id)).map(([id]) => id)]);
  return { cosas, npcs: npcsCtx, presentes: presentes ?? npcsCtx.map((n) => n.id), escenas, reciente: { ...reciente }, pendiente, escenaDe, transportables };
}

/** Ajuste fase 7: lista explícita de llevables (data/config/llevables.json). */
export const LLEVABLES = new Set(llevablesJson.llevables);

/** W1: objeto con algún paso `fin: hallazgo` en sus ramas. */
export function esTransportable(def) {
  return def?.clase === 'objeto' && Object.values(def.ramas ?? {}).some((l) => Array.isArray(l) && l.some((p) => p && typeof p === 'object' && p.fin === 'hallazgo'));
}
/** W1: único lugar de decisión de «agarrar/tomar/levantar»: transportable → tomar; si no → tocar. */
export function tomarOTocar(id, ctx) {
  return ctx?.transportables?.has(id) ? 'tomar' : 'tocar';
}

function vocabCosas(ctx) {
  const v = new Map();
  // Primero alias de una palabra; las palabras de alias compuestos solo si no las tomó nadie.
  for (const multi of [false, true]) {
    for (const c of ctx.cosas) {
      const ws = c.alias.split(' ');
      if ((ws.length > 1) !== multi) continue;
      for (const w of ws) if (w.length >= 4 && !VACIAS.has(w)) { const k = `${c.tipo}:${c.id}`; if (multi && v.has(w)) continue; v.set(w, v.has(w) && v.get(w) !== k ? '*' : k); }
    }
  }
  // Palabras de escenas: protegen de corregir «lago» a «lazo» o «taberna» a «tabernera».
  for (const e of ctx.escenas ?? []) for (const w of normalizar(e.nombre).split(' ')) if (w.length >= 4 && !VACIAS.has(w) && !v.has(w)) v.set(w, `escena:${e.id}`);
  return v;
}
function vocabVerbos(et) {
  const v = new Map();
  for (const [f, inf] of formas(et).mapa) v.set(f, inf);
  return v;
}

// ---- etapas de frase ----
const MODOS = [[['a', 'escondidas'], 'sigilo'], [['en', 'silencio'], 'sigilo'], [['despacio'], 'sigilo'], [['sigilosamente'], 'sigilo'], [['con', 'cuidado'], 'sigilo'], [['sin', 'hacer', 'ruido'], 'sigilo'], [['rapido'], 'prisa'], [['corriendo'], 'prisa'], [['deprisa'], 'prisa'], [['de', 'prisa'], 'prisa'], [['a', 'las', 'corridas'], 'prisa'], [['rapidamente'], 'prisa']];
/** Saca el modo (sigilo/prisa) de las palabras. */
export function extraerModo(ws) {
  for (const [m, modo] of MODOS) {
    for (let i = 0; i + m.length <= ws.length; i++) if (m.every((x, j) => ws[i + j] === x)) return { modo, palabras: [...ws.slice(0, i), ...ws.slice(i + m.length)] };
  }
  return { modo: null, palabras: ws };
}

const SEPARADORES = [['y', 'despues'], ['y', 'luego'], ['despues'], ['luego'], ['y']];
/** Parte la frase en acciones (máx. 3) cuando cada parte tiene verbo. */
export function separarAcciones(texto, et = ETAPAS) {
  const crudo = String(texto ?? '').split(/,|;/).map(normalizar).filter(Boolean);
  let partes = crudo.map((p) => p.split(' '));
  for (const sep of SEPARADORES) {
    const nuevas = [];
    for (const ws of partes) {
      let resto = ws; let hecho = false;
      for (let i = 1; i + sep.length < resto.length; i++) {
        if (sep.every((x, j) => resto[i + j] === x)) {
          const a = resto.slice(0, i); const b = resto.slice(i + sep.length);
          if (tieneVerbo(a, et) && tieneVerbo(b, et)) { nuevas.push(a); resto = b; i = 0; hecho = true; }
        }
      }
      nuevas.push(resto); void hecho;
    }
    partes = nuevas;
  }
  // Partes sin verbo se pegan a la anterior.
  const out = [];
  for (const p of partes) if (out.length && !tieneVerbo(p, et)) out[out.length - 1] = [...out[out.length - 1], ...p]; else out.push(p);
  const sinNexo = (p) => { let i = 0; while (i < p.length - 1 && ['y', 'despues', 'luego', 'entonces'].includes(p[i])) i++; return p.slice(i); };
  return out.slice(0, 3).map((p) => sinNexo(p).join(' '));
}
const tieneVerbo = (ws, et) => ws.some((w) => verboDe(w, et));
function verboDe(w, et) {
  const inf = et.lematizar ? lematizar(w, { sinonimos: et.sinonimos }) : formaBase(w);
  if (inf) return { inf, pronombres: [] };
  if (et.encliticos) { const e = separarEncliticos(w, { sinonimos: et.sinonimos }); if (e) return { inf: e.verbo, pronombres: e.pronombres }; }
  return null;
}
// Sin lematizador: solo infinitivo y primera persona regular de los verbos base.
function formaBase(w) {
  for (const inf of Object.keys(BASE)) if (w === inf || w === inf.slice(0, -2) + 'o') return inf;
  return null;
}

/** Busca cosas nombradas (focos/NPC) en las palabras. Devuelve candidatos únicos por id, multi-palabra primero. */
export function cosasNombradas(ws, ctx, et = ETAPAS) {
  const texto = ` ${ws.join(' ')} `;
  const hall = new Map();
  const usadas = new Set();
  const cosas = [...ctx.cosas].sort((a, b) => b.alias.length - a.alias.length);
  // V2: plurales de sustantivos («las campanas» → campana).
  const textoSing = et.lematizar ? ` ${ws.map((w) => (w.length > 4 && w.endsWith('es') && !ctx.cosas.some((c) => c.alias === w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !ctx.cosas.some((c) => c.alias === w) ? w.slice(0, -1) : w)).join(' ')} ` : texto;
  for (const c of cosas) {
    let i = texto.indexOf(` ${c.alias} `);
    if (i < 0 && textoSing !== texto) i = textoSing.indexOf(` ${c.alias} `);
    // B: singular escrito de un alias que solo está en plural («el papel» → «papeles»).
    if (i < 0 && et.lematizar && !c.alias.includes(' ')) {
      const sing = c.alias.length > 5 && c.alias.endsWith('es') ? c.alias.slice(0, -2) : c.alias.length > 4 && c.alias.endsWith('s') ? c.alias.slice(0, -1) : null;
      if (sing && sing.length >= 4 && !ctx.cosas.some((x) => x.alias === sing)) i = texto.indexOf(` ${sing} `);
    }
    if (i < 0) continue;
    const pos = texto.slice(0, i).trim().split(' ').filter(Boolean).length;
    if (FUNCIONALES.has(c.alias) && !ARTICULOS.has(ws[pos - 1])) continue;
    const span = c.alias.split(' ').map((_, j) => pos + j);
    if (span.some((p) => usadas.has(p)) && !hall.has(`${c.tipo}:${c.id}`)) {
      // la palabra ya la tomó un alias más largo: solo cuenta si el otro alias es igual de largo (ambigüedad real)
      const otro = [...hall.values()].find((h) => h.span.join() === span.join());
      if (!otro || otro.alias !== c.alias) continue;
    }
    span.forEach((p) => usadas.add(p));
    const k = `${c.tipo}:${c.id}`;
    if (!hall.has(k)) hall.set(k, { ...c, span, pos });
  }
  if (et.tipeo && hall.size === 0) {
    const vocab = vocabCosas(ctx);
    ws.forEach((w, pos) => {
      if (w.length < 4 || VACIAS.has(w) || PRON_F.has(w) || PRON_M.has(w) || PRON_NPC.has(w) || PRON_NEUTRO.has(w) || verboDe(w, et)) return;
      const r = corregirTipeo(w, vocab);
      if (r && r.clave !== '*' && r.distancia > 0 && !r.clave.startsWith('escena:') && cuatroSeguro(w, r.palabra)) {
        const [tipo, ...id] = r.clave.split(':');
        const c = ctx.cosas.find((x) => x.tipo === tipo && x.id === id.join(':'));
        const k = `${tipo}:${c.id}`;
        if (!hall.has(k)) hall.set(k, { ...c, span: [pos], pos, tipeo: true });
      }
    });
  }
  return [...hall.values()];
}

const PRON_F = new Set(['la', 'las', 'ella', 'ellas']);
const PRON_M = new Set(['lo', 'los', 'ellos']);
const PRON_NEUTRO = new Set(['eso', 'esto', 'aquello', 'ahi', 'alla', 'aca']);
const PRON_NPC = new Set(['le', 'les', 'ella']);
/** V4: resuelve un pronombre con la memoria de referencia. tipo: 'foco'|'npc'. */
export function resolverReferencia(pron, reciente, { tipo = 'foco', genero: g = null } = {}) {
  const r = reciente ?? {};
  if (tipo === 'npc') return PRON_NPC.has(pron) || pron === 'se' ? r.npc ?? null : null;
  if (PRON_NEUTRO.has(pron)) return r.foco ?? r.objeto ?? null;
  const quiere = PRON_F.has(pron) ? 'f' : PRON_M.has(pron) ? 'm' : null;
  if (!quiere) return null;
  for (const k of ['foco', 'objeto']) { const x = r[k]; if (x && (!g || g(x) === quiere)) return x; }
  return null;
}

const ORDINALES = { primero: 0, primera: 0, '1': 0, uno: 0, segundo: 1, segunda: 1, '2': 1, dos: 1, tercero: 2, tercera: 2, '3': 2, ultimo: -1, ultima: -1 };
/** V5: respuesta corta a una aclaración pendiente. Devuelve el id elegido o null. */
export function responderAclaracion(texto, pendiente, ctx) {
  if (!pendiente?.opciones?.length) return null;
  const ws = normalizar(texto).split(' ').filter(Boolean);
  if (ws.length > 6) return null;
  for (const w of ws) if (w in ORDINALES) { const i = ORDINALES[w]; return pendiente.opciones.at(i) ?? null; }
  const cont = ws.filter((w) => !VACIAS.has(w));
  const puntaje = pendiente.opciones.map((id) => {
    const al = ctx.cosas.filter((c) => c.id === id).map((c) => c.alias.split(' '));
    const propias = new Set(al.flat());
    const comunes = new Set(pendiente.opciones.filter((o) => o !== id).flatMap((o) => ctx.cosas.filter((c) => c.id === o).flatMap((c) => c.alias.split(' '))));
    return cont.filter((w) => propias.has(w) && !comunes.has(w)).length + (cont.length && cont.every((w) => propias.has(w)) ? 0.5 : 0);
  });
  const max = Math.max(...puntaje);
  if (max <= 0) return null;
  const top = puntaje.filter((p) => p === max);
  if (top.length > 1) return null;
  return pendiente.opciones[puntaje.indexOf(max)];
}

/** Nombre para la pregunta de aclaración: el alias que no comparte con las otras opciones. */
function nombreDe(id, opciones, ctx) {
  const al = ctx.cosas.filter((c) => c.id === id).map((c) => c.alias);
  const otras = new Set(opciones.filter((o) => o !== id).flatMap((o) => ctx.cosas.filter((c) => c.id === o).map((c) => c.alias)));
  // la primera opción va con su nombre principal; las demás, con el más largo que no compartan
  const propias = al.filter((x) => !otras.has(x)).sort((x, y) => y.length - x.length);
  const a = (opciones[0] === id ? al[0] : propias[0]) ?? al[0] ?? id;
  return `${genero(a) === 'f' ? 'la' : 'el'} ${a}`;
}
/** W1: rótulo que distingue candidatos con el mismo alias: escena donde se vio, o el resto de un alias propio («de granja»). */
export function rotuloDe(id, base, opciones, ctx) {
  const escenas = opciones.map((o) => ctx.escenaDe?.[o]);
  if (ctx.escenaDe?.[id] && new Set(escenas).size === opciones.length) {
    const e = (ctx.escenas ?? []).find((x) => x.id === ctx.escenaDe[id]);
    const w = e ? normalizar(e.nombre).split(' ')[0] : null;
    if (w) return /a$/.test(w) ? `de la ${w}` : `del ${w}`;
  }
  const propio = ctx.cosas.find((c) => c.id === id && c.alias !== base && c.alias.startsWith(`${base} `));
  return propio ? propio.alias.slice(base.length + 1) : null;
}
function aliasComun(opciones, ctx) {
  const de = opciones.map((o) => new Set(ctx.cosas.filter((c) => c.id === o).map((c) => c.alias)));
  return [...de[0]].find((a) => de.every((s) => s.has(a))) ?? null;
}
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function preguntaAclaracion({ opciones = [], verbo = null } = {}, ctx) {
  const base = opciones.length >= 2 ? aliasComun(opciones.slice(0, 2), ctx) : null;
  if (base) {
    const art = genero(base) === 'f' ? 'la' : 'el';
    const r = opciones.slice(0, 2).map((o) => rotuloDe(o, base, opciones.slice(0, 2), ctx));
    if (r.some(Boolean)) {
      const a = `${art} ${base}${r[0] ? ` ${r[0]}` : ''}`;
      const b = r[1] ? `${art} ${r[1]}` : nombreDe(opciones[1], opciones, ctx);
      return TEXTOS_ACLARACION.opciones.replace('{a}', capital(a)).replace('{b}', b);
    }
  }
  if (opciones.length >= 2) return TEXTOS_ACLARACION.opciones.replace('{a}', capital(nombreDe(opciones[0], opciones, ctx))).replace('{b}', nombreDe(opciones[1], opciones, ctx));
  return TEXTOS_ACLARACION.falta.replace('{verbo}', verbo ?? 'hacer');
}

// ---- frases hechas (sobre lemas) ----
// [secuencia, acción]. '*' = cualquier forma del verbo indicado por lema.
const FRASES = [
  [['ir', 'tras'], 'seguir', 'base'], [['correr', 'tras'], 'seguir', 'base'], [['ir', 'detras'], 'seguir', 'sin'],
  [['pasar', 'de'], 'ignorar', 'sin'], [['pasar', 'del'], 'ignorar', 'sin'], [['dejar', 'pasar'], 'ignorar', 'base'],
  [['prestar', 'atencion'], 'escuchar', 'sin'], [['prestar', 'oido'], 'escuchar', 'base'],
  [['fijar', 'en'], 'mirar', 'base'], [['me', 'fijar'], 'mirar', 'base'], [['me', 'callar'], 'callar', 'base'],
];

/**
 * Lee una parte (una sola acción).
 * @returns {{ accion: string, objetivo?: string, npc?: string, lugar?: string, modo?: string, opciones?: string[], pregunta?: string }}
 */
function leerParte(parte, ctx, et) {
  let ws = normalizar(parte).replace(/\bx\b/g, 'por').split(' ').filter(Boolean);
  let modo = null;
  if (et.modo) ({ modo, palabras: ws } = extraerModo(ws));
  if (!et.negacion && ws[0] === 'no') return { accion: 'no_entendido' }; // precisión: sin etapa de negación, no adivinar
  const negada = et.negacion && ws[0] === 'no';
  if (negada) ws = ws.slice(1);
  const lemas = ws.map((w) => verboDe(w, et));
  // V3: tipeo en verbos, si no hay ninguno.
  if (et.tipeo && !lemas.some(Boolean) && ws.length >= 2) {
    const vv = vocabVerbos(et);
    ws.forEach((w, i) => { if (w.length >= 4 && !VACIAS.has(w)) { const r = corregirTipeo(w, vv); if (r && cuatroSeguro(w, r.palabra)) lemas[i] = { inf: r.clave, pronombres: [] }; } });
  }
  const seq = ws.map((w, i) => lemas[i]?.inf ?? w);
  let accion = null; let usado = -1; let pronombres = [];
  for (const [f, a, nivel] of FRASES) {
    if (nivel === 'sin' && !et.sinonimos) continue;
    for (let i = 0; i + f.length <= seq.length; i++) if (f.every((x, j) => seq[i + j] === x)) { accion = a; usado = i; break; }
    if (accion) break;
  }
  if (!accion) {
    let i = lemas.findIndex((l) => l && formas(et).infs[l.inf]);
    // perífrasis: «sigo mirando», «voy siguiendo» → el gerundio manda.
    if (i >= 0 && ['seguir', 'ir'].includes(lemas[i].inf) && lemas[i + 1] && /(ando|iendo|yendo)$/.test(ws[i + 1])) i += 1;
    if (i >= 0) { accion = formas(et).infs[lemas[i].inf]; usado = i; pronombres = lemas[i].pronombres; }
    else {
      // hacer caso / decir nada: solo con negación
      const aux = lemas.findIndex((l) => l && AUXILIARES.includes(l.inf));
      if (aux >= 0 && negada) { usado = aux; accion = lemas[aux].inf === 'decir' ? 'callar_neg' : lemas[aux].inf === 'hacer' && ws.includes('caso') ? 'ignorar' : null; }
    }
  }
  // Solo un sustantivo que nombra una cosa («lámpara», «la gata»): mirarla.
  if (!accion && !negada && et.defaults) {
    const cont = ws.filter((w) => !VACIAS.has(w));
    const n = cosasNombradas(ws, ctx, et);
    if (cont.length && n.length === 1 && n[0].tipo === 'foco' && cont.length === n[0].span.length && cont.every((w) => n[0].span.includes(ws.indexOf(w)))) return { accion: 'mirar', objetivo: n[0].id };
  }
  if (!accion) return { accion: 'no_entendido' };
  if (negada) {
    if (accion === 'callar_neg' || ((accion === 'hablar') && ws.includes('nada'))) return { accion: 'callar' };
    if (['seguir', 'mirar', 'escuchar', 'tocar', 'llamar'].includes(accion)) accion = 'ignorar';
    else if (accion === 'hablar') return { accion: 'callar' };
    else if (accion !== 'ignorar') return { accion: 'no_entendido' };
  }
  if (accion === 'callar_neg') return { accion: 'no_entendido' };
  const resto = ws.filter((_, i) => i !== usado);
  const sueltos = resto.filter((w) => !VACIAS.has(w) || PRON_F.has(w) || PRON_M.has(w) || PRON_NEUTRO.has(w));
  const nombradas = cosasNombradas(resto, ctx, et);
  const npcsN = nombradas.filter((c) => c.tipo === 'npc');
  const focosN = nombradas.filter((c) => c.tipo === 'foco');
  const r = { accion };
  if (modo) r.modo = modo;
  const presentes = ctx.presentes ?? [];
  const pronNpc = [...pronombres, ...ws].some((p) => PRON_NPC.has(p) && true);
  const npcElegido = () => {
    if (npcsN.length === 1) return npcsN[0].id;
    if (npcsN.length > 1) return { aclarar: npcsN.map((n) => n.id) };
    if (et.referencias && pronNpc && ctx.reciente?.npc) return ctx.reciente.npc;
    if (et.defaults && presentes.length === 1) return presentes[0];
    if (presentes.length > 1) return { aclarar: presentes };
    return null;
  };

  if (accion === 'viajar') {
    const d = resolverDestino(resto.join(' '), ctx.escenas ?? [], { exacto: !et.tipeo });
    const exactas = nombradas.filter((c) => !c.tipeo);
    if (d.estado === 'resuelto' && !exactas.length) return { ...r, lugar: d.destino };
    if (focosN.length === 1 && !npcsN.length) return { ...r, accion: 'seguir', objetivo: focosN[0].id };
    if (npcsN.length === 1) return { ...r, accion: 'seguir', objetivo: npcsN[0].id };
    if (d.estado === 'resuelto') return { ...r, lugar: d.destino };
    if (d.datos?.ids?.length) return { accion: 'aclarar', opciones: d.datos.ids };
    return { accion: 'no_entendido' };
  }
  if (accion === 'hablar' || accion === 'callar') {
    if (accion === 'callar') return r;
    const n = npcElegido();
    if (n && typeof n === 'object') return { accion: 'aclarar', opciones: n.aclarar, pregunta: TEXTOS_ACLARACION.npc };
    return n ? { ...r, npc: n } : { accion: 'aclarar', pregunta: TEXTOS_ACLARACION.npc };
  }
  if (accion === 'mostrar') {
    const n = npcsN.length === 1 ? npcsN[0].id : et.defaults && presentes.length === 1 ? presentes[0] : null;
    if (n) r.npc = n;
    const obj = focosN[0]?.id ?? (et.referencias ? resolverReferencia(pronombreEn(resto, pronombres) ?? 'eso', ctx.reciente, { genero: generoDe(ctx) }) : null);
    if (obj) r.objetivo = obj;
    const ajenas = resto.filter((w) => !VACIAS.has(w) && !PRON_F.has(w) && !PRON_M.has(w) && !nombradas.some((c) => c.alias.split(' ').includes(w)));
    return obj && !ajenas.length ? r : { accion: 'no_entendido' };
  }
  // Acciones sobre un foco (y preguntar, que lleva además un NPC).
  if (accion === 'preguntar') {
    const n = npcElegido();
    if (n && typeof n !== 'object') r.npc = n;
  }
  const focosValidos = accion === 'preguntar' ? focosN : nombradas.filter((c) => c.tipo === 'foco' || (accion !== 'tomar' && c.tipo === 'npc'));
  const ids = [...new Set(focosValidos.map((c) => c.id))];
  if (ids.length === 1) return { ...r, objetivo: ids[0] };
  if (ids.length > 1) {
    const mismaPalabra = new Set(focosValidos.map((c) => c.span.join())).size === 1;
    if (mismaPalabra && ctx.reciente?.foco && ids.includes(ctx.reciente.foco)) return { ...r, objetivo: ctx.reciente.foco };
    return { accion: 'aclarar', verbo: accion, opciones: ids, pregunta: preguntaAclaracion({ opciones: ids }, ctx) };
  }
  // Sin cosa nombrada: referencias (V4) y defaults (V5).
  if (et.referencias) {
    const pron = pronombreEn(resto, pronombres);
    if (pron && !(accion === 'preguntar' && pron === 'le')) {
      const ref = resolverReferencia(pron, ctx.reciente, { genero: generoDe(ctx) });
      if (ref) return { ...r, objetivo: ref };
      return { accion: 'aclarar', verbo: accion, pregunta: preguntaAclaracion({ verbo: accion }, ctx) };
    }
  }
  const quedan = sueltos.filter((w) => !PRON_NPC.has(w) && !(r.npc && ctx.npcs.find((n) => n.id === r.npc)?.palabras.includes(w)));
  if (quedan.length) return { accion: 'no_entendido' };
  if (et.defaults && ctx.reciente?.foco && accion !== 'preguntar') return { ...r, objetivo: ctx.reciente.foco };
  if (accion === 'escuchar' && !quedan.length) return r; // escuchar a secas: el ambiente
  return { accion: 'aclarar', verbo: accion, pregunta: preguntaAclaracion({ verbo: accion }, ctx) };
}
// «la/lo» son pronombre solo si no las sigue un sustantivo («mirá la» sí; «mirá la torre» no).
function pronombreEn(ws, pronombres) {
  if (pronombres.length) return pronombres.find((p) => PRON_F.has(p) || PRON_M.has(p) || PRON_NEUTRO.has(p)) ?? null;
  return ws.find((w, i) => PRON_NEUTRO.has(w) || ((PRON_F.has(w) || PRON_M.has(w)) && (i === ws.length - 1 || VACIAS.has(ws[i + 1])))) ?? null;
}
const generoDe = (ctx) => (id) => ctx.cosas.find((c) => c.id === id)?.genero ?? null;

/** Turnos que vive cada referencia (foco, objeto, NPC, lugar). */
export const VIDA_REFERENCIA = 5;
/** V4: memoria de referencia vigente en `turno` (las entradas viejas se olvidan). */
export function referenciasVigentes(memoria, turno, vida = VIDA_REFERENCIA) {
  const out = {};
  for (const [k, v] of Object.entries(memoria ?? {})) if (v && typeof v === 'object' && Number.isInteger(v.turno) && turno - v.turno <= vida) out[k] = v.id;
  return out;
}
/** V4: guarda en la memoria (con turno) lo que dejó una lectura. */
export function anotarReferencias(memoria, l, ctx, turno) {
  const m = { ...(memoria ?? {}) };
  const plano = recordar({}, l, ctx);
  for (const [k, id] of Object.entries(plano)) m[k] = { id, turno };
  return m;
}

/** Actualiza la memoria de referencia con lo leído. */
export function recordar(reciente, l, ctx) {
  const r = { ...(reciente ?? {}) };
  if (l.objetivo) { if (ctx.cosas.some((c) => c.id === l.objetivo && c.tipo === 'npc')) r.npc = l.objetivo; else r.foco = l.objetivo; }
  if (l.npc) r.npc = l.npc;
  if (l.lugar) r.lugar = l.lugar;
  return r;
}

/**
 * Lee la acción completa (con acciones encadenadas en `luego`).
 * @param {string} texto
 * @param {ReturnType<typeof contextoLectura>} ctx
 * @param {{ etapas?: object }} [o]
 */
// Bugs fase 7 (A4): charla directa. Saludo (+ nombre) → hablar; identidad/actividad/origen → preguntar_npc con tema;
// «qué dice X» / «leo X» → mirar X.
const SALUDOS_CHARLA = ['hola', 'holi', 'ola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'que tal', 'hey', 'saludos', 'como estas', 'como esta', 'como andas', 'como va', 'que onda', 'que hay'];
export const TEMAS_CHARLA = Object.freeze({
  identidad: /\b(quien (sos|eres|es usted|sos vos|eres tu)|como te (llamas|dicen)|cual es tu nombre|tu nombre)\b/,
  actividad: /\b(que (haces|hace usted|estas haciendo|anda haciendo|andas haciendo)|a que te dedicas|de que (trabajas|vivis)|en que (andas|estas)|que es lo que haces|cual es tu (trabajo|oficio))\b/,
  origen: /\b(de donde (sos|eres|venis|vienes|es usted)|sos de aca|eres de aqui)\b/,
});
const LEER = /^(que (dice|pone|hay escrito en)|lee|leo|leer|leeme|leele|leemos)\s+(.+)$/;

/** A4: lectura de charla directa; null si la frase no es de este tipo. */
export function leerCharla(texto, ctx) {
  // Letras estiradas al final («holaa», «buenass»).
  const n = normalizar(texto).replace(/\s+/g, ' ').trim().split(' ').map((w) => w.replace(/([a-z])\1{2,}/g, '$1')).map((w) => (w.length >= 5 ? w.replace(/([aeious])\1+$/, '$1') : w)).map((w) => ({ k: 'que', q: 'que', ke: 'que', kien: 'quien', qien: 'quien' })[w] ?? w).join(' ');
  if (!n) return null;
  const ws = n.split(' ');
  const npcDe = (palabras) => ctx.npcs.find((x) => palabras.some((w) => x.palabras.includes(w)) && (ctx.presentes ?? []).includes(x.id))?.id ?? null;
  const nombrado = npcDe(ws);
  const porDefecto = nombrado ?? (ctx.reciente?.npc && ctx.presentes?.includes(ctx.reciente.npc) ? ctx.reciente.npc : ctx.presentes?.[0] ?? null);
  // Saludo: solo fórmulas de saludo y, como mucho, el nombre (o el oficio) de un presente.
  const sinNombre = ws.filter((w) => !(nombrado && ctx.npcs.find((x) => x.id === nombrado).palabras.includes(w)) && !['che', 'senor', 'senora', 'don', 'dona', 'amigo', 'y', 'vos', 'usted', 'tu'].includes(w)).join(' ');
  let resto = ` ${sinNombre} `;
  for (let previo = null; previo !== resto;) { previo = resto; resto = [...SALUDOS_CHARLA].sort((a, b) => b.length - a.length).reduce((t, f) => t.replace(new RegExp(` ${f} `, 'g'), '  '), resto); }
  resto = resto.trim();
  if (sinNombre && !resto && porDefecto) return { accion: 'hablar', npc: porDefecto, saludo: true };
  for (const [tema, re] of Object.entries(TEMAS_CHARLA)) if (re.test(n) && porDefecto) return { accion: 'preguntar_npc', npc: porDefecto, tema };
  const m = n.match(LEER);
  if (m) {
    const cosa = vocabCosas(ctx);
    for (const w of m[3].split(' ')) for (const v of [w, `${w}s`, `${w}es`]) { const k = cosa.get(v); if (k && k !== '*' && k.startsWith('foco:')) return { accion: 'mirar', objetivo: k.slice(5) }; }
  }
  return null;
}

// B: muletillas que no son acción («a ver», «o sea») y «no le doy bola a X» = ignorar.
const MULETILLAS = new Set(['a ver', 'o sea', 'este', 'tipo', 'bueno', 'nada', 'ya', 'y', 'eh']);
export function leerAccion(texto, ctx, { etapas = ETAPAS } = {}) {
  const et = { ...ETAPAS, ...etapas };
  if (typeof texto === 'string') {
    const n0 = normalizar(texto).trim();
    if (MULETILLAS.has(n0)) return { accion: 'no_entendido' };
    texto = texto.replace(/\bno (le )?(doy|des|presto|prestes) (bola|bolilla|atenci[oó]n)( a)?\b/i, 'ignoro a');
    // «dejar» = ignorar solo con animal o persona («dejo la gata»); con un objeto no se lee así (soltar/dejar ahí).
    const d = normalizar(texto).match(/^(dejo|deja|deja|dejar|dejamos)( (en paz|tranquil[oa]s?))? (a )?(el |la |los |las |al )?(.+)$/);
    if (d) {
      const ws = d[6].split(' ');
      const c = ctx.cosas.find((x) => ws.includes(x.alias) || ws.some((w) => w.length > 3 && (`${w}` === `${x.alias}s` || w === x.alias.replace(/s$/, ''))));
      if (c && (c.tipo === 'npc' || c.clase === 'animal' || c.clase === 'persona')) texto = `ignoro a ${d[5] ?? ''}${d[6]}`;
    }
  }
  if (et.charla !== false && !ctx.pendiente) { const c = leerCharla(texto, ctx); if (c) return c; }
  if (et.defaults && ctx.pendiente) {
    const id = responderAclaracion(texto, ctx.pendiente, ctx);
    if (id) return { accion: ctx.pendiente.accion ?? 'seguir', objetivo: id };
  }
  const partes = et.varias ? separarAcciones(texto, et) : [texto];
  let reciente = ctx.reciente;
  let primera = null; let ultima = null;
  for (const p of partes) {
    const l = leerParte(p, { ...ctx, reciente }, et);
    if (l.accion === 'tomar' && l.objetivo && !ctx.cosas.some((c) => c.id === l.objetivo && c.tipo === 'npc')) l.accion = tomarOTocar(l.objetivo, ctx);
    reciente = recordar(reciente, l, ctx);
    if (!primera) primera = l; else ultima.luego = l;
    ultima = l;
  }
  return primera ?? { accion: 'no_entendido' };
}

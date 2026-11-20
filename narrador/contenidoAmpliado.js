// Contenido ampliado (data/contenido/ampliado/t*.json): se fusiona en memoria sobre contenido-v3.json, que no se toca.
// - "borrador": nunca se carga. "a_aprobar": solo con cargarPendientes. "a_aprobar_canon": además, incluirCanon.
// - Sin carpeta, vacía o sin nada cargable: null (v3 puro, salida idéntica).
// SIN VERIFICAR: carga en el navegador (no hay fetch de carpeta; producción no lo carga por defecto).

export const CLAVES_CONDICION = Object.freeze({
  f: ['madrugada', 'manana', 'tarde', 'noche'],
  cl: ['despejado', 'nublado', 'lluvia', 'niebla'],
  r: ['mala', 'neutra', 'buena'],
  ts: ['baja', 'alta'],
  rec: ['presionar', 'atacar', 'ayudar', 'negociar', 'emboscar', 'defender'],
  ant: ['reciente', 'lejano'],
  vis: ['1', '2', '3+'],
  rep: ['1', '2', '3+'],
  cat: ['ciudad', 'camino', 'otro'],
  fz: ['fuerte', 'difuso'],
  esc: null,
  npc: null,
  // extensiones (P14-P21)
  eco: null,
  efecto: null,
  ritmo: ['corto', 'largo'],
  estacion: ['primavera', 'verano', 'otono', 'invierno'],
  festividad: null,
  objetivoPaso: null,
  apodo: null,
});
export const PLACEHOLDERS_AMPLIADO = Object.freeze(['npc', 'objeto', 'lugar', 'conocimiento', 'nombres', 'eco', 'apodo']);
// Únicos que no se cargan hasta que el autor los apruebe (posible choque con la regla "sin magia").
export const UNICOS_BLOQUEADOS = Object.freeze(['u_niebla_voces']);
const SUFIJOS = new Set([...CLAVES_CONDICION.f, ...CLAVES_CONDICION.cl]);

const esObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sumar = (dst, k, v) => { dst[k] = [...(dst[k] ?? []), ...(Array.isArray(v) ? v : [v])]; };

/** ¿Se carga un archivo con este estado? */
export function seCarga(estado, { cargarPendientes = false, incluirCanon = false } = {}) {
  if (estado === 'aprobado') return true;
  if (estado === 'a_aprobar') return cargarPendientes;
  if (estado === 'a_aprobar_canon') return cargarPendientes && incluirCanon;
  return false;
}

function vacio() {
  return {
    tandas: [], guia: null, ambiente: {}, npcsRutina: {}, plantillas: {}, voces: {}, memoria: {}, genericas: {}, rumores: {},
    remateCiudad: {}, mensajeros: {}, reaccionNpc: {}, rumoresExtra: {}, charla: {}, eventos: {}, cierre: {}, simbolos: {},
    conocimientos: {}, temas: {}, unicos: [], reformulacion: {}, viaje: {}, objetos: {}, eco: {}, efectos: [], objetivos: {},
    diario: {}, apodos: null, silencio: { corto: {}, gesto: [] }, estaciones: {}, festividades: {},
  };
}

/**
 * Fusiona los archivos (ya parseados, en orden por nombre). Lanza si hay un id de conocimiento repetido.
 * @param {Array<[string, object]>} archivos [nombre, json]
 * @param {object} v3 contenido v3 (para ids de conocimiento existentes)
 */
export function fusionarAmpliado(archivos, v3, opciones = {}) {
  const a = vacio();
  const idsConocimiento = new Set((v3?.npcs ?? []).flatMap((n) => (n.conocimientos ?? []).map((k) => k.id)));
  for (const [nombre, d] of archivos) {
    if (!esObj(d)) continue;
    if (nombre.startsWith('t00')) { a.guia = d; continue; }
    if (nombre === 'valores.json') { a.valores = d.valores ?? d; continue; }
    if (!seCarga(d.estado, opciones)) continue;
    a.tandas.push(d.tanda ?? nombre);
    for (const [k, v] of Object.entries(d.ambiente ?? {})) sumar(a.ambiente, k, v.l ?? v);
    for (const [k, v] of Object.entries(d.npcs ?? {})) a.npcsRutina[k] = { rutina: [...(a.npcsRutina[k]?.rutina ?? []), ...(v.rutina ?? [])], gestos: [...(a.npcsRutina[k]?.gestos ?? []), ...(v.gestos ?? [])] };
    for (const [clave, bloque] of Object.entries(d.plantillas ?? {})) {
      a.plantillas[clave] ??= {};
      for (const [r, l] of Object.entries(bloque)) sumar(a.plantillas[clave], r, l);
    }
    for (const [n, v] of Object.entries(d.voces ?? {})) { a.voces[n] ??= {}; for (const [k, l] of Object.entries(v)) sumar(a.voces[n], k, l); }
    for (const [n, v] of Object.entries(d.memoria ?? {})) {
      a.memoria[n] ??= {};
      for (const [verbo, par] of Object.entries(v)) { a.memoria[n][verbo] ??= [[], []]; a.memoria[n][verbo][0].push(par[0]); a.memoria[n][verbo][1].push(par[1]); }
    }
    for (const [verbo, par] of Object.entries(d.genericas ?? {})) { a.genericas[verbo] ??= [[], []]; a.genericas[verbo][0].push(par[0]); a.genericas[verbo][1].push(par[1]); }
    for (const [verbo, fz] of Object.entries(d.rumores ?? {})) { a.rumores[verbo] ??= {}; for (const [k, l] of Object.entries(fz)) sumar(a.rumores[verbo], k, l); }
    for (const [k, l] of Object.entries(d.remate_ciudad ?? {})) sumar(a.remateCiudad, k, l);
    for (const [k, l] of Object.entries(d.mensajeros ?? {})) sumar(a.mensajeros, k, l);
    for (const [k, l] of Object.entries(d.reaccion_npc ?? {})) sumar(a.reaccionNpc, k, l);
    for (const [n, v] of Object.entries(d.charla ?? {})) sumar(a.charla, n, v.l ?? v);
    for (const [id, l] of Object.entries(d.eventos ?? {})) sumar(a.eventos, id, l);
    for (const [cat, l] of Object.entries(d.cierre ?? {})) sumar(a.cierre, cat, l);
    for (const [k, l] of Object.entries(d.simbolos ?? {})) sumar(a.simbolos, k, l);
    for (const [n, l] of Object.entries(d.conocimientos ?? {})) {
      for (const c of l) {
        if (idsConocimiento.has(c.id)) throw new Error(`contenido ampliado ${nombre}: id de conocimiento repetido ${c.id}`);
        idsConocimiento.add(c.id);
        sumar(a.conocimientos, n, c);
      }
    }
    for (const [n, t] of Object.entries(d.temas ?? {})) a.temas[n] = { ...(a.temas[n] ?? {}), ...t };
    for (const u of d.unicos ?? []) if (!UNICOS_BLOQUEADOS.includes(u.id)) a.unicos.push(u);
    for (const [n, l] of Object.entries(d.reformulacion ?? {})) sumar(a.reformulacion, n, l);
    for (const k of ['durante', 'llegada']) for (const [id, l] of Object.entries(d[k] ?? {})) { a.viaje[k] ??= {}; sumar(a.viaje[k], id, l); }
    if (d.encuentros) sumar(a.viaje, 'encuentros', d.encuentros);
    for (const [id, l] of Object.entries(d.objetos ?? {})) sumar(a.objetos, id, l);
    for (const [id, l] of Object.entries(d.eco ?? {})) sumar(a.eco, id, l);
    if (Array.isArray(d.efectos)) a.efectos.push(...d.efectos);
    for (const [n, o] of Object.entries(d.objetivos ?? {})) a.objetivos[n] = o;
    for (const k of ['entradas', 'otras', 'categorias']) if (d[k]) { a.diario[k] ??= {}; for (const [t, l] of Object.entries(d[k])) sumar(a.diario[k], t, l); }
    if (d.tabla && d.base) a.apodos = { base: d.base, tabla: d.tabla, usos: d.usos ?? [] };
    for (const [id, l] of Object.entries(d.corto ?? {})) sumar(a.silencio.corto, id, l);
    if (Array.isArray(d.gesto)) a.silencio.gesto.push(...d.gesto);
    for (const [s, e] of Object.entries(d.estaciones ?? {})) { a.estaciones[s] ??= {}; for (const [esc, l] of Object.entries(e)) sumar(a.estaciones[s], esc, l); }
    for (const [id, f] of Object.entries(d.festividades ?? {})) a.festividades[id] = f;
  }
  return a.tandas.length ? a : null;  // valores.json solo no basta para activar el ampliado
}

// ---- validación ----

function* textos(o, clave = '') {
  const SIN = new Set(['tanda', 'estado', 'nota', 'id', 'npc', 'escena', 'hecho', 'meta', 'ciudad', 'estacion', 'dias', 'duracionH', 'avanzaCadaH', 'prob', 'afinidad', 'umbralRelacion', 'requiereEvento', 'requiereMarca', 'palabrasClave', 'base']);
  if (typeof o === 'string') { if (!SIN.has(clave)) yield o; }
  else if (Array.isArray(o)) for (const x of o) yield* textos(x, clave);
  else if (esObj(o)) for (const [k, v] of Object.entries(o)) { if (k === 'c' || SIN.has(k)) continue; yield* textos(v, k); }
}
function* condiciones(o) {
  if (Array.isArray(o)) for (const x of o) yield* condiciones(x);
  else if (esObj(o)) for (const [k, v] of Object.entries(o)) { if (k === 'c' && esObj(v)) yield v; else yield* condiciones(v); }
}

/** ¿El símbolo #k# se resuelve con estos símbolos? (a.b, o a.b.<franja|clima>...) */
export function simboloResoluble(k, simbolos) {
  if (k in simbolos) return true;
  return Object.keys(simbolos).some((x) => x.startsWith(k + '.') && x.slice(k.length + 1).split('.').every((p) => SUFIJOS.has(p)));
}

/**
 * Valida los archivos ampliados (todos, cualquiera sea su estado). Devuelve la lista de errores.
 * @param {Array<[string, object]>} archivos
 */
export function validarAmpliado(archivos, v3) {
  const err = [];
  const escenas = new Set(v3.escenas.map((e) => e.id));
  const npcs = new Set(v3.npcs.map((n) => n.id));
  const eventos = new Set(v3.eventos.map((e) => e.id));
  const simbolos = {};
  for (const [, d] of archivos) for (const [k, l] of Object.entries(d?.simbolos ?? {})) sumar(simbolos, k, l);
  const ids = new Set(v3.npcs.flatMap((n) => (n.conocimientos ?? []).map((k) => k.id)));
  for (const [f, d] of archivos) {
    if (!esObj(d)) { err.push(`${f}: no es un objeto JSON`); continue; }
    for (const c of condiciones(d)) for (const [k, v] of Object.entries(c)) {
      if (!(k in CLAVES_CONDICION)) { err.push(`${f}: clave de condición desconocida "${k}"`); continue; }
      const vals = Array.isArray(v) ? v : [v];
      if (k === 'esc') vals.forEach((x) => !escenas.has(x) && err.push(`${f}: esc inexistente ${x}`));
      else if (k === 'npc') vals.forEach((x) => !npcs.has(x) && err.push(`${f}: npc inexistente ${x}`));
      else if (CLAVES_CONDICION[k]) vals.forEach((x) => !CLAVES_CONDICION[k].includes(String(x)) && err.push(`${f}: valor "${x}" fuera de dominio de ${k}`));
    }
    if (f.startsWith('t00')) continue;
    const lista = [...textos(Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'simbolos'))), ...Object.values(d.simbolos ?? {}).flat()];
    for (const t of lista) {
      if (typeof t !== 'string') continue;
      for (const m of t.matchAll(/\{(\w+)\}/g)) if (!PLACEHOLDERS_AMPLIADO.includes(m[1])) err.push(`${f}: placeholder {${m[1]}} no previsto`);
      for (const m of t.matchAll(/#([\w.]+)#/g)) if (!simboloResoluble(m[1], simbolos)) err.push(`${f}: símbolo #${m[1]}# sin definir`);
    }
    for (const k of Object.keys(d.ambiente ?? {})) if (!escenas.has(k)) err.push(`${f}: escena inexistente ${k}`);
    for (const campo of ['voces', 'charla', 'temas', 'conocimientos', 'objetivos', 'reformulacion', 'npcs']) for (const k of Object.keys(d[campo] ?? {})) if (!npcs.has(k)) err.push(`${f}: npc inexistente ${k} (${campo})`);
    for (const k of Object.keys(d.eventos ?? {})) if (!eventos.has(k)) err.push(`${f}: evento inexistente ${k}`);
    for (const l of Object.values(d.conocimientos ?? {})) for (const c of l) {
      if (ids.has(c.id)) err.push(`${f}: id de conocimiento repetido ${c.id}`);
      ids.add(c.id);
    }
  }
  return err;
}

/** Lee la carpeta en Node (orden por nombre). Sin carpeta: lista vacía. */
export async function leerArchivosAmpliado(dir) {
  const { readdir, readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const ruta = dir ?? fileURLToPath(new URL('../data/contenido/ampliado/', import.meta.url));
  let nombres;
  try { nombres = (await readdir(ruta)).filter((x) => /^t.*\.json$/.test(x) || x === 'valores.json').sort(); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const out = [];
  for (const n of nombres) out.push([n, JSON.parse(await readFile(`${ruta.replace(/\/?$/, '/')}${n}`, 'utf8'))]);
  return out;
}

/** Carga y fusiona en Node. `cargarPendientes` por defecto false (producción). */
export async function cargarAmpliadoNode({ dir, cargarPendientes = false, incluirCanon = false } = {}) {
  const { leerContenido } = await import('./cargarContenido.js');
  const v3 = await leerContenido();
  return fusionarAmpliado(await leerArchivosAmpliado(dir), v3, { cargarPendientes, incluirCanon });
}

#!/usr/bin/env node
// Verificador entre partes. Sin dependencias. Uso:
//   node tools/verificar-partes.mjs contenido        # contenido ampliado vs v3 y entre tandas
//   node tools/verificar-partes.mjs codigo           # contenido vs código (claves, placeholders)
//   node tools/verificar-partes.mjs regresion [--fijar-base]   # salida sin ampliado == base; determinismo
//   node tools/verificar-partes.mjs paso P4          # archivos + tests + contenido + regresión del paso
//   node tools/verificar-partes.mjs todo
// Sale con código 1 si hay errores. Escribe tools/reporte/verificacion.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const RAIZ = process.cwd();
const AMP = path.join(RAIZ, 'data/contenido/ampliado');
const V3 = path.join(RAIZ, 'data/contenido/contenido-v3.json');
const PLAN = path.join(RAIZ, 'tools/auto/PLAN.json');
const BASE = path.join(RAIZ, 'tools/auto/baseline.sha');
const errores = [], avisos = [];
const E = (c, m) => errores.push(`[${c}] ${m}`);
const W = (c, m) => avisos.push(`[${c}] ${m}`);
const leer = f => JSON.parse(fs.readFileSync(f, 'utf8'));

const VERBOS_HECHO = ['presionar', 'atacar', 'ayudar', 'negociar', 'emboscar', 'defender'];
const DOM = {
  f: ['madrugada', 'manana', 'tarde', 'noche'], cl: ['despejado', 'nublado', 'lluvia', 'niebla'],
  r: ['mala', 'neutra', 'buena'], ts: ['baja', 'alta'], ant: ['reciente', 'lejano'],
  vis: ['1', '2', '3+'], rep: ['1', '2', '3+'], cat: ['ciudad', 'camino', 'otro'], fz: ['fuerte', 'difuso'],
  rec: VERBOS_HECHO,
  // claves de extensiones (P14-P22); valores libres si no se listan
  eco: null, efecto: null, ritmo: ['corto', 'largo'], estacion: ['primavera', 'verano', 'otono', 'invierno'],
  festividad: null, objetivoPaso: null, apodo: null, esc: null, npc: null,
};
const PH = new Set(['npc', 'objeto', 'lugar', 'conocimiento', 'nombres', 'eco', 'apodo', 'foco']);
const ESTADOS = new Set(['borrador', 'a_aprobar', 'a_aprobar_canon', 'aprobado']);
const SIN_TEXTO = new Set(['tanda', 'estado', 'nota', 'id', 'npc', 'escena', 'hecho', 'meta', 'ciudad', 'estacion', 'dias', 'duracionH', 'avanzaCadaH', 'prob', 'afinidad', 'umbralRelacion', 'requiereEvento', 'requiereMarca', 'palabrasClave', 'base', 'clase', 'fin', 'emite']);

function cargar() {
  const v3 = leer(V3);
  const ctx = {
    v3,
    esc: new Set(v3.escenas.map(e => e.id)), npc: new Set(v3.npcs.map(n => n.id)),
    ev: new Set(v3.eventos.map(e => e.id)), obj: new Set((v3.objetos || []).map(o => o.id)),
    intenciones: new Set(v3.intenciones.map(i => String(i.id).replace('intencion_', ''))),
    marcas: new Set(), knowIds: new Set(), files: {},
  };
  for (const n of v3.npcs) for (const c of n.conocimientos || []) { ctx.knowIds.add(c.id); if (c.requiereMarca) ctx.marcas.add(c.requiereMarca); }
  if (fs.existsSync(AMP))
    for (const f of fs.readdirSync(AMP).filter(x => x.endsWith('.json') && x !== 'manifest.json').sort()) {
      try { ctx.files[f] = leer(path.join(AMP, f)); } catch (e) { E('json', `${f}: ${e.message}`); }
    }
  return ctx;
}

function* textos(o, clave = '') {
  if (typeof o === 'string') { if (!SIN_TEXTO.has(clave)) yield o; }
  else if (Array.isArray(o)) for (const x of o) yield* textos(x, clave);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'c' || SIN_TEXTO.has(k)) continue; yield* textos(v, k); }
}
function* condiciones(o) {
  if (Array.isArray(o)) for (const x of o) yield* condiciones(x);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
    if (k === 'c' && v && typeof v === 'object' && !Array.isArray(v)) yield v; else yield* condiciones(v);
  }
}

const SUF = new Set([...DOM.f, ...DOM.cl]);
function resuelve(k, sim) {
  if (k in sim) return true;
  // a.b se resuelve por a.b.<franja>[.<clima>] o a.b.<clima> (orden de P3)
  return Object.keys(sim).some(x => x.startsWith(k + '.') && x.slice(k.length + 1).split('.').every(p => SUF.has(p)));
}
function contenido(ctx) {
  const claves = new Set();
  const simbolos = {};
  for (const f of ['t01-gramatica.json', 't15-gramatica2.json']) if (ctx.files[f]) Object.assign(simbolos, ctx.files[f].simbolos, Object.fromEntries(Object.entries(simbolos).map(([k, v]) => [k, v])));
  // fusionar variantes repetidas entre t01 y t15
  const sim = {};
  for (const f of ['t01-gramatica.json', 't15-gramatica2.json']) if (ctx.files[f]) for (const [k, v] of Object.entries(ctx.files[f].simbolos)) sim[k] = (sim[k] || []).concat(v);
  let lineas = 0; const vistos = new Map();
  for (const [f, d] of Object.entries(ctx.files)) {
    if (!d.tanda || !ESTADOS.has(d.estado)) E('meta', `${f}: falta tanda o estado válido (${d.estado})`);
    // condiciones
    for (const c of condiciones(d)) for (const [k, v] of Object.entries(c)) {
      claves.add(k);
      if (!(k in DOM)) { E('cond', `${f}: clave de condición desconocida "${k}"`); continue; }
      const vals = Array.isArray(v) ? v : [v];
      if (k === 'esc') vals.forEach(x => !ctx.esc.has(x) && E('id', `${f}: esc inexistente ${x}`));
      else if (k === 'npc') vals.forEach(x => !ctx.npc.has(x) && E('id', `${f}: npc inexistente ${x}`));
      else if (DOM[k]) vals.forEach(x => !DOM[k].includes(String(x)) && E('cond', `${f}: valor "${x}" fuera de dominio de ${k}`));
    }
    // textos
    if (f === 't00-guia.json') continue;
    const lista = [...textos(Object.fromEntries(Object.entries(d).filter(([k]) => !['simbolos'].includes(k))))];
    const simTx = f.includes('gramatica') ? Object.values(d.simbolos).flat().filter(x => typeof x === 'string') : [];
    for (const t of [...lista, ...simTx]) {
      lineas++;
      if (!t.trim()) E('texto', `${f}: línea vacía`);
      if (t !== t.trim() || /  /.test(t)) W('texto', `${f}: espacios raros: "${t.slice(0, 40)}"`);
      if (t.length > 260) W('texto', `${f}: línea larga (${t.length}): "${t.slice(0, 40)}"`);
      if ((t.match(/«/g) || []).length !== (t.match(/»/g) || []).length) E('texto', `${f}: «» desbalanceadas: "${t.slice(0, 50)}"`);
      if ((t.match(/\{/g) || []).length !== (t.match(/\}/g) || []).length) E('texto', `${f}: {} desbalanceadas: "${t.slice(0, 50)}"`);
      for (const m of t.matchAll(/\{(\w+)\}/g)) if (!PH.has(m[1])) E('placeholder', `${f}: {${m[1]}} no previsto`);
      for (const m of t.matchAll(/#([\w.]+)#/g)) if (!resuelve(m[1], sim)) E('simbolo', `${f}: #${m[1]}# sin definir`);
      if (!f.includes('gramatica')) { const k = t.trim(); if (vistos.has(k) && vistos.get(k) !== f) W('dup', `texto repetido entre ${vistos.get(k)} y ${f}: "${k.slice(0, 40)}"`); vistos.set(k, f); }
    }
    // ids estructurales
    const esc = (o, tag) => Object.keys(o || {}).forEach(k => !ctx.esc.has(k) && E('id', `${f}: escena inexistente ${k} (${tag})`));
    const npc = (o, tag) => Object.keys(o || {}).forEach(k => !ctx.npc.has(k) && E('id', `${f}: npc inexistente ${k} (${tag})`));
    const ev = (o, tag) => Object.keys(o || {}).forEach(k => !ctx.ev.has(k) && E('id', `${f}: evento inexistente ${k} (${tag})`));
    esc(d.ambiente, 'ambiente'); npc(d.voces, 'voces'); npc(d.memoria && !d.memoria.genericas ? d.memoria : d.memoria, 'memoria');
    if (d.memoria) for (const [n, vs] of Object.entries(d.memoria)) { if (n === 'genericas') continue; for (const [v, pair] of Object.entries(vs)) { if (!VERBOS_HECHO.includes(v)) E('verbo', `${f}: memoria.${n}.${v} no es verbo de hecho`); if (!Array.isArray(pair) || pair.length < 2) E('memoria', `${f}: ${n}.${v} debe ser [reciente, lejano]`); } }
    npc(d.charla, 'charla'); npc(d.temas, 'temas'); npc(d.conocimientos, 'conocimientos'); npc(d.objetivos, 'objetivos'); npc(d.reformulacion, 'reformulacion');
    if (d.eventos) ev(d.eventos, 'eventos');
    for (const k of ['t07-rumores.json', 't18-memoria-rumores2.json']) if (f === k && d.rumores) Object.keys(d.rumores).forEach(v => !VERBOS_HECHO.includes(v) && E('verbo', `${f}: rumores.${v}`));
    if (d.estaciones) for (const [s, e] of Object.entries(d.estaciones)) { if (!DOM.estacion.includes(s)) E('cond', `${f}: estación ${s}`); esc(e, 'estaciones.' + s); }
    if (d.efectos) { const ids = new Set(); for (const e of d.efectos) { if (ids.has(e.id)) E('dup', `${f}: efecto repetido ${e.id}`); ids.add(e.id); if (!ctx.npc.has(e.npc)) E('id', `${f}: efecto npc ${e.npc}`); if (!ctx.esc.has(e.escena)) E('id', `${f}: efecto escena ${e.escena}`); if (!VERBOS_HECHO.includes(e.hecho)) E('verbo', `${f}: efecto ${e.id} usa hecho "${e.hecho}" que no se registra`); } }
    if (d.objetivos) { const ids = new Set(); for (const [n, o] of Object.entries(d.objetivos)) { if (ids.has(o.id)) E('dup', `${f}: objetivo repetido ${o.id}`); ids.add(o.id); for (const v of Object.keys(o.afinidad || {})) if (!VERBOS_HECHO.includes(v) && !ctx.intenciones.has(v)) E('verbo', `${f}: afinidad ${n}.${v} desconocido`); if (!Array.isArray(o.pasos) || !o.pasos.length) E('objetivo', `${f}: ${n} sin pasos`); } }
    if (d.conocimientos) for (const [n, l] of Object.entries(d.conocimientos)) for (const c of l) {
      if (ctx.knowIds.has(c.id)) E('dup', `${f}: id de conocimiento repetido ${c.id}`); ctx.knowIds.add(c.id);
      if (c.requiereEvento && !ctx.ev.has(c.requiereEvento)) E('id', `${f}: ${c.id} requiere evento inexistente ${c.requiereEvento}`);
      if (c.requiereMarca && !ctx.marcas.has(c.requiereMarca)) E('id', `${f}: ${c.id} marca desconocida ${c.requiereMarca}`);
      if (!c.revelar?.length || !c.pista?.length || !c.palabrasClave?.length) E('conocimiento', `${f}: ${c.id} incompleto`);
      if (!(c.umbralRelacion >= 0 && c.umbralRelacion <= 100)) E('conocimiento', `${f}: ${c.id} umbral fuera de rango`);
    }
  }
  // gramática: ciclos y profundidad
  const hijos = k => [...new Set((sim[k] || []).flatMap(t => [...String(t).matchAll(/#([\w.]+)#/g)].map(m => m[1])))];
  const prof = (k, pila = []) => { if (pila.includes(k)) { E('simbolo', `ciclo: ${[...pila, k].join(' > ')}`); return 0; } let m = 0; for (const h of hijos(k)) if (h in sim) m = Math.max(m, 1 + prof(h, [...pila, k])); return m; };
  for (const k of Object.keys(sim)) if (prof(k) > 5) E('simbolo', `${k}: profundidad > 5`);
  // cobertura
  const cob = (f, key, esperado, etiqueta) => { const d = ctx.files[f]; if (!d) return; const h = new Set(Object.keys(d[key] || {})); for (const x of esperado) if (!h.has(x)) W('cobertura', `${f}: falta ${etiqueta} ${x}`); };
  cob('t02-ambiente.json', 'ambiente', ctx.esc, 'escena'); cob('t13-ambiente2.json', 'ambiente', ctx.esc, 'escena');
  cob('t05-voces.json', 'voces', ctx.npc, 'npc'); cob('t17-charla.json', 'charla', ctx.npc, 'npc'); cob('t16-conocimientos.json', 'conocimientos', ctx.npc, 'npc');
  cob('t16-conocimientos.json', 'temas', ctx.npc, 'npc'); cob('t22-objetivos.json', 'objetivos', ctx.npc, 'npc'); cob('t26-reformulacion2.json', 'reformulacion', ctx.npc, 'npc');
  cob('t09-eventos.json', 'eventos', ctx.ev, 'evento'); cob('t19-eventos2.json', 'eventos', ctx.ev, 'evento');
  return { lineas, claves: [...claves] };
}

function codigo(ctx, claves) {
  const dir = path.join(RAIZ, 'narrador');
  const src = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.includes('test')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') : '';
  const plan = fs.existsSync(PLAN) ? leer(PLAN) : { pasos: [] };
  const hechos = new Set(plan.pasos.filter(p => p.estado === 'hecho').map(p => p.id));
  const exige = { seleccion: 'P2', gramatica: 'P3' };
  if (hechos.has('P2')) for (const k of claves) if (!new RegExp(`\\b${k}\\b`).test(src)) E('codigo', `la condición "${k}" se usa en contenido pero ningún narrador/*.js la menciona`);
  if (hechos.has('P3')) for (const f of ['gramatica.js']) if (!fs.existsSync(path.join(dir, f))) E('codigo', `falta narrador/${f}`);
  for (const [ph, paso] of [['eco', 'P14'], ['apodo', 'P18']]) if (hechos.has(paso) && !src.includes('{' + ph + '}') && !new RegExp(ph).test(src)) E('codigo', `placeholder {${ph}} del contenido sin soporte en código (${paso})`);
  if (!hechos.size) W('codigo', 'ningún paso hecho todavía: sin verificación código↔contenido');
}

function sha(dirTxt) { return crypto.createHash('sha256').update(dirTxt).digest('hex'); }
function simular(extra = []) {
  if (!fs.existsSync(path.join(RAIZ, 'tools/simular.js'))) return null;
  return execFileSync('node', ['tools/simular.js', '--semilla', '1', '--partidas', '20', '--turnos', '30', '--salida', 'stdout', ...extra], { encoding: 'utf8', maxBuffer: 1 << 28 });
}
function regresion(fijar) {
  const a = simular(['--sin-ampliado']);
  if (a === null) { W('regresion', 'tools/simular.js no existe todavía (P1): sin regresión'); return; }
  const b = simular(['--sin-ampliado']);
  if (sha(a) !== sha(b)) E('determinismo', 'misma semilla produce salidas distintas');
  if (fijar || !fs.existsSync(BASE)) { fs.writeFileSync(BASE, sha(a) + '\n'); W('regresion', 'base fijada: ' + sha(a).slice(0, 12)); return; }
  if (fs.readFileSync(BASE, 'utf8').trim() !== sha(a)) E('regresion', 'la salida SIN ampliado cambió respecto de la base (retrocompatibilidad rota). Si el cambio es el objetivo del paso, declarar "cambiaConducta":true en PLAN.json y fijar base nueva con --fijar-base.');
  const c = simular([]);
  if (c !== null && /\b(undefined|NaN|\[object Object\])\b/.test(c)) E('salida', 'la simulación con ampliado emite undefined/NaN/[object Object]');
  if (c !== null && /[{}#]/.test(JSON.parse(c).textos?.join?.('\n') || '')) E('salida', 'quedan {, } o # sin expandir en textos simulados');
}

function paso(id) {
  const plan = leer(PLAN); const p = plan.pasos.find(x => x.id === id);
  if (!p) return E('paso', `${id} no existe en PLAN.json`);
  for (const f of p.archivos || []) if (!fs.existsSync(path.join(RAIZ, f))) E('paso', `${id}: falta ${f}`);
  for (const t of p.tests || []) { if (!fs.existsSync(path.join(RAIZ, t))) { E('paso', `${id}: falta test ${t}`); continue; } try { execFileSync('node', ['--test', t], { stdio: 'pipe' }); } catch (e) { E('test', `${id}: falla ${t}\n${String(e.stdout || '').split('\n').filter(l => /not ok|# fail|Error/.test(l)).slice(0, 8).join('\n')}`); } }
  try { execFileSync('npm', ['test'], { stdio: 'pipe' }); } catch (e) { E('test', `${id}: npm test falla\n${String(e.stdout || '').split('\n').filter(l => /not ok|# fail/.test(l)).slice(0, 8).join('\n')}`); }
}

const [modo = 'todo', arg, ...resto] = process.argv.slice(2);
const ctx = cargar();
let info = {};
if (['contenido', 'todo', 'paso'].includes(modo)) info = contenido(ctx);
if (['codigo', 'todo', 'paso'].includes(modo)) codigo(ctx, info.claves || [...new Set([...Object.keys(DOM)])]);
if (['regresion', 'todo', 'paso'].includes(modo)) regresion(arg === '--fijar-base' || resto.includes('--fijar-base'));
if (modo === 'paso') paso(arg);
fs.mkdirSync(path.join(RAIZ, 'tools/reporte'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'tools/reporte/verificacion.json'), JSON.stringify({ modo, paso: modo === 'paso' ? arg : null, lineas: info.lineas, errores, avisos }, null, 1));
console.log(`verificación ${modo}${modo === 'paso' ? ' ' + arg : ''}: ${errores.length} errores, ${avisos.length} avisos${info.lineas ? `, ${info.lineas} líneas` : ''}`);
errores.slice(0, 15).forEach(x => console.log('ERROR ' + x));
avisos.slice(0, 5).forEach(x => console.log('aviso ' + x));
process.exit(errores.length ? 1 : 0);

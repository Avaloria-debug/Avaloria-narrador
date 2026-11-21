#!/usr/bin/env node
// Verificador de compuerta de la fase 5 (IA local). Sin dependencias.
// Uso: node tools/verificar-ialocal.mjs <contenido|codigo|version|regresion|paso Rn|produccion> [--plan ruta]
// Reutiliza los verificadores existentes: tools/verificar-partes.mjs y tools/verificar-produccion.mjs.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const modo = args[0];
const pi = args.indexOf('--plan');
const PLAN = pi >= 0 ? args[pi + 1] : 'tools/auto5/PLAN.json';
const ESTADOS = ['pendiente', 'hecho', 'bloqueado', 'omitido'];
const APROB = [null, 'a_aprobar', 'aprobado'];
const MALO = /undefined|\bNaN\b|\[object|\{\}|\{\{/;
const DIRS_CODIGO = ['narrador/iaLocal'];
const ARCHIVOS_CODIGO = ['narrador/prueba/iaLocalPagina.js', 'narrador/prueba/bench-ia.js'];
const PERMITE_IMPORT_HTTPS = ['narrador/iaLocal/motor.js', 'narrador/prueba/bench-ia.js'];
const errs = [];
const avisos = [];
const err = (m) => errs.push(m);

function cargarPlan() {
  try {
    const p = JSON.parse(readFileSync(PLAN, 'utf8'));
    if (!Array.isArray(p.pasos)) throw new Error('falta "pasos"');
    return p.pasos;
  } catch (e) {
    err(`PLAN ilegible: ${e.message}`);
    return [];
  }
}

function contenido() {
  const pasos = cargarPlan();
  const ids = new Set();
  for (const p of pasos) {
    if (!/^R\d+$/.test(p.id ?? '')) err(`id inválido: ${p.id}`);
    if (ids.has(p.id)) err(`id duplicado: ${p.id}`);
    ids.add(p.id);
    if (!ESTADOS.includes(p.estado)) err(`${p.id}: estado inválido (${p.estado})`);
    if (!APROB.includes(p.aprobacion ?? null)) err(`${p.id}: aprobacion inválida`);
    for (const k of ['depende', 'archivos', 'tests']) if (!Array.isArray(p[k])) err(`${p.id}: falta ${k}[]`);
    if (typeof p.cambiaConducta !== 'boolean') err(`${p.id}: cambiaConducta debe ser boolean`);
  }
  for (const p of pasos) {
    for (const d of p.depende ?? []) if (!ids.has(d)) err(`${p.id}: depende de inexistente ${d}`);
  }
  const mapa = new Map(pasos.map((p) => [p.id, p.depende ?? []]));
  const color = new Map();
  const visita = (id, ruta) => {
    if (color.get(id) === 2) return;
    if (color.get(id) === 1) { err(`ciclo: ${[...ruta, id].join(' -> ')}`); return; }
    color.set(id, 1);
    for (const d of mapa.get(id) ?? []) if (mapa.has(d)) visita(d, [...ruta, id]);
    color.set(id, 2);
  };
  for (const id of mapa.keys()) visita(id, []);
  if (!existsSync('docs/pasos5/R0.md')) err('falta docs/pasos5/R0.md');
  for (const p of pasos) {
    const f = `docs/pasos5/${p.id}.md`;
    if (!existsSync(f)) { err(`falta ${f}`); continue; }
    const b = statSync(f).size;
    if (b < 500 || b > 900) err(`${f}: ${b} bytes (debe estar entre 500 y 900)`);
    if (p.estado === 'hecho') {
      for (const a of p.archivos ?? []) if (!existsSync(a)) err(`${p.id}: hecho pero falta ${a}`);
    }
  }
  if (existsSync('tools/auto5/AUTO5.md')) {
    const l = readFileSync('tools/auto5/AUTO5.md', 'utf8').trimEnd().split('\n').length;
    if (l > 45) err(`AUTO5.md tiene ${l} líneas (máx 40)`);
  }
  return pasos;
}

function recorrer(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    statSync(f).isDirectory() ? recorrer(f, out) : out.push(f);
  }
  return out;
}

function valoresString(x, fn) {
  if (typeof x === 'string') fn(x);
  else if (Array.isArray(x)) x.forEach((v) => valoresString(v, fn));
  else if (x && typeof x === 'object') Object.values(x).forEach((v) => valoresString(v, fn));
}

function codigo() {
  const archivos = [...DIRS_CODIGO.flatMap((d) => recorrer(d)), ...ARCHIVOS_CODIGO.filter((f) => existsSync(f))];
  let total = 0;
  for (const f of archivos) {
    const b = statSync(f).size;
    total += b;
    const ext = extname(f);
    if (ext === '.js' || ext === '.mjs') {
      const t = readFileSync(f, 'utf8');
      for (const m of t.matchAll(/^\s*(?:import|export)\s[^'"\n]*?from\s+['"]([^'"]+)['"]/gm)) {
        if (!/^(\.|node:)/.test(m[1])) err(`${f}: import no permitido (${m[1]})`);
      }
      for (const m of t.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) {
        if (!/^(\.|node:)/.test(m[1])) err(`${f}: import no permitido (${m[1]})`);
      }
      for (const m of t.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) err(`${f}: require no permitido (${m[1]})`);
      if (/\bimport\(\s*[`'"]https?:/.test(t) && !PERMITE_IMPORT_HTTPS.includes(f)) err(`${f}: import() https solo en ${PERMITE_IMPORT_HTTPS.join(' y ')}`);
    }
    if (ext === '.json') {
      try {
        const j = JSON.parse(readFileSync(f, 'utf8'));
        valoresString(j, (s) => { if (MALO.test(s)) err(`${f}: valor sospechoso "${s.slice(0, 40)}"`); });
      } catch (e) { err(`${f}: JSON inválido (${e.message})`); }
    }
  }
  for (const f of recorrer('narrador')) {
    if (statSync(f).size > 5 * 1024 * 1024) err(`${f}: más de 5 MB (¿pesos en el repo?)`);
  }
  if (total > 150 * 1024) err(`código de IA local pesa ${total} bytes (máx 153600)`);
}

function sh(cmd, argv) {
  return spawnSync(cmd, argv, { encoding: 'utf8' });
}

function versionDe(texto) {
  const m = texto.match(/VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'/);
  return m ? m.slice(1).map(Number) : null;
}

function version() {
  if (!existsSync('narrador/version.js')) { err('falta narrador/version.js'); return; }
  const actual = versionDe(readFileSync('narrador/version.js', 'utf8'));
  if (!actual) { err('VERSION ilegible en narrador/version.js'); return; }
  const txt = actual.join('.');
  if (existsSync('narrador/prueba/index.html') && !readFileSync('narrador/prueba/index.html', 'utf8').includes(`v${txt}`)) {
    err(`narrador/prueba/index.html no muestra v${txt}`);
  }
  const st = sh('git', ['status', '--porcelain']);
  if (st.status !== 0) { avisos.push('git no disponible: sin comprobar el aumento de versión'); return; }
  const tocados = st.stdout.split('\n').map((l) => l.slice(3).trim()).filter(Boolean)
    .filter((f) => f.startsWith('narrador/') && f !== 'narrador/version.js' && f !== 'narrador/prueba/index.html');
  const paginaTocada = st.stdout.split('\n').some((l) => l.slice(3).trim() === 'narrador/prueba/index.html');
  if (tocados.length === 0 && !paginaTocada) return;
  const base = sh('git', ['show', 'HEAD:narrador/version.js']);
  if (base.status !== 0) { avisos.push('sin versión en HEAD: sin comprobar el aumento'); return; }
  const prev = versionDe(base.stdout);
  const sube = prev && (actual[0] > prev[0] || actual[1] > prev[1] || actual[2] > prev[2]);
  if (!sube) err(`narrador/ cambió pero VERSION sigue en ${txt} (suma 0.0.1)`);
}

function regresion() {
  const r = sh('node', ['tools/verificar-partes.mjs', 'regresion']);
  if (r.status !== 0) err(`regresión: ${(r.stdout + r.stderr).trim().split('\n').slice(-6).join(' | ')}`);
}

function correrTest(f) {
  if (!existsSync(f)) { err(`falta test ${f}`); return; }
  const r = sh('node', ['--test', f]);
  if (r.status !== 0) {
    const lineas = `${r.stdout}${r.stderr}`.split('\n').filter((l) => /not ok|# fail|Error/.test(l)).slice(0, 8);
    err(`test falla: ${f}\n${lineas.join('\n')}`);
  }
}

function paso(id) {
  const pasos = contenido();
  const p = pasos.find((x) => x.id === id);
  if (!p) { err(`paso inexistente: ${id}`); return; }
  for (const d of p.depende) {
    const dp = pasos.find((x) => x.id === d);
    if (dp && dp.estado !== 'hecho') err(`${id}: dependencia ${d} no está hecha`);
  }
  for (const a of p.archivos) if (!existsSync(a)) err(`${id}: falta ${a}`);
  codigo();
  for (const t of p.tests) correrTest(t);
  if (p.cambiaConducta) { regresion(); version(); }
}

function produccion() {
  const pasos = contenido();
  codigo();
  version();
  regresion();
  for (const [cmd, a] of [['tools/verificar-partes.mjs', 'todo'], ['tools/verificar-produccion.mjs', 'todo']]) {
    const r = sh('node', [cmd, a]);
    if (r.status !== 0) err(`${cmd} ${a}: ${(r.stdout + r.stderr).trim().split('\n').slice(-5).join(' | ')}`);
  }
  for (const p of pasos) {
    if (p.estado === 'pendiente') err(`${p.id}: sigue pendiente`);
    if (p.aprobacion === 'a_aprobar') avisos.push(`${p.id}: A APROBAR`);
    if (p.estado === 'bloqueado' || p.estado === 'omitido') avisos.push(`${p.id}: ${p.estado}`);
  }
}

switch (modo) {
  case 'contenido': contenido(); break;
  case 'codigo': codigo(); break;
  case 'version': version(); break;
  case 'regresion': regresion(); break;
  case 'paso': paso(args[1]); break;
  case 'produccion': produccion(); break;
  default: err('modo inválido: contenido|codigo|version|regresion|paso Rn|produccion');
}

for (const a of avisos) console.log(`aviso: ${a}`);
if (errs.length) {
  for (const e of errs) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log(`OK ${modo}${modo === 'paso' ? ' ' + args[1] : ''}`);

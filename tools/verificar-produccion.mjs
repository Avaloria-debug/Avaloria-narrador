#!/usr/bin/env node
// Verificador de la fase 2 (producción). Sin dependencias. Uso: node tools/verificar-produccion.mjs [valores|calendario|manifest|entrada|tamano|todo]
// Si el código lee otro formato de calendario/valores, ajustar ESTE archivo con diff mínimo (no el dato).
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(), A = path.join(R, 'data/contenido/ampliado');
const errores = [], avisos = []; const E = m => errores.push(m), W = m => avisos.push(m);
const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const v3 = J(path.join(R, 'data/contenido/contenido-v3.json'));
const npcs = new Set(v3.npcs.map(n => n.id));
const modo = process.argv[2] || 'todo'; const on = m => modo === 'todo' || modo === m;
if (on('valores')) {
  const f = path.join(A, 'valores.json');
  if (!fs.existsSync(f)) E('falta valores.json'); else {
    const v = J(f).valores || {}; const K = ['orden', 'dinero', 'curiosidad', 'miedo', 'lealtad'];
    for (const n of npcs) if (!v[n]) E(`valores: falta ${n}`);
    for (const [n, o] of Object.entries(v)) { if (!npcs.has(n)) E(`valores: npc inexistente ${n}`); for (const k of K) if (!Number.isInteger(o[k]) || o[k] < -2 || o[k] > 2) E(`valores: ${n}.${k} fuera de -2..2`); for (const k of Object.keys(o)) if (!K.includes(k)) E(`valores: clave ${k} desconocida`); }
  }
}
if (on('calendario')) {
  const f = path.join(A, 'calendario.json');
  if (!fs.existsSync(f)) E('falta calendario.json'); else {
    const c = J(f); const t27 = fs.existsSync(path.join(A, 't27-calendario.json')) ? J(path.join(A, 't27-calendario.json')).festividades : {};
    const ids = new Set();
    for (const x of c.festividades || []) {
      if (ids.has(x.id)) E(`calendario: id repetido ${x.id}`); ids.add(x.id);
      if (!t27[x.id]) E(`calendario: ${x.id} sin texto en t27`);
      if (!(x.dia >= 1 && x.dia + x.dias - 1 <= c.anio_dias)) E(`calendario: ${x.id} fuera del año`);
      if (t27[x.id]) { const [a, b] = c.rangos[t27[x.id].estacion] || []; if (!(x.dia >= a && x.dia <= b)) E(`calendario: ${x.id} (${x.dia}) fuera de su estación ${t27[x.id].estacion}`); if (t27[x.id].ciudad !== x.ciudad) E(`calendario: ${x.id} ciudad distinta de t27`); if (t27[x.id].dias !== x.dias) W(`calendario: ${x.id} duración distinta de t27`); }
    }
    for (const k of Object.keys(t27)) if (!ids.has(k)) E(`calendario: t27 tiene ${k} sin fecha`);
    const r = Object.values(c.rangos || {}); if (r.length !== 4 || r[3][1] !== c.anio_dias) E('calendario: estaciones no cubren el año');
  }
}
if (on('manifest')) {
  const f = path.join(A, 'manifest.json');
  if (!fs.existsSync(f)) E('falta manifest.json (tools/generar-manifest.js)'); else {
    const m = J(f).archivos || []; const disco = fs.readdirSync(A).filter(x => x.endsWith('.json') && x !== 'manifest.json').sort();
    const enM = m.map(x => x.f).sort();
    for (const x of disco) if (!enM.includes(x)) E(`manifest: falta ${x}`);
    for (const x of enM) if (!disco.includes(x)) E(`manifest: ${x} no existe en disco`);
    for (const x of m) { const e = J(path.join(A, x.f)).estado; if (e !== x.estado) E(`manifest: estado de ${x.f} desactualizado (${x.estado} vs ${e})`); }
  }
}
if (on('entrada')) {
  const cand = ['index.html', 'ui', 'narrador/prueba', 'core', 'src'].map(p => path.join(R, p)).filter(fs.existsSync);
  const hay = p => fs.statSync(p).isDirectory() ? fs.readdirSync(p).some(x => hay(path.join(p, x))) : /\.(js|mjs|html)$/.test(p) && /ampliado/.test(fs.readFileSync(p, 'utf8')) && !/verificar|\.test\./.test(p);
  if (!cand.some(hay)) E('el punto de entrada real (ui/, index.html) no activa `ampliado`');
}
if (on('tamano')) {
  const t = fs.readdirSync(A).reduce((s, x) => s + fs.statSync(path.join(A, x)).size, 0);
  if (t > 3_000_000) E(`ampliado pesa ${t} bytes (>3 MB)`); else if (t > 1_500_000) W(`ampliado pesa ${t} bytes`);
}
console.log(`produccion ${modo}: ${errores.length} errores, ${avisos.length} avisos`);
errores.slice(0, 15).forEach(x => console.log('ERROR ' + x)); avisos.slice(0, 5).forEach(x => console.log('aviso ' + x));
process.exit(errores.length ? 1 : 0);

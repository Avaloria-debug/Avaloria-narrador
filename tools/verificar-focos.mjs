#!/usr/bin/env node
// Verificador de focos (fase 3). Sin dependencias. node tools/verificar-focos.mjs [estatico|cobertura|todo]
// cobertura: menciones animal.* sin foco con alias que las capture (aviso). sonido/olor/luz/gente se cubren por clase (S2: foco generado desde el símbolo).
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(), A = path.join(R, 'data/contenido/ampliado');
const errores = [], avisos = []; const E = m => errores.push(m), W = m => avisos.push(m);
const J = f => JSON.parse(fs.readFileSync(path.join(A, f), 'utf8'));
const v3 = JSON.parse(fs.readFileSync(path.join(R, 'data/contenido/contenido-v3.json'), 'utf8'));
const npcs = new Set(v3.npcs.map(n => n.id)), escs = new Set(v3.escenas.map(e => e.id));
const modo = process.argv[2] || 'todo';
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const files = fs.readdirSync(A).filter(f => /^t3\d-.*focos.*\.json$/.test(f) || f === 't30-focos.json');
if (!files.length) { E('no hay tandas de focos (t30-focos.json)'); }
const F = {}, C = {}, FIJ = {}, INT = {}; let NV = [];
for (const f of files) { const d = J(f); Object.assign(F, d.focos || {}); Object.assign(C, d.clases || {}); Object.assign(FIJ, d.fijos || {}); Object.assign(INT, d.interrupcion || {}); NV = NV.concat(d.no_visto || []); }
const VERBOS = ['seguir', 'mirar', 'llamar', 'tocar', 'escuchar', 'preguntar', 'ignorar'];
const PH = /\{(\w+)\}/g;
const txt = (t, ctx) => { if (typeof t !== 'string' || !t.trim()) E(`${ctx}: texto vacío`); else { if ((t.match(/«/g) || []).length !== (t.match(/»/g) || []).length) E(`${ctx}: «» desbalanceadas`); for (const m of t.matchAll(PH)) if (!['npc', 'lugar', 'objeto', 'foco'].includes(m[1])) E(`${ctx}: {${m[1]}} no previsto`); } };
// Alias bloqueados (se quitan al cargar) y stopwords: palabras funcionales o verbos comunes no pueden ser alias.
const BLOQ = new Set(JSON.parse(fs.readFileSync(path.join(R, 'data/config/alias-bloqueados.json'), 'utf8')).bloqueados.map(norm));
const STOPWORDS = new Set(['sobre', 'bajo', 'entre', 'desde', 'hacia', 'hasta', 'para', 'por', 'con', 'sin', 'como', 'cuando', 'donde', 'pero', 'que', 'quien', 'cual', 'este', 'esta', 'eso', 'esto', 'aquel', 'algo', 'nada', 'todo', 'otro', 'otra', 'mismo', 'cada', 'poco', 'mucho', 'mas', 'menos', 'muy', 'bien', 'mal', 'aqui', 'ahi', 'alli', 'aca', 'alla', 'luego', 'antes', 'despues', 'ahora', 'siempre', 'nunca', 'tambien', 'solo', 'casi', 'lado', 'parte', 'vez', 'cosa', 'cosas', 'gente', 'alguien', 'nadie', 'ser', 'estar', 'haber', 'tener', 'hacer', 'ir', 'ver', 'dar', 'decir', 'poder', 'saber', 'querer', 'llegar', 'pasar', 'deber', 'poner', 'parecer', 'quedar', 'creer', 'hablar', 'llevar', 'dejar', 'seguir', 'encontrar', 'llamar', 'venir', 'pensar', 'salir', 'volver', 'tomar', 'conocer', 'vivir', 'sentir', 'tratar', 'mirar', 'contar', 'empezar', 'esperar', 'buscar', 'existir', 'entrar', 'trabajar', 'escribir', 'perder', 'entender', 'pedir', 'recibir', 'recordar', 'terminar', 'tocar', 'escuchar', 'saco', 'cola', 'registro', 'apunte', 'vecinos', 'grupo', 'bulto', 'hoja']);
if (modo === 'estatico' || modo === 'todo') {
  const aliasEnClase = {};
  for (const [id, f] of Object.entries(F)) for (const a of f.alias || []) { const k = norm(a); if (!BLOQ.has(k) && k.split(' ').length === 1 && STOPWORDS.has(k)) E(`foco ${id}: alias "${a}" es palabra funcional o verbo común (bloquearlo o cambiarlo)`); }
  for (const [id, f] of Object.entries(F)) {
    if (!C[f.clase]) E(`foco ${id}: clase ${f.clase} inexistente`);
    if (!Array.isArray(f.alias) || !f.alias.length) E(`foco ${id}: sin alias`);
    if (!(f.dura >= 1 && f.dura <= 10)) E(`foco ${id}: dura fuera de 1..10`);
    for (const a of f.alias || []) { const k = norm(a); (aliasEnClase[k] ||= new Set()).add(id); }
    for (const e of f.escenas || []) if (!escs.has(e)) E(`foco ${id}: escena inexistente ${e}`);
    if (!f.ramas?.seguir && !f.ramas?.mirar) E(`foco ${id}: necesita al menos seguir o mirar`);
    for (const [v, pasos] of Object.entries(f.ramas || {})) {
      if (!VERBOS.includes(v)) E(`foco ${id}: verbo ${v} desconocido`);
      if (!Array.isArray(pasos) || !pasos.length) E(`foco ${id}.${v}: vacío`);
      if (pasos.length > 4) E(`foco ${id}.${v}: más de 4 pasos`);
      pasos.forEach((p, i) => {
        const o = typeof p === 'string' ? { t: p } : p; txt(o.t, `foco ${id}.${v}[${i}]`);
        if (o.fin && !['nada', 'hallazgo'].includes(o.fin)) E(`foco ${id}.${v}[${i}]: fin inválido`);
        if (o.fin && i !== pasos.length - 1) E(`foco ${id}.${v}[${i}]: fin antes del último paso`);
        for (const e of o.emite || []) if (!F[e]) E(`foco ${id}.${v}[${i}]: emite inexistente ${e}`);
        if (o.tiempoMin !== undefined && !(o.tiempoMin >= 0 && o.tiempoMin <= 60)) E(`foco ${id}.${v}[${i}]: tiempoMin fuera de 0..60`);
      });
      if (v === 'seguir' && typeof pasos[pasos.length - 1] !== 'string' && !pasos[pasos.length - 1].fin) W(`foco ${id}.seguir: el último paso no declara fin (nada|hallazgo)`);
    }
  }
  for (const [a, ids] of Object.entries(aliasEnClase)) if (ids.size > 1) W(`alias "${a}" repetido en ${[...ids].join(', ')} (se desambigua por escena/recencia)`);
  // ciclos de emite
  const vis = {}, dfs = (id, pila) => { if (pila.includes(id)) { E(`ciclo de emite: ${[...pila, id].join(' > ')}`); return; } if (vis[id]) return; vis[id] = 1; for (const p of Object.values(F[id]?.ramas || {}).flat()) for (const e of (typeof p === 'string' ? [] : p.emite || [])) if (F[e]) dfs(e, [...pila, id]); };
  for (const id of Object.keys(F)) dfs(id, []);
  for (const [c, vs] of Object.entries(C)) for (const v of VERBOS) { const l = vs[v]; if (!Array.isArray(l) || l.length < 2) E(`clase ${c}.${v}: faltan variantes (mín. 2)`); else l.forEach((t, i) => txt(t, `clase ${c}.${v}[${i}]`)); }
  if (NV.length < 3) E('no_visto: mín. 3 variantes'); NV.forEach((t, i) => txt(t, `no_visto[${i}]`));
  for (const n of npcs) { const i = INT[n]; if (!i) { E(`interrupcion: falta ${n}`); continue; } for (const k of ['durante', 'regreso']) if (!Array.isArray(i[k]) || i[k].length < 2) E(`interrupcion ${n}.${k}: mín. 2`); else i[k].forEach((t, j) => txt(t, `interrupcion ${n}.${k}[${j}]`)); }
  for (const e of escs) { const fj = FIJ[e]; if (!fj || Object.keys(fj).length < 2) E(`fijos: ${e} necesita ≥2 objetos fijos`); else for (const [id, o] of Object.entries(fj)) { if (!o.alias?.length) E(`fijo ${e}.${id}: sin alias`); for (const k of ['examinar', 'tocar']) if (!Array.isArray(o[k]) || !o[k].length) E(`fijo ${e}.${id}.${k}: vacío`); else o[k].forEach((t, j) => txt(t, `fijo ${e}.${id}.${k}[${j}]`)); } }
  for (const e of Object.keys(FIJ)) if (!escs.has(e)) E(`fijos: escena inexistente ${e}`);
  for (const n of Object.keys(INT)) if (!npcs.has(n)) E(`interrupcion: npc inexistente ${n}`);
}
if (modo === 'cobertura' || modo === 'todo') {
  const aliases = [...Object.values(F).flatMap(f => f.alias), ...Object.values(FIJ).flatMap(e => Object.values(e).flatMap(o => o.alias))].map(norm);
  const cubre = t => aliases.some(a => new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(norm(t)));
  const sim = {}; for (const f of ['t01-gramatica.json', 't15-gramatica2.json']) if (fs.existsSync(path.join(A, f))) for (const [k, v] of Object.entries(J(f).simbolos)) (sim[k] ||= []).push(...v);
  let sin = [];
  for (const [k, v] of Object.entries(sim)) if (/^animal/.test(k)) for (const t of v) if (typeof t === 'string' && !cubre(t)) sin.push(`${k}: ${t.slice(0, 60)}`);
  sin.slice(0, 12).forEach(x => W('mención sin foco: ' + x)); if (sin.length > 12) W(`… y ${sin.length - 12} menciones más sin foco`);
}
console.log(`focos ${modo}: ${errores.length} errores, ${avisos.length} avisos (${Object.keys(F).length} focos, ${Object.keys(FIJ).length} escenas con fijos)`);
errores.slice(0, 15).forEach(x => console.log('ERROR ' + x)); avisos.slice(0, 14).forEach(x => console.log('aviso ' + x));
process.exit(errores.length ? 1 : 0);

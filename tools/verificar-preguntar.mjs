#!/usr/bin/env node
// Verifica t31-preguntar.json: 12 NPC × 6 clases × ≥2 variantes, placeholders {foco}, sin vacíos. Uso: node tools/verificar-preguntar.mjs
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(), A = path.join(R, 'data/contenido/ampliado');
const v3 = JSON.parse(fs.readFileSync(path.join(R, 'data/contenido/contenido-v3.json'), 'utf8'));
const npcs = v3.npcs.map(n => n.id), CL = ['animal', 'persona', 'sonido', 'objeto', 'lugar', 'fenomeno'];
const err = []; const f = path.join(A, 't31-preguntar.json');
if (!fs.existsSync(f)) err.push('falta t31-preguntar.json'); else {
  const P = JSON.parse(fs.readFileSync(f, 'utf8')).preguntar || {};
  for (const n of npcs) { if (!P[n]) { err.push(`falta ${n}`); continue; } for (const c of CL) { const l = P[n][c]; if (!Array.isArray(l) || l.length < 2) { err.push(`${n}.${c}: mín. 2`); continue; } l.forEach((t, i) => { if (!t.trim()) err.push(`${n}.${c}[${i}] vacío`); if ((t.match(/«/g) || []).length !== (t.match(/»/g) || []).length) err.push(`${n}.${c}[${i}] «» desbalanceadas`); for (const m of t.matchAll(/\{(\w+)\}/g)) if (m[1] !== 'foco') err.push(`${n}.${c}[${i}] {${m[1]}} no previsto`); }); } }
  for (const n of Object.keys(P)) if (!npcs.includes(n)) err.push(`npc inexistente ${n}`);
}
console.log(`preguntar: ${err.length} errores`); err.slice(0, 15).forEach(x => console.log('ERROR ' + x)); process.exit(err.length ? 1 : 0);

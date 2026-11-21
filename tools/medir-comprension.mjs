#!/usr/bin/env node
// Fase 6: mide la comprensión del jugador con data/pruebas/corpus-comprension.json.
// Uso: node tools/medir-comprension.mjs [--base] [--etapas todas|ninguna] [--json]
//   --base: guarda la medición como línea base en tools/auto6/base.json.
// Sin --base: falla (código 1) si el % total baja o si una frase que estaba bien pasa a mal (falso positivo nuevo).
// Estados por caso: ok | no (no entendió o pidió aclaración sin hacer falta) | mal (entendió otra cosa con confianza).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contenido } from '../narrador/index.js';
import { cargarAmpliadoNode } from '../narrador/contenidoAmpliado.js';
import { leerAccion, contextoLectura, ETAPAS } from '../narrador/lectura.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = path.join(RAIZ, 'data/pruebas/corpus-comprension.json');
const BASE = path.join(RAIZ, 'tools/auto6/base.json');
const CAMPOS = ['objetivo', 'npc', 'lugar', 'modo', 'tema'];
const DUDA = new Set(['no_entendido', 'aclarar']);

export async function contextoBase() {
  const amp = await cargarAmpliadoNode({ cargarPendientes: true });
  return { focos: amp.focos.defs, npcs: contenido.npcs, escenas: contenido.escenas };
}

/** Compara lo leído con lo esperado: 'ok' | 'no' | 'mal'. */
export function juzgar(esperado, leido) {
  const la = leido?.accion ?? 'no_entendido';
  if (DUDA.has(la)) {
    if (la !== esperado.accion) return 'no';
    if (la === 'aclarar' && esperado.pregunta && esperado.pregunta !== leido.pregunta) return 'no';
    if (la === 'aclarar' && esperado.opciones) return [...esperado.opciones].sort().join() === [...(leido.opciones ?? [])].sort().join() ? 'ok' : 'no';
    return 'ok';
  }
  if (DUDA.has(esperado.accion)) return 'mal'; // esperaba no entender o aclarar y entendió algo con confianza
  if (la !== esperado.accion) return 'mal';
  for (const c of CAMPOS) if (esperado[c] !== undefined && leido[c] !== esperado[c]) return leido[c] === undefined ? 'no' : 'mal';
  if (esperado.luego) return juzgar(esperado.luego, leido.luego);
  return 'ok';
}

export async function medir({ etapas = ETAPAS, corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8')) } = {}) {
  const base = await contextoBase();
  const casos = corpus.casos.map((c, i) => {
    const npcIds = new Set(contenido.npcs.map((n) => n.id));
    const reciente = {};
    for (const x of [].concat(c.ctx ?? [])) { if (npcIds.has(x)) reciente.npc = x; else reciente.foco = x; }
    const focos = c.escenaDe ? Object.fromEntries(Object.entries(base.focos).map(([id, d]) => [id, c.escenaDe[id] ? { ...d, escena: c.escenaDe[id] } : d])) : base.focos;
    const ctx = contextoLectura({ ...base, focos, presentes: c.presentes ?? ['serel_panadero'], reciente, pendiente: c.pendiente ?? null });
    const leido = leerAccion(c.frase, ctx, { etapas });
    return { i, frase: c.frase, cat: c.cat ?? 'otros', estado: juzgar(c, leido), leido };
  });
  const por = {};
  for (const c of casos) { por[c.cat] ??= { n: 0, ok: 0, mal: 0 }; por[c.cat].n++; if (c.estado === 'ok') por[c.cat].ok++; if (c.estado === 'mal') por[c.cat].mal++; }
  const pct = (a, b) => Math.round((a / b) * 1000) / 10;
  const ok = casos.filter((c) => c.estado === 'ok').length;
  return {
    total: casos.length, ok, pct: pct(ok, casos.length), mal: casos.filter((c) => c.estado === 'mal').length,
    categorias: Object.fromEntries(Object.entries(por).sort().map(([k, v]) => [k, { ...v, pct: pct(v.ok, v.n) }])),
    estados: Object.fromEntries(casos.map((c) => [c.frase, c.estado])),
    casos,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = process.argv.slice(2);
  const etapas = a.includes('--etapas') && a[a.indexOf('--etapas') + 1] === 'ninguna' ? Object.fromEntries(Object.keys(ETAPAS).map((k) => [k, false])) : ETAPAS;
  const r = await medir({ etapas });
  const linea = { total: r.total, pct: r.pct, mal: r.mal, categorias: Object.fromEntries(Object.entries(r.categorias).map(([k, v]) => [k, v.pct])) };
  if (a.includes('--json')) console.log(JSON.stringify(r.casos.filter((c) => c.estado !== 'ok').map((c) => ({ frase: c.frase, estado: c.estado, leido: c.leido })), null, 1));
  console.log(JSON.stringify(linea));
  if (a.includes('--base')) {
    fs.writeFileSync(BASE, JSON.stringify({ pct: r.pct, mal: r.mal, categorias: linea.categorias, estados: r.estados }, null, 1) + '\n');
    console.log('línea base guardada');
    process.exit(0);
  }
  if (!fs.existsSync(BASE)) { console.log('sin línea base: correr con --base'); process.exit(0); }
  const b = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  const nuevosMal = Object.entries(r.estados).filter(([f, e]) => e === 'mal' && b.estados[f] !== 'mal').map(([f]) => f);
  const perdidos = Object.entries(r.estados).filter(([f, e]) => b.estados[f] === 'ok' && e !== 'ok').map(([f]) => f);
  console.log(`base ${b.pct}% → ${r.pct}% · falsos positivos nuevos ${nuevosMal.length} · ok perdidos ${perdidos.length}`);
  nuevosMal.slice(0, 10).forEach((f) => console.log('MAL ' + f));
  perdidos.slice(0, 10).forEach((f) => console.log('PERDIDO ' + f));
  process.exit(r.pct < b.pct || nuevosMal.length || perdidos.length ? 1 : 0);
}

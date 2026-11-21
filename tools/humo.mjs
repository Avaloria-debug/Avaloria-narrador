#!/usr/bin/env node
// Humo tipo navegador (Q5): servidor estático node:http sobre la raíz del repo + fetch real de Node, como el navegador.
// Carga manifest y archivos por HTTP (cargarAmpliadoFetch), arma una partida y juega 60 turnos con ampliado.
// Uso: node tools/humo.mjs [--semilla N]. Salida: 1 línea JSON. Sale con 1 si falla.
// SIN VERIFICAR: DOM y CSS de la página (no hay navegador real en este chequeo).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearPartida, narrar, contenido } from '../narrador/index.js';
import { cargarAmpliadoFetch } from '../narrador/contenidoAmpliado.js';
import { crearRng, semillaAEntero } from '../narrador/azar.js';
import { accionAlAzar } from './simular.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function humo({ semilla = 1, turnos = 60 } = {}) {
  const t0 = Date.now();
  const servidor = http.createServer(async (req, res) => {
    const ruta = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!ruta.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
    try { const b = await fs.readFile(ruta); res.writeHead(200, { 'content-type': ruta.endsWith('.json') ? 'application/json' : 'text/plain' }).end(b); } catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const { port } = servidor.address();
  const fallas = [];
  let avisos = [];
  let focos = 0;
  try {
    const carga = await cargarAmpliadoFetch({ base: `http://127.0.0.1:${port}/data/contenido/ampliado/`, v3: contenido });
    avisos = carga.avisos;
    if (!carga.ampliado) fallas.push('ampliado no cargó');
    const rng = crearRng(semillaAEntero(`humo:${semilla}`));
    let estado = crearPartida({ semilla });
    const frases = ['calmando la situacion', 'observar la gente', 'diario', 'asdf qwer', 'explorar la ciudad entera'];
    // Fase 3: acciones sobre focos (el más reciente, o un fijo de la escena).
    const sobreFoco = ['mirar eso', 'seguir eso', 'examinar la fuente', 'escuchar eso', 'tocar la mesa', 'ignorar eso'];
    for (let t = 0; t < turnos; t++) {
      const entrada = t % 5 === 4 ? { tipo: 'texto', texto: frases[t % frases.length] }
        : t % 5 === 2 ? { tipo: 'texto', texto: sobreFoco[(t / 5 | 0) % sobreFoco.length] } : accionAlAzar(estado, rng);
      try {
        const r = await narrar(estado, entrada, { ampliado: carga.ampliado, ahora: () => 0 });
        if (/[{}#]|\bundefined\b|\bNaN\b/.test(r.texto)) fallas.push(`turno ${t}: ${r.texto}`);
        if (r.errores.length) fallas.push(`turno ${t}: ${r.errores.join(',')}`);
        if ((r.estado.ext?.focos ?? []).length || entrada.texto && sobreFoco.includes(entrada.texto)) focos++;
        estado = r.estado;
      } catch (e) { fallas.push(`turno ${t}: excepción ${e.message}`); }
    }
    avisos = [...avisos, ...(estado.avisos ?? []), ...(estado.ext?.avisos ?? [])];
  } finally {
    servidor.close();
  }
  const ms = Date.now() - t0;
  if (ms >= 10000) fallas.push(`tardó ${ms} ms`);
  return { ok: fallas.length === 0 && avisos.length === 0, turnos, focos, ms, fallas: fallas.slice(0, 5), avisos: avisos.slice(0, 5) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = process.argv.slice(2);
  const r = await humo({ semilla: a.includes('--semilla') ? Number(a[a.indexOf('--semilla') + 1]) : 1 });
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
}

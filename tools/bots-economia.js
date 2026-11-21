#!/usr/bin/env node
// Fase 8 (X8): bots de economía. 12 escenas × N turnos con compras, precios, regateos, trabajos, favores, fiado,
// pagos con información, exhibir dinero y cambios de escena. Comprueba: dinero ≥ 0 y sin NaN, montos con moneda,
// ningún sistema abierto tras cambiar de escena, favores que siempre terminan y sin texto repetido seguido.
// node tools/bots-economia.js [turnos=300] [semilla=1] → tools/reporte/economia.json (sale con 1 si hay errores)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearPartida, narrar, contenido } from '../narrador/index.js';
import { cargarAmpliadoNode } from '../narrador/contenidoAmpliado.js';
import { derivar } from '../narrador/azar.js';
import { totalBronce } from '../narrador/economia/monedas.js';
import { abiertos, DIAS_MAX_COBRO, DIAS_RESPUESTA, DIAS_DEUDA_NPC } from '../narrador/economia/favores.js';

const FRASES = [
  'cuánto cuesta el pan', 'precio del pescado', 'compro pan', 'compro una vela', 'quiero comprar una cuerda', 'cuánto sale una habitación',
  'regatear', 'quiero regatear el pan', 'te doy 5', 'te doy 2 de plata', 'rebaja', 'más barato', 'acepto', 'pago de más', 'te cambio el pan',
  'me voy', 'busco trabajo', '¿tenés trabajo?', 'sí, acepto', 'sigo', 'sigo', 'no', 'ayudo', 'me lo fiás', 'después te pago',
  'me debés una', 'sí, lo hago', 'no, no puedo', 'le cuento lo del archivo', 'te cuento lo del puente', 'saco la bolsa', 'cuento mis monedas',
  'vendo el pan', 'pago', 'miro alrededor', 'hablo con alguien', 'descanso',
];
const MONEDA = /^ de (bronce|plata|oro|platino)/;

export async function correr({ turnos = 300, semilla = 1, amp = null } = {}) {
  amp ??= await cargarAmpliadoNode({ cargarPendientes: true });
  const op = { ampliado: amp, ahora: () => 0 };
  const errores = [];
  const cuenta = { turnos: 0, economia: 0, sistemas: 0, cambios: 0, favores: 0, seguidas: 0 };
  const escenas = contenido.escenas.map((e) => e.id);
  for (const esc of escenas) {
    const rng = derivar(`${semilla}:${esc}`, 'bots-economia');
    let e = crearPartida({ semilla: semilla * 100 + escenas.indexOf(esc) });
    e = { ...e, jugador: { ...e.jugador, escenaId: esc } };
    let previo = '';
    for (let t = 0; t < turnos; t++) {
      let cambio = false;
      if (t > 0 && t % 37 === 0) { e = { ...e, jugador: { ...e.jugador, escenaId: escenas[Math.floor(rng() * escenas.length)] } }; cambio = true; cuenta.cambios++; }
      if (t > 0 && t % 25 === 0) e = { ...e, reloj: { ...e.reloj, dia: e.reloj.dia + 1 } };
      let frase = FRASES[Math.floor(rng() * FRASES.length)];
      if (frase === 'ayudo') { const p = contenido.npcs[Math.floor(rng() * contenido.npcs.length)]; frase = `ayudo a ${p.alias?.[0] ?? p.nombre}`; }
      const r = await narrar(e, { tipo: 'texto', texto: frase }, op);
      cuenta.turnos++;
      const donde = `${esc}#${t} «${frase}»`;
      if (r.errores?.some((x) => x.startsWith('ampliado'))) errores.push(`${donde}: error ampliado ${r.errores.join('|')}`);
      const j = r.estado.jugador;
      for (const m of ['bronce', 'plata']) if (!Number.isFinite(j[m]) || j[m] < 0) errores.push(`${donde}: dinero inválido ${m}=${j[m]}`);
      if (!Number.isFinite(totalBronce(j))) errores.push(`${donde}: total NaN`);
      if (/NaN|undefined|\{\w+\}/.test(r.texto)) errores.push(`${donde}: texto roto: ${r.texto.slice(0, 80)}`);
      if (/bronce|plata/.test(r.texto) || r.estado.ext?.sistema) {
        cuenta.economia++;
        for (const m of r.texto.matchAll(/\b\d+\b/g)) if (!MONEDA.test(r.texto.slice(m.index + m[0].length))) errores.push(`${donde}: monto sin moneda: ${r.texto.slice(Math.max(0, m.index - 20), m.index + 25)}`);
      }
      if (r.estado.ext?.sistema) cuenta.sistemas++;
      if (cambio && r.estado.ext?.sistema && r.estado.ext.sistema.sub?.escena !== r.estado.jugador.escenaId) errores.push(`${donde}: sistema abierto tras cambiar de escena`);
      const dia = r.estado.reloj.dia;
      for (const f of abiertos(r.estado.ext?.favores)) {
        const tope = f.deudor === 'npc' ? DIAS_DEUDA_NPC + 1 : DIAS_MAX_COBRO + DIAS_RESPUESTA + 1;
        if (dia - f.dia > tope) errores.push(`${donde}: favor sin terminar ${JSON.stringify(f)}`);
      }
      cuenta.favores = Math.max(cuenta.favores, (r.estado.ext?.favores ?? []).length);
      if (r.texto === previo && r.texto.length > 40 && (/bronce|plata/.test(r.texto) || r.estado.ext?.sistema || e.ext?.sistema)) { cuenta.seguidas++; if (process.env.VER) console.log(donde, r.texto.slice(0, 90)); }
      previo = r.texto;
      e = r.estado;
    }
  }
  if (cuenta.seguidas > cuenta.turnos * 0.01) errores.push(`repetidas seguidas: ${cuenta.seguidas}`);
  return { ...cuenta, errores };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [turnos = 300, semilla = 1] = process.argv.slice(2).map(Number);
  const r = await correr({ turnos, semilla });
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'reporte');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'economia.json'), `${JSON.stringify(r, null, 1)}\n`);
  console.log(JSON.stringify({ ...r, errores: r.errores.length }));
  for (const x of r.errores.slice(0, 15)) console.log(x);
  process.exit(r.errores.length ? 1 : 0);
}

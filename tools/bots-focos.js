#!/usr/bin/env node
// S6 (fase 3): bots de decisiones sobre focos. Sin dependencias.
// node tools/bots-focos.js [partidas=200] [turnos=60] [semilla=1] → tools/reporte/focos.json
// Tras cada turno, por cada foco activo (propios, generados y fijos de la escena) prueba 3 verbos al azar de los 7
// sobre una copia del estado y verifica la respuesta. La partida principal sigue con acciones al azar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearPartida, narrar, contenido } from '../narrador/index.js';
import { cargarAmpliadoNode } from '../narrador/contenidoAmpliado.js';
import { derivar } from '../narrador/azar.js';
import { normalizar } from '../narrador/comprension.js';
import { minutosAbsolutos } from '../narrador/reloj.js';
import { VERBOS_FOCO, FAMILIAS, tieneAlias } from '../narrador/focos.js';

const PREFIJO = { seguir: 'seguir a', mirar: 'mirar a', llamar: 'llamar a', tocar: 'tocar', escuchar: 'escuchar', preguntar: 'preguntar por', ignorar: 'ignorar' };
const ACCIONES = ['observar', 'explorar', 'examinar', 'hablar con serel', 'hablar con maren', 'mirar eso', 'seguir eso', 'escuchar', 'descansar', 'viajar a la plaza', 'viajar al mercado', 'viajar al archivo', 'viajar a la taberna', 'ir al camino norte', 'trabajar', 'leer'];
const ARTICULOS = new Set(['un', 'una', 'el', 'la', 'unos', 'unas']);

export async function correr({ partidas = 200, turnos = 60, semilla = 1, amp = null } = {}) {
  amp ??= await cargarAmpliadoNode({ cargarPendientes: true });
  const F = amp.focos;
  const op = { ampliado: amp, ahora: () => 0 };
  const m = { pruebas: 0, ok: 0, rama: 0, clase: 0, interrupciones: 0, agotados: 0, errores: [], textos: new Set(), palabras: new Set(), propios: 0, generados: 0 };
  const sinFoco = {};
  const todosAlias = [...Object.values(F.defs).flatMap((d) => d.alias), ...Object.values(F.fijos).flatMap((e) => Object.values(e).flatMap((o) => o.alias)), ...Object.values(FAMILIAS).flatMap((x) => x.alias)].map(normalizar);
  const propiosNombres = new Set([...contenido.npcs.flatMap((n) => [n.nombre, ...(n.alias ?? [])]), ...contenido.objetos.map((o) => o.nombre), ...contenido.escenas.map((e) => e.nombre)].flatMap((x) => normalizar(x).split(' ')));
  const ramaDe = (id, verbo) => (F.defs[id]?.ramas?.[verbo] ?? []).map((p) => (typeof p === 'string' ? p : p.t));
  const malo = (t) => typeof t !== 'string' || !t.trim() || /[{}#]|undefined|NaN/.test(t);
  const err = (x) => { if (m.errores.length < 50) m.errores.push(x); };

  for (let p = 0; p < partidas; p++) {
    const rng = derivar(`${semilla}:${p}`, 'bots');
    let e = crearPartida({ semilla: semilla * 1000 + p });
    for (let t = 0; t < turnos; t++) {
      const accion = ACCIONES[Math.floor(rng() * ACCIONES.length)];
      let r;
      try { r = await narrar(e, { tipo: 'texto', texto: accion }, op); } catch (x) { err(`excepción: ${x.message}`); break; }
      if (malo(r.texto)) err(`texto inválido en "${accion}": ${r.texto}`);
      if (minutosAbsolutos(r.estado.reloj) < minutosAbsolutos(e.reloj)) err('el reloj retrocede');
      m.textos.add(r.texto);
      for (const w of normalizar(r.texto).split(' ')) m.palabras.add(w);
      // sustantivos tras artículo que ningún alias captura
      const ws = normalizar(r.texto).split(' ');
      ws.forEach((w, i) => {
        const s = ws[i + 1];
        if (ARTICULOS.has(w) && s && s.length >= 4 && !propiosNombres.has(s) && !todosAlias.some((a) => a === s || tieneAlias(s, a))) sinFoco[s] = (sinFoco[s] ?? 0) + 1;
      });
      e = r.estado;
      const esc = e.jugador.escenaId;
      const objetivos = [
        ...(e.ext?.focos ?? []).map((f) => ({ id: f.id, alias: f.gen ? f.alias[0] : F.defs[f.id]?.alias[0], gen: Boolean(f.gen) })),
        ...Object.entries(F.fijos[esc] ?? {}).map(([id, o]) => ({ id: `fijo:${id}`, alias: o.alias[0], fijo: true })),
      ].filter((x) => x.alias);
      for (const o of objetivos) {
        if (!o.fijo) { if (o.gen) m.generados++; else m.propios++; }
        for (let k = 0; k < 3; k++) {
          const verbo = VERBOS_FOCO[Math.floor(rng() * VERBOS_FOCO.length)];
          const frase = `${PREFIJO[verbo]} ${o.alias}`;
          m.pruebas++;
          let s;
          try { s = await narrar(e, { tipo: 'texto', texto: frase }, op); } catch (x) { err(`excepción en "${frase}": ${x.message}`); continue; }
          const noVisto = F.no_visto.some((n) => s.texto.startsWith(n) || s.texto.includes(n));
          if (malo(s.texto) || s.tipo === 'reformulacion' || noVisto || s.errores.length) { err(`${esc} "${frase}" → ${s.tipo}: ${s.texto.slice(0, 80)} ${s.errores.join(',')} ${process.env.DBG ? JSON.stringify([e.ext.turno, e.ext.siguiendo, e.ext.focos]) : ''}`); continue; }
          if (minutosAbsolutos(s.estado.reloj) < minutosAbsolutos(e.reloj)) { err(`reloj retrocede en "${frase}"`); continue; }
          m.ok++;
          const propia = o.fijo ? ['mirar', 'tocar'].includes(verbo) : !o.gen && ramaDe(o.id, verbo).some((x) => s.texto.includes(x));
          if (propia) m.rama++; else m.clase++;
        }
      }
    }
    m.interrupciones += Object.values(e.ext?.interrupciones ?? {}).reduce((a, i) => a + (i.veces ?? 0), 0);
    m.agotados += (e.ext?.focos ?? []).filter((f) => f.agotado).length;
  }
  const pct = (a, b) => (b ? Math.round((a / b) * 10000) / 100 : 100);
  return {
    partidas, turnos, semilla,
    pruebas: m.pruebas,
    menciones_con_respuesta_pct: pct(m.ok, m.pruebas),
    rama_propia_pct: pct(m.rama, m.ok),
    clase_pct: pct(m.clase, m.ok),
    focos_propios: m.propios,
    focos_generados: m.generados,
    interrupciones: m.interrupciones,
    focos_agotados: m.agotados,
    textos_distintos: m.textos.size,
    palabras_distintas: m.palabras.size,
    sin_foco_top30: Object.entries(sinFoco).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 30).map(([palabra, n]) => ({ palabra, n })),
    errores: m.errores,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [p = 200, t = 60, s = 1] = process.argv.slice(2).map(Number);
  const r = await correr({ partidas: p, turnos: t, semilla: s });
  const dir = path.join(process.cwd(), 'tools/reporte');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'focos.json'), JSON.stringify(r, null, 1) + '\n');
  const { sin_foco_top30, errores, ...resumen } = r;
  console.log(JSON.stringify(resumen));
  if (errores.length) { console.error(errores.slice(0, 10).join('\n')); process.exit(1); }
}

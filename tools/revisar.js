#!/usr/bin/env node
// Modo revisión del contenido ampliado (P22). Uso: node tools/revisar.js [--semilla N] [--salida stdout]
// Escribe tools/reporte/revision.html: por tanda, cantidad de líneas, 5 líneas al azar con sus condiciones y errores.
// El botón "marcar aprobado" NO escribe nada: arma un JSON de cambios de estado para pegar a mano.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerArchivosAmpliado, validarAmpliado } from '../narrador/contenidoAmpliado.js';
import { leerContenido } from '../narrador/cargarContenido.js';
import { crearRng, semillaAEntero } from '../narrador/azar.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const A_APROBAR_FIJOS = Object.freeze([
  't16: conocimientos nuevos (canon)', 't21: consecuencias (canon)', 't22: objetivos por NPC (canon)', 't27: festividades (canon)',
  'u_niebla_voces (t12): no se carga hasta aprobar', 'data/contenido/ampliado/calendario.json: fechas de festividades (no existe)',
  'data/contenido/ampliado/valores.json: valores de los 12 NPCs (no existe)', 'registro: campo pasada_comprension (esquema cerrado)',
]);

/** Líneas {npc?, c?, t} de un archivo, recorriendo su estructura. */
export function lineasDe(d) {
  const out = [];
  const SIN = new Set(['tanda', 'estado', 'nota', 'id', 'escena', 'hecho', 'meta', 'ciudad', 'estacion', 'dias', 'duracionH', 'avanzaCadaH', 'prob', 'afinidad', 'umbralRelacion', 'requiereEvento', 'requiereMarca', 'palabrasClave', 'base', 'npc']);
  const rec = (o, ruta, npc) => {
    if (typeof o === 'string') out.push({ ruta, npc, c: null, t: o });
    else if (Array.isArray(o)) o.forEach((x, i) => rec(x, `${ruta}[${i}]`, npc));
    else if (o && typeof o === 'object') {
      if (typeof o.t === 'string') { out.push({ ruta, npc: o.c?.npc ?? npc, c: o.c ?? null, t: o.t }); return; }
      for (const [k, v] of Object.entries(o)) if (!SIN.has(k) && k !== 'c') rec(v, `${ruta}.${k}`, /_/.test(k) && !k.startsWith('intencion_') && !k.startsWith('escena_') && !k.startsWith('evento_') && !k.startsWith('objeto_') ? k : (o.npc ?? npc));
    }
  };
  rec(d, '', null);
  return out;
}

export async function revisar({ semilla = 1, dir } = {}) {
  const v3 = await leerContenido();
  const archivos = await leerArchivosAmpliado(dir);
  const rng = crearRng(semillaAEntero(`revisar:${semilla}`));
  const tandas = archivos.filter(([n]) => n.startsWith('t')).map(([nombre, d]) => {
    const lineas = nombre.startsWith('t00') ? [] : lineasDe(d);
    const muestra = [];
    const pool = [...lineas];
    while (muestra.length < 5 && pool.length) muestra.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return { archivo: nombre, tanda: d.tanda ?? null, estado: d.estado ?? null, lineas: lineas.length, muestra, errores: validarAmpliado([[nombre, d]], v3).filter((e) => !/símbolo/.test(e)), npcs: [...new Set(lineas.map((l) => l.npc).filter(Boolean))] };
  });
  const errores = validarAmpliado(archivos, v3);
  const aAprobar = [...A_APROBAR_FIJOS, ...tandas.filter((t) => t.estado && t.estado !== 'aprobado').map((t) => `${t.tanda}: estado ${t.estado}`)];
  return { tandas, errores, aAprobar };
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export function html(r) {
  const filas = r.tandas.map((t) => `<tr data-tanda="${esc(t.tanda)}" data-estado="${esc(t.estado)}" data-npcs="${esc(t.npcs.join(' '))}"><td>${esc(t.tanda)}</td><td>${esc(t.estado)}</td><td>${t.lineas}</td><td><ul>${t.muestra.map((m) => `<li><code>${esc(JSON.stringify(m.c))}</code> ${esc(m.t)}</li>`).join('')}</ul></td><td>${esc(t.errores.join('; '))}</td><td><input type="checkbox" class="ok" value="${esc(t.archivo)}"></td></tr>`).join('');
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Revisión de contenido</title>
<style>body{font-family:sans-serif;margin:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px;vertical-align:top}</style>
<p>Filtrar: tanda <input id="ft" size="6"> NPC <input id="fn" size="14"> estado <input id="fe" size="10"> <button id="marcar">marcar aprobado</button></p>
<table><tr><th>tanda</th><th>estado</th><th>líneas</th><th>muestra</th><th>errores</th><th>aprobar</th></tr>${filas}</table>
<h3>A APROBAR</h3><ul>${r.aAprobar.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<h3>Cambios de estado (pegar a mano; esta página no escribe archivos)</h3><pre id="diff"></pre>
<script>
const f=()=>{const t=ft.value.trim(),n=fn.value.trim(),e=fe.value.trim();for(const r of document.querySelectorAll('tr[data-tanda]'))r.hidden=(t&&!r.dataset.tanda.includes(t))||(n&&!r.dataset.npcs.includes(n))||(e&&!r.dataset.estado.includes(e));};
for(const i of [ft,fn,fe])i.oninput=f;
marcar.onclick=()=>{diff.textContent=JSON.stringify(Object.fromEntries([...document.querySelectorAll('.ok:checked')].map(c=>[c.value,{estado:'aprobado'}])),null,1);};
</script></html>`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = process.argv.slice(2);
  const semilla = a.includes('--semilla') ? a[a.indexOf('--semilla') + 1] : 1;
  const r = await revisar({ semilla });
  if (a.includes('--salida') && a[a.indexOf('--salida') + 1] === 'stdout') process.stdout.write(JSON.stringify(r));
  else {
    fs.mkdirSync(path.join(RAIZ, 'tools/reporte'), { recursive: true });
    fs.writeFileSync(path.join(RAIZ, 'tools/reporte/revision.html'), html(r));
    console.log(`revisión: ${r.tandas.length} tandas, ${r.errores.length} errores, ${r.aAprobar.length} a aprobar`);
  }
}

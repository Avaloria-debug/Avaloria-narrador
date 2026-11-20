#!/usr/bin/env node
// Simulador de partidas por botones (P1). Determinista con la misma semilla.
// Uso: node tools/simular.js --semilla 1 --partidas 20 --turnos 30 --salida stdout [--sin-ampliado] [--incluir-canon]
//      --salida archivo (por defecto) escribe tools/reporte/reporte.json y reporte.html.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearPartida, narrar, contenido } from '../narrador/index.js';
import { crearRng, semillaAEntero } from '../narrador/azar.js';
import { npcsPresentes } from '../narrador/turno.js';
import { posicionesDeNpcs } from '../narrador/movimientoNpcs.js';
import { DESTINOS_CIUDAD } from '../narrador/contenido.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function leerArgs(argv) {
  const a = { semilla: 1, partidas: 200, turnos: 50, salida: 'archivo', sinAmpliado: false, incluirCanon: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--semilla') a.semilla = argv[++i];
    else if (k === '--partidas') a.partidas = Number(argv[++i]);
    else if (k === '--turnos') a.turnos = Number(argv[++i]);
    else if (k === '--salida') a.salida = argv[++i];
    else if (k === '--sin-ampliado') a.sinAmpliado = true;
    else if (k === '--incluir-canon') a.incluirCanon = true;
  }
  return a;
}

const elegir = (rng, l) => l[Math.floor(rng() * l.length)];

/** Acción de botón al azar, con parámetros tomados del estado. */
export function accionAlAzar(estado, rng) {
  const intencion = elegir(rng, contenido.intenciones);
  const parametros = {};
  if (intencion.verbo === 'viajar') {
    const escena = contenido.escenas.find((e) => e.id === estado.jugador.escenaId);
    parametros.destino = elegir(rng, [...(escena?.salidas ?? []), ...DESTINOS_CIUDAD]);
  }
  const presentes = npcsPresentes(estado, contenido);
  if (presentes.length && rng() < 0.5) parametros.npcId = elegir(rng, presentes).id;
  return { tipo: 'boton', intencionId: intencion.id, parametros };
}

/** Cargador del contenido ampliado; null si todavía no existe el módulo (antes de P1.5). */
async function ampliadoPara(args) {
  if (args.sinAmpliado) return null;
  const ruta = path.join(RAIZ, 'narrador/contenidoAmpliado.js');
  if (!fs.existsSync(ruta)) return null;
  const mod = await import('../narrador/contenidoAmpliado.js');
  return mod.cargarAmpliadoNode({ cargarPendientes: true, incluirCanon: args.incluirCanon });
}

const apertura = (t) => t.split(/\s+/).slice(0, 3).join(' ').toLowerCase();

export async function simular(args) {
  const ampliado = await ampliadoPara(args);
  const rngSim = crearRng(semillaAEntero(`sim:${args.semilla}`));
  const textos = [];
  const excepciones = [];
  const errores = {};
  const tipos = {};
  const escenasVistas = new Set();
  const posiciones = {};
  for (let p = 0; p < args.partidas; p++) {
    let estado = crearPartida({ semilla: `${args.semilla}:${p}`, ...(ampliado ? { ampliado } : {}) });
    for (let t = 0; t < args.turnos; t++) {
      escenasVistas.add(estado.jugador.escenaId);
      try {
        const r = await narrar(estado, accionAlAzar(estado, rngSim), { ahora: () => 0, ...(ampliado ? { ampliado } : {}) });
        textos.push(r.texto);
        tipos[r.tipo] = (tipos[r.tipo] ?? 0) + 1;
        for (const e of r.errores) { const k = e.split(':')[0]; errores[k] = (errores[k] ?? 0) + 1; }
        estado = r.estado;
        for (const [id, esc] of Object.entries(posicionesDeNpcs(estado.reloj, contenido))) (posiciones[id] ??= new Set()).add(esc);
      } catch (e) {
        excepciones.push({ semilla: `${args.semilla}:${p}`, turno: t, error: String(e?.message ?? e) });
      }
    }
  }
  const frec = {};
  for (const t of textos) frec[t] = (frec[t] ?? 0) + 1;
  const aper = {};
  for (const t of textos) { const a = apertura(t); aper[a] = (aper[a] ?? 0) + 1; }
  const todas = [];
  for (const [clave, bloque] of Object.entries(contenido.plantillas)) {
    const recorrer = (v, ruta) => {
      if (typeof v === 'string') todas.push({ clave: ruta, fija: v.split('{')[0].trim() });
      else if (Array.isArray(v)) v.forEach((x) => recorrer(x, ruta));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) recorrer(x, `${ruta}.${k}`);
    };
    recorrer(bloque, clave);
  }
  const unido = textos.join('\n');
  const nuncaUsadas = todas.filter((x) => x.fija.length >= 8 && !unido.includes(x.fija)).map((x) => x.clave);
  const palabras = new Set(unido.toLowerCase().match(/[a-záéíóúñü]+/g) ?? []);
  const metricas = {
    turnos: textos.length,
    textosDistintos: Object.keys(frec).length,
    palabrasDistintas: palabras.size,
    plantillasTotales: todas.length,
    plantillasNuncaUsadas: nuncaUsadas.length,
    aperturasDistintas: Object.keys(aper).length,
    topAperturas: Object.entries(aper).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 20),
    escenasVisitadas: escenasVistas.size,
    escenasSinTextoAmbiental: contenido.escenas.filter((e) => !(ampliado?.ambiente?.[e.id])).map((e) => e.id),
    npcsSinMoverse: Object.entries(posiciones).filter(([, s]) => s.size <= 1).map(([id]) => id),
    tipos,
    errores,
    excepciones,
    clavesNuncaUsadas: [...new Set(nuncaUsadas)].sort(),
  };
  return { metricas, textos };
}

function html(r) {
  const fila = (k, v) => `<tr><td>${k}</td><td>${typeof v === 'object' ? JSON.stringify(v) : v}</td></tr>`;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><meta charset="utf-8"><title>Reporte simulador</title><table border="1">${Object.entries(r.metricas).map(([k, v]) => fila(esc(k), esc(typeof v === 'object' ? JSON.stringify(v) : v))).join('')}</table>`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = leerArgs(process.argv.slice(2));
  const r = await simular(args);
  if (args.salida === 'stdout') process.stdout.write(JSON.stringify(r));
  else {
    const dir = path.join(RAIZ, 'tools/reporte');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'reporte.json'), JSON.stringify(r.metricas, null, 1));
    fs.writeFileSync(path.join(dir, 'reporte.html'), html(r));
    console.log(JSON.stringify({ turnos: r.metricas.turnos, textosDistintos: r.metricas.textosDistintos, palabrasDistintas: r.metricas.palabrasDistintas, plantillasNuncaUsadas: r.metricas.plantillasNuncaUsadas, aperturasDistintas: r.metricas.aperturasDistintas }));
  }
}

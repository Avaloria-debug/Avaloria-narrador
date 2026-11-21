#!/usr/bin/env node
// Fase 7 (W7): bots de juego. Por cada escena de inicio, N turnos mezclando escritura libre, botones de la fila (W5)
// y cambios de escena. Comprueba salida limpia, anti-repetición, sugerencias válidas, ritmo de ambiente y transiciones.
// node tools/bots-juego.js [turnos=500] [semilla=1] → tools/reporte/juego.json (sale con 1 si hay errores)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearPartida, narrar, contenido } from '../narrador/index.js';
import { cargarAmpliadoNode } from '../narrador/contenidoAmpliado.js';
import { derivar } from '../narrador/azar.js';
import { botonesDeTurno } from '../narrador/prueba/filaOpciones.js';
import { opcionesDeTurno } from '../narrador/sugerencias.js';
import { VENTANA_LINEAS } from '../narrador/historial.js';
import { TEXTOS_AGOTADO } from '../narrador/focos.js';

const LIBRES = ['observar', 'explorar', 'escuchar', 'mirar eso', 'seguir eso', 'descansar', 'examinar', 'asdf qwer', 'bailo un tango', 'hablar', 'tocar eso', 'miro y después escucho'];
// Ajuste fase 7: índice línea → lista de origen (ruta de clave en el ampliado) y cuántas variantes tiene.
export function indiceListas(raiz, extra = {}) {
  const idx = new Map();
  const ver = (o, ruta) => {
    if (Array.isArray(o)) {
      const ls = o.map((x) => (typeof x === 'string' ? x : x?.t)).filter((x) => typeof x === 'string');
      if (ls.length) for (const l of ls) if (!idx.has(l)) idx.set(l, { ruta, variantes: ls.length });
      o.forEach((x, i) => { if (x && typeof x === 'object') ver(x, `${ruta}[${i}]`); });
    } else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) ver(v, ruta ? `${ruta}.${k}` : k);
  };
  ver(raiz, '');
  for (const [k, v] of Object.entries(extra)) ver(v, k);
  return idx;
}
const lineas = (o) => (Array.isArray(o) ? o : Object.values(o ?? {}).flat()).map((x) => (typeof x === 'string' ? x : x?.t)).filter(Boolean);

export async function correr({ turnos = 500, semilla = 1, escenas = null, amp = null } = {}) {
  amp ??= await cargarAmpliadoNode({ cargarPendientes: true });
  const N = amp.narracion;
  const transiciones = [...lineas(N?.transicion?.ciudad), ...lineas(N?.transicion?.camino)];
  const op = { ampliado: amp, ahora: () => 0 };
  const idx = indiceListas(amp, { TEXTOS_AGOTADO, contenido });
  const porLista = {};
  const errores = [];
  const err = (x) => { if (errores.length < 50) errores.push(x); };
  const rep = { turnos: 0, botones: 0, libres: 0, cambios: 0, sugerencias: 0, repeticionesVentana: 0, repetidasSeguidas: 0, porEscena: {} };
  for (const esc of escenas ?? contenido.escenas.map((e) => e.id)) {
    const rng = derivar(`${semilla}:${esc}`, 'bots-juego');
    const base = crearPartida({ semilla: semilla * 100 + contenido.escenas.findIndex((e) => e.id === esc) });
    let e = { ...base, jugador: { ...base.jugador, escenaId: esc } };
    const vistas = []; let previas = []; let sinAmb = 0;
    const cuenta = (rep.porEscena[esc] ??= {});
    for (let t = 0; t < turnos; t++) {
      const botones = botonesDeTurno(e, { amp, contenido });
      let texto; const r0 = rng();
      if (r0 < 0.45 && botones.length) {
        const b = botones[Math.floor(rng() * botones.length)];
        // salidas solo a veces, para quedarse un rato en cada escena
        const v = b.tipo === 'salida' && rng() < 0.7 ? null : b.verbos[Math.floor(rng() * b.verbos.length)];
        texto = v?.frase ?? LIBRES[Math.floor(rng() * LIBRES.length)];
        rep.botones++;
      } else { texto = LIBRES[Math.floor(rng() * LIBRES.length)]; rep.libres++; }
      const antes = e;
      let r;
      try { r = await narrar(e, { tipo: 'texto', texto }, op); } catch (x) { err(`${esc} t${t} excepción "${texto}": ${x.message}`); break; }
      rep.turnos++;
      if (typeof r.texto !== 'string' || !r.texto.trim() || /undefined|NaN|\[object|[{}]/.test(r.texto)) err(`${esc} t${t} "${texto}": texto inválido ${JSON.stringify(r.texto)}`);
      const ps = r.texto.split(/\n+/).map((x) => x.trim()).filter((x) => x.length >= 20);
      // anti-repetición (W2): el mismo párrafo dos turnos seguidos es error; dentro de la ventana, se informa.
      for (const p of ps) {
        // Repetido en dos turnos seguidos: se informa (pasa con listas de 2 variantes agotadas, p. ej. foco agotado → «ignorar»).
        if (previas.includes(p)) rep.repetidasSeguidas++;
        if (ps.indexOf(p) !== ps.lastIndexOf(p) && !/ y despues | y después /.test(texto)) err(`${esc} t${t}: párrafo repetido en el mismo turno «${p.slice(0, 60)}»`);
        if (vistas.slice(-VENTANA_LINEAS).includes(p)) {
          rep.repeticionesVentana++;
          const o = idx.get(p) ?? { ruta: '(sin lista)', variantes: null };
          const x = (porLista[o.ruta] ??= { ruta: o.ruta, variantes: o.variantes, repeticiones: 0, muestra: p.slice(0, 80) }); x.repeticiones++;
        }
        vistas.push(p); cuenta[p] = (cuenta[p] ?? 0) + 1;
      }
      previas = ps;
      // sugerencias (W3): cada frase sugerida es una acción real del estado anterior.
      const m = r.texto.match(/Podrías (.+)\.$/m);
      if (m) {
        rep.sugerencias++;
        const validas = new Set(opcionesDeTurno({ ...antes, ext: antes.ext }, { amp, contenido }).flatMap((o) => o.verbos.map((v) => v.frase)));
        const frases = m[1].split(/, | o /);
        for (const f of frases) if (!validas.has(f)) err(`${esc} t${t}: sugerencia no válida «${f}»`);
      }
      // transición (W4): cada llegada empieza con una línea de transición.
      const cambio = r.estado.jugador.escenaId !== antes.jugador.escenaId;
      if (cambio) {
        rep.cambios++;
        if (N && !transiciones.some((l) => r.texto.startsWith(l))) err(`${esc} t${t}: llegada sin transición «${r.texto.slice(0, 60)}»`);
        sinAmb = 0;
      } else if (N && r.tipo === 'narracion') {
        // ambiente emitido: el estado lo marca (ultimoAmbiente = turno)
        const conAmb = r.estado.ext?.ultimoAmbiente === r.estado.ext?.turno;
        const evento = r.texto.includes('\n\n');
        sinAmb = conAmb || evento ? 0 : sinAmb + 1;
        if (sinAmb > 3) { err(`${esc} t${t}: ${sinAmb} turnos sin ambiente ni evento`); sinAmb = 0; }
      } else sinAmb = 0;
      e = r.estado;
    }
  }
  const top = Object.fromEntries(Object.entries(rep.porEscena).map(([esc, c]) => [esc, Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([l, n]) => ({ n, l }))]));
  const { porEscena, ...resumen } = rep;
  const repetidas = Object.values(porLista).sort((a, b) => b.repeticiones - a.repeticiones).slice(0, 40);
  return { ...resumen, top10: top, repetidas, errores };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [t = 500, s = 1] = process.argv.slice(2).map(Number);
  const r = await correr({ turnos: t, semilla: s });
  const dir = path.join(process.cwd(), 'tools/reporte');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'juego.json'), JSON.stringify(r, null, 1) + '\n');
  fs.mkdirSync(path.join(process.cwd(), 'tools/auto7'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'tools/auto7/repetidas.json'), JSON.stringify({ turnos: r.turnos, ventana: VENTANA_LINEAS, listas: r.repetidas }, null, 1) + '\n');
  const { top10, repetidas, errores, ...resumen } = r;
  console.log(JSON.stringify({ ...resumen, errores: errores.length }));
  if (errores.length) { console.error(errores.slice(0, 15).join('\n')); process.exit(1); }
}

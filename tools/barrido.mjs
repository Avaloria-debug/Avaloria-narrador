#!/usr/bin/env node
// Bugs fase 7 (B): barrido de coherencia, conocimiento del jugador, eco/vacío y respuestas de NPC.
// Juega N turnos por escena con frases de jugador real + botones y cruza cada salida con escena/franja/clima/presentes.
// node tools/barrido.mjs [turnos=200] [semilla=1] → tools/reporte/barrido.json (sale con 1 si hay hallazgos)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearPartida, narrar, contenido } from '../narrador/index.js';
import { cargarAmpliadoNode } from '../narrador/contenidoAmpliado.js';
import { derivar } from '../narrador/azar.js';
import { npcsPresentes } from '../narrador/turno.js';
import { botonesDeTurno } from '../narrador/prueba/filaOpciones.js';
import { franjaDe } from '../narrador/seleccion.js';
import { hechosCoherencia } from '../narrador/coherencia.js';
import { similitud } from '../narrador/ia.js';
import { normalizar } from '../narrador/comprension.js';

export const FRASES = ['hola', 'hola {npc}', 'buenas', 'quien sos', 'que haces aca', 'de donde sos', 'observar', 'explorar', 'escuchar', 'descansar', 'miro alrededor', 'gracias', 'ok', 'asdf', 'que dice la carta', 'hablar con {npc}', 'sos un idiota', 'eh', 'y', 'me voy', 'perdon', 'no se'];
// Palabras clave por familia → condición que las vuelve contradictorias.
const CLAVES = {
  clima_interior: { re: /\b(lluvia|llueve|llovizna|niebla|neblina|viento|ventarr[oó]n)\b/i, mal: (c) => c.interior && !c.llegada },
  clima_otro: { re: /\b(llueve|lluvia|llovizna)\b/i, mal: (c) => !c.interior && c.clima && c.clima !== 'lluvia' && c.clima !== 'tormenta' },
  campo_en_ciudad: { re: /\b(vacas?|ovejas?|cabras?|corderos?|reba[ñn]o|cerdos?)\b/i, mal: (c) => c.cat === 'ciudad' && c.esc !== 'escena_mercado_circular' },
  agua_lejos: { re: /\b(la orilla|orilla del lago|aguas del lago)\b/i, mal: (c) => !/lago|puente/.test(c.esc) },
  franja_noche: { re: /\b(luna|estrellas|a oscuras|noche cerrada)\b/i, mal: (c) => c.franja === 'manana' || c.franja === 'tarde' },
  franja_dia: { re: /\b(sol del mediod[ií]a|pleno sol|sol fuerte|a pleno d[ií]a)\b/i, mal: (c) => c.franja === 'noche' || c.franja === 'madrugada' },
};
// Excepciones revisadas a mano (no son contradicción): línea → motivo.
export const EXCEPCIONES = Object.freeze({ 'Un postigo golpea con el viento.': 'foco ventana_abierta del Archivo: el viento entra por la ventana abierta' });
const NOMBRES = contenido.npcs.map((n) => ({ id: n.id, corto: n.nombre.split(' ')[0] }));

export async function barrer({ turnos = 200, semilla = 1, amp = null, escenas = null } = {}) {
  amp ??= await cargarAmpliadoNode({ cargarPendientes: true });
  const op = { ampliado: amp, ahora: () => 0 };
  const hallazgos = [];
  const H = (familia, d) => { if (hallazgos.filter((x) => x.familia === familia).length < 40) hallazgos.push({ familia, ...d }); };
  const conteo = {};
  const cuenta = (f) => { conteo[f] = (conteo[f] ?? 0) + 1; };
  for (const esc of escenas ?? contenido.escenas.map((e) => e.id)) {
    const rng = derivar(`${semilla}:${esc}`, 'barrido');
    const base = crearPartida({ semilla: semilla * 31 + esc.length });
    let e = { ...base, jugador: { ...base.jugador, escenaId: esc } };
    const oido = new Set(); // palabras que el jugador ya vio u oyó (salidas del narrador)
    const ver = (t) => { for (const w of normalizar(t).split(/\s+/)) oido.add(w); };
    ver(contenido.escenas.find((x) => x.id === esc).nombre);
    for (let t = 0; t < turnos; t++) {
      const pres = npcsPresentes(e, contenido);
      // a la vista: el oficio de los presentes (el nombre propio, solo si se oyó)
      for (const n of pres) for (const a of contenido.npcs.find((x) => x.id === n.id)?.alias?.slice(1, 2) ?? []) oido.add(normalizar(a));
      const botones = botonesDeTurno(e, { amp, contenido });
      // conocimiento: la fila no nombra focos ni NPC que el jugador no vio u oyó nombrar.
      for (const b of botones) if (b.tipo !== 'salida' && !normalizar(b.rotulo).split(' ').some((w) => oido.has(w))) { H('conocimiento', { esc, t, donde: 'fila', nombre: b.rotulo, id: b.id }); cuenta('conocimiento'); }
      let texto;
      if (rng() < 0.4 && botones.length) { const b = botones[Math.floor(rng() * botones.length)]; texto = b.verbos[Math.floor(rng() * b.verbos.length)].frase; }
      else texto = FRASES[Math.floor(rng() * FRASES.length)].replace('{npc}', pres[0]?.nombre.split(' ')[0] ?? 'che');
      const antes = e;
      const r = await narrar(e, { tipo: 'texto', texto }, op);
      const sal = r.texto ?? '';
      const hc = hechosCoherencia({ estado: r.estado, franja: franjaDe(r.estado.reloj?.hora ?? '08:00') });
      const c = { ...hc, esc: r.estado.jugador.escenaId, cat: contenido.escenas.find((x) => x.id === r.estado.jugador.escenaId)?.categoria === 'camino' ? 'camino' : 'ciudad' };
      const presDespues = npcsPresentes(r.estado, contenido).map((n) => n.id);
      // coherencia
      for (const [fam, k] of Object.entries(CLAVES)) for (const p of sal.split(/\n+/)) if (k.re.test(p.replace(/«[^»]*»/g, ' ')) && k.mal(c) && !EXCEPCIONES[p.trim()]) { H(`coherencia.${fam}`, { esc: c.esc, t, franja: c.franja, clima: c.clima, linea: p.slice(0, 120) }); cuenta(`coherencia.${fam}`); }
      for (const n of NOMBRES) if (new RegExp(`\\b${n.corto}\\b`).test(sal) && !presDespues.includes(n.id) && !pres.some((x) => x.id === n.id) && !new RegExp(`\\b${n.corto}\\b`, 'i').test(texto)) {
        // un rumor o conocimiento puede nombrar a otro: solo cuenta si la línea lo muestra actuando
        if (new RegExp(`\\b${n.corto} (est[aá]|levanta|mira|dice|murmura|cierra|abre|revisa|anota|sonr[ií]e|asiente)`).test(sal)) { H('coherencia.npc_ausente', { esc: c.esc, t, npc: n.id, linea: sal.slice(0, 120) }); cuenta('coherencia.npc_ausente'); }
      }
      // eco y vacío
      if (similitud(sal, texto) > 0.6 && normalizar(texto).split(' ').length >= 3) { H('eco', { esc, t, entrada: texto, salida: sal.slice(0, 100) }); cuenta('eco'); }
      if (/\{[a-z_.]+\}|#[a-z_.]+#|undefined|NaN|\[object/.test(sal)) { H('vacio.placeholder', { esc, t, salida: sal.slice(0, 120) }); cuenta('vacio.placeholder'); }
      if (/ {2,}/.test(sal)) { H('vacio.dobles_espacios', { esc, t, salida: sal.slice(0, 120) }); cuenta('vacio.dobles_espacios'); }
      for (const p of sal.split(/\n+/)) {
        if ((p.match(/«/g) ?? []).length !== (p.match(/»/g) ?? []).length) { H('vacio.comillas', { esc, t, linea: p.slice(0, 120) }); cuenta('vacio.comillas'); }
        if (/^[«¿¡"]?[a-záéíóúñ]/.test(p.trim())) { H('vacio.minuscula', { esc, t, linea: p.slice(0, 120) }); cuenta('vacio.minuscula'); }
        for (const o of p.split(/(?<=[.!?]|[.!?]»)\s+/)) if (/^[«¿¡]?[a-záéíóúñ]/.test(o) && !/^[a-záéíóúñ]+»/.test(o)) { H('vacio.minuscula', { esc, t, linea: p.slice(0, 120) }); cuenta('vacio.minuscula'); break; }
      }
      // respuestas de NPC: un saludo se responde con un saludo; una pregunta, no con charla genérica.
      const n = normalizar(texto);
      if (/^(hola|buenas)( [a-z]+)?$/.test(n) && pres.length && r.tipo !== 'narracion' && r.tipo !== 'saludo') { H('npc.saludo', { esc, t, entrada: texto, tipo: r.tipo, salida: sal.slice(0, 100) }); cuenta('npc.saludo'); }
      if (/^(quien sos|que haces aca|de donde sos)$/.test(n) && pres.length && (r.tipo === 'reformulacion' || /^No entend/.test(sal))) { H('npc.pregunta', { esc, t, entrada: texto, salida: sal.slice(0, 100) }); cuenta('npc.pregunta'); }
      // conocimiento en la respuesta: sugerencias «Podrías …» solo con lo visto.
      const m = sal.match(/Podrías (.+)\.$/m);
      if (m) for (const f of m[1].split(/, | o /)) { const ws = normalizar(f).split(' ').slice(1).filter((w) => w.length >= 4); if (!f.startsWith('ir ') && ws.length && !ws.some((w) => oido.has(w))) { H('conocimiento', { esc, t, donde: 'sugerencia', frase: f }); cuenta('conocimiento'); } }
      ver(sal);
      if (r.estado.jugador.escenaId !== antes.jugador.escenaId) ver(contenido.escenas.find((x) => x.id === r.estado.jugador.escenaId).nombre);
      e = r.estado;
    }
  }
  return { conteo, hallazgos };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [t = 200, s = 1] = process.argv.slice(2).map(Number);
  const r = await barrer({ turnos: t, semilla: s });
  fs.mkdirSync(path.join(process.cwd(), 'tools/reporte'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'tools/reporte/barrido.json'), JSON.stringify(r, null, 1) + '\n');
  console.log(JSON.stringify(r.conteo));
  process.exit(Object.keys(r.conteo).length ? 1 : 0);
}

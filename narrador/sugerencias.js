// Fase 7 (W3/W5): acciones reales de la escena (focos activos, NPC presentes, salidas).
// Un solo generador para las sugerencias de «no entendí» y la fila de opciones de la página.
import { datosFocos, vigentes } from './focos.js';
import { npcsPresentes } from './turno.js';
import { normalizar } from './comprension.js';

// A APROBAR (prov): frase de sugerencia y rótulos de verbos.
export const TEXTOS_SUGERENCIA = Object.freeze({ prov: true, una: 'Podrías {a}.', dos: 'Podrías {a} o {b}.', tres: 'Podrías {a}, {b} o {c}.' });
export const ROTULOS_VERBO = Object.freeze({ prov: true, seguir: 'seguir', mirar: 'mirar', tocar: 'tocar', escuchar: 'escuchar', llamar: 'llamar', ignorar: 'ignorar', hablar: 'hablar', preguntar: 'preguntar por…', ir: 'ir' });

const ORDEN_VERBOS = ['mirar', 'seguir', 'escuchar', 'tocar', 'llamar', 'ignorar'];
const CON_A = new Set(['seguir', 'llamar', 'ignorar']);
const genero = (w) => (/a(s)?$/.test(normalizar(w).split(' ')[0]) ? 'f' : 'm');
const art = (w) => (genero(w) === 'f' ? 'la' : 'el');

/** Frase que entiende la lectura para «verbo» sobre un sustantivo. */
export function fraseDe(verbo, nombre, { animado = false } = {}) {
  const a = art(nombre);
  if (CON_A.has(verbo) && (animado || verbo !== 'ignorar')) return `${verbo} ${a === 'el' ? 'al' : 'a la'} ${nombre}`;
  return `${verbo} ${a} ${nombre}`;
}
const conArticulo = (nombre) => { const w = normalizar(nombre).split(' ')[0]; return /a$/.test(w) ? `a la ${nombre}` : `al ${nombre}`; };

/**
 * Opciones del turno: [{ tipo: 'foco'|'npc'|'salida', id, nombre, verbos: [{ verbo, rotulo, frase }] }].
 * Solo focos activos (vigentes y no agotados) en la escena actual.
 */
export function opcionesDeTurno(estado, { amp, contenido }) {
  const out = [];
  const F = datosFocos(amp);
  const escena = estado?.jugador?.escenaId;
  const ext = estado?.ext ?? {};
  if (F && Array.isArray(ext.focos)) {
    const turno = Number.isInteger(ext.turno) ? ext.turno : 0;
    const vivos = vigentes(ext.focos, { F, turno, escena, siguiendo: ext.siguiendo ?? null }).filter((f) => !f.agotado).sort((a, b) => b.visto - a.visto);
    for (const f of vivos) {
      const def = f.gen ? null : F.defs[f.id];
      const nombre = (f.gen ? f.alias?.[0] : def?.alias?.[0]) ?? null;
      if (!nombre) continue;
      const clase = f.gen ? f.clase : def?.clase;
      const animado = clase === 'animal' || clase === 'persona';
      const deRamas = Object.keys(def?.ramas ?? {}).map((v) => (v === 'examinar' ? 'mirar' : v)).filter((v) => ORDEN_VERBOS.includes(v));
      const verbos = [...new Set([...ORDEN_VERBOS.filter((v) => deRamas.includes(v)), ...(deRamas.length ? [] : ['mirar']), 'ignorar'])];
      out.push({ tipo: 'foco', id: f.id, nombre, verbos: verbos.map((v) => ({ verbo: v, rotulo: ROTULOS_VERBO[v], frase: fraseDe(v, nombre, { animado }) })) });
    }
  }
  for (const n of npcsPresentes(estado, contenido)) {
    const corto = n.nombre.split(' ')[0];
    const foco = out.find((o) => o.tipo === 'foco');
    const verbos = [{ verbo: 'hablar', rotulo: ROTULOS_VERBO.hablar, frase: `hablar con ${corto}` }];
    if (foco) verbos.push({ verbo: 'preguntar', rotulo: ROTULOS_VERBO.preguntar, frase: `preguntar por ${art(foco.nombre)} ${foco.nombre} a ${corto}` });
    verbos.push({ verbo: 'ignorar', rotulo: ROTULOS_VERBO.ignorar, frase: `ignorar a ${corto}` });
    out.push({ tipo: 'npc', id: n.id, nombre: corto, verbos });
  }
  const esc = (contenido.escenas ?? []).find((e) => e.id === escena);
  for (const id of esc?.salidas ?? []) {
    const d = contenido.escenas.find((e) => e.id === id);
    if (d) out.push({ tipo: 'salida', id, nombre: d.nombre, verbos: [{ verbo: 'ir', rotulo: ROTULOS_VERBO.ir, frase: `ir ${conArticulo(d.nombre)}` }] });
  }
  return out;
}

/**
 * W3: 2–3 sugerencias (foco + verbo de sus ramas, NPC → hablar, salida → ir), sin repetir la terna anterior.
 * @returns {{ frases: string[], texto: string|null, clave: string }}
 */
export function sugerencias(opciones, rng, { anterior = null } = {}) {
  const grupos = [
    opciones.filter((o) => o.tipo === 'foco').map((o) => o.verbos.find((v) => v.verbo !== 'ignorar')?.frase).filter(Boolean),
    opciones.filter((o) => o.tipo === 'npc').map((o) => o.verbos[0].frase),
    opciones.filter((o) => o.tipo === 'salida').map((o) => o.verbos[0].frase),
  ];
  const tomar = (l) => (l.length ? l[Math.min(l.length - 1, Math.floor(rng() * l.length))] : null);
  let frases = []; let clave = '';
  for (let intento = 0; intento < 4; intento++) {
    frases = grupos.map(tomar).filter(Boolean).slice(0, 3);
    if (frases.length === 1) { const extra = tomar(grupos.flat().filter((f) => f !== frases[0])); if (extra) frases.push(extra); }
    clave = frases.join('|');
    if (clave !== anterior || grupos.flat().length <= frases.length) break;
  }
  if (!frases.length) return { frases, texto: null, clave };
  const t = frases.length === 1 ? TEXTOS_SUGERENCIA.una : frases.length === 2 ? TEXTOS_SUGERENCIA.dos : TEXTOS_SUGERENCIA.tres;
  return { frases, clave, texto: t.replace('{a}', frases[0]).replace('{b}', frases[1] ?? '').replace('{c}', frases[2] ?? '') };
}

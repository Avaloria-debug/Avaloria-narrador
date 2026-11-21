// Fase 7 (W3/W5): acciones reales de la escena (focos activos, NPC presentes, salidas).
// Un solo generador para las sugerencias de «no entendí» y la fila de opciones de la página.
import { datosFocos, vigentes } from './focos.js';
import { npcsPresentes } from './turno.js';
import { normalizar } from './comprension.js';
import { coherente, hechosCoherencia } from './coherencia.js';

// A APROBAR (prov): frase de sugerencia y rótulos de verbos.
export const TEXTOS_SUGERENCIA = Object.freeze({ prov: true, una: 'Podrías {a}.', dos: 'Podrías {a} o {b}.', tres: 'Podrías {a}, {b} o {c}.' });
export const ROTULOS_VERBO = Object.freeze({ prov: true, seguir: 'seguir', mirar: 'mirar', tocar: 'tocar', escuchar: 'escuchar', llamar: 'llamar', ignorar: 'ignorar', hablar: 'hablar', preguntar: 'preguntar por…', ir: 'ir' });

const ORDEN_VERBOS = ['mirar', 'seguir', 'escuchar', 'tocar', 'llamar', 'ignorar'];
const CON_A = new Set(['seguir', 'llamar', 'ignorar']);
const genero = (w) => (/a(s)?$/.test(normalizar(w).split(' ')[0]) ? 'f' : 'm');
const plural = (w) => /s$/.test(normalizar(w).split(' ')[0]);
// B (vacío): «la piedras» → «las piedras».
const art = (w) => (genero(w) === 'f' ? (plural(w) ? 'las' : 'la') : plural(w) ? 'los' : 'el');

/** Frase que entiende la lectura para «verbo» sobre un sustantivo. */
export function fraseDe(verbo, nombre, { animado = false } = {}) {
  const a = art(nombre);
  if (CON_A.has(verbo) && (animado || verbo !== 'ignorar')) return `${verbo} ${a === 'el' ? 'al' : `a ${a}`} ${nombre}`;
  return `${verbo} ${a} ${nombre}`;
}
const conArticulo = (nombre) => { const a = art(nombre); return a === 'el' ? `al ${nombre}` : `a ${a} ${nombre}`; };

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
    const coh = hechosCoherencia({ estado });
    const vivos = vigentes(ext.focos, { F, turno, escena, siguiendo: ext.siguiendo ?? null }).filter((f) => !f.agotado).sort((a, b) => b.visto - a.visto);
    for (const f of vivos) {
      // B (conocimiento): un foco generado cuyo nombre no salió en el texto no se ofrece por nombre.
      if (f.gen && f.nombrado === false) continue;
      // B (coherencia): un foco de clima que ya no corresponde (paró la lluvia, interior) no se sugiere.
      if ((f.gen ? f.alias : F.defs[f.id]?.alias ?? []).slice(0, 1).some((a) => !coherente(a, coh))) continue;
      const def = f.gen ? null : F.defs[f.id];
      const nombre = (f.gen ? f.alias?.[0] : (typeof f.rotulo === 'string' && def?.alias?.includes(f.rotulo) ? f.rotulo : def?.alias?.[0])) ?? null;
      if (!nombre) continue;
      const clase = f.gen ? f.clase : def?.clase;
      const animado = clase === 'animal' || clase === 'persona';
      const deRamas = Object.keys(def?.ramas ?? {}).map((v) => (v === 'examinar' ? 'mirar' : v)).filter((v) => ORDEN_VERBOS.includes(v));
      const verbos = [...new Set([...ORDEN_VERBOS.filter((v) => deRamas.includes(v)), ...(deRamas.length ? [] : ['mirar']), 'ignorar'])];
      out.push({ tipo: 'foco', id: f.id, nombre, verbos: verbos.map((v) => ({ verbo: v, rotulo: ROTULOS_VERBO[v], frase: fraseDe(v, nombre, { animado }) })) });
    }
  }
  // B (conocimiento): un NPC cuyo nombre el jugador todavía no oyó se nombra por su oficio («el panadero»).
  const oidos = Array.isArray(ext.nombresOidos) ? ext.nombresOidos : [];
  for (const n of npcsPresentes(estado, contenido)) {
    const corto = n.nombre.split(' ')[0];
    const def = (contenido.npcs ?? []).find((x) => x.id === n.id);
    const oficio = (def?.alias ?? []).find((a) => !normalizar(n.nombre).split(' ').includes(normalizar(a)));
    const conocido = !oidos || oidos.includes(n.id) || !oficio;
    const nombre = conocido ? corto : oficio;
    const a = conocido ? corto : `${art(oficio)} ${oficio}`;
    const al = conocido ? `a ${corto}` : art(oficio) === 'el' ? `al ${oficio}` : `a ${art(oficio)} ${oficio}`;
    const foco = out.find((o) => o.tipo === 'foco');
    const verbos = [{ verbo: 'hablar', rotulo: ROTULOS_VERBO.hablar, frase: `hablar con ${a}` }];
    if (foco) verbos.push({ verbo: 'preguntar', rotulo: ROTULOS_VERBO.preguntar, frase: `preguntar por ${art(foco.nombre)} ${foco.nombre} ${al}` });
    verbos.push({ verbo: 'ignorar', rotulo: ROTULOS_VERBO.ignorar, frase: `ignorar ${al}` });
    out.push({ tipo: 'npc', id: n.id, nombre, verbos });
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

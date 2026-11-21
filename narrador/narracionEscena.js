// Fase 7 (W4): narración de escena con t39 (llegada en capas, ambiente con ritmo, transición y cierre).
// Sin texto propio: todas las líneas salen de amp.narracion (t39) y de amp.ambiente.
import { franjaDe } from './seleccion.js';
import { elegirLinea } from './historial.js';

export const DENSIDADES = Object.freeze(['breve', 'normal', 'rica']);
export const PROB_CIERRE = 0.5;

const lineasDe = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : x?.t)).filter((x) => typeof x === 'string' && x) : []);
const porFranja = (o, franja) => (Array.isArray(o) ? lineasDe(o) : lineasDe(o?.[franja]));

/**
 * @param {{ amp: object, contenido: object, antes: object, despues: object, ext: object, turno: object,
 *   densidad?: string, rng: () => number, hayEvento?: boolean, presentes?: string[] }} p
 * @returns {{ previas: string[], posteriores: string[], ext: object, llegada: boolean }}
 */
export function narracionDeEscena({ amp, contenido, antes, despues, ext, turno, densidad = 'normal', rng, hayEvento = false, presentes = [] }) {
  const N = amp?.narracion;
  const out = { previas: [], posteriores: [], ext, llegada: false };
  if (!N) return out;
  const d = DENSIDADES.includes(densidad) ? densidad : 'normal';
  const esc = despues.jugador.escenaId;
  const franja = franjaDe(despues.reloj?.hora ?? '08:00');
  const datos = N.escenas?.[esc] ?? {};
  const pick = (l) => elegirLinea(l, rng);
  const cambio = antes.jugador.escenaId !== esc;
  const inicio = !cambio && (ext.turno ?? 0) <= 1 && (ext.visitas?.[esc] ?? 1) <= 1;
  const e = { ...ext };

  if (cambio || inicio) {
    out.llegada = true;
    // Transición: ciudad si las dos escenas son de la misma ciudad; si no, camino.
    const de = contenido.escenas.find((x) => x.id === antes.jugador.escenaId);
    const a = contenido.escenas.find((x) => x.id === esc);
    const tipo = de?.ciudad && a?.ciudad && de.ciudad === a.ciudad ? 'ciudad' : 'camino';
    const tr = cambio ? pick(lineasDe(N.transicion?.[tipo])) : null;
    if (tr) out.previas.push(tr);
    const visitas = e.visitas?.[esc] ?? 1;
    if (visitas <= 1) {
      const prim = porFranja(datos.primera, franja);
      const n = d === 'rica' ? 2 : 1;
      const usadas = [];
      for (let i = 0; i < n && prim.length; i++) { const l = pick(prim.filter((x) => !usadas.includes(x))); if (l) usadas.push(l); }
      out.posteriores.push(...usadas);
      if (d !== 'breve' && presentes.length) {
        const npc = presentes[Math.min(presentes.length - 1, Math.floor(rng() * presentes.length))];
        const act = pick(porFranja(N.actividad?.[npc], franja));
        if (act) out.posteriores.push(act);
      }
    } else {
      const reg = pick(porFranja(datos.regreso, franja));
      if (reg) out.posteriores.push(reg);
    }
    e.proximoAmbiente = (e.turno ?? 0) + 2 + Math.floor(rng() * 2);
  } else if (d !== 'breve' && !hayEvento) {
    // Ambiente: cada 2–3 turnos sin evento.
    if (!Number.isInteger(e.proximoAmbiente)) e.proximoAmbiente = (e.turno ?? 0) + 2 + Math.floor(rng() * 2);
    if ((e.turno ?? 0) >= e.proximoAmbiente) {
      const actividad = presentes.flatMap((n) => porFranja(N.actividad?.[n], franja));
      const pool = [...porFranja(datos.ambiente, franja), ...lineasDe(amp.ambiente?.[esc]), ...(d === 'rica' || rng() < 0.4 ? actividad : [])];
      const l = pick(pool);
      if (l) { out.posteriores.push(l); e.ultimoAmbiente = e.turno; }
      e.proximoAmbiente = (e.turno ?? 0) + 2 + Math.floor(rng() * 2);
    }
  } else if (hayEvento) {
    e.proximoAmbiente = (e.turno ?? 0) + 2 + Math.floor(rng() * 2);
  }

  // Cierre tras el fin de un foco (hallazgo/nada) o una charla dejada: 0–1 línea.
  const fin = turno?.foco?.fin;
  const clave = fin === 'hallazgo' || fin === 'nada' ? fin : turno?.foco?.interrupcion ? 'charla' : null;
  if (clave && rng() < PROB_CIERRE) {
    const c = pick(lineasDe(N.cierre?.[clave]));
    if (c) out.posteriores.push(c);
  }
  out.ext = e;
  return out;
}

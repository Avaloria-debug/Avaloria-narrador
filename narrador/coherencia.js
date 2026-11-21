// Bugs fase 7 (B, coherencia): una línea no contradice la escena. Se aplica como condición al elegir candidatas
// (historial.sinRepetir), sin reescribir texto: lo dicho entre «» no cuenta (un NPC puede hablar del lago).
import escenasConfig from '../data/config/escenas.json' with { type: 'json' };

/** Escenas interiores (data/config/escenas.json): el clima solo se nombra en el turno de llegada. */
export const INTERIORES = new Set(Object.entries(escenasConfig.escenas).filter(([, e]) => e.interior).map(([id]) => id));
export const CLIMA_DE_AFUERA = new Set(['lluvia', 'niebla', 'viento']);
const EVENTO_CLIMA = { evento_lluvia_suave: 'lluvia', evento_tormenta_verano: 'tormenta', evento_niebla_lago: 'niebla' };

const LLUVIA = /\b(lluvia|llueve|llovizna|lloviznar|lloviendo|aguacero|chaparr[oó]n)\b/i;
const NIEBLA = /\b(niebla|neblina|bruma)\b/i;
const VIENTO = /\b(viento|ventarr[oó]n|r[aá]faga)\b/i;
const NOCHE = /\b(la luna|las estrellas|estrellado)\b/i;
const SOL = /\b(pleno sol|sol del mediod[ií]a|sol fuerte|sol de frente)\b/i;
const fuera = (t) => String(t ?? '').replace(/«[^»]*»/g, ' ');

/** Hechos de coherencia del turno. */
export function hechosCoherencia({ estado, clima = null, franja = null }) {
  const ext = estado?.ext ?? {};
  const esc = estado?.jugador?.escenaId;
  const ev = (estado?.eventosActivos ?? []).map((a) => EVENTO_CLIMA[a?.id]).find(Boolean) ?? null;
  return { esc, interior: INTERIORES.has(esc), llegada: ext.llegada === ext.turno, clima: ev ?? clima ?? ext.clima ?? null, franja };
}

/** ¿El texto es compatible con la escena? Sin hechos, siempre. */
export function coherente(texto, h) {
  if (!h || typeof texto !== 'string') return true;
  const t = fuera(texto);
  const adentro = h.interior && !h.llegada;
  if (LLUVIA.test(t) && (adentro || (h.clima && !['lluvia', 'tormenta'].includes(h.clima)))) return false;
  if (NIEBLA.test(t) && (adentro || (h.clima && h.clima !== 'niebla'))) return false;
  if (VIENTO.test(t) && adentro) return false;
  if (NOCHE.test(t) && ['manana', 'tarde'].includes(h.franja)) return false;
  if (SOL.test(t) && ['noche', 'madrugada'].includes(h.franja)) return false;
  return true;
}

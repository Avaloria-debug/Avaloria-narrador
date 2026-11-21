// Bugs fase 7 (A4): charla directa con el ampliado. «hola maren» → saludo de Maren; «quién sos», «qué hacés acá»,
// «de dónde sos» → respuesta del NPC con t05 (voces), t39 (actividad) o t03 (rutina); «qué dice la carta» → «mirar la carta».
// Sin texto propio: todas las líneas salen del contenido.
import { leerCharla, contextoLectura } from './lectura.js';
import { npcsPresentes } from './turno.js';
import { elegir, hechosDe, franjaDe } from './seleccion.js';
import { derivar } from './azar.js';
import { datosFocos } from './focos.js';

const lineas = (v) => (Array.isArray(v) ? v : []);

/** Líneas candidatas para un tema del NPC. */
export function lineasDeTema(amp, npcId, tema, franja) {
  const voces = amp?.voces?.[npcId] ?? {};
  if (tema === 'identidad') return lineas(voces.saludo);
  if (tema === 'actividad') {
    const act = amp?.narracion?.actividad?.[npcId];
    const t39 = Array.isArray(act) ? act : lineas(act?.[franja]);
    return [...t39, ...lineas(amp?.npcsRutina?.[npcId]?.rutina ?? amp?.npcsRutina?.[npcId])];
  }
  if (tema === 'origen') return lineas(voces.no_se);
  return [];
}

/**
 * @returns {null | { reescrito: string } | { turno: object }}
 */
export function turnoDeCharla({ amp, contenido, partida, texto }) {
  if (typeof texto !== 'string' || !amp) return null;
  const presentes = npcsPresentes(partida, contenido);
  const F = datosFocos(amp);
  const focos = {};
  for (const f of partida.ext?.focos ?? []) { const d = F?.defs?.[f.id]; if (d) focos[f.id] = { alias: d.alias, clase: d.clase }; }
  const ctx = contextoLectura({ focos, npcs: contenido.npcs, presentes: presentes.map((n) => n.id), escenas: contenido.escenas, reciente: { npc: partida.ext?.refs?.npc?.id ?? null } });
  const l = leerCharla(texto, ctx);
  if (!l) return null;
  if (l.accion === 'mirar') return { reescrito: `mirar ${F.defs[l.objetivo]?.alias?.[0] ?? ''}`.trim() };
  if (l.accion === 'hablar') return { turno: { tipo: 'saludo', estado: { ...partida, reformulacionPendiente: false }, intencionId: 'saludo', npcId: l.npc } };
  const franja = franjaDe(partida.reloj?.hora ?? '08:00');
  const h = hechosDe(partida, { contenido, npcId: l.npc });
  const rng = derivar(`${partida.ext?.semillaBase ?? partida.semilla | 0}:${(partida.ext?.turno ?? 0) + 1}`, 'charla');
  // Identidad y origen: primero lo que el NPC dice («…»); actividad: lo que hace.
  const todas = lineasDeTema(amp, l.npc, l.tema, franja);
  const dichas = l.tema === 'actividad' ? [] : todas.filter((x) => /«/.test(typeof x === 'string' ? x : x?.t ?? ''));
  const r = elegir(dichas, h, { rng }) ?? elegir(todas, h, { rng });
  if (!r) return null;
  return { turno: { tipo: 'foco', estado: { ...partida, reformulacionPendiente: false }, intencionId: null, texto: r.texto, foco: { id: null, verbo: 'preguntar', npc: l.npc, tema: l.tema } } };
}

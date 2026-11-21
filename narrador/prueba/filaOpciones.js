// Fase 7 (W5): fila de opciones sobre la barra de texto. Lógica pura (testeable en Node).
// Usa el mismo generador que las sugerencias de «no entendí» (narrador/sugerencias.js).
import { opcionesDeTurno } from '../sugerencias.js';

export const MIN_BOTONES = 4;
export const MAX_BOTONES = 8;
export const CLAVE_OCULTA = 'avaloria_fila_oculta';
// A APROBAR (prov): textos de botones de la fila.
export const TEXTOS_FILA = Object.freeze({ prov: true, escribir: '✎', ocultar: 'Ocultar opciones', mostrar: 'Mostrar opciones', volver: '←' });

/**
 * Botones del turno: hasta 8, mezclando focos, NPC y salidas (focos primero, al menos un NPC y una salida si hay).
 * @returns {{ tipo: string, id: string, rotulo: string, verbos: { rotulo: string, frase: string }[] }[]}
 */
export function botonesDeTurno(estado, { amp, contenido }) {
  if (!estado) return [];
  const o = opcionesDeTurno(estado, { amp, contenido });
  const focos = o.filter((x) => x.tipo === 'foco');
  const npcs = o.filter((x) => x.tipo === 'npc');
  const salidas = o.filter((x) => x.tipo === 'salida');
  const reservados = [npcs[0], salidas[0]].filter(Boolean);
  const lista = [...focos.slice(0, MAX_BOTONES - reservados.length), ...reservados];
  for (const x of [...npcs.slice(1), ...salidas.slice(1), ...focos.slice(MAX_BOTONES - reservados.length)]) if (lista.length < MAX_BOTONES) lista.push(x);
  return lista.map((x) => ({ tipo: x.tipo, id: x.id, rotulo: x.nombre, verbos: x.verbos.map((v) => ({ rotulo: v.rotulo, frase: v.frase })) }));
}

/** Preferencia de fila oculta (localStorage con try/catch). */
export function filaOculta(storage) { try { return storage?.getItem?.(CLAVE_OCULTA) === '1'; } catch { return false; } }
export function guardarFilaOculta(storage, oculta) { try { storage?.setItem?.(CLAVE_OCULTA, oculta ? '1' : '0'); } catch { /* sin almacenamiento */ } }

/** Texto para el input al «escribir sin ejecutar»: la frase y un espacio, cursor al final. */
export const textoParaInput = (frase) => `${frase} `;

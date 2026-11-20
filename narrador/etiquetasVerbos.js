// Utilidad por NPC (P7): etiquetas de verbos (código, sin texto) y valores opcionales por NPC.
// npc.valores {orden, dinero, curiosidad, miedo, lealtad} en -2..2 vienen de data/contenido/ampliado/valores.json
// (si existe; A APROBAR). NPC sin valores → 0 → conducta idéntica.
export const DIMENSIONES = Object.freeze(['orden', 'dinero', 'curiosidad', 'miedo', 'lealtad']);

// Cuánto toca cada verbo cada dimensión (-1..1). Positivo: un NPC que valora esa dimensión lo aprecia.
export const ETIQUETAS = Object.freeze({
  ayudar: { lealtad: 1, orden: 0.5 },
  defender: { lealtad: 1, miedo: 0.5 },
  negociar: { dinero: 1, curiosidad: 0.5 },
  presionar: { orden: -0.5, miedo: -1 },
  atacar: { orden: -1, miedo: -1, lealtad: -0.5 },
  emboscar: { orden: -1, lealtad: -1 },
  comprar: { dinero: 1 },
  trabajar: { orden: 0.5, dinero: 0.5 },
  examinar: { curiosidad: 0.5 },
  observar: { curiosidad: 0.5 },
  leer: { curiosidad: 1 },
  calmar: { orden: 1, miedo: 0.5 },
  distraer: { orden: -0.5 },
});

const acotar = (v, lim) => Math.max(-lim, Math.min(lim, v));

/** Valores de un NPC (ausente = 0 en todo). */
export function valoresDe(amp, npcId) {
  const v = amp?.valores?.[npcId] ?? {};
  return Object.fromEntries(DIMENSIONES.map((d) => [d, Number.isFinite(v[d]) ? acotar(v[d], 2) : 0]));
}

/** Delta extra de relación por la acción: Σ valor×etiqueta, acotado a ±1. */
export function afinidadAccion(amp, npcId, verbo) {
  const val = valoresDe(amp, npcId);
  const et = ETIQUETAS[verbo] ?? {};
  const suma = DIMENSIONES.reduce((s, d) => s + val[d] * (et[d] ?? 0), 0);
  return acotar(Math.round(suma * 100) / 100, 1);
}

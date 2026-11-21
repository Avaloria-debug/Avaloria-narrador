// Conocimientos ampliados, temas y únicos (P10). Sin texto propio: respuestas de t16 (canon, A APROBAR) y t12.
import { normalizar } from './comprension.js';
import { cumple, especificidad } from './seleccion.js';

// Palabras que reconocen cada tema (vocabulario de comprensión, no narración).
export const PALABRAS_TEMA = Object.freeze({
  dinero: ['dinero', 'plata', 'precio', 'precios', 'moneda', 'monedas', 'bronce', 'deuda', 'pagar', 'cobrar'],
  guerra: ['guerra', 'coronas', 'batalla', 'soldados', 'ejercito'],
  camino: ['camino', 'caminos', 'ruta', 'viaje', 'viajar', 'puente'],
  tiempo: ['tiempo', 'clima', 'lluvia', 'niebla', 'sol', 'frio', 'calor'],
  gente: ['gente', 'vecinos', 'personas', 'familia'],
  trabajo: ['trabajo', 'oficio', 'trabajar'],
  ciudad: ['ciudad', 'ardenhall', 'lareth', 'halenor'],
  rumor: ['rumor', 'rumores', 'chisme', 'dicen', 'novedades'],
});

const palabras = (texto) => new Set(normalizar(String(texto ?? '')).split(/[^a-z0-9ñ]+/).filter(Boolean));

/** Tema reconocido en el texto, o null (el primero en el orden de la tabla). */
export function temaDe(texto) {
  const p = palabras(texto);
  return Object.entries(PALABRAS_TEMA).find(([, l]) => l.some((w) => p.has(w)))?.[0] ?? null;
}

/**
 * Conocimiento ampliado del NPC que coincide con el texto (palabras clave), con su estado:
 * { k, puede: boolean } — puede = relación ≥ umbral y evento/marca cumplidos. null si ninguno coincide.
 */
export function conocimientoQueCoincide(lista, texto, { relacion = 0, marcas = [], eventosActivos = [], revelados = [] } = {}) {
  const p = palabras(texto);
  for (const k of lista ?? []) {
    if (revelados.includes(k.id)) continue;
    if (!(k.palabrasClave ?? []).some((w) => p.has(normalizar(w)))) continue;
    const evento = !k.requiereEvento || eventosActivos.some((a) => a.id === k.requiereEvento);
    const marca = !k.requiereMarca || marcas.includes(k.requiereMarca);
    return { k, puede: relacion >= (k.umbralRelacion ?? 0) && evento && marca };
  }
  return null;
}

/** Único (t12) que cumple y no se usó: el más específico. Solo los que tienen condiciones. */
export function unicoDisponible(unicos, hechos, usadas = []) {
  const ok = (unicos ?? []).filter((u) => u.c && !usadas.includes(u.id) && cumple(u.c, hechos));
  return ok.length ? ok.reduce((a, b) => (especificidad(b) > especificidad(a) ? b : a)) : null;
}

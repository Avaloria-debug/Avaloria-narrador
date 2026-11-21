// Contenido ampliado en la página de prueba (Q3). Interruptor de emergencia: `?ampliado=0` en la URL o
// localStorage `ampliado=0` → v3 puro. Nunca rompe la página: ante un error, v3 puro y un aviso.
// SIN VERIFICAR: fetch y localStorage reales del navegador (probado con dobles en ampliado.test.js).
import { cargarAmpliadoFetch } from '../contenidoAmpliado.js';

/** ¿Está activo el ampliado? Apagado solo con ?ampliado=0 o localStorage ampliado=0. */
export function ampliadoActivo(busqueda = '', almacen = null) {
  try {
    if (new URLSearchParams(busqueda).get('ampliado') === '0') return false;
  } catch { /* URL rara: sigue */ }
  try {
    if (almacen?.getItem?.('ampliado') === '0') return false;
  } catch { /* sin localStorage */ }
  return true;
}

/**
 * Carga el ampliado para la página. @returns {Promise<{ ampliado: object|null, avisos: object[] }>}
 */
export async function cargarAmpliadoPagina({ v3, busqueda = globalThis.location?.search ?? '', almacen = globalThis.localStorage ?? null, fetch: f = globalThis.fetch, base = new URL('../../data/contenido/ampliado/', import.meta.url) } = {}) {
  if (!ampliadoActivo(busqueda, almacen)) return { ampliado: null, avisos: [] };
  return cargarAmpliadoFetch({ base, fetch: f, v3 });
}

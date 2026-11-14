// Lectura de contenido-v3.json desde disco (Node). El navegador lo cargará por fetch
// en la fase de integración; la validación de contenido.js es la misma.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exigirContenidoValido } from './contenido.js';

// Ubicación documentada primero; ubicación real en el repo después (ver SUPUESTOS.md).
export const RUTAS_CONTENIDO = Object.freeze([
  fileURLToPath(new URL('../data/contenido/contenido-v3.json', import.meta.url)),
  fileURLToPath(new URL('../contenido-v3.json', import.meta.url)),
]);

/** Lee y parsea el contenido sin validarlo. */
export async function leerContenido(ruta) {
  const rutas = ruta ? [ruta] : RUTAS_CONTENIDO;
  let ultimoError;
  for (const r of rutas) {
    let crudo;
    try {
      crudo = await readFile(r, 'utf8');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      ultimoError = e;
      continue;
    }
    return JSON.parse(crudo);
  }
  throw new Error(`No se encontró contenido-v3.json en: ${rutas.join(', ')}`, { cause: ultimoError });
}

/** Lee, valida y devuelve el contenido. Lanza si es inválido. */
export async function cargarContenido(ruta) {
  return exigirContenidoValido(await leerContenido(ruta));
}

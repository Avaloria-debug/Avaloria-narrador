// Uso: node narrador/validarContenido.js [ruta]
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { leerContenido } from './cargarContenido.js';
import { validarContenido, CONTEOS } from './contenido.js';
import { validarCasos } from './casos/validador.js';

export const RUTA_CASOS = fileURLToPath(new URL('../data/contenido/casos.json', import.meta.url));

/** Casos de data/contenido/casos.json; lista vacía si el archivo no existe. */
export async function leerCasos(ruta = RUTA_CASOS) {
  try {
    return JSON.parse(await readFile(ruta, 'utf8')).casos ?? [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

const contenido = await leerContenido(process.argv[2]);
const { ok, errores, avisos, conteos } = validarContenido(contenido);
const casos = await leerCasos();
const erroresCasos = validarCasos(casos, contenido);

for (const [clave, meta] of Object.entries(CONTEOS)) {
  console.log(`${clave}: ${conteos[clave]}/${meta}`);
}
console.log(`casos: ${casos.length}`);
if (avisos.length > 0) {
  console.log(`Avisos (${avisos.length}), no bloquean:`);
  for (const a of avisos) console.log(`- ${a}`);
}
if (ok && erroresCasos.length === 0) {
  console.log('Contenido válido.');
} else {
  console.error(`Contenido inválido (${errores.length + erroresCasos.length}):`);
  for (const e of errores) console.error(`- ${e}`);
  for (const e of erroresCasos) console.error(`- caso ${e.casoId}: ${e.regla}: ${e.detalle}`);
  process.exitCode = 1;
}

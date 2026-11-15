// Uso: node narrador/validarContenido.js [ruta]
import { leerContenido } from './cargarContenido.js';
import { validarContenido, CONTEOS } from './contenido.js';

const contenido = await leerContenido(process.argv[2]);
const { ok, errores, avisos, conteos } = validarContenido(contenido);

for (const [clave, meta] of Object.entries(CONTEOS)) {
  console.log(`${clave}: ${conteos[clave]}/${meta}`);
}
if (avisos.length > 0) {
  console.log(`Avisos (${avisos.length}), no bloquean:`);
  for (const a of avisos) console.log(`- ${a}`);
}
if (ok) {
  console.log('Contenido válido.');
} else {
  console.error(`Contenido inválido (${errores.length}):`);
  for (const e of errores) console.error(`- ${e}`);
  process.exitCode = 1;
}

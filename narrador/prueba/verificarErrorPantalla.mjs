// Verifica en un navegador real (Playwright + Chromium) la pantalla de error de diccionarios de la página de prueba.
// No es parte de `npm test` (necesita el Chromium de Playwright).
// Uso: node narrador/prueba/verificarErrorPantalla.mjs [archivo-a-quitar]
//   Sin argumento (control): no se quita nada. Veredicto OK si #aviso está vacío, no hay error en la consola y
//   Crear y Cargar están habilitados.
//   Con un archivo (p. ej. diccionario-lexico.md): se le responde 404. Veredicto ERROR_ESPERADO si #aviso y la consola
//   nombran el archivo y Crear y Cargar están deshabilitados.
// Código de salida 1 solo si el resultado no coincide con lo esperado (veredicto DISTINTO_DE_LO_ESPERADO).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = new URL('../../', import.meta.url).pathname;
const quitar = process.argv[2] ?? null;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const servidor = createServer(async (req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (quitar && ruta.endsWith(`/data/diccionarios/${quitar}`)) { res.writeHead(404).end('no existe'); return; }
  try {
    const cuerpo = await readFile(join(RAIZ, ruta));
    res.writeHead(200, { 'content-type': TIPOS[extname(ruta)] ?? 'application/octet-stream' }).end(cuerpo);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const { chromium } = createRequire(import.meta.url)('playwright');
const navegador = await chromium.launch();
try {
  const pagina = await navegador.newPage();
  const consola = [];
  pagina.on('console', (m) => m.type() === 'error' && consola.push(m.text()));
  await pagina.goto(`http://127.0.0.1:${servidor.address().port}/narrador/prueba/index.html`);
  // Se espera a que la página termine de cargar y a que #aviso y los botones dejen de cambiar (no a que aparezca un aviso).
  await pagina.waitForLoadState('networkidle');
  const leer = () => pagina.evaluate(() => ({
    aviso: document.getElementById('aviso').textContent,
    crear: document.getElementById('crear').disabled,
    cargar: document.getElementById('cargar').disabled,
  }));
  let r = await leer();
  for (let i = 0; i < 20; i++) {
    await pagina.waitForTimeout(250);
    const otro = await leer();
    const igual = JSON.stringify(otro) === JSON.stringify(r);
    r = otro;
    if (igual && i >= 3) break;
  }
  const errores = consola.filter((t) => t.startsWith('El narrador no puede arrancar'));
  console.log(JSON.stringify({ quitado: quitar ?? '(control)', ...r, consola }, null, 1));
  const esperado = quitar
    ? r.aviso.includes(quitar) && r.crear && r.cargar && errores.length > 0 && errores.every((t) => t.includes(quitar))
    : r.aviso === '' && !r.crear && !r.cargar && errores.length === 0;
  const veredicto = esperado ? (quitar ? 'ERROR_ESPERADO' : 'OK') : 'DISTINTO_DE_LO_ESPERADO';
  console.log(`${veredicto}: ${quitar ?? 'control'} | aviso ${r.aviso ? 'con texto' : 'vacío'} | Crear ${r.crear ? 'deshabilitado' : 'habilitado'} | Cargar ${r.cargar ? 'deshabilitado' : 'habilitado'} | mensajes de error en consola: ${errores.length}`);
  process.exitCode = esperado ? 0 : 1;
} finally {
  await navegador.close();
  servidor.close();
}

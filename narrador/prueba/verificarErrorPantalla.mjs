// Verifica en un navegador real (Playwright + Chromium) que, sin un diccionario, la página de prueba muestra el error
// en el DOM y deja Crear y Cargar deshabilitados. No es parte de `npm test` (necesita el Chromium de Playwright).
// Uso: node narrador/prueba/verificarErrorPantalla.mjs [archivo-a-quitar]   (por defecto diccionario-lexico.md)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = new URL('../../', import.meta.url).pathname;
const quitar = process.argv[2] ?? 'diccionario-lexico.md';
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const servidor = createServer(async (req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ruta.endsWith(`/data/diccionarios/${quitar}`)) { res.writeHead(404).end('no existe'); return; }
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
  await pagina.waitForFunction(() => document.getElementById('aviso')?.textContent.length > 0, null, { timeout: 5000 });
  const r = await pagina.evaluate(() => ({
    aviso: document.getElementById('aviso').textContent,
    crear: document.getElementById('crear').disabled,
    cargar: document.getElementById('cargar').disabled,
  }));
  console.log(JSON.stringify({ quitado: quitar, ...r, consola }, null, 1));
  const ok = r.aviso.includes(quitar) && r.crear && r.cargar && consola.some((t) => t.includes(quitar));
  console.log(ok ? 'OK: error en el DOM, en la consola y botones deshabilitados' : 'FALLA');
  process.exitCode = ok ? 0 : 1;
} finally {
  await navegador.close();
  servidor.close();
}

// Verifica en un navegador real (Playwright + Chromium) la pregunta de destino ambiguo y su respuesta corta.
// No es parte de `npm test` (necesita el Chromium de Playwright).
// Uso: node narrador/prueba/verificarDestino.mjs
// Casos: control (página sin errores), Mercado ("salir de acá", "norte"), Plaza ("salir de acá",
// "Taberna de la campana tardía", "camino", "banana"). Veredicto por caso: OK o DISTINTO_DE_LO_ESPERADO.
// Código de salida 1 solo si algún caso da DISTINTO_DE_LO_ESPERADO.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = new URL('../../', import.meta.url).pathname;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown' };
const servidor = createServer(async (req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    res.writeHead(200, { 'content-type': TIPOS[extname(ruta)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(await readFile(join(RAIZ, ruta)));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const { chromium } = createRequire(import.meta.url)('playwright');
const navegador = await chromium.launch();
const resultados = [];
const veredicto = (caso, ok, detalle) => { resultados.push(ok); console.log(`${ok ? 'OK' : 'DISTINTO_DE_LO_ESPERADO'}: ${caso} | ${detalle}`); };
const PLAZA = 'Hay más de un camino: Taberna de la Campana Tardía, Camino del norte o Camino del este. ¿Por cuál vas?';
try {
  const pagina = await navegador.newPage();
  const errores = [];
  pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  pagina.on('pageerror', (e) => errores.push(String(e)));
  await pagina.goto(`http://127.0.0.1:${servidor.address().port}/narrador/prueba/index.html`);
  await pagina.waitForFunction(() => document.getElementById('crear') && !document.getElementById('crear').disabled, null, { timeout: 15000 }).catch(() => {});
  const version = (await pagina.textContent('#version')).trim();
  const crearHabilitado = !(await pagina.isDisabled('#crear'));
  veredicto('control', errores.length === 0 && crearHabilitado && /^v\d+\.\d+\.\d+$/.test(version), `${version} | Crear habilitado: ${crearHabilitado} | errores de consola: ${errores.length}`);

  // Desde el módulo real de la página: partida en la escena pedida, dos turnos de texto.
  const correr = (escenaId, frases) => pagina.evaluate(async ([esc, fr]) => {
    const m = await import('../index.js');
    let est = m.crearPartida({ nombre: 'Verif' });
    est = { ...est, jugador: { ...est.jugador, escenaId: esc } };
    const salida = [];
    for (const f of fr) {
      const r = await m.narrar(est, { tipo: 'texto', texto: f });
      est = r.estado;
      salida.push({ texto: r.texto, escena: est.jugador.escenaId, pendiente: est.destinoPendiente?.opciones.length ?? null, errores: r.errores });
    }
    return salida;
  }, [escenaId, frases]);

  const MERCADO = 'Hay más de un camino: Archivo Real o Camino del norte. ¿Por cuál vas?';
  let r = await correr('escena_mercado_circular', ['salir de acá', 'norte']);
  veredicto('Mercado "salir de acá"', r[0].texto === MERCADO && r[0].pendiente === 2, r[0].texto);
  veredicto('Mercado "norte"', r[1].escena === 'escena_camino_norte' && r[1].pendiente === null, `${r[1].escena} | ${r[1].texto}`);

  for (const [frase, esperado] of [
    ['Taberna de la campana tardía', (x) => x.escena === 'escena_taberna_lareth' && x.pendiente === null],
    ['camino', (x) => x.texto === `No me quedó claro. ${PLAZA}` && x.pendiente === 3 && x.escena === 'escena_plaza_cambistas'],
    ['banana', (x) => x.texto === PLAZA && x.pendiente === 3 && x.escena === 'escena_plaza_cambistas'],
  ]) {
    r = await correr('escena_plaza_cambistas', ['salir de acá', frase]);
    if (frase === 'Taberna de la campana tardía') veredicto('Plaza "salir de acá"', r[0].texto === PLAZA && r[0].pendiente === 3, r[0].texto);
    veredicto(`Plaza "${frase}"`, esperado(r[1]), `${r[1].escena} | ${r[1].texto}`);
  }
  veredicto('sin errores de consola al final', errores.length === 0, `errores: ${JSON.stringify(errores)}`);
} finally {
  await navegador.close();
  servidor.close();
}
process.exit(resultados.every(Boolean) ? 0 : 1);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { crearPartida, contenido } from '../index.js';
import { datosDeContexto, SIN_IA, MOTIVOS_IA } from '../ia.js';
import { crearIaLocal, candidatos, limpiarPensamiento, MOTIVOS_LOCAL, MAX_TOKENS_SALIDA_LOCAL } from './motor.js';
import { CLAVE_CARGANDO } from './capacidad.js';

const manifest = JSON.parse(fs.readFileSync(new URL('./modelo-manifest.json', import.meta.url), 'utf8'));
const ctx = datosDeContexto(crearPartida({ semilla: 2 }), contenido, { frase: 'hola' });
const almacen = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
// Reloj falso: cada llamada a ahora() avanza 100 ms → 16 tokens en 0,1 s = rápido.
const reloj = () => { let t = 0; return () => (t += 100); };
const nunca = () => new Promise(() => {});
function fabrica(respuesta, { fallan = [], salidaProbe = 16 } = {}) {
  const llamadas = [];
  const f = async (c) => {
    llamadas.push(c.modeloId);
    if (fallan.includes(c.modeloId)) throw new Error('no carga');
    return {
      opciones: [],
      async generar(msgs, o) { if (o.maxTokens === 16) return { texto: 'Hola.', salida: salidaProbe }; f.ultimas = { msgs, o }; return typeof respuesta === 'function' ? respuesta() : { texto: respuesta }; },
      async descargar() { f.descargados = (f.descargados ?? 0) + 1; },
    };
  };
  f.llamadas = llamadas;
  return f;
}
const crear = (fab, extra = {}) => crearIaLocal({ manifest, motorFactory: fab, env: { sessionStorage: almacen() }, ahora: reloj(), esperar: () => nunca(), ...extra });

test('respuesta válida → ok con texto', async () => {
  const ia = crear(fabrica('«Pan fresco, como siempre», dice Serel.'));
  assert.equal(await ia.cargar(), true);
  const r = await ia.pedir({ contexto: ctx });
  assert.equal(r.ok, true); assert.ok(r.texto.includes('Serel'));
  assert.ok(r.tokens.entrada > 0);
});
test('sin cargar → sin_ia / local_no_listo', async () => {
  const r = await crear(fabrica('x')).pedir({ contexto: ctx });
  assert.deepEqual([r.ok, r.error, r.motivo, r.texto], [false, SIN_IA, MOTIVOS_LOCAL.NO_LISTO, null]);
});
test('salida vacía → salida_invalida, sin texto', async () => {
  const ia = crear(fabrica('   ')); await ia.cargar();
  const r = await ia.pedir({ contexto: ctx });
  assert.equal(r.motivo, MOTIVOS_IA.SALIDA_INVALIDA); assert.equal(r.texto, null);
});
test('salida con ids → rechazada', async () => {
  const ia = crear(fabrica('Hablá con npc_serel en escena_mercado.')); await ia.cargar();
  assert.equal((await ia.pedir({ contexto: ctx })).ok, false);
});
test('fuego sin evento → rechazada', async () => {
  const ia = crear(fabrica('Hay humo y fuego en la plaza.')); await ia.cargar();
  const r = await ia.pedir({ contexto: ctx });
  assert.equal(r.ok, false); assert.equal(r.detalle, 'fuego_sin_evento');
});
test('timeout → local_tiempo', async () => {
  const fab = fabrica(() => nunca());
  const ia2 = crearIaLocal({ manifest, motorFactory: fab, env: {}, ahora: reloj(), esperar: () => new Promise((r) => setTimeout(r, 5)) });
  assert.equal(await ia2.cargar(), true);
  const r = await ia2.pedir({ contexto: ctx });
  assert.equal(r.motivo, MOTIVOS_LOCAL.TIEMPO); assert.equal(r.texto, null);
});
test('excepción del motor → local_error', async () => {
  const ia = crear(fabrica(() => { throw new Error('gpu perdida'); })); await ia.cargar();
  const r = await ia.pedir({ contexto: ctx });
  assert.equal(r.motivo, MOTIVOS_LOCAL.ERROR); assert.equal(r.texto, null);
});
test('<think> se limpia; solo pensamiento → inválida', async () => {
  assert.equal(limpiarPensamiento('<think>a\nb</think> Hola, che.'), 'Hola, che.');
  assert.equal(limpiarPensamiento('<think>sin cerrar'), '');
  const ia = crear(fabrica('<think>mmm</think>')); await ia.cargar();
  assert.equal((await ia.pedir({ contexto: ctx })).ok, false);
  const ia2 = crear(fabrica('<think>mmm</think>«Buen día», dice Maren.')); await ia2.cargar();
  assert.equal((await ia2.pedir({ contexto: ctx })).texto, '«Buen día», dice Maren.');
});
test('cadena: principal falla → móvil/respaldo; todos fallan → false', async () => {
  const ids = candidatos(manifest, 'local-pc').map((c) => c.modeloId);
  const f = fabrica('Hola.', { fallan: [ids[0]] });
  const ia = crear(f); assert.equal(await ia.cargar(), true);
  assert.equal(ia.modelo(), ids[1]);
  const g = fabrica('Hola.', { fallan: ids });
  const ib = crear(g); assert.equal(await ib.cargar(), false);
  assert.equal(ib.estado(), 'fallida');
  assert.deepEqual(g.llamadas, ids);
});
test('lento bajo el umbral → siguiente candidato', async () => {
  const f = fabrica('Hola.', { salidaProbe: 1 });
  const ia = crear(f); assert.equal(await ia.cargar(), false);
  assert.ok(f.descargados >= 1);
});
test('móvil empieza por el modelo móvil', () => {
  assert.equal(candidatos(manifest, 'local-movil')[0].modeloId, manifest.movil.modeloId);
});
test('marca anti-crash: se pone al cargar y se limpia', async () => {
  const ss = almacen(); let visto = null;
  const f = async (c) => { visto = ss.getItem(CLAVE_CARGANDO); return (await fabrica('Hola.')(c)); };
  const ia = crearIaLocal({ manifest, motorFactory: f, env: { sessionStorage: ss }, ahora: reloj(), esperar: () => nunca() });
  await ia.cargar();
  assert.equal(visto, '1'); assert.equal(ss.getItem(CLAVE_CARGANDO), null);
});
test('max_tokens 100, temperatura 0.6 y pensamiento apagado en Qwen3', async () => {
  const f = fabrica('Hola, che.');
  const ia = crear(f); await ia.cargar(); await ia.pedir({ contexto: ctx });
  assert.equal(f.ultimas.o.maxTokens, MAX_TOKENS_SALIDA_LOCAL); assert.equal(f.ultimas.o.temperatura, 0.6);
  assert.deepEqual(f.ultimas.msgs.map((m) => m.role), ['system', 'user']);
});
test('descargar y pagehide', async () => {
  let h; const win = { addEventListener: (n, fn) => { if (n === 'pagehide') h = fn; } };
  const f = fabrica('Hola.');
  const ia = crearIaLocal({ manifest, motorFactory: f, env: { window: win }, ahora: reloj(), esperar: () => nunca() });
  await ia.cargar(); assert.equal(ia.listo(), true);
  h(); await new Promise((r) => setTimeout(r, 0));
  assert.equal(ia.listo(), false); assert.equal(f.descargados, 1);
});
test('manifest: principal, movil, respaldo[] con tamanoMB y prov', () => {
  for (const c of [manifest.principal, manifest.movil, ...manifest.respaldo]) { assert.ok(c.modeloId && c.tamanoMB > 0 && c.prov === true); }
});

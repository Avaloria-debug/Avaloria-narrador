import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectar, nivelDeIa, marcarCarga, limpiarCarga, CLAVE_CARGANDO, CLAVE_BLOQUEADA, UMBRALES_TOK_S } from './capacidad.js';

const almacen = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0';
const AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130.0 Mobile';
const env = ({ ua = PC, gpu = true, search = '', mem = 8, touch = 0 } = {}) => ({
  navigator: { userAgent: ua, gpu: gpu ? {} : undefined, deviceMemory: mem, maxTouchPoints: touch },
  sessionStorage: almacen(), localStorage: almacen(), location: { search },
});
const nivel = (e) => nivelDeIa(detectar(e));

test('PC con WebGPU → local-pc', () => assert.equal(nivel(env()), 'local-pc'));
test('Android con WebGPU → local-movil', () => assert.equal(nivel(env({ ua: AND })), 'local-movil'));
test('sin navigator.gpu → ninguna', () => assert.equal(nivel(env({ gpu: false })), 'ninguna'));
test('iPhone → ninguna', () => assert.equal(nivel(env({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari' })), 'ninguna'));
test('iPad como Mac (táctil) → ios', () => assert.equal(detectar(env({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', touch: 5 })).ios, true));
test('navegador dentro de Instagram → ninguna', () => assert.equal(nivel(env({ ua: AND + ' Instagram 300' })), 'ninguna'));
test('?ialocal=0 → ninguna', () => assert.equal(nivel(env({ search: '?ialocal=0' })), 'ninguna'));
test('?ialocal=forzar en iOS con gpu → local-movil', () => assert.equal(nivel(env({ ua: 'iPhone OS 18', search: '?ialocal=forzar' })), 'local-movil'));
test('forzar sin gpu → ninguna', () => assert.equal(nivel(env({ gpu: false, search: '?ialocal=forzar' })), 'ninguna'));
test('memoriaGB se lee de deviceMemory', () => { assert.equal(detectar(env({ mem: 4 })).memoriaGB, 4); assert.equal(detectar(env({ mem: null })).memoriaGB, null); });
test('anti-crash: marca de carga que sobrevive bloquea en el siguiente inicio', () => {
  const e = env();
  marcarCarga(e);
  assert.equal(e.sessionStorage.getItem(CLAVE_CARGANDO), '1');
  const i = detectar(e);
  assert.equal(i.bloqueada, true);
  assert.equal(e.localStorage.getItem(CLAVE_BLOQUEADA), '1');
  assert.equal(nivelDeIa(i), 'ninguna');
  assert.equal(nivelDeIa(i, { forzar: true }), 'local-pc');
});
test('limpiarCarga tras cargar bien → no bloquea', () => {
  const e = env(); marcarCarga(e); limpiarCarga(e);
  assert.equal(detectar(e).bloqueada, false);
});
test('almacenamiento que lanza no rompe', () => {
  const malo = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  const e = { ...env(), sessionStorage: malo, localStorage: malo };
  assert.doesNotThrow(() => { marcarCarga(e); limpiarCarga(e); });
  assert.equal(nivel(e), 'local-pc');
});
test('entorno vacío → ninguna', () => { assert.equal(nivel({}), 'ninguna'); assert.equal(nivelDeIa(null), 'ninguna'); });
test('umbrales provisionales', () => { assert.equal(UMBRALES_TOK_S.prov, true); assert.ok(UMBRALES_TOK_S.pc > UMBRALES_TOK_S.movil); });

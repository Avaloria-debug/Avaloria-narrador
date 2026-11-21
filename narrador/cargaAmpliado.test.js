// Fase 7 (W6): carga en paralelo con caché; mismo contenido que la carga completa por fs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { cargarAmpliadoNode, cargarAmpliadoFetch, vaciarCacheAmpliado } from './contenidoAmpliado.js';
import { contenido } from './index.js';

const DIR = new URL('../data/contenido/ampliado/', import.meta.url);
function fetchFalso() {
  const f = async (u) => { f.pedidos++; f.enVuelo++; f.max = Math.max(f.max, f.enVuelo); await new Promise((r) => setTimeout(r, 1)); f.enVuelo--; const b = await fs.readFile(new URL(u.split('/').pop(), DIR), 'utf8'); return { ok: true, json: async () => JSON.parse(b) }; };
  f.pedidos = 0; f.enVuelo = 0; f.max = 0;
  return f;
}

test('W6: fetch en paralelo da el mismo objeto que fs', async () => {
  vaciarCacheAmpliado();
  const f = fetchFalso();
  const a = await cargarAmpliadoFetch({ base: 'http://x/a/', fetch: f, v3: contenido });
  const b = await cargarAmpliadoNode({ cargarPendientes: true });
  assert.deepEqual(a.ampliado, b);
  assert.ok(f.max > 1, `pedidos simultáneos: ${f.max}`);
});
test('W6: la segunda carga usa la caché (solo pide el manifest) y no comparte objetos', async () => {
  vaciarCacheAmpliado();
  const f = fetchFalso();
  const a = await cargarAmpliadoFetch({ base: 'http://x/a/', fetch: f, v3: contenido });
  const n = f.pedidos;
  const b = await cargarAmpliadoFetch({ base: 'http://x/a/', fetch: f, v3: contenido });
  assert.equal(f.pedidos, n + 1);
  assert.deepEqual(a.ampliado, b.ampliado);
  a.ampliado.focos.defs.gata_mercado.alias.push('x');
  assert.ok(!b.ampliado.focos.defs.gata_mercado.alias.includes('x'));
});
test('W6: un error de red no queda en caché', async () => {
  vaciarCacheAmpliado();
  let falla = true;
  const ok = fetchFalso();
  const f = async (u) => (falla && u.endsWith('t30-focos.json') ? { ok: false, status: 500 } : ok(u));
  const a = await cargarAmpliadoFetch({ base: 'http://x/a/', fetch: f, v3: contenido });
  assert.equal(a.ampliado, null);
  falla = false;
  const b = await cargarAmpliadoFetch({ base: 'http://x/a/', fetch: f, v3: contenido });
  assert.ok(b.ampliado);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cargarAmpliadoFetch, cargarAmpliadoNode } from './contenidoAmpliado.js';
import { leerContenido } from './cargarContenido.js';
import { armarManifest } from '../tools/generar-manifest.js';

const DIR = fileURLToPath(new URL('../data/contenido/ampliado/', import.meta.url));
const v3 = await leerContenido();
const fetchDisco = async (url) => {
  const n = new URL(url).pathname.split('/').pop();
  try { const t = await readFile(DIR + n, 'utf8'); return { ok: true, json: async () => JSON.parse(t) }; } catch { return { ok: false, status: 404 }; }
};

test('manifest: coincide con la carpeta (si falla: node tools/generar-manifest.js)', async () => {
  const enDisco = JSON.parse(await readFile(DIR + 'manifest.json', 'utf8'));
  assert.deepEqual(enDisco, armarManifest());
});

test('manifest: fs y fetch dan el mismo objeto', async () => {
  for (const o of [{ cargarPendientes: true }, { cargarPendientes: true, incluirCanon: true }]) {
    const a = await cargarAmpliadoNode(o);
    const b = await cargarAmpliadoFetch({ base: 'https://x.test/data/contenido/ampliado/', fetch: fetchDisco, v3, ...o });
    assert.deepEqual(b.avisos, []);
    assert.deepEqual(b.ampliado, a);
  }
});

test('manifest: en producción nunca pide canon', async () => {
  const pedidos = [];
  const f = async (u) => { pedidos.push(u); return fetchDisco(u); };
  await cargarAmpliadoFetch({ base: 'https://x.test/a/', fetch: f, v3 });
  const canon = armarManifest().archivos.filter((x) => x.estado === 'a_aprobar_canon').map((x) => x.f);
  assert.ok(canon.length > 0);
  assert.ok(!pedidos.some((u) => canon.some((c) => u.endsWith('/' + c))));
});

test('manifest: error de red o archivo roto → v3 puro con aviso, sin lanzar', async () => {
  const r = await cargarAmpliadoFetch({ base: 'https://x.test/a/', fetch: async () => { throw new Error('red'); }, v3 });
  assert.equal(r.ampliado, null);
  assert.equal(r.avisos[0].tipo, 'ampliado_no_cargado');
  const roto = await cargarAmpliadoFetch({ base: 'https://x.test/a/', fetch: async (u) => (u.endsWith('manifest.json') ? fetchDisco(u) : { ok: true, json: async () => { throw new SyntaxError('roto'); } }), v3 });
  assert.equal(roto.ampliado, null);
});

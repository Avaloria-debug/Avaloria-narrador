import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { revisar, html } from './revisar.js';

test('revisar: salida estable con la semilla', async () => {
  const a = await revisar({ semilla: 3 });
  const b = await revisar({ semilla: 3 });
  assert.deepEqual(a, b);
  assert.ok(a.tandas.length >= 27);
  assert.deepEqual(a.errores, []);
  assert.ok(a.aAprobar.some((x) => x.startsWith('t16')));
  assert.ok(html(a).includes('marcar aprobado'));
});

test('revisar: tanda vacía', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rev-'));
  await writeFile(join(dir, 't99-vacia.json'), JSON.stringify({ tanda: 't99', estado: 'borrador' }));
  const r = await revisar({ dir });
  assert.equal(r.tandas[0].lineas, 0);
  assert.deepEqual(r.tandas[0].muestra, []);
});

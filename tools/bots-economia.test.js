import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correr } from './bots-economia.js';

test('bots de economía (corto): sin errores', async () => {
  const r = await correr({ turnos: 40, semilla: 2 });
  assert.deepEqual(r.errores, []);
  assert.ok(r.economia > 0 && r.sistemas > 0);
});

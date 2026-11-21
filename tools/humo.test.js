import { test } from 'node:test';
import assert from 'node:assert/strict';
import { humo } from './humo.mjs';

test('humo: 60 turnos con ampliado cargado por HTTP, sin fallas ni avisos', async () => {
  const r = await humo({ semilla: 3 });
  assert.equal(r.ok, true, JSON.stringify(r));
});

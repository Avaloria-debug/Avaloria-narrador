import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correr } from './bots-juego.js';

test('bots de juego (2 escenas × 60 turnos): sin errores, con botones, cambios y sugerencias; determinista', async () => {
  const a = await correr({ turnos: 60, semilla: 1, escenas: ['escena_mercado_circular', 'escena_lago_espejos'] });
  assert.deepEqual(a.errores, []);
  assert.ok(a.botones > 0 && a.cambios > 0 && a.sugerencias > 0);
  const b = await correr({ turnos: 60, semilla: 1, escenas: ['escena_mercado_circular', 'escena_lago_espejos'] });
  assert.deepEqual(b, a);
});

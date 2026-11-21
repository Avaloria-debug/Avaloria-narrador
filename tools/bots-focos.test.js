import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correr } from './bots-focos.js';

test('bots de focos (10×20): 100 % de menciones con respuesta, sin errores, determinista', async () => {
  const a = await correr({ partidas: 10, turnos: 20, semilla: 1 });
  assert.deepEqual(a.errores, []);
  assert.equal(a.menciones_con_respuesta_pct, 100);
  assert.ok(a.pruebas > 0);
  if (a.preguntar_con_npc >= 20) assert.ok(a.preguntar_voz_npc_pct >= 95, String(a.preguntar_voz_npc_pct));
  const b = await correr({ partidas: 10, turnos: 20, semilla: 1 });
  assert.deepEqual(b, a);
});

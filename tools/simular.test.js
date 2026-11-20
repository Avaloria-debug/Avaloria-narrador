import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simular, leerArgs } from './simular.js';

test('simulador: misma semilla, mismo reporte', async () => {
  const args = { ...leerArgs([]), partidas: 2, turnos: 10, semilla: 7, sinAmpliado: true };
  const a = await simular(args);
  const b = await simular(args);
  assert.deepEqual(a, b);
  assert.equal(a.metricas.turnos, 20);
  assert.equal(a.metricas.excepciones.length, 0);
});

test('simulador: lee los flags del contrato', () => {
  const a = leerArgs(['--semilla', '3', '--partidas', '4', '--turnos', '5', '--salida', 'stdout', '--sin-ampliado', '--incluir-canon']);
  assert.deepEqual(a, { semilla: '3', partidas: 4, turnos: 5, salida: 'stdout', sinAmpliado: true, incluirCanon: true });
});

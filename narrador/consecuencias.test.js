import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activarPorHecho, vencer, efectosEn, efectosGuardados } from './consecuencias.js';
import { crearPartida, narrar, cargarPartida } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true, incluirCanon: true });
const tabla = [{ id: 'pan_extra', npc: 'serel_panadero', escena: 'escena_mercado_circular', hecho: 'ayudar', duracionH: 24, aparece: ['x'], expira: ['y'] }];
const hecho = { tipo: 'ayudar', npc: 'serel_panadero', peso: 2 };

test('consecuencias: aparece y no se duplica', () => {
  let a = activarPorHecho([], tabla, hecho, { dia: 1, hora: '10:00' });
  assert.deepEqual(efectosEn(a, 'escena_mercado_circular'), ['pan_extra']);
  a = activarPorHecho(a, tabla, hecho, { dia: 1, hora: '11:00' });
  assert.equal(a.length, 1);
  assert.equal(activarPorHecho([], tabla, { ...hecho, peso: 1 }, { dia: 1, hora: '10:00' }).length, 0);
  assert.equal(activarPorHecho([], tabla, { ...hecho, npc: 'otro' }, { dia: 1, hora: '10:00' }).length, 0);
});

test('consecuencias: expira por reloj', () => {
  const a = activarPorHecho([], tabla, hecho, { dia: 1, hora: '10:00' });
  assert.equal(vencer(a, { dia: 2, hora: '09:59' }).activos.length, 1);
  assert.equal(vencer(a, { dia: 2, hora: '10:00' }).vencidos.length, 1);
});

test('consecuencias: persiste con la partida; partida vieja → []', async () => {
  assert.deepEqual(efectosGuardados(undefined), []);
  let e = crearPartida({ semilla: 1 });
  for (let i = 0; i < 4; i++) e = (await narrar(e, { tipo: 'boton', intencionId: 'intencion_ayudar', parametros: { npcId: 'serel_panadero' } }, { ampliado: amp })).estado;
  assert.ok(e.ext.efectos.some((x) => x.id.startsWith('serel')), JSON.stringify(e.ext.efectos));
  assert.deepEqual(cargarPartida(JSON.stringify(e)).ext.efectos, e.ext.efectos);
});

test('consecuencias: sin canon cargado no hay efectos (retrocompatible)', async () => {
  const sinCanon = await cargarAmpliadoNode({ cargarPendientes: true });
  assert.equal(sinCanon.efectos.length, 0);
});

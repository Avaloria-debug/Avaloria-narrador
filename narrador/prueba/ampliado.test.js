import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ampliadoActivo, cargarAmpliadoPagina } from './ampliado.js';
import { crearPartida, cargarPartida, narrar, contenido } from '../index.js';
import { cargarAmpliadoNode } from '../contenidoAmpliado.js';

test('Q3: interruptor de emergencia (?ampliado=0 o localStorage)', async () => {
  assert.equal(ampliadoActivo('', null), true);
  assert.equal(ampliadoActivo('?ampliado=0', null), false);
  assert.equal(ampliadoActivo('', { getItem: (k) => (k === 'ampliado' ? '0' : null) }), false);
  assert.equal(ampliadoActivo('', { getItem: () => { throw new Error('bloqueado'); } }), true);
  let pedidos = 0;
  const r = await cargarAmpliadoPagina({ v3: contenido, busqueda: '?ampliado=0', almacen: null, fetch: async () => { pedidos++; }, base: 'https://x.test/' });
  assert.equal(r.ampliado, null);
  assert.equal(pedidos, 0);
});

test('Q3: partida guardada vieja (sin campos nuevos) carga y juega con ampliado', async () => {
  const amp = await cargarAmpliadoNode({ cargarPendientes: true, incluirCanon: true });
  const vieja = JSON.parse(JSON.stringify(crearPartida({ semilla: 5 })));
  delete vieja.ext;
  const e = cargarPartida(JSON.stringify(vieja));
  assert.equal(e.ext, undefined);
  const r = await narrar(e, { tipo: 'boton', intencionId: 'intencion_observar' }, { ampliado: amp });
  assert.deepEqual(r.errores, []);
  for (const k of ['hechos', 'clima', 'tension', 'efectos', 'objetivos', 'diario', 'apodo', 'unicasUsadas']) assert.ok(k in r.estado.ext, k);
  assert.deepEqual(cargarPartida(JSON.stringify(r.estado)).ext, r.estado.ext);
});

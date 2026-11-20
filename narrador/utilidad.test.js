import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afinidadAccion, valoresDe } from './etiquetasVerbos.js';
import { crearPartida, narrar } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });

test('utilidad: NPC sin valores → 0 y conducta idéntica', async () => {
  assert.deepEqual(Object.values(valoresDe(amp, 'maren_archivista')), [0, 0, 0, 0, 0]);
  assert.equal(afinidadAccion(amp, 'maren_archivista', 'atacar'), 0);
  const e = crearPartida({ semilla: 2 });
  const a = await narrar(e, { tipo: 'boton', intencionId: 'intencion_ayudar' }, { ampliado: amp });
  const b = await narrar(e, { tipo: 'boton', intencionId: 'intencion_ayudar' }, { ampliado: { ...amp, valores: {} } });
  assert.equal(a.texto, b.texto);
  assert.deepEqual(a.estado.ext.afinidad, {});
});

test('utilidad: dos NPCs reaccionan distinto a la misma acción, acotado a ±1', () => {
  const conValores = { valores: { a: { dinero: 2, curiosidad: 1 }, b: { dinero: -2, orden: 2 } } };
  assert.equal(afinidadAccion(conValores, 'a', 'negociar'), 1);
  assert.equal(afinidadAccion(conValores, 'b', 'negociar'), -1);
  assert.ok(afinidadAccion(conValores, 'a', 'atacar') !== afinidadAccion(conValores, 'b', 'atacar'));
});

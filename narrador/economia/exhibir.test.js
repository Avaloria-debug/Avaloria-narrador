import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atencionDecaida } from './index.js';
import { crearPartida, narrar } from '../index.js';
import { cargarAmpliadoNode } from '../contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const op = { ampliado: amp, ahora: () => 0 };
const rica = (escenaId = 'escena_mercado_circular') => { const e = crearPartida({ semilla: 4 }); return { ...e, jugador: { ...e.jugador, escenaId, plata: 50 } }; };

test('mostrar la bolsa en el mercado sube la atención y da la línea de t41', async () => {
  const r = await narrar(rica(), { tipo: 'texto', texto: 'saco la bolsa' }, op);
  assert.equal(r.estado.ext.atencion_ladrones.valor, 1);
  assert.ok(amp.economia.pagos.exhibir.some((l) => r.texto.includes(l)));
});
test('fuera de escenas concurridas no sube', async () => {
  const r = await narrar(rica('escena_lago_espejos'), { tipo: 'texto', texto: 'saco la bolsa' }, op);
  assert.ok(!r.estado.ext?.atencion_ladrones?.valor);
});
test('pagar ≥ 1 de plata en la taberna sube; decae por día', async () => {
  const r = await narrar(rica('escena_taberna_lareth'), { tipo: 'texto', texto: 'quiero una habitación, la compro' }, op);
  assert.ok(r.estado.jugador.plata < 50, r.texto);
  assert.equal(r.estado.ext.atencion_ladrones.valor, 1);
  assert.deepEqual(atencionDecaida({ valor: 3, dia: 1 }, 3), { valor: 1, dia: 3 });
  assert.deepEqual(atencionDecaida({ valor: 1, dia: 1 }, 9), { valor: 0, dia: 9 });
});
test('sin_dinero de t41 al no alcanzar', async () => {
  const e = crearPartida({ semilla: 4 });
  const pobre = { ...e, jugador: { ...e.jugador, bronce: 0, plata: 0 } };
  const r = await narrar(pobre, { tipo: 'texto', texto: 'compro pan fresco' }, op);
  assert.ok(amp.economia.pagos.sin_dinero.includes(r.texto.split('\n')[0]) || amp.economia.pagos.sin_dinero.some((l) => r.texto.includes(l)), r.texto);
});

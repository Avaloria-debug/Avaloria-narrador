import { test } from 'node:test';
import assert from 'node:assert/strict';
import { climaEn, mensajeAmbiental, CLIMAS, PROB_AMBIENTE } from './ambiente.js';
import { crearRng } from './azar.js';
import { extInicial } from './ampliado.js';
import { crearPartida, narrar, cargarPartida } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const esc = 'escena_mercado_circular';

test('ambiente: probabilidad acotada con semilla', () => {
  let n = 0;
  for (let s = 0; s < 400; s++) {
    const ext = { ...extInicial({}), turno: 5 };
    if (mensajeAmbiental({ ext, amp, hechos: { f: 'manana', esc }, escenaId: esc, rng: crearRng(s) })) n++;
  }
  assert.ok(n > 400 * PROB_AMBIENTE * 0.6 && n < 400 * PROB_AMBIENTE * 1.4, String(n));
});

test('ambiente: nunca dos turnos seguidos', () => {
  const ext = { ...extInicial({}), turno: 6, ultimoAmbiente: 5 };
  for (let s = 0; s < 100; s++) assert.equal(mensajeAmbiental({ ext, amp, hechos: { f: 'manana' }, escenaId: esc, rng: crearRng(s) }), null);
});

test('ambiente: no repite dentro de la ventana de 8', () => {
  let ext = extInicial({});
  const vistos = [];
  for (let t = 1; t < 400 && vistos.length < 12; t += 2) {
    ext = { ...ext, turno: t };
    const r = mensajeAmbiental({ ext, amp, hechos: { f: 'manana', esc }, escenaId: esc, rng: crearRng(t) });
    if (r) { assert.ok(!vistos.slice(-8).includes(r.texto)); vistos.push(r.texto); ext = r.ext; }
  }
  assert.ok(vistos.length >= 8);
});

test('ambiente: el clima cambia por bloques de 6 h y es reproducible', () => {
  assert.equal(climaEn(7, { dia: 1, hora: '01:00' }), climaEn(7, { dia: 1, hora: '05:59' }));
  const vistos = new Set();
  for (let d = 1; d < 30; d++) for (const h of ['00:00', '06:00', '12:00', '18:00']) vistos.add(climaEn(7, { dia: d, hora: h }));
  assert.deepEqual([...vistos].sort(), [...CLIMAS].sort());
  assert.equal(climaEn(null, { dia: 1, hora: '01:00' }), 'despejado');
});

test('ambiente: partida vieja → despejado; sin datos → nada', () => {
  assert.equal(extInicial(undefined).clima, 'despejado');
  assert.equal(mensajeAmbiental({ ext: extInicial({}), amp: { ambiente: {} }, hechos: {}, escenaId: esc, rng: () => 0 }), null);
});

test('ambiente: sin ampliado, narrar no agrega ext ni cambia el texto', async () => {
  const e = crearPartida({ semilla: 3 });
  const a = await narrar(e, { tipo: 'boton', intencionId: 'intencion_observar' });
  assert.equal(a.estado.ext, undefined);
  const b = await narrar(e, { tipo: 'boton', intencionId: 'intencion_observar' }, { ampliado: amp });
  assert.equal(typeof b.texto, 'string');
  assert.ok(b.estado.ext);
  assert.deepEqual(cargarPartida(JSON.parse(JSON.stringify(b.estado))).ext, b.estado.ext);
});

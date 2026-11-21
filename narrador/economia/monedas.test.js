import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalBronce, conTotal, formatoMonto, precioDe, baseDe, PRECIOS } from './monedas.js';
import { leerEconomia } from './index.js';
import { crearPartida, narrar } from '../index.js';
import { cargarAmpliadoNode } from '../contenidoAmpliado.js';

test('conversión y total en bronce', () => {
  assert.equal(totalBronce({ bronce: 20, plata: 3 }), 320);
  assert.equal(totalBronce({ bronce: 1, plata: 0, oro: 1 }), 10001);
  assert.deepEqual(conTotal({ nombre: 'x', bronce: 0, plata: 0 }, 120), { nombre: 'x', bronce: 20, plata: 1 });
  assert.deepEqual(conTotal({ bronce: 5, plata: 1 }, -40), { bronce: 0, plata: 0 });
});
test('formato natural, siempre con moneda', () => {
  assert.equal(formatoMonto(500), '5 de plata');
  assert.equal(formatoMonto(120), '1 de plata y 20 de bronce');
  assert.equal(formatoMonto(7), '7 de bronce');
  assert.equal(formatoMonto(0), '0 de bronce');
  assert.equal(formatoMonto(1030201), '1 de platino, 3 de oro, 2 de plata y 1 de bronce');
  assert.equal(formatoMonto(NaN), '0 de bronce');
});
test('modificadores: lluvia, invierno, festividad, importado, relación', () => {
  assert.equal(precioDe('pan_fresco', {}), 10);
  assert.equal(precioDe('pan_fresco', { clima: 'lluvia' }), 12);
  assert.equal(precioDe('vela', { estacion: 'invierno' }), 10);
  assert.equal(precioDe('habitacion_pobre', { festividad: { id: 'x' } }), 750);
  assert.equal(precioDe('pan_fresco', { relacion: -2 }), 13);
  assert.equal(precioDe('pan_fresco', { relacion: 2 }), 9);
  const h = precioDe('herramienta_caelumia', { semillaBase: 1, dia: 1, vendedor: 'ivor_cambista' });
  assert.ok(h >= 1200 && h <= 3000);
});
test('rangos: fijos por día y vendedor; sin NaN ni negativos', () => {
  const a = baseDe('pescado', { semillaBase: 9, dia: 2, vendedor: 'ysolde_pescadora' });
  assert.equal(a, baseDe('pescado', { semillaBase: 9, dia: 2, vendedor: 'ysolde_pescadora' }));
  for (const clave of Object.keys(PRECIOS.base)) for (let d = 1; d < 20; d++) {
    const p = precioDe(clave, { semillaBase: d, dia: d, vendedor: 'v', relacion: (d % 5) - 2, clima: d % 2 ? 'lluvia' : 'despejado' });
    assert.ok(Number.isInteger(p) && p >= 1, `${clave} ${p}`);
  }
  assert.equal(precioDe('inexistente', {}), null);
});
test('comprensión: cuánto cuesta, precio de, compro, vendo, pago', () => {
  assert.deepEqual(leerEconomia('¿Cuánto cuesta el pan?'), { tipo: 'precio', producto: 'pan_fresco' });
  assert.deepEqual(leerEconomia('precio del pescado'), { tipo: 'precio', producto: 'pescado' });
  assert.deepEqual(leerEconomia('compro pan viejo'), { tipo: 'compra', producto: 'pan_viejo' });
  assert.equal(leerEconomia('vendo la daga').tipo, 'venta');
  assert.equal(leerEconomia('pago').tipo, 'pago');
  assert.equal(leerEconomia('miro el pan'), null);
});
test('narrar con ampliado: precio y compra de pan con Serel; sin ampliado no cambia', async () => {
  const amp = await cargarAmpliadoNode({ cargarPendientes: true });
  let e = crearPartida({ semilla: 4 });
  const sin = await narrar(e, { tipo: 'texto', texto: 'cuánto cuesta el pan' });
  assert.ok(!/de bronce/.test(sin.texto));
  const r = await narrar(e, { tipo: 'texto', texto: 'cuánto cuesta el pan' }, { ampliado: amp, ahora: () => 0 });
  assert.match(r.texto, /\d+ de (bronce|plata)/);
  const antes = totalBronce(r.estado.jugador);
  const c = await narrar(r.estado, { tipo: 'texto', texto: 'compro pan' }, { ampliado: amp, ahora: () => 0 });
  assert.ok(totalBronce(c.estado.jugador) < antes);
  assert.ok(c.estado.inventario.some((x) => x.objetoId === 'objeto_pan_fresco'));
});

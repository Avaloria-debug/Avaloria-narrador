import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estacionDe, festividadActiva, diaDelAnio } from './calendario.js';
import { hechosDe } from './seleccion.js';
import { contexto, extInicial } from './ampliado.js';
import { crearPartida, contenido } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const fest = { cosecha: { ciudad: 'Ardenhall', estacion: 'otono', dias: 3, lineas: ['x'] } };
const mercado = contenido.escenas.find((e) => e.id === 'escena_mercado_circular');
const lago = contenido.escenas.find((e) => e.id === 'escena_lago_espejos');

test('calendario: transición de estación', () => {
  assert.equal(estacionDe(1), 'primavera');
  assert.equal(estacionDe(90), 'primavera');
  assert.equal(estacionDe(91), 'verano');
  assert.equal(estacionDe(271), 'invierno');
  assert.equal(estacionDe(361), 'primavera');
  assert.equal(diaDelAnio(361), 1);
});

test('calendario: festividad activa e inactiva', () => {
  const fechas = { cosecha: { diaDelAnio: 200 } };
  assert.equal(festividadActiva(fest, fechas, { dia: 200, escena: mercado }), 'cosecha');
  assert.equal(festividadActiva(fest, fechas, { dia: 202, escena: mercado }), 'cosecha');
  assert.equal(festividadActiva(fest, fechas, { dia: 203, escena: mercado }), null);
  assert.equal(festividadActiva(fest, fechas, { dia: 200, escena: lago }), null);
  assert.equal(festividadActiva(fest, {}, { dia: 200, escena: mercado }), null);
});

test('calendario: partida vieja (sin ext) → estación por el día; hechos con estación', async () => {
  const amp = await cargarAmpliadoNode({ cargarPendientes: true, incluirCanon: true });
  const e = crearPartida({ semilla: 1 });
  const ctx = contexto({ amp, contenido, despues: e, turno: {}, ext: { ...extInicial(undefined, 1), turno: 1 } });
  assert.equal(ctx.hechos().estacion, 'primavera');
  assert.equal(ctx.hechos().festividad, undefined);
  assert.equal(hechosDe(e, { contenido }).estacion, undefined);
});

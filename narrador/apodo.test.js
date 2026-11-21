import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivarApodo, apodoPara } from './apodo.js';
import { crearRng } from './azar.js';
import { crearPartida, narrar, cargarPartida } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const tabla = { ayudar: ['el Servicial'], atacar: ['el Violento'], negociar: ['el Regateador'] };
const h = (tipo, n, peso = 2) => Array.from({ length: n }, () => ({ tipo, peso }));

test('apodo: derivación (hecho fuerte o ≥5 usos)', () => {
  assert.equal(derivarApodo(null, h('ayudar', 4), tabla, crearRng(1)), null);
  assert.equal(derivarApodo(null, h('ayudar', 5), tabla, crearRng(1)).texto, 'el Servicial');
  assert.equal(derivarApodo(null, h('atacar', 1, 3), tabla, crearRng(1)).texto, 'el Violento');
});

test('apodo: cambia solo si otro supera por ≥2 puntos', () => {
  const a = derivarApodo(null, h('ayudar', 5), tabla, crearRng(1));
  const casi = derivarApodo(a, [...h('ayudar', 5), ...h('negociar', 5), { tipo: 'negociar', peso: 1 }], tabla, crearRng(1));
  assert.equal(casi.verbo, 'ayudar');
  const supera = derivarApodo(a, [...h('ayudar', 5), ...h('negociar', 6)], tabla, crearRng(1));
  assert.equal(supera.verbo, 'negociar');
});

test('apodo: NPC sin relación (mala) → base', () => {
  const a = { verbo: 'ayudar', texto: 'el Servicial' };
  assert.equal(apodoPara(a, 'el Forastero', 'mala'), 'el Forastero');
  assert.equal(apodoPara(a, 'el Forastero', 'neutra'), 'el Servicial');
  assert.equal(apodoPara(null, 'el Forastero', 'buena'), 'el Forastero');
});

test('apodo: persiste con la partida', async () => {
  const amp = await cargarAmpliadoNode({ cargarPendientes: true });
  let e = crearPartida({ semilla: 1 });
  for (let i = 0; i < 6; i++) e = (await narrar(e, { tipo: 'boton', intencionId: 'intencion_ayudar', parametros: { npcId: 'serel_panadero' } }, { ampliado: amp })).estado;
  assert.equal(e.ext.apodo?.verbo, 'ayudar');
  assert.deepEqual(cargarPartida(JSON.stringify(e)).ext.apodo, e.ext.apodo);
});

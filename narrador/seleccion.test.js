import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegir, cumple, hechosDe, franjaDe } from './seleccion.js';
import { elegirPlantilla } from './narracion.js';
import { crearRng, derivar } from './azar.js';
import { contenido } from './index.js';

test('seleccion: la variante más específica gana', () => {
  const v = ['genérica', { c: { f: 'noche' }, t: 'de noche' }, { c: { f: 'noche', cl: 'lluvia' }, t: 'noche y lluvia' }];
  assert.equal(elegir(v, { f: 'noche', cl: 'lluvia' }, { rng: crearRng(1) }).texto, 'noche y lluvia');
  assert.equal(elegir(v, { f: 'noche', cl: 'niebla' }, { rng: crearRng(1) }).texto, 'de noche');
});

test('seleccion: genérica de respaldo', () => {
  const v = ['genérica', { c: { f: 'noche' }, t: 'de noche' }];
  assert.equal(elegir(v, { f: 'manana' }, { rng: crearRng(1) }).texto, 'genérica');
  assert.equal(elegir([{ c: { f: 'noche' }, t: 'x' }], { f: 'manana' }, { rng: crearRng(1) }), null);
});

test('seleccion: listas, 3+ y clave ausente', () => {
  assert.ok(cumple({ f: ['tarde', 'noche'] }, { f: 'noche' }));
  assert.ok(!cumple({ f: ['tarde', 'noche'] }, { f: 'manana' }));
  assert.ok(cumple({ vis: '3+' }, { vis: '3+' }));
  assert.ok(cumple({ rec: 'ayudar' }, { rec: ['presionar', 'ayudar'] }));
  assert.ok(!cumple({ cl: 'lluvia' }, { f: 'noche' }));
});

test('seleccion: desempate por aperturas', () => {
  const v = ['Uno dos', 'Otro tres'];
  for (let s = 0; s < 20; s++) assert.equal(elegir(v, {}, { rng: crearRng(s), aperturas: ['uno'] }).texto, 'Otro tres');
});

test('seleccion: hechosDe con franja, relación y categoría', () => {
  assert.equal(franjaDe('05:59'), 'madrugada');
  assert.equal(franjaDe('19:00'), 'noche');
  const estado = { reloj: { dia: 1, hora: '13:00' }, jugador: { escenaId: contenido.escenas[0].id }, npcs: { a: { relacion: 50 } } };
  const h = hechosDe(estado, { contenido, npcId: 'a' });
  assert.equal(h.f, 'tarde');
  assert.equal(h.r, 'buena');
  assert.equal(h.cat, 'ciudad');
  assert.equal(h.ts, 'baja');
  assert.equal(h.cl, undefined);
});

test('seleccion: sin `c` la elección de plantillas es idéntica (retrocompatibilidad)', () => {
  const lista = contenido.plantillas.intencion_examinar.exito;
  for (let s = 0; s < 30; s++) {
    const a = elegirPlantilla(lista, { objeto: 'x', npc: 'y', lugar: 'z' }, { rng: crearRng(s), aperturas: [] });
    const b = elegirPlantilla(lista, { objeto: 'x', npc: 'y', lugar: 'z' }, { rng: crearRng(s), aperturas: [], hechos: { f: 'noche' } });
    assert.deepEqual(a, b);
  }
});

test('seleccion: rng derivado reproducible y distinto por nombre', () => {
  assert.equal(derivar(5, 'seleccion')(), derivar(5, 'seleccion')());
  assert.notEqual(derivar(5, 'seleccion')(), derivar(5, 'gramatica')());
});

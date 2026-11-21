import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esNoEntendida, guardarNoEntendida, leerNoEntendidas, exportarNoEntendidas, MAX_NO_ENTENDIDAS, CLAVE_NO_ENTENDIDAS } from './noEntendidas.js';

const almacen = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const estado = { jugador: { escenaId: 'escena_mercado_circular' }, ext: { focos: [{ id: 'gata_mercado', visto: 3 }, { id: 'perro_ciudad', visto: 1 }] } };

test('detecta reformulación, sin_ia y aclaración pendiente', () => {
  assert.equal(esNoEntendida({ tipo: 'reformulacion', errores: [] }), true);
  assert.equal(esNoEntendida({ tipo: 'narracion', errores: ['ia: sin_ia: sin_clave'] }), true);
  assert.equal(esNoEntendida({ tipo: 'narracion', errores: [], estado: { ext: { aclaracion: { opciones: ['a', 'b'] } } } }), true);
  assert.equal(esNoEntendida({ tipo: 'narracion', errores: [], estado: { ext: {} } }), false);
  assert.equal(esNoEntendida(null), false);
});
test('guarda con escena y foco reciente, sin repetir', () => {
  const s = almacen();
  guardarNoEntendida(s, 'bailo un tango', estado);
  guardarNoEntendida(s, 'bailo un tango', estado);
  assert.deepEqual(leerNoEntendidas(s), [{ frase: 'bailo un tango', escena: 'escena_mercado_circular', ctx: 'gata_mercado' }]);
});
test('máximo 200, se quedan las más nuevas', () => {
  const s = almacen();
  for (let i = 0; i < MAX_NO_ENTENDIDAS + 5; i++) guardarNoEntendida(s, `frase ${i}`, estado);
  const l = leerNoEntendidas(s);
  assert.equal(l.length, MAX_NO_ENTENDIDAS);
  assert.equal(l.at(-1).frase, `frase ${MAX_NO_ENTENDIDAS + 4}`);
});
test('almacenamiento roto o ilegible no lanza', () => {
  const malo = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.doesNotThrow(() => guardarNoEntendida(malo, 'hola', estado));
  const s = almacen(); s.setItem(CLAVE_NO_ENTENDIDAS, '{no json');
  assert.deepEqual(leerNoEntendidas(s), []);
});
test('exporta con el formato del corpus', () => {
  const s = almacen(); guardarNoEntendida(s, 'tiro la moneda', estado);
  const j = JSON.parse(exportarNoEntendidas(s));
  assert.deepEqual(j.casos[0], { frase: 'tiro la moneda', accion: '?', cat: 'jugadas', ctx: 'gata_mercado', escena: 'escena_mercado_circular' });
});

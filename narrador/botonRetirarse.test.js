// El botón "retirarse" y la frase "salir de acá" siguen el mismo camino.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, contenido, diccionarios } from './index.js';
import { ejecutarTurno } from './turno.js';
import { rngSembrado } from './utilsPrueba.js';
import { MOTIVOS } from './motivos.js';

const en = (escenaId) => {
  const e = crearPartida({ semilla: 4 });
  return { ...e, jugador: { ...e.jugador, escenaId } };
};
const correr = (estado, entrada, c = contenido) => ejecutarTurno(estado, entrada, { contenido: c, rng: rngSembrado(9), diccionarios });
const frase = { tipo: 'texto', texto: 'salir de acá' };
const boton = { tipo: 'boton', intencionId: 'intencion_retirarse', parametros: {} };

describe('botón retirarse = "salir de acá"', () => {
  test('una salida: mismo movimiento a esa salida', () => {
    const a = correr(en('escena_taberna_lareth'), frase);
    const b = correr(en('escena_taberna_lareth'), boton);
    assert.equal(b.estado.jugador.escenaId, 'escena_plaza_cambistas');
    assert.deepEqual(b, a);
  });

  test('varias salidas: mismo destino_ambiguo, con los nombres de las salidas', () => {
    const a = correr(en('escena_plaza_cambistas'), frase);
    const b = correr(en('escena_plaza_cambistas'), boton);
    assert.equal(b.tipo, 'reformular');
    assert.equal(b.motivo, MOTIVOS.DESTINO_AMBIGUO);
    assert.deepEqual(b.datos.opciones.length, 3);
    assert.deepEqual(b, a);
  });

  test('ninguna salida: mismo sin_salidas', () => {
    const sin = { ...contenido, escenas: contenido.escenas.map((e) => (e.id === 'escena_taberna_lareth' ? { ...e, salidas: [] } : e)) };
    const a = correr(en('escena_taberna_lareth'), frase, sin);
    const b = correr(en('escena_taberna_lareth'), boton, sin);
    assert.equal(b.motivo, MOTIVOS.SIN_SALIDAS);
    assert.deepEqual(b, a);
  });
});

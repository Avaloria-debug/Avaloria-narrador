import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  relojInicial,
  avanzar,
  comparar,
  minutosDeHora,
  minutosAbsolutos,
  esHora,
  proximaOcurrencia,
  ultimaOcurrencia,
  ocurreEntre,
  yaPaso,
} from './reloj.js';
import { leerContenido } from './cargarContenido.js';

const r = (dia, hora) => ({ dia, hora });

describe('reloj — inicio y formato', () => {
  test('reloj inicial: día 1, 08:00, desde reglas.relojInicial', async () => {
    assert.deepEqual(relojInicial(await leerContenido()), r(1, '08:00'));
    assert.deepEqual(relojInicial({ reglas: { relojInicial: 'tarde (17:30)' } }), r(1, '17:30'));
    assert.throws(() => relojInicial({ reglas: { relojInicial: 'mañana' } }), /relojInicial/);
  });

  test('horas válidas e inválidas', () => {
    assert.equal(minutosDeHora('00:00'), 0);
    assert.equal(minutosDeHora('23:59'), 1439);
    for (const mala of ['24:00', '8:00', '08:60', '0800', '', null, 8]) {
      assert.equal(esHora(mala), false);
      assert.throws(() => minutosDeHora(mala), TypeError);
    }
    assert.throws(() => minutosAbsolutos(r(0, '08:00')), TypeError);
  });
});

describe('reloj — avanzar', () => {
  test('suma horas dentro del día', () => {
    assert.deepEqual(avanzar(r(1, '08:00'), 1), r(1, '09:00'));
    assert.deepEqual(avanzar(r(1, '08:00'), 0), r(1, '08:00'));
    assert.deepEqual(avanzar(r(1, '08:00'), 15), r(1, '23:00'));
    assert.deepEqual(avanzar(r(1, '08:30'), 1.5), r(1, '10:00'));
  });

  test('cruza la medianoche y pasa de día', () => {
    assert.deepEqual(avanzar(r(1, '23:00'), 1), r(2, '00:00'));
    assert.deepEqual(avanzar(r(1, '22:00'), 5), r(2, '03:00'));
    assert.deepEqual(avanzar(r(3, '08:00'), 24), r(4, '08:00'));
  });

  test('viajes largos: 36, 44 y 52 horas', () => {
    assert.deepEqual(avanzar(r(1, '08:00'), 36), r(2, '20:00'));
    assert.deepEqual(avanzar(r(1, '08:00'), 44), r(3, '04:00'));
    assert.deepEqual(avanzar(r(1, '08:00'), 52), r(3, '12:00'));
  });

  test('no modifica el reloj recibido', () => {
    const antes = Object.freeze(r(1, '23:00'));
    const despues = avanzar(antes, 2);
    assert.deepEqual(antes, r(1, '23:00'));
    assert.notEqual(despues, antes);
  });

  test('horas inválidas', () => {
    for (const mala of [-1, NaN, Infinity, '2', null]) assert.throws(() => avanzar(r(1, '08:00'), mala), RangeError);
  });
});

describe('reloj — comparar horas', () => {
  test('comparar y yaPaso', () => {
    assert.ok(comparar(r(1, '08:00'), r(1, '09:00')) < 0);
    assert.ok(comparar(r(2, '00:00'), r(1, '23:59')) > 0);
    assert.equal(comparar(r(2, '05:00'), r(2, '05:00')), 0);
    assert.equal(yaPaso(r(2, '05:00'), r(2, '05:00')), true);
    assert.equal(yaPaso(r(2, '04:59'), r(2, '05:00')), false);
    // Las 05:00 del día 2 son posteriores a las 21:00 del día 1.
    assert.equal(yaPaso(r(1, '23:00'), r(2, '05:00')), false);
  });

  test('próxima ocurrencia: el mismo día o cruzando la medianoche', () => {
    assert.deepEqual(proximaOcurrencia(r(1, '07:00'), '12:00'), r(1, '12:00'));
    assert.deepEqual(proximaOcurrencia(r(1, '21:00'), '05:00'), r(2, '05:00'));
    assert.deepEqual(proximaOcurrencia(r(1, '23:30'), '06:00'), r(2, '06:00'));
    // La misma hora es la del día siguiente.
    assert.deepEqual(proximaOcurrencia(r(1, '12:00'), '12:00'), r(2, '12:00'));
  });

  test('ocurreEntre: desde sin incluir, hasta incluido', () => {
    assert.equal(ocurreEntre(r(1, '08:00'), r(1, '10:00'), '09:00'), true);
    assert.equal(ocurreEntre(r(1, '08:00'), r(1, '10:00'), '10:00'), true);
    assert.equal(ocurreEntre(r(1, '08:00'), r(1, '10:00'), '08:00'), false);
    assert.equal(ocurreEntre(r(1, '08:00'), r(1, '10:00'), '08:00', { incluirDesde: true }), true);
    assert.equal(ocurreEntre(r(1, '08:00'), r(1, '10:00'), '11:00'), false);
    assert.equal(ocurreEntre(r(1, '08:00'), r(1, '08:00'), '08:00'), false);
  });

  test('ocurreEntre con cruce de medianoche', () => {
    assert.equal(ocurreEntre(r(1, '22:00'), r(2, '03:00'), '01:00'), true);
    assert.equal(ocurreEntre(r(1, '22:00'), r(2, '03:00'), '23:00'), true);
    assert.equal(ocurreEntre(r(1, '22:00'), r(2, '03:00'), '05:00'), false);
    assert.equal(ocurreEntre(r(1, '22:00'), r(2, '03:00'), '21:00'), false);
  });

  test('ultimaOcurrencia en un salto de varios días devuelve la más reciente', () => {
    assert.deepEqual(ultimaOcurrencia(r(1, '08:00'), r(3, '12:00'), '07:00'), r(3, '07:00'));
    assert.deepEqual(ultimaOcurrencia(r(1, '08:00'), r(3, '12:00'), '19:00'), r(2, '19:00'));
    assert.equal(ultimaOcurrencia(r(1, '08:00'), r(1, '09:00'), '07:00'), null);
  });
});

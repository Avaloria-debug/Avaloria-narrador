import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { estadoDeEscena, estadoPropio, gravedad, ESTADO_BASE } from './estadoEscena.js';
import { leerContenido } from './cargarContenido.js';

let contenido;
before(async () => {
  contenido = await leerContenido();
});

// Mapa mínimo: A <-> B <-> C, y D sola. Un evento por estado, más un neutro.
const estados = ['tranquilo', 'social', 'sigilo', 'tenso', 'peligroso', 'combate'];
const mini = {
  escenas: [
    { id: 'a', salidas: ['b'] },
    { id: 'b', salidas: ['a', 'c'] },
    { id: 'c', salidas: ['b'] },
    { id: 'd', salidas: [] },
  ],
  eventos: [...estados.map((e) => ({ id: `ev_${e}`, estado: e })), { id: 'ev_neutro', estado: null }],
};
const en = (escenaId, ...nombres) => nombres.map((n) => ({ id: `ev_${n}`, escenaId, turnosRestantes: null, horaFin: null }));

describe('estado de escena — propio', () => {
  test('orden de gravedad del vocabulario', () => {
    assert.deepEqual(estados.map(gravedad), [0, 1, 2, 3, 4, 5]);
    assert.equal(ESTADO_BASE, 'tranquilo');
  });

  test('sin eventos: tranquilo', () => {
    assert.equal(estadoDeEscena('a', [], mini), 'tranquilo');
    assert.equal(estadoDeEscena('a', undefined, mini), 'tranquilo');
  });

  test('un evento: su estado', () => {
    for (const e of estados) assert.equal(estadoDeEscena('d', en('d', e), mini), e);
  });

  test('dos eventos: gana el de mayor gravedad, en cualquier orden', () => {
    assert.equal(estadoDeEscena('d', en('d', 'social', 'peligroso'), mini), 'peligroso');
    assert.equal(estadoDeEscena('d', en('d', 'combate', 'tenso'), mini), 'combate');
    assert.equal(estadoDeEscena('d', en('d', 'sigilo', 'social'), mini), 'sigilo');
    assert.equal(estadoDeEscena('d', en('d', 'tranquilo', 'tenso'), mini), 'tenso');
  });

  test('los neutros no producen estado', () => {
    assert.equal(estadoDeEscena('d', en('d', 'neutro'), mini), 'tranquilo');
    assert.equal(estadoDeEscena('d', en('d', 'neutro', 'social'), mini), 'social');
  });

  test('un evento que no está en el contenido no cuenta', () => {
    assert.equal(estadoDeEscena('d', [{ id: 'ev_fantasma', escenaId: 'd' }], mini), 'tranquilo');
  });
});

describe('estado de escena — regla de vecina', () => {
  test('vecina más grave: sube un nivel, nunca más', () => {
    assert.equal(estadoDeEscena('a', en('b', 'combate'), mini), 'social');
    assert.equal(estadoDeEscena('a', en('b', 'social'), mini), 'social');
    assert.equal(estadoDeEscena('a', [...en('a', 'social'), ...en('b', 'combate')], mini), 'sigilo');
    assert.equal(estadoDeEscena('a', [...en('a', 'peligroso'), ...en('b', 'combate')], mini), 'combate');
  });

  test('vecina igual o menos grave: no cambia', () => {
    assert.equal(estadoDeEscena('a', [...en('a', 'tenso'), ...en('b', 'tenso')], mini), 'tenso');
    assert.equal(estadoDeEscena('a', [...en('a', 'tenso'), ...en('b', 'social')], mini), 'tenso');
    assert.equal(estadoDeEscena('a', [...en('a', 'combate'), ...en('b', 'combate')], mini), 'combate');
  });

  test('varias vecinas más graves suben un solo nivel', () => {
    assert.equal(estadoDeEscena('b', [...en('a', 'combate'), ...en('c', 'peligroso')], mini), 'social');
  });

  test('solo cuentan las vecinas directas y su estado propio', () => {
    // C está a dos saltos de A: no la afecta, ni siquiera a través de B.
    assert.equal(estadoDeEscena('a', en('c', 'combate'), mini), 'tranquilo');
    assert.equal(estadoDeEscena('b', en('c', 'combate'), mini), 'social');
    assert.equal(estadoDeEscena('d', en('b', 'combate'), mini), 'tranquilo');
  });

  test('un neutro en la vecina no sube nada', () => {
    assert.equal(estadoDeEscena('a', en('b', 'neutro'), mini), 'tranquilo');
  });

  test('estadoPropio ignora a las vecinas', () => {
    assert.equal(estadoPropio('a', en('b', 'combate'), mini), 'tranquilo');
  });
});

describe('estado de escena — contenido real', () => {
  const activo = (id, escenaId) => ({ id, escenaId, turnosRestantes: null, horaFin: null });

  test('emboscada en el lago: combate en el lago, un nivel más en el camino del norte', () => {
    const activos = [activo('evento_emboscada_lago', 'escena_lago_espejos')];
    assert.equal(estadoDeEscena('escena_lago_espejos', activos, contenido), 'combate');
    assert.equal(estadoDeEscena('escena_camino_norte', activos, contenido), 'social');
    assert.equal(estadoDeEscena('escena_mercado_circular', activos, contenido), 'tranquilo');
  });

  test('la tormenta de verano es neutra', () => {
    const activos = [activo('evento_tormenta_verano', 'escena_camino_sur')];
    assert.equal(estadoDeEscena('escena_camino_sur', activos, contenido), 'tranquilo');
  });

  test('cada evento del contenido da su estado, o tranquilo si es neutro', () => {
    for (const ev of contenido.eventos) {
      const escenaId = ev.escenas[0];
      assert.equal(estadoPropio(escenaId, [activo(ev.id, escenaId)], contenido), ev.estado ?? 'tranquilo', ev.id);
    }
  });
});

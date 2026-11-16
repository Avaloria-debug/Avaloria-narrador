import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { escenaDeNpc, posicionesDeNpcs, npcsEnEscena, moverNpcs } from './movimientoNpcs.js';
import { avanzar } from './reloj.js';
import { leerContenido } from './cargarContenido.js';

let contenido;
before(async () => {
  contenido = await leerContenido();
});
const r = (dia, hora) => ({ dia, hora });
const def = (id) => contenido.npcs.find((n) => n.id === id);
const donde = (id, reloj) => escenaDeNpc(def(id), reloj, contenido);

describe('movimiento — Sarin rota entre los tres caminos cada 8 horas', () => {
  test('arranca en su escena inicial y sigue el orden norte, este, sur', () => {
    const horario = [
      [r(1, '08:00'), 'escena_camino_este'],
      [r(1, '15:00'), 'escena_camino_este'],
      [r(1, '16:00'), 'escena_camino_sur'],
      [r(1, '23:00'), 'escena_camino_sur'],
      [r(2, '00:00'), 'escena_camino_norte'],
      [r(2, '07:00'), 'escena_camino_norte'],
      [r(2, '08:00'), 'escena_camino_este'],
      [r(2, '16:00'), 'escena_camino_sur'],
      [r(3, '00:00'), 'escena_camino_norte'],
    ];
    for (const [reloj, escena] of horario) assert.equal(donde('sarin_mensajera', reloj), escena, JSON.stringify(reloj));
  });

  test('vuelve al mismo camino cada 24 horas', () => {
    for (let h = 0; h < 96; h++) {
      const reloj = avanzar(r(1, '08:00'), h);
      assert.equal(donde('sarin_mensajera', reloj), donde('sarin_mensajera', avanzar(reloj, 24)));
    }
  });
});

describe('movimiento — Brenn alterna entre norte y sur cada 24 horas', () => {
  test('horario', () => {
    const horario = [
      [r(1, '08:00'), 'escena_camino_norte'],
      [r(2, '07:00'), 'escena_camino_norte'],
      [r(2, '08:00'), 'escena_camino_sur'],
      [r(3, '07:00'), 'escena_camino_sur'],
      [r(3, '08:00'), 'escena_camino_norte'],
      [r(4, '08:00'), 'escena_camino_sur'],
    ];
    for (const [reloj, escena] of horario) assert.equal(donde('brenn_arriero', reloj), escena, JSON.stringify(reloj));
  });

  test('nunca está en el camino del este', () => {
    for (let h = 0; h < 200; h++) {
      assert.notEqual(donde('brenn_arriero', avanzar(r(1, '08:00'), h)), 'escena_camino_este');
    }
  });
});

describe('movimiento — Ysolde y Hollis alternan cada 12 horas', () => {
  test('Ysolde: lago y camino del norte', () => {
    assert.equal(donde('ysolde_pescadora', r(1, '08:00')), 'escena_lago_espejos');
    assert.equal(donde('ysolde_pescadora', avanzar(r(1, '08:00'), 11)), 'escena_lago_espejos');
    assert.equal(donde('ysolde_pescadora', avanzar(r(1, '08:00'), 12)), 'escena_camino_norte');
    assert.equal(donde('ysolde_pescadora', avanzar(r(1, '08:00'), 24)), 'escena_lago_espejos');
    assert.equal(donde('ysolde_pescadora', avanzar(r(1, '08:00'), 36)), 'escena_camino_norte');
  });

  test('Hollis: camino del sur y cruce de colinas', () => {
    assert.equal(donde('hollis_pastor', r(1, '08:00')), 'escena_camino_sur');
    assert.equal(donde('hollis_pastor', avanzar(r(1, '08:00'), 11)), 'escena_camino_sur');
    assert.equal(donde('hollis_pastor', avanzar(r(1, '08:00'), 12)), 'escena_cruce_colinas');
    assert.equal(donde('hollis_pastor', avanzar(r(1, '08:00'), 24)), 'escena_camino_sur');
    assert.equal(donde('hollis_pastor', avanzar(r(1, '08:00'), 36)), 'escena_cruce_colinas');
  });

  test('a las 20:00 se mueven los dos', () => {
    assert.deepEqual(moverNpcs(r(1, '19:00'), r(1, '20:00'), contenido).map((m) => [m.npcId, m.hasta]), [
      ['ysolde_pescadora', 'escena_camino_norte'],
      ['hollis_pastor', 'escena_cruce_colinas'],
    ]);
  });
});

describe('movimiento — los demás quedan fijos', () => {
  test('ocho NPCs no se mueven nunca', () => {
    const fijos = contenido.npcs.filter((n) => n.movimiento === null);
    assert.equal(fijos.length, 8);
    for (const n of fijos) {
      for (const h of [0, 7, 8, 24, 100, 1000]) {
        assert.equal(escenaDeNpc(n, avanzar(r(1, '08:00'), h), contenido), n.escenaInicialId, n.id);
      }
    }
  });
});

describe('movimiento — al avanzar el reloj', () => {
  test('sin cambio de franja no se mueve nadie', () => {
    assert.deepEqual(moverNpcs(r(1, '08:00'), r(1, '15:00'), contenido), []);
    assert.deepEqual(moverNpcs(r(1, '08:00'), r(1, '08:00'), contenido), []);
  });

  test('a las 16:00 se mueve Sarin', () => {
    assert.deepEqual(moverNpcs(r(1, '15:00'), r(1, '16:00'), contenido), [
      { npcId: 'sarin_mensajera', desde: 'escena_camino_este', hasta: 'escena_camino_sur' },
    ]);
  });

  test('a las 08:00 del día 2 se mueven cuatro', () => {
    assert.deepEqual(moverNpcs(r(2, '07:00'), r(2, '08:00'), contenido), [
      { npcId: 'brenn_arriero', desde: 'escena_camino_norte', hasta: 'escena_camino_sur' },
      { npcId: 'ysolde_pescadora', desde: 'escena_camino_norte', hasta: 'escena_lago_espejos' },
      { npcId: 'sarin_mensajera', desde: 'escena_camino_norte', hasta: 'escena_camino_este' },
      { npcId: 'hollis_pastor', desde: 'escena_cruce_colinas', hasta: 'escena_camino_sur' },
    ]);
  });

  test('tras un viaje de 36 horas quedan donde les toca a la hora de llegada', () => {
    const llegada = avanzar(r(1, '08:00'), 36); // día 2, 20:00
    const movidos = moverNpcs(r(1, '08:00'), llegada, contenido);
    assert.deepEqual(movidos, [
      { npcId: 'brenn_arriero', desde: 'escena_camino_norte', hasta: 'escena_camino_sur' },
      { npcId: 'ysolde_pescadora', desde: 'escena_lago_espejos', hasta: 'escena_camino_norte' },
      { npcId: 'sarin_mensajera', desde: 'escena_camino_este', hasta: 'escena_camino_sur' },
      { npcId: 'hollis_pastor', desde: 'escena_camino_sur', hasta: 'escena_cruce_colinas' },
    ]);
  });

  test('presentes en una escena según la hora', () => {
    const ids = (escena, reloj) => npcsEnEscena(escena, reloj, contenido).map((n) => n.id);
    assert.deepEqual(ids('escena_camino_norte', r(1, '08:00')), ['brenn_arriero']);
    assert.deepEqual(ids('escena_camino_sur', r(1, '16:00')), ['sarin_mensajera', 'hollis_pastor']);
    assert.deepEqual(ids('escena_camino_norte', r(2, '00:00')), ['brenn_arriero', 'ysolde_pescadora', 'sarin_mensajera']);
    assert.deepEqual(ids('escena_mercado_circular', r(5, '03:00')), ['serel_panadero']);
  });

  test('cada NPC está en una sola escena, y es una escena existente', () => {
    const escenas = new Set(contenido.escenas.map((e) => e.id));
    for (let h = 0; h < 72; h++) {
      const pos = posicionesDeNpcs(avanzar(r(1, '08:00'), h), contenido);
      assert.equal(Object.keys(pos).length, 12);
      for (const escenaId of Object.values(pos)) assert.ok(escenas.has(escenaId));
    }
  });
});

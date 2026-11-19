import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { abrirPersistenciaCasos } from './persistencia.js';
import { escribirTag } from './tags.js';
import {
  candidatos,
  elegirFirma,
  ordenar,
  instanciar,
  armarInstancia,
  leerHistorialJugador,
  ordenesValidos,
  duenosDeConocimientos,
  claveDeOrden,
} from './instancias.js';

const contenido = JSON.parse(readFileSync(new URL('../../data/contenido/contenido-v3.json', import.meta.url), 'utf8'));

// Caso de prueba: no es contenido. Los conocimientos y sus dueños son inventados para el test.
const DUENOS = new Map([
  ['c_a1', 'npc_a'], ['c_b1', 'npc_b'],
  ['c_c1', 'npc_c'], ['c_d1', 'npc_d'],
  ['c_e1', 'npc_e'], ['c_f1', 'npc_f'],
  ['c_a2', 'npc_a'],
]);
const CTX = { duenos: DUENOS };
const caso = (p1 = ['c_a1', 'c_b1'], p2 = ['c_c1', 'c_d1'], p3 = ['c_e1', 'c_f1'], h1 = { id: 'h1', condiciones: { pistas: { p1: 1 } } }) => ({
  id: 'caso_prueba',
  ranuras_pista: [
    { id: 'p1', conocimientos_validos: p1 },
    { id: 'p2', conocimientos_validos: p2 },
    { id: 'p3', conocimientos_validos: p3 },
  ],
  hitos: [h1],
});
const CASO = caso();
const jugada = (firma, usos, ultimaHora, ordenes = {}) => ({ firma, usos, ultimaHora, ordenes });

describe('instancias: candidatos', () => {
  test('8 firmas distintas con el caso de prueba', () => {
    const firmas = candidatos(CASO, {}, CTX);
    assert.equal(firmas.length, 8);
    assert.equal(new Set(firmas.map((f) => f.clave)).size, 8);
    assert.equal(firmas[0].clave, 'p1=c_a1|p2=c_c1|p3=c_e1');
    assert.deepEqual(firmas[0].pistas, [
      { ranura: 'p1', conocimientoId: 'c_a1', npcId: 'npc_a' },
      { ranura: 'p2', conocimientoId: 'c_c1', npcId: 'npc_c' },
      { ranura: 'p3', conocimientoId: 'c_e1', npcId: 'npc_e' },
    ]);
  });

  test('un dueño repetido no aparece en una misma firma', () => {
    // c_a2 es del mismo dueño que c_a1: las firmas con los dos se descartan.
    const firmas = candidatos(caso(['c_a1', 'c_b1'], ['c_a2', 'c_d1']), {}, CTX);
    assert.equal(firmas.length, 6);
    for (const f of firmas) {
      assert.equal(new Set(f.pistas.map((p) => p.npcId)).size, 3, f.clave);
    }
  });

  test('un conocimiento repetido no llena dos ranuras', () => {
    const firmas = candidatos(caso(['c_a1', 'c_b1'], ['c_a1', 'c_d1']), {}, CTX);
    assert.equal(firmas.length, 6);
    for (const f of firmas) {
      assert.equal(new Set(f.pistas.map((p) => p.conocimientoId)).size, 3, f.clave);
    }
  });

  test('rencor grave del dueño excluye su conocimiento de p1', () => {
    const tags = escribirTag([], { tipo: 'rencor', objetivo: 'npc_a', nivel: 3 });
    const firmas = candidatos(CASO, { tags }, CTX);
    assert.equal(firmas.length, 4);
    assert.ok(firmas.every((f) => f.pistas[0].conocimientoId === 'c_b1'));
  });

  test('rencor medio no excluye; rencor grave no excluye de p2 ni p3', () => {
    const medio = escribirTag([], { tipo: 'rencor', objetivo: 'npc_a', nivel: 2 });
    assert.equal(candidatos(CASO, { tags: medio }, CTX).length, 8);
    const enP2 = escribirTag([], { tipo: 'rencor', objetivo: 'npc_c', nivel: 3 });
    assert.equal(candidatos(CASO, { tags: enP2 }, CTX).length, 8);
  });

  test('rencor grave con los dos dueños de p1: la exclusión no se aplica', () => {
    let tags = escribirTag([], { tipo: 'rencor', objetivo: 'npc_a', nivel: 3 });
    tags = escribirTag(tags, { tipo: 'rencor', objetivo: 'npc_b', nivel: 3 });
    assert.equal(candidatos(CASO, { tags }, CTX).length, 8);
  });

  test('un conocimiento con requiereEvento o requiereMarca sigue siendo candidato', () => {
    const duenos = duenosDeConocimientos(contenido);
    const conCompuerta = contenido.npcs
      .flatMap((n) => n.conocimientos.map((c) => ({ ...c, npcId: n.id })))
      .filter((c) => c.requiereEvento || c.requiereMarca);
    const libres = contenido.npcs
      .flatMap((n) => n.conocimientos.map((c) => ({ ...c, npcId: n.id })))
      .filter((c) => !c.requiereEvento && !c.requiereMarca);
    const conEvento = conCompuerta.find((c) => c.requiereEvento);
    const conMarca = conCompuerta.find((c) => c.requiereMarca);
    assert.ok(conEvento && conMarca);
    // Cuatro conocimientos libres de dueños distintos, que no sean los de las compuertas.
    const otros = [];
    for (const c of libres) {
      if ([conEvento.npcId, conMarca.npcId, ...otros.map((o) => o.npcId)].includes(c.npcId)) continue;
      otros.push(c);
      if (otros.length === 4) break;
    }
    const conContenido = caso([conEvento.id, otros[0].id], [conMarca.id, otros[1].id], [otros[2].id, otros[3].id]);
    const firmas = candidatos(conContenido, {}, { contenido });
    assert.equal(firmas.length, 8);
    assert.equal(firmas.filter((f) => f.pistas[0].conocimientoId === conEvento.id).length, 4);
    assert.equal(firmas.filter((f) => f.pistas[1].conocimientoId === conMarca.id).length, 4);
    assert.equal(firmas[0].pistas[0].npcId, duenos.get(conEvento.id));
  });

  test('caso mal armado o conocimiento inexistente: error', () => {
    assert.throws(() => candidatos(caso(['c_a1', 'c_zz']), {}, CTX), /no existe/);
    assert.throws(() => candidatos(caso(['c_a1']), {}, CTX), /2 conocimientos/);
    assert.throws(() => candidatos({ id: 'x', ranuras_pista: [] }, {}, CTX), /3 ranuras/);
    assert.throws(() => candidatos(CASO, {}, {}), /contenido/);
  });
});

describe('instancias: elegir firma', () => {
  const todas = candidatos(CASO, {}, CTX).map((f) => f.clave);

  test('no repite una firma jugada mientras queden no jugadas', () => {
    const instancias = [];
    const vistas = new Set();
    for (let i = 0; i < 8; i++) {
      const firma = elegirFirma(candidatos(CASO, { instancias }, CTX), {}, `semilla_${i}`);
      assert.ok(!vistas.has(firma.clave), `repitió ${firma.clave} en la vuelta ${i}`);
      vistas.add(firma.clave);
      instancias.push(jugada(firma.clave, 1, i));
    }
    assert.equal(vistas.size, 8);
  });

  test('con una sola no jugada, sale esa con cualquier semilla', () => {
    const instancias = todas.slice(1).map((clave, i) => jugada(clave, 3, i));
    for (const semilla of [1, 2, 3, 'x']) {
      assert.equal(elegirFirma(candidatos(CASO, { instancias }, CTX), {}, semilla).clave, todas[0]);
    }
  });

  test('todas jugadas: la de menos usos', () => {
    const instancias = todas.map((clave, i) => jugada(clave, i === 5 ? 1 : 2, i));
    assert.equal(elegirFirma(candidatos(CASO, { instancias }, CTX), {}, 9).clave, todas[5]);
  });

  test('todas jugadas y empate de usos: la más vieja', () => {
    const instancias = todas.map((clave, i) => jugada(clave, 2, i === 3 ? 5 : 100 + i));
    assert.equal(elegirFirma(candidatos(CASO, { instancias }, CTX), {}, 9).clave, todas[3]);
  });

  test('el historial también se puede pasar a elegirFirma', () => {
    const instancias = todas.slice(1).map((clave, i) => jugada(clave, 1, i));
    assert.equal(elegirFirma(candidatos(CASO, {}, CTX), { instancias }, 4).clave, todas[0]);
  });

  test('sin candidatos: error', () => {
    assert.throws(() => elegirFirma([], {}, 1), /no hay firmas/);
  });
});

describe('instancias: orden', () => {
  test('p1 va primera si el primer hito depende de ella', () => {
    assert.deepEqual(ordenesValidos(CASO).map(claveDeOrden), ['p1>p2>p3', 'p1>p3>p2']);
    const libre = caso(undefined, undefined, undefined, { id: 'h1', condiciones: { escena: 'escena_x' } });
    assert.equal(ordenesValidos(libre).length, 6);
    const porEntrega = caso(undefined, undefined, undefined, { id: 'h1', condiciones: {}, escena_entrega: 'escena(p1)' });
    assert.equal(ordenesValidos(porEntrega).length, 2);
  });

  test('la permutación menos usada gana', () => {
    const [firma] = candidatos(CASO, {}, CTX);
    for (const semilla of [1, 2, 3, 4, 5]) {
      assert.deepEqual(ordenar({ ...firma, ordenes: { 'p1>p2>p3': 2, 'p1>p3>p2': 1 } }, semilla), ['p1', 'p3', 'p2']);
      assert.deepEqual(ordenar({ ...firma, ordenes: { 'p1>p2>p3': 1, 'p1>p3>p2': 2 } }, semilla), ['p1', 'p2', 'p3']);
      assert.deepEqual(ordenar({ ...firma, ordenes: { 'p1>p2>p3': 1 } }, semilla), ['p1', 'p3', 'p2']);
    }
  });

  test('con empate decide la semilla, siempre dentro de los órdenes válidos', () => {
    const [firma] = candidatos(CASO, {}, CTX);
    const salidas = new Set();
    for (let s = 0; s < 40; s++) {
      const orden = ordenar(firma, s);
      assert.equal(orden[0], 'p1');
      assert.deepEqual(ordenar(firma, s), orden);
      salidas.add(claveDeOrden(orden));
    }
    assert.equal(salidas.size, 2);
  });
});

describe('instancias: instanciar', () => {
  const abrir = () => abrirPersistenciaCasos({ indexedDB: new IDBFactory(), versionContenido: 'v3.1' });

  test('devuelve la instancia completa y suma el uso', async () => {
    const persistencia = await abrir();
    const historial = await leerHistorialJugador(persistencia, 'jugador_1', CASO.id);
    const instancia = await instanciar(CASO, historial, 7, { ...CTX, persistencia, fecha: 1000 });

    assert.deepEqual(Object.keys(instancia), ['casoId', 'firma', 'pistas', 'semilla']);
    assert.equal(instancia.casoId, 'caso_prueba');
    assert.equal(instancia.semilla, 7);
    assert.equal(instancia.pistas.length, 3);
    assert.deepEqual(instancia.pistas.map((p) => p.ranura), ['p1', 'p2', 'p3']);
    assert.deepEqual(instancia.pistas.map((p) => p.orden).sort(), [1, 2, 3]);
    assert.equal(instancia.pistas[0].orden, 1);
    for (const p of instancia.pistas) {
      assert.equal(p.npcId, DUENOS.get(p.conocimientoId));
      assert.ok(CASO.ranuras_pista.find((r) => r.id === p.ranura).conocimientos_validos.includes(p.conocimientoId));
    }
    assert.equal(instancia.firma, instancia.pistas.map((p) => `${p.ranura}=${p.conocimientoId}`).join('|'));

    const orden = [...instancia.pistas].sort((a, b) => a.orden - b.orden).map((p) => p.ranura).join('>');
    assert.deepEqual(await persistencia.instanciasDeCaso('jugador_1', CASO.id), [
      { firma: instancia.firma, usos: 1, ultimaHora: 1000, ordenes: { [orden]: 1 } },
    ]);
    persistencia.cerrar();
  });

  test('mismo historial y misma semilla dan la misma instancia', async () => {
    const persistencia = await abrir();
    const historial = { jugadorId: 'jugador_1', instancias: [jugada('p1=c_a1|p2=c_c1|p3=c_e1', 1, 3)], tags: [] };
    const una = await instanciar(CASO, historial, 'semilla', { ...CTX, persistencia });
    const otra = await instanciar(CASO, historial, 'semilla', { ...CTX, persistencia });
    assert.deepEqual(una, otra);
    assert.deepEqual(armarInstancia(CASO, historial, 'semilla', CTX), una);
    const distintas = new Set();
    for (let s = 0; s < 30; s++) distintas.add(armarInstancia(CASO, historial, s, CTX).firma);
    assert.ok(distintas.size > 1);
    persistencia.cerrar();
  });

  test('ocho partidas del mismo jugador: ocho firmas distintas; la novena repite la más vieja', async () => {
    const persistencia = await abrir();
    const firmas = [];
    for (let i = 0; i < 9; i++) {
      const historial = await leerHistorialJugador(persistencia, 'jugador_1', CASO.id);
      const instancia = await instanciar(CASO, historial, `partida_${i}`, { ...CTX, persistencia, fecha: i });
      firmas.push(instancia.firma);
    }
    assert.equal(new Set(firmas.slice(0, 8)).size, 8);
    assert.equal(firmas[8], firmas[0]);
    persistencia.cerrar();
  });

  test('la misma firma jugada dos veces usa los dos órdenes', async () => {
    const persistencia = await abrir();
    const unaSola = caso(['c_a1', 'c_a1'], ['c_c1', 'c_c1'], ['c_e1', 'c_e1']);
    const ordenes = [];
    for (let i = 0; i < 2; i++) {
      const historial = await leerHistorialJugador(persistencia, 'jugador_1', unaSola.id);
      const instancia = await instanciar(unaSola, historial, 5, { ...CTX, persistencia, fecha: i });
      ordenes.push(instancia.pistas.map((p) => p.orden).join(''));
    }
    assert.deepEqual([...ordenes].sort(), ['123', '132']);
    persistencia.cerrar();
  });

  test('otro jugador tiene su propio historial', async () => {
    const persistencia = await abrir();
    const h1 = await leerHistorialJugador(persistencia, 'jugador_1', CASO.id);
    await instanciar(CASO, h1, 7, { ...CTX, persistencia });
    const h2 = await leerHistorialJugador(persistencia, 'jugador_2', CASO.id);
    assert.deepEqual(h2.instancias, []);
    persistencia.cerrar();
  });

  test('dentro de la transacción del turno', async () => {
    const persistencia = await abrir();
    const instancia = await persistencia.turno(async (t) => {
      const historial = await leerHistorialJugador(t, 'jugador_1', CASO.id);
      const nueva = await instanciar(CASO, historial, 7, { ...CTX, persistencia: t });
      await t.guardarEstadoCaso('partida_1', nueva);
      return nueva;
    });
    assert.deepEqual((await persistencia.leerEstadoCaso('partida_1')).estado, instancia);
    assert.equal(await persistencia.usoDeInstancia('jugador_1', CASO.id, instancia.firma), 1);
    persistencia.cerrar();
  });

  test('sin persistencia o sin jugador: error', async () => {
    await assert.rejects(instanciar(CASO, { jugadorId: 'j' }, 1, CTX), /persistencia/);
    await assert.rejects(instanciar(CASO, {}, 1, { ...CTX, persistencia: {} }), /jugadorId/);
  });
});

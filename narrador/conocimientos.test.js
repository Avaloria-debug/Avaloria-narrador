import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { puedeRevelar, conocimientoARevelar, conocimientoPorNarrativo, revelar, MOTIVOS_NO_REVELA as M } from './conocimientos.js';
import { npcInicial } from './npcs.js';
import { leerContenido } from './cargarContenido.js';
import { eventoActivo as ev, contenidoConSenderoPorTormenta } from './utilsPrueba.js';

let contenido;
before(async () => {
  contenido = await leerContenido();
});
const def = (id) => contenido.npcs.find((n) => n.id === id);
const objeto = (id) => contenido.objetos.find((o) => o.id === id);
const npc = (id, extra = {}) => ({ ...npcInicial(def(id)), ...extra });
const estado = (extra = {}) => ({ eventosActivos: [], marcas: [], ...extra });
const aRevelar = (id, npcEstado, est = estado()) => conocimientoARevelar(def(id), npcEstado, est, contenido);

describe('conocimientos — revelar por conversación', () => {
  test('umbral de relación: por debajo no, en el umbral sí', () => {
    // Maren: umbral 40.
    assert.deepEqual(aRevelar('maren_archivista', npc('maren_archivista', { relacion: 39.5 })), { conocimiento: null, motivo: M.UMBRAL });
    assert.equal(aRevelar('maren_archivista', npc('maren_archivista', { relacion: 40 })).conocimiento.id, 'conocimiento_maren_1');
    assert.equal(aRevelar('maren_archivista', npc('maren_archivista', { relacion: 100 })).conocimiento.id, 'conocimiento_maren_1');
  });

  test('evento requerido: Ivor solo con la deuda impaga activa', () => {
    const ivor = npc('ivor_cambista', { relacion: 80 });
    assert.equal(aRevelar('ivor_cambista', ivor).motivo, M.EVENTO);
    const conDeuda = estado({ eventosActivos: [ev('evento_deuda_impaga', 'escena_taberna_lareth')] });
    assert.equal(aRevelar('ivor_cambista', ivor, conDeuda).conocimiento.id, 'conocimiento_ivor_1');
    // Con el evento pero sin el umbral, no.
    assert.equal(aRevelar('ivor_cambista', npc('ivor_cambista', { relacion: 49 }), conDeuda).motivo, M.UMBRAL);
  });

  test('evento que habilita: Hollis con la tormenta de verano (contenido con el sendero por tormenta)', () => {
    // Desde 0.0.43 el contenido real no pide la tormenta; el mecanismo se prueba con la copia que la pide.
    const c = contenidoConSenderoPorTormenta(contenido);
    const hollis = npc('hollis_pastor', { relacion: 30 });
    const aRevelarC = (est = estado()) => conocimientoARevelar(c.npcs.find((n) => n.id === 'hollis_pastor'), hollis, est, c);
    assert.equal(aRevelarC().motivo, M.EVENTO);
    const conTormenta = estado({ eventosActivos: [ev('evento_tormenta_verano', 'escena_lago_espejos')] });
    assert.equal(aRevelarC(conTormenta).conocimiento.id, 'conocimiento_sendero_sin_vigilancia');
  });

  test('0.0.43: en el contenido real el _1 de Hollis no pide evento y se revela sin tormenta', () => {
    assert.equal(def('hollis_pastor').conocimientos[0].requiereEvento, null);
    assert.equal(aRevelar('hollis_pastor', npc('hollis_pastor', { relacion: 30 })).conocimiento.id, 'conocimiento_sendero_sin_vigilancia');
  });

  test('marca leyo: Elia y Oren', () => {
    for (const [id, relacion] of [['elia_bibliotecaria', 50], ['oren_peregrino', 30]]) {
      const n = npc(id, { relacion });
      assert.equal(aRevelar(id, n).motivo, M.MARCA, id);
      assert.ok(aRevelar(id, n, estado({ marcas: ['leyo'] })).conocimiento, id);
      assert.equal(aRevelar(id, n, estado({ marcas: ['otra'] })).motivo, M.MARCA, id);
    }
  });

  test('orden: el _1 antes que el _2, aunque el _2 tenga umbral menor', () => {
    // maren_1 umbral 40, maren_2 umbral 30. Con 39 no se revela el _2.
    const k2 = def('maren_archivista').conocimientos.find((k) => k.id === 'conocimiento_maren_2');
    assert.ok(k2.umbralRelacion < 40);
    assert.deepEqual(aRevelar('maren_archivista', npc('maren_archivista', { relacion: 39 })), { conocimiento: null, motivo: M.UMBRAL });
    const maren = npc('maren_archivista', { relacion: 40 });
    assert.equal(aRevelar('maren_archivista', maren).conocimiento.id, 'conocimiento_maren_1');
    // Con el _1 revelado, el _2 sin condición sale en la siguiente pregunta.
    assert.equal(aRevelar('maren_archivista', revelar(maren, 'conocimiento_maren_1')).conocimiento.id, 'conocimiento_maren_2');
  });

  test('sin el _1 revelado, nunca el _2 (Ivor sin deuda impaga)', () => {
    assert.equal(aRevelar('ivor_cambista', npc('ivor_cambista', { relacion: 100 })).motivo, M.EVENTO);
  });

  test('una sola vez por conocimiento', () => {
    const maren = npc('maren_archivista', { relacion: 90 });
    const { conocimiento } = aRevelar('maren_archivista', maren);
    const despues = revelar(maren, conocimiento.id);
    assert.deepEqual(despues.conocimientosRevelados, ['conocimiento_maren_1']);
    const ambos = revelar(despues, 'conocimiento_maren_2');
    assert.deepEqual(aRevelar('maren_archivista', ambos), { conocimiento: null, motivo: M.YA_REVELADO });
    // Revelar dos veces no duplica, y no modifica el estado recibido.
    assert.equal(revelar(despues, conocimiento.id), despues);
    assert.deepEqual(maren.conocimientosRevelados, []);
  });

  test('bloqueado por atacar o emboscar, aunque cumpla todo lo demás', () => {
    const maren = npc('maren_archivista', { relacion: 100, bloqueadoConocimientos: true });
    assert.deepEqual(aRevelar('maren_archivista', maren), { conocimiento: null, motivo: M.BLOQUEADO });
  });

  test('cada conocimiento del contenido se puede revelar cumpliendo sus condiciones', () => {
    for (const n of contenido.npcs) {
      for (const k of n.conocimientos) {
        const est = estado({
          marcas: k.requiereMarca ? [k.requiereMarca] : [],
          eventosActivos: k.requiereEvento ? [ev(k.requiereEvento, 'escena_x')] : [],
        });
        const r = puedeRevelar(k, n.id, npc(n.id, { relacion: k.umbralRelacion }), est, contenido);
        assert.deepEqual(r, { puede: true, motivo: null }, k.id);
      }
    }
  });
});

describe('conocimientos — mostrar un objeto narrativo', () => {
  const mostrar = (objetoId, npcId, npcEstado, est = estado()) =>
    conocimientoPorNarrativo(objeto(objetoId), def(npcId), npcEstado, est, contenido);

  test('revela sin pedir relación', () => {
    const maren = npc('maren_archivista', { relacion: -50 });
    assert.equal(aRevelar('maren_archivista', maren).motivo, M.UMBRAL);
    assert.equal(mostrar('objeto_sello_archivo', 'maren_archivista', maren).conocimiento.id, 'conocimiento_maren_1');
  });

  test('cada narrativo revela el conocimiento de su NPC con relación 0', () => {
    for (const o of contenido.objetos.filter((x) => x.tipo === 'narrativo')) {
      const k = def(o.npcAsociado).conocimientos.find((x) => x.id === o.conocimientoDesbloquea);
      const est = estado({
        marcas: k.requiereMarca ? [k.requiereMarca] : [],
        eventosActivos: k.requiereEvento ? [ev(k.requiereEvento, 'escena_x')] : [],
      });
      assert.equal(mostrar(o.id, o.npcAsociado, npc(o.npcAsociado), est).conocimiento.id, o.conocimientoDesbloquea, o.id);
    }
  });

  test('siguen valiendo el bloqueo, la única vez, el evento y la marca', () => {
    assert.equal(mostrar('objeto_sello_archivo', 'maren_archivista', npc('maren_archivista', { bloqueadoConocimientos: true })).motivo, M.BLOQUEADO);
    const ya = npc('maren_archivista', { conocimientosRevelados: ['conocimiento_maren_1'] });
    assert.equal(mostrar('objeto_sello_archivo', 'maren_archivista', ya).motivo, M.YA_REVELADO);
    assert.equal(mostrar('objeto_recibo_deuda', 'ivor_cambista', npc('ivor_cambista')).motivo, M.EVENTO);
    assert.equal(mostrar('objeto_libro_retirado', 'elia_bibliotecaria', npc('elia_bibliotecaria')).motivo, M.MARCA);
  });

  test('a otro NPC, o con un objeto que no es narrativo, no revela nada', () => {
    assert.deepEqual(mostrar('objeto_sello_archivo', 'serel_panadero', npc('serel_panadero', { relacion: 100 })), {
      conocimiento: null,
      motivo: M.INEXISTENTE,
    });
    assert.equal(mostrar('objeto_daga', 'maren_archivista', npc('maren_archivista')).conocimiento, null);
  });
});

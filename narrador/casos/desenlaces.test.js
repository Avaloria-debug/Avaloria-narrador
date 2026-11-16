import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { nivelDeTag } from './tags.js';
import { elegirDesenlace, aplicarDesenlace, negativoValido, TAGS_CIERRE } from './desenlaces.js';

// Datos de prueba: no son contenido.
const tag = (tipo, objetivo, nivel) => ({ tipo, objetivo, nivel, creadoHora: 0, creadoHito: 0, casoId: 'caso_prueba', origen: 'prueba' });
const estado = (tags = [], extra = {}) => ({
  casoId: 'caso_prueba',
  instancia: { pistas: [{ ranura: 'p1', conocimientoId: 'c_a', npcId: 'npc_a', orden: 1 }] },
  tags, contadorHitos: 3, hitosAlcanzados: ['h1'], ...extra,
});
const mundo = { hora: 30, turno: 9, escena: 'escena_plaza', estadoEvento: 'tranquilo', npcs: {} };
const neutro = { id: 'd_n', tipo: 'neutro', requiere: {}, prioridad: 0, efectos_post: [] };
const positivo = { id: 'd_p', tipo: 'positivo', requiere: { tags: [{ tipo: 'gratitud', objetivo: 'npc(p1)', op: '>=', nivel: 1 }] }, prioridad: 1, efectos_post: [] };
const negativo = {
  id: 'd_neg', tipo: 'negativo', prioridad: 5, efectos_post: [],
  requiere: { tags: [{ tipo: 'sospecha_crimen', objetivo: 'jugador', op: '>=', nivel: 3 }, { tipo: 'rencor', objetivo: 'npc(p1)', op: '>=', nivel: 2 }] },
};
const caso = (desenlaces) => ({ id: 'caso_prueba', desenlaces });

describe('desenlaces: elección', () => {
  test('siempre hay un neutro default: sin candidatos gana él', () => {
    const r = elegirDesenlace(caso([positivo, negativo, neutro]), estado(), mundo);
    assert.equal(r.desenlace.id, 'd_n');
    assert.equal(r.porDefecto, true);
  });

  test('sin neutro default, error', () => {
    assert.throws(() => elegirDesenlace(caso([positivo]), estado(), mundo), /neutro por defecto/);
    const neutroConRequiere = { ...neutro, requiere: { requiere_hitos: ['h1'] } };
    assert.throws(() => elegirDesenlace(caso([neutroConRequiere]), estado(), mundo), /neutro por defecto/);
  });

  test('candidato con requiere cumplido gana al default', () => {
    const r = elegirDesenlace(caso([neutro, positivo]), estado([tag('gratitud', 'npc_a', 1)]), mundo);
    assert.equal(r.desenlace.id, 'd_p');
  });

  test('un negativo nunca gana sin su condición', () => {
    for (const tags of [[], [tag('sospecha_crimen', 'jugador', 3)], [tag('rencor', 'npc_a', 2)], [tag('sospecha_crimen', 'jugador', 2), tag('rencor', 'npc_a', 3)]]) {
      assert.notEqual(elegirDesenlace(caso([neutro, negativo]), estado(tags), mundo).desenlace.id, 'd_neg');
    }
    const r = elegirDesenlace(caso([neutro, positivo, negativo]), estado([tag('sospecha_crimen', 'jugador', 3), tag('rencor', 'npc_a', 2), tag('gratitud', 'npc_a', 1)]), mundo);
    assert.equal(r.desenlace.id, 'd_neg'); // mayor prioridad
  });

  test('un negativo sin condición del jugador no entra nunca (no por azar)', () => {
    const azar = { id: 'd_azar', tipo: 'negativo', prioridad: 9, requiere: { hora: { rango: [0, 24] } }, efectos_post: [] };
    const ausente = { id: 'd_aus', tipo: 'negativo', prioridad: 9, requiere: { tags: [{ tipo: 'gratitud', objetivo: 'npc(p1)', op: 'ausente' }] }, efectos_post: [] };
    assert.equal(negativoValido(azar), false);
    assert.equal(negativoValido(ausente), false);
    assert.equal(elegirDesenlace(caso([neutro, azar, ausente]), estado(), mundo).desenlace.id, 'd_n');
  });

  test('empate de prioridad: mayor coincidencia', () => {
    const uno = { id: 'd_1', tipo: 'positivo', prioridad: 1, efectos_post: [], requiere: { requiere_hitos: ['h1'], tags: [{ tipo: 'gratitud', objetivo: 'npc(p1)', op: '>=', nivel: 1 }] } };
    const dos = { id: 'd_2', tipo: 'positivo', prioridad: 1, efectos_post: [], requiere: { tags: [{ tipo: 'gratitud', objetivo: 'npc(p1)', op: '>=', nivel: 1 }, { tipo: 'curiosidad', objetivo: 'npc(p1)', op: '>=', nivel: 1 }] } };
    const r = elegirDesenlace(caso([neutro, uno, dos]), estado([tag('gratitud', 'npc_a', 2), tag('curiosidad', 'npc_a', 1)]), mundo);
    assert.equal(r.desenlace.id, 'd_2');
  });
});

describe('desenlaces: aplicar', () => {
  test('efectos_post se escriben y los tags de cierre se borran', () => {
    const d = { ...positivo, efectos_post: [{ tipo: 'gratitud', objetivo: 'npc(p1)', nivel: 1 }, { tipo: 'reputacion_ciudad', objetivo: 'ardenhall', op: 'reputacion', paso: 1 }] };
    const r = aplicarDesenlace(d, estado([tag('pacto_caso', 'bando_x', 2), tag('miedo', 'npc_a', 1)]), mundo);
    assert.equal(nivelDeTag(r.tags, 'gratitud', 'npc_a'), 1);
    assert.equal(nivelDeTag(r.tags, 'reputacion_ciudad', 'ardenhall'), 1);
    assert.equal(nivelDeTag(r.tags, 'pacto_caso', 'bando_x'), 0);
    assert.equal(nivelDeTag(r.tags, 'miedo', 'npc_a'), 1);
    assert.equal(r.desenlaceId, 'd_p');
    assert.equal(r.cerrado, true);
  });

  test('efectos_post con tag de cierre: error', () => {
    assert.deepEqual([...TAGS_CIERRE].sort(), ['alianza_npc', 'favor_archivo', 'favor_casa_aster', 'pacto_caso', 'sospecha_crimen']);
    const malo = { ...neutro, efectos_post: [{ tipo: 'alianza_npc', objetivo: 'npc(p1)', nivel: 1 }] };
    assert.throws(() => aplicarDesenlace(malo, estado(), mundo), /tags de cierre/);
  });
});

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_TAG,
  RELACION_REPARACION,
  buscarTag,
  nivelDeTag,
  quitarTag,
  escribirTag,
  subirTag,
  aplicarTraicion,
  ajustarReputacion,
  deltaRelacion,
} from './tags.js';

const NPC = 'maren_archivista';
const en = (hora, hito) => ({ hora, hito, casoId: 'caso_07', origen: 'accion:prueba' });

describe('tags: tipos y forma', () => {
  test('son 20 tipos, sin repetir', () => {
    assert.equal(TIPOS_TAG.length, 20);
    assert.equal(new Set(TIPOS_TAG).size, 20);
  });

  test('escribir crea el tag con sus datos de creación', () => {
    const tags = escribirTag([], { tipo: 'rencor', objetivo: NPC, nivel: 2, hora: 34, hito: 3, casoId: 'caso_07', origen: 'accion:amenazar' });
    assert.deepEqual(tags, [
      { tipo: 'rencor', objetivo: NPC, nivel: 2, creadoHora: 34, creadoHito: 3, casoId: 'caso_07', origen: 'accion:amenazar' },
    ]);
  });

  test('no modifica la lista recibida', () => {
    const antes = Object.freeze([Object.freeze({ tipo: 'miedo', objetivo: NPC, nivel: 1, creadoHora: 0, creadoHito: 0, casoId: null, origen: null })]);
    const despues = escribirTag(antes, { tipo: 'miedo', objetivo: NPC, nivel: 3 });
    assert.equal(antes[0].nivel, 1);
    assert.equal(despues[0].nivel, 3);
  });

  test('rechaza tipo desconocido, objetivo vacío y nivel fuera de 1–3', () => {
    assert.throws(() => escribirTag([], { tipo: 'hambre', objetivo: NPC, nivel: 1 }), /tipo desconocido/);
    assert.throws(() => escribirTag([], { tipo: 'miedo', objetivo: '', nivel: 1 }), /objetivo/);
    for (const nivel of [0, 4, 1.5, -1, undefined]) {
      assert.throws(() => escribirTag([], { tipo: 'miedo', objetivo: NPC, nivel }), /nivel/);
    }
  });

  test('único por (tipo, objetivo): otro objetivo u otro tipo es otro tag', () => {
    let tags = escribirTag([], { tipo: 'miedo', objetivo: NPC, nivel: 1 });
    tags = escribirTag(tags, { tipo: 'miedo', objetivo: 'dario_guardia', nivel: 1 });
    tags = escribirTag(tags, { tipo: 'curiosidad', objetivo: NPC, nivel: 1 });
    tags = escribirTag(tags, { tipo: 'miedo', objetivo: NPC, nivel: 2 });
    assert.equal(tags.length, 3);
    assert.equal(tags.filter((t) => t.tipo === 'miedo' && t.objetivo === NPC).length, 1);
  });

  test('quitar y buscar', () => {
    const tags = escribirTag([], { tipo: 'deuda_personal', objetivo: NPC, nivel: 1 });
    assert.equal(buscarTag(tags, 'deuda_personal', NPC).nivel, 1);
    assert.deepEqual(quitarTag(tags, 'deuda_personal', NPC), []);
    assert.equal(buscarTag([], 'deuda_personal', NPC), null);
    assert.equal(nivelDeTag([], 'deuda_personal', NPC), 0);
  });
});

describe('tags: combinación', () => {
  test('nivel nuevo mayor: gana el mayor', () => {
    let tags = escribirTag([], { tipo: 'miedo', objetivo: NPC, nivel: 1, ...en(2, 1) });
    tags = escribirTag(tags, { tipo: 'miedo', objetivo: NPC, nivel: 3, ...en(5, 2) });
    assert.equal(nivelDeTag(tags, 'miedo', NPC), 3);
    assert.equal(tags[0].creadoHora, 5);
    assert.equal(tags[0].creadoHito, 2);
  });

  test('mismo nivel: +1', () => {
    let tags = escribirTag([], { tipo: 'desconfianza', objetivo: NPC, nivel: 1 });
    tags = escribirTag(tags, { tipo: 'desconfianza', objetivo: NPC, nivel: 1 });
    assert.equal(nivelDeTag(tags, 'desconfianza', NPC), 2);
  });

  test('mismo nivel en 3: queda en 3', () => {
    let tags = escribirTag([], { tipo: 'miedo', objetivo: NPC, nivel: 3 });
    tags = escribirTag(tags, { tipo: 'miedo', objetivo: NPC, nivel: 3 });
    assert.equal(nivelDeTag(tags, 'miedo', NPC), 3);
  });

  test('nivel nuevo menor: el nivel queda y se reinicia el decaimiento', () => {
    let tags = escribirTag([], { tipo: 'miedo', objetivo: NPC, nivel: 3, hora: 2, hito: 1, casoId: 'caso_01', origen: 'accion:atacar' });
    tags = escribirTag(tags, { tipo: 'miedo', objetivo: NPC, nivel: 2, hora: 9, hito: 4, casoId: 'caso_02', origen: 'accion:amenazar' });
    assert.deepEqual(tags[0], {
      tipo: 'miedo', objetivo: NPC, nivel: 3, creadoHora: 9, creadoHito: 4, casoId: 'caso_01', origen: 'accion:atacar',
    });
  });

  test('rencor nuevo baja la gratitud del mismo NPC un nivel', () => {
    let tags = escribirTag([], { tipo: 'gratitud', objetivo: NPC, nivel: 2 });
    tags = escribirTag(tags, { tipo: 'rencor', objetivo: NPC, nivel: 1 });
    assert.equal(nivelDeTag(tags, 'gratitud', NPC), 1);
    assert.equal(nivelDeTag(tags, 'rencor', NPC), 1);
  });

  test('rencor nuevo quita la gratitud leve', () => {
    let tags = escribirTag([], { tipo: 'gratitud', objetivo: NPC, nivel: 1 });
    tags = escribirTag(tags, { tipo: 'rencor', objetivo: NPC, nivel: 2 });
    assert.equal(buscarTag(tags, 'gratitud', NPC), null);
  });

  test('rencor no toca la gratitud de otro NPC', () => {
    let tags = escribirTag([], { tipo: 'gratitud', objetivo: 'dario_guardia', nivel: 2 });
    tags = escribirTag(tags, { tipo: 'rencor', objetivo: NPC, nivel: 2 });
    assert.equal(nivelDeTag(tags, 'gratitud', 'dario_guardia'), 2);
  });

  test('gratitud nueva no baja el rencor', () => {
    let tags = escribirTag([], { tipo: 'rencor', objetivo: NPC, nivel: 2 });
    tags = escribirTag(tags, { tipo: 'gratitud', objetivo: NPC, nivel: 2 });
    assert.equal(nivelDeTag(tags, 'rencor', NPC), 2);
    assert.equal(nivelDeTag(tags, 'gratitud', NPC), 2);
  });

  test('traición: gratitud grave baja a medio; medio y leve no cambian', () => {
    const grave = escribirTag([], { tipo: 'gratitud', objetivo: NPC, nivel: 3 });
    assert.equal(nivelDeTag(aplicarTraicion(grave, NPC), 'gratitud', NPC), 2);
    const medio = escribirTag([], { tipo: 'gratitud', objetivo: NPC, nivel: 2 });
    assert.equal(nivelDeTag(aplicarTraicion(medio, NPC), 'gratitud', NPC), 2);
    assert.deepEqual(aplicarTraicion([], NPC), []);
  });

  test('subir: crea en 1, suma 1 y no pasa de 3', () => {
    const pista = { tipo: 'pista_conocida', objetivo: 'conocimiento_dario_1' };
    let tags = subirTag([], pista);
    assert.equal(nivelDeTag(tags, pista.tipo, pista.objetivo), 1);
    tags = subirTag(subirTag(subirTag(tags, pista), pista), pista);
    assert.equal(nivelDeTag(tags, pista.tipo, pista.objetivo), 3);
    assert.equal(tags.length, 1);
  });
});

describe('tags: reputacion_ciudad', () => {
  const ciudad = 'Ardenhall';

  test('se mueve por pasos con signo', () => {
    let tags = ajustarReputacion([], { objetivo: ciudad, paso: 1 });
    assert.equal(nivelDeTag(tags, 'reputacion_ciudad', ciudad), 1);
    tags = ajustarReputacion(tags, { objetivo: ciudad, paso: -1 });
    assert.deepEqual(tags, []);
    tags = ajustarReputacion(tags, { objetivo: ciudad, paso: -1 });
    assert.equal(nivelDeTag(tags, 'reputacion_ciudad', ciudad), -1);
  });

  test('rango de −3 a +3', () => {
    let tags = [];
    for (let i = 0; i < 5; i++) tags = ajustarReputacion(tags, { objetivo: ciudad, paso: 1 });
    assert.equal(nivelDeTag(tags, 'reputacion_ciudad', ciudad), 3);
    for (let i = 0; i < 9; i++) tags = ajustarReputacion(tags, { objetivo: ciudad, paso: -1 });
    assert.equal(nivelDeTag(tags, 'reputacion_ciudad', ciudad), -3);
  });

  test('no se escribe con escribirTag ni con subirTag', () => {
    assert.throws(() => escribirTag([], { tipo: 'reputacion_ciudad', objetivo: ciudad, nivel: 1 }), /ajustarReputacion/);
    assert.throws(() => subirTag([], { tipo: 'reputacion_ciudad', objetivo: ciudad }), /ajustarReputacion/);
    assert.throws(() => ajustarReputacion([], { objetivo: ciudad, paso: 0 }), /paso/);
  });
});

describe('tags: relación', () => {
  test('gratitud +5, rencor −8, desconfianza −4, miedo −3 por nivel; reparación +15', () => {
    assert.equal(deltaRelacion('gratitud', 2), 10);
    assert.equal(deltaRelacion('rencor', 3), -24);
    assert.equal(deltaRelacion('desconfianza', 1), -4);
    assert.equal(deltaRelacion('miedo', 2), -6);
    assert.equal(deltaRelacion('curiosidad', 3), 0);
    assert.equal(RELACION_REPARACION, 15);
  });
});

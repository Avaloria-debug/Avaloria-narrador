import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS_TAG } from './tags.js';
import {
  TABLA_DECAIMIENTO,
  aplicarDecaimientoPorHoras,
  aplicarDecaimientoPorHitos,
  aplicarCierreDeCaso,
  aplicarReparacion,
} from './decaimiento.js';

const NPC = 'maren_archivista';
const tag = (tipo, nivel, extra = {}) => ({
  tipo, objetivo: NPC, nivel, creadoHora: 0, creadoHito: 0, casoId: 'caso_07', origen: 'accion:prueba', ...extra,
});

/** Nivel del tag tras `h` horas de reloj; null si se quitó. */
function trasHoras(t, h) {
  const r = aplicarDecaimientoPorHoras({ tags: [t], hora: t.creadoHora + h, contadorHitos: 0 }, h);
  return r.tags[0]?.nivel ?? null;
}
/** Nivel del tag tras `n` hitos; null si se quitó. */
function trasHitos(t, n) {
  const r = aplicarDecaimientoPorHitos({ tags: [t], hora: 0, contadorHitos: t.creadoHito + n });
  return r.tags[0]?.nivel ?? null;
}
const MUCHO = 10_000;

describe('decaimiento: tabla', () => {
  test('cubre los 20 tipos, con regla para los tres niveles', () => {
    assert.deepEqual(Object.keys(TABLA_DECAIMIENTO).sort(), [...TIPOS_TAG].sort());
    for (const tipo of TIPOS_TAG) assert.equal(TABLA_DECAIMIENTO[tipo].length, 3, tipo);
  });
});

describe('decaimiento por hitos', () => {
  // [tipo, nivel, hitos que aguanta sin cambio, nivel al cumplirse el plazo (null = se quita)]
  const plazos = [
    ['desconfianza', 1, 1, null],
    ['desconfianza', 2, 3, null],
    ['rencor', 1, 2, null],
    ['gratitud', 1, 2, null],
    ['gratitud', 2, 5, null],
    ['curiosidad', 1, 3, null],
    ['curiosidad', 2, 3, null],
    ['deuda_personal', 1, 3, 2],
    ['deuda_personal', 2, 3, 3],
    ['favor_debido', 1, 5, null],
    ['favor_debido', 2, 5, null],
    ['favor_debido', 3, 5, null],
    ['lealtad_caravana', 1, 7, null],
    ['lealtad_caravana', 2, 7, null],
  ];
  for (const [tipo, nivel, aguanta, despues] of plazos) {
    test(`${tipo} ${nivel}: sigue a los ${aguanta} hitos, cambia a los ${aguanta + 1}`, () => {
      assert.equal(trasHitos(tag(tipo, nivel), aguanta), nivel);
      assert.equal(trasHitos(tag(tipo, nivel), aguanta + 1), despues);
    });
  }

  const fijos = [
    ['desconfianza', 3], ['rencor', 2], ['rencor', 3], ['gratitud', 3], ['curiosidad', 3], ['deuda_personal', 3],
    ['secreto_compartido', 1], ['pista_conocida', 1], ['pista_conocida', 3],
  ];
  for (const [tipo, nivel] of fijos) {
    test(`${tipo} ${nivel}: no decae por hitos`, () => {
      assert.equal(trasHitos(tag(tipo, nivel), MUCHO), nivel);
    });
  }

  test('deuda_personal sube 1 nivel cada 4 hitos y se queda en 3', () => {
    assert.equal(trasHitos(tag('deuda_personal', 1), 7), 2);
    assert.equal(trasHitos(tag('deuda_personal', 1), 8), 3);
    assert.equal(trasHitos(tag('deuda_personal', 1), MUCHO), 3);
  });

  test('cuenta desde creadoHito, con el contador global', () => {
    const t = tag('desconfianza', 1, { creadoHito: 10 });
    assert.equal(aplicarDecaimientoPorHitos({ tags: [t], contadorHitos: 11 }).tags.length, 1);
    assert.equal(aplicarDecaimientoPorHitos({ tags: [t], contadorHitos: 12 }).tags.length, 0);
  });

  test('los hitos no mueven los tags de horas', () => {
    for (const tipo of ['miedo', 'vigilancia_escena', 'chisme_activo', 'alerta_camino', 'fama_violenta']) {
      assert.equal(trasHitos(tag(tipo, 1), MUCHO), 1, tipo);
    }
    assert.equal(trasHitos(tag('reputacion_ciudad', -2, { objetivo: 'Ardenhall' }), MUCHO), -2);
  });

  test('sin cambios devuelve el mismo estado; con cambios no modifica el recibido', () => {
    const estado = { tags: [tag('rencor', 1)], contadorHitos: 1 };
    assert.equal(aplicarDecaimientoPorHitos(estado), estado);
    const vencido = Object.freeze({ tags: Object.freeze([Object.freeze(tag('rencor', 1))]), contadorHitos: 3, otro: 1 });
    const despues = aplicarDecaimientoPorHitos(vencido);
    assert.deepEqual(despues, { tags: [], contadorHitos: 3, otro: 1 });
    assert.equal(vencido.tags.length, 1);
  });
});

describe('decaimiento por horas', () => {
  const plazos = [
    ['miedo', 1, 5, null],
    ['miedo', 2, 23, null],
    ['vigilancia_escena', 1, 2, null],
    ['vigilancia_escena', 2, 5, null],
    ['vigilancia_escena', 3, 11, null],
    ['chisme_activo', 1, 5, null],
    ['chisme_activo', 3, 5, null],
    ['alerta_camino', 1, 5, null],
    ['fama_violenta', 1, 11, null],
    ['fama_violenta', 2, 11, 1],
    ['fama_violenta', 3, 11, 2],
  ];
  for (const [tipo, nivel, aguanta, despues] of plazos) {
    test(`${tipo} ${nivel}: sigue a las ${aguanta} h, cambia a las ${aguanta + 1} h`, () => {
      assert.equal(trasHoras(tag(tipo, nivel), aguanta), nivel);
      assert.equal(trasHoras(tag(tipo, nivel), aguanta + 1), despues);
    });
  }

  test('miedo grave no decae por horas', () => {
    assert.equal(trasHoras(tag('miedo', 3), MUCHO), 3);
  });

  test('fama_violenta baja 1 nivel cada 12 h hasta quitarse', () => {
    assert.equal(trasHoras(tag('fama_violenta', 3), 24), 1);
    assert.equal(trasHoras(tag('fama_violenta', 3), 35), 1);
    assert.equal(trasHoras(tag('fama_violenta', 3), 36), null);
  });

  test('reputacion_ciudad: 1 paso hacia 0 cada 24 h, desde los dos lados', () => {
    const rep = (nivel) => tag('reputacion_ciudad', nivel, { objetivo: 'Ardenhall' });
    assert.equal(trasHoras(rep(3), 23), 3);
    assert.equal(trasHoras(rep(3), 24), 2);
    assert.equal(trasHoras(rep(3), 48), 1);
    assert.equal(trasHoras(rep(3), 72), null);
    assert.equal(trasHoras(rep(-3), 24), -2);
    assert.equal(trasHoras(rep(-2), 47), -1);
    assert.equal(trasHoras(rep(-1), 24), null);
    assert.equal(trasHoras(rep(1), 24), null);
  });

  test('por pasos: la cuenta sigue desde el fin del plazo, no desde la hora actual', () => {
    const estado = { tags: [tag('fama_violenta', 3, { creadoHora: 10 })], hora: 25 };
    const r = aplicarDecaimientoPorHoras(estado, 15);
    assert.equal(r.tags[0].nivel, 2);
    assert.equal(r.tags[0].creadoHora, 22);
  });

  test('las acciones de 0 horas no mueven nada, aunque el plazo esté vencido', () => {
    const estado = { tags: [tag('miedo', 1), tag('chisme_activo', 1)], hora: 100 };
    assert.equal(aplicarDecaimientoPorHoras(estado, 0), estado);
    assert.equal(aplicarDecaimientoPorHoras(estado, 1).tags.length, 0);
  });

  test('cuenta desde creadoHora', () => {
    const t = tag('miedo', 1, { creadoHora: 40 });
    assert.equal(aplicarDecaimientoPorHoras({ tags: [t], hora: 45 }, 5).tags.length, 1);
    assert.equal(aplicarDecaimientoPorHoras({ tags: [t], hora: 46 }, 1).tags.length, 0);
  });

  test('las horas no mueven los tags de hitos, de cierre ni los que no decaen', () => {
    const quietos = ['desconfianza', 'rencor', 'gratitud', 'curiosidad', 'deuda_personal', 'favor_debido', 'secreto_compartido',
      'pista_conocida', 'lealtad_caravana', 'sospecha_crimen', 'favor_casa_aster', 'favor_archivo', 'pacto_caso', 'alianza_npc'];
    for (const tipo of quietos) assert.equal(trasHoras(tag(tipo, 1), MUCHO), 1, tipo);
  });
});

describe('cierre de caso', () => {
  const deCierre = ['sospecha_crimen', 'favor_casa_aster', 'favor_archivo', 'pacto_caso', 'alianza_npc'];

  for (const tipo of deCierre) {
    test(`${tipo}: no decae por horas ni hitos, se quita al cierre`, () => {
      assert.equal(trasHoras(tag(tipo, 2), MUCHO), 2);
      assert.equal(trasHitos(tag(tipo, 2), MUCHO), 2);
      assert.deepEqual(aplicarCierreDeCaso({ tags: [tag(tipo, 2)] }).tags, []);
    });
  }

  test('el cierre deja los demás tags', () => {
    const resto = TIPOS_TAG.filter((t) => !deCierre.includes(t)).map((t) => tag(t, 1));
    const estado = { tags: [...resto, tag('pacto_caso', 3)] };
    assert.deepEqual(aplicarCierreDeCaso(estado).tags, resto);
    const sinCierre = { tags: resto };
    assert.equal(aplicarCierreDeCaso(sinCierre), sinCierre);
  });
});

describe('reparación', () => {
  const niveles = (estado) => Object.fromEntries(estado.tags.map((t) => [`${t.tipo}:${t.objetivo}`, t.nivel]));

  for (const tipo of ['rencor', 'desconfianza', 'miedo']) {
    test(`quita ${tipo} medio`, () => {
      assert.deepEqual(aplicarReparacion({ tags: [tag(tipo, 2)] }, NPC).tags, []);
    });
  }

  test('quita desconfianza grave y miedo grave', () => {
    assert.deepEqual(aplicarReparacion({ tags: [tag('desconfianza', 3)] }, NPC).tags, []);
    assert.deepEqual(aplicarReparacion({ tags: [tag('miedo', 3)] }, NPC).tags, []);
  });

  test('quita uno solo y baja el resto 1 nivel', () => {
    const estado = { tags: [tag('miedo', 3), tag('desconfianza', 2), tag('rencor', 1)] };
    assert.deepEqual(niveles(aplicarReparacion(estado, NPC)), { [`desconfianza:${NPC}`]: 1 });
  });

  test('con empate quita rencor antes que desconfianza y miedo', () => {
    const estado = { tags: [tag('miedo', 2), tag('desconfianza', 2), tag('rencor', 2)] };
    assert.deepEqual(niveles(aplicarReparacion(estado, NPC)), { [`miedo:${NPC}`]: 1, [`desconfianza:${NPC}`]: 1 });
  });

  test('tipo fuerza cuál se quita', () => {
    const estado = { tags: [tag('miedo', 3), tag('desconfianza', 2)] };
    assert.deepEqual(niveles(aplicarReparacion(estado, NPC, { tipo: 'desconfianza' })), { [`miedo:${NPC}`]: 2 });
    assert.throws(() => aplicarReparacion(estado, NPC, { tipo: 'gratitud' }), /no se repara/);
  });

  test('rencor grave: solo con reparaRencorGrave', () => {
    const solo = { tags: [tag('rencor', 3)] };
    assert.equal(aplicarReparacion(solo, NPC), solo);
    assert.deepEqual(aplicarReparacion(solo, NPC, { reparaRencorGrave: true }).tags, []);

    const conMiedo = { tags: [tag('rencor', 3), tag('miedo', 2)] };
    assert.deepEqual(niveles(aplicarReparacion(conMiedo, NPC)), { [`rencor:${NPC}`]: 3 });
    assert.deepEqual(niveles(aplicarReparacion(conMiedo, NPC, { reparaRencorGrave: true })), { [`miedo:${NPC}`]: 1 });
  });

  test('sin tag medio o grave no hace nada', () => {
    const estado = { tags: [tag('rencor', 1), tag('miedo', 1), tag('gratitud', 3)] };
    assert.equal(aplicarReparacion(estado, NPC), estado);
  });

  test('no toca otros tags del NPC ni los tags de otros objetivos', () => {
    const otros = [tag('gratitud', 2), tag('curiosidad', 1), tag('rencor', 2, { objetivo: 'dario_guardia' }), tag('vigilancia_escena', 2, { objetivo: 'escena_archivo_real' })];
    const estado = { tags: [tag('rencor', 2), ...otros], hora: 5 };
    assert.deepEqual(aplicarReparacion(estado, NPC), { tags: otros, hora: 5 });
    assert.equal(estado.tags.length, 5);
  });
});

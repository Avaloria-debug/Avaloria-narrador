import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nivelDeTag } from './tags.js';
import {
  evaluarCondiciones,
  actualizarListos,
  dispararHito,
  elegirDisparo,
  ganchoFueraDeEscena,
  escenaDeEntrega,
  ranuraHabilitada,
  resolver,
  antiTrabaSinListos,
  antiTrabaRencorGrave,
  antiTrabaSinAvance,
  antiTrabaFinalesBloqueados,
} from './hitos.js';

// Datos de prueba: no son contenido.
const INSTANCIA = {
  casoId: 'caso_prueba',
  firma: 'p1=c_a|p2=c_b|p3=c_c',
  pistas: [
    { ranura: 'p1', conocimientoId: 'c_a', npcId: 'npc_a', orden: 1 },
    { ranura: 'p2', conocimientoId: 'c_b', npcId: 'npc_b', orden: 3 },
    { ranura: 'p3', conocimientoId: 'c_c', npcId: 'npc_c', orden: 2 },
  ],
  semilla: 1,
};
const tag = (tipo, objetivo, nivel, extra = {}) => ({ tipo, objetivo, nivel, creadoHora: 0, creadoHito: 0, casoId: 'caso_prueba', origen: 'prueba', ...extra });
const caso = (estado = {}) => ({
  casoId: 'caso_prueba',
  instancia: INSTANCIA,
  tags: [],
  contadorHitos: 0,
  hitoPrevio: { id: null, hora: 10, escena: 'escena_plaza', contador: 0 },
  hitosAlcanzados: [],
  hitosListos: [],
  hitosBloqueados: [],
  ...estado,
});
const mundo = (hitos = [], extra = {}) => ({
  caso: { id: 'caso_prueba', hitos },
  hora: 10,
  turno: 1,
  escena: 'escena_plaza',
  estadoEvento: 'tranquilo',
  npcs: {
    npc_a: { escena: 'escena_archivo', relacion: 0, bloqueadoConocimientos: false },
    npc_b: { escena: 'escena_taberna', relacion: 0, bloqueadoConocimientos: false },
    npc_c: { escena: 'escena_puente', relacion: 0, bloqueadoConocimientos: false },
  },
  ...extra,
});
const hito = (id, condiciones = {}, extra = {}) => ({ id, condiciones, escena_entrega: null, efectos: [], bloquea: [], ...extra });
const cumple = (condiciones, estado = {}, extraMundo = {}) => evaluarCondiciones(hito('h1', condiciones), caso(estado), mundo([], extraMundo));

describe('hitos: condiciones', () => {
  test('sin condiciones se cumple', () => {
    assert.equal(cumple({}), true);
  });

  test('requiere_hitos: todos y alguno', () => {
    assert.equal(cumple({ requiere_hitos: ['h2', 'h3'] }, { hitosAlcanzados: ['h2'] }), false);
    assert.equal(cumple({ requiere_hitos: ['h2', 'h3'] }, { hitosAlcanzados: ['h2', 'h3'] }), true);
    assert.equal(cumple({ requiere_hitos: { alguno: ['h2', 'h3'] } }, { hitosAlcanzados: ['h3'] }), true);
    assert.equal(cumple({ requiere_hitos: { alguno: ['h2', 'h3'] } }, {}), false);
    assert.equal(cumple({ requiere_hitos: { todos: ['h1'], alguno: ['h2', 'h3'] } }, { hitosAlcanzados: ['h2'] }), false);
  });

  test('tag por ranura con operador >=', () => {
    const c = { tags: [{ tipo: 'pista_conocida', objetivo: 'p1', op: '>=', nivel: 2 }] };
    assert.equal(cumple(c), false);
    assert.equal(cumple(c, { tags: [tag('pista_conocida', 'c_a', 1)] }), false);
    assert.equal(cumple(c, { tags: [tag('pista_conocida', 'c_a', 2)] }), true);
    assert.equal(cumple(c, { tags: [tag('pista_conocida', 'c_a', 3)] }), true);
    assert.equal(cumple(c, { tags: [tag('pista_conocida', 'c_b', 3)] }), false);
  });

  test('tag sobre el NPC de una ranura con operador <', () => {
    const c = { tags: [{ tipo: 'desconfianza', objetivo: 'npc(p2)', op: '<', nivel: 2 }] };
    assert.equal(cumple(c), true);
    assert.equal(cumple(c, { tags: [tag('desconfianza', 'npc_b', 1)] }), true);
    assert.equal(cumple(c, { tags: [tag('desconfianza', 'npc_b', 2)] }), false);
    assert.equal(cumple(c, { tags: [tag('desconfianza', 'npc_a', 3)] }), true);
  });

  test('tag con operador == y ausente', () => {
    const igual = { tags: [{ tipo: 'gratitud', objetivo: 'npc(p1)', op: '==', nivel: 2 }] };
    assert.equal(cumple(igual, { tags: [tag('gratitud', 'npc_a', 2)] }), true);
    assert.equal(cumple(igual, { tags: [tag('gratitud', 'npc_a', 3)] }), false);
    const ausente = { tags: [{ tipo: 'rencor', objetivo: 'npc(p1)', op: 'ausente' }] };
    assert.equal(cumple(ausente), true);
    assert.equal(cumple(ausente, { tags: [tag('rencor', 'npc_a', 1)] }), false);
  });

  test('varios tags: todos; operador desconocido: error', () => {
    const c = { tags: [
      { tipo: 'pista_conocida', objetivo: 'p1', op: '>=', nivel: 1 },
      { tipo: 'miedo', objetivo: 'npc(p1)', op: 'ausente' },
    ] };
    assert.equal(cumple(c, { tags: [tag('pista_conocida', 'c_a', 1)] }), true);
    assert.equal(cumple(c, { tags: [tag('pista_conocida', 'c_a', 1), tag('miedo', 'npc_a', 1)] }), false);
    assert.throws(() => cumple({ tags: [{ tipo: 'miedo', objetivo: 'npc(p1)', op: '~', nivel: 1 }] }), /operador/);
  });

  test('escena: en, no en y escena de una ranura', () => {
    assert.equal(cumple({ escena: 'escena_plaza' }), true);
    assert.equal(cumple({ escena: ['escena_archivo', 'escena_taberna'] }), false);
    assert.equal(cumple({ escena: { no_en: ['escena_plaza'] } }), false);
    assert.equal(cumple({ escena: { no_en: ['escena_archivo'] } }), true);
    assert.equal(cumple({ escena: 'escena(p2)' }), false);
    assert.equal(cumple({ escena: 'escena(p2)' }, {}, { escena: 'escena_taberna' }), true);
  });

  test('hora por rango (hora del día)', () => {
    const c = { hora: { rango: [18, 24] } };
    assert.equal(cumple(c, {}, { hora: 17 }), false);
    assert.equal(cumple(c, {}, { hora: 18 }), true);
    assert.equal(cumple(c, {}, { hora: 23 }), true);
    assert.equal(cumple(c, {}, { hora: 24 }), false);
    assert.equal(cumple(c, {}, { hora: 24 + 19 }), true);
    const noche = { hora: { rango: [22, 4] } };
    assert.equal(cumple(noche, {}, { hora: 23 }), true);
    assert.equal(cumple(noche, {}, { hora: 26 }), true);
    assert.equal(cumple(noche, {}, { hora: 12 }), false);
  });

  test('hora relativa a hitoPrevio, en horas del reloj', () => {
    const c = { hora: { desde_previo: 6 } };
    assert.equal(cumple(c, {}, { hora: 15 }), false);
    assert.equal(cumple(c, {}, { hora: 16 }), true);
    const previo = { hitoPrevio: { id: 'h2', hora: 40, escena: 'escena_plaza', contador: 2 } };
    assert.equal(cumple(c, previo, { hora: 45 }), false);
    assert.equal(cumple(c, previo, { hora: 46 }), true);
    // Los turnos no cuentan: muchos turnos sin que avance el reloj no la cumplen.
    assert.equal(cumple(c, previo, { hora: 40, turno: 500 }), false);
  });

  test('contador relativo a hitoPrevio.contador', () => {
    const c = { contador: { desde_previo: 2 } };
    const previo = { hitoPrevio: { id: 'h2', hora: 40, escena: 'escena_plaza', contador: 3 } };
    assert.equal(cumple(c, { ...previo, contadorHitos: 4 }), false);
    assert.equal(cumple(c, { ...previo, contadorHitos: 5 }), true);
  });

  test('estado_evento', () => {
    assert.equal(cumple({ estado_evento: ['sigilo', 'tenso'] }), false);
    assert.equal(cumple({ estado_evento: ['sigilo', 'tenso'] }, {}, { estadoEvento: 'tenso' }), true);
    assert.equal(cumple({ estado_evento: 'tranquilo' }), true);
  });

  test('pistas: conteo en nivel entendida y ranura habilitada según el orden de la instancia', () => {
    const dos = { pistas: { cantidad: 2 } };
    assert.equal(cumple(dos, { tags: [tag('pista_conocida', 'c_a', 2), tag('pista_conocida', 'c_b', 1)] }), false);
    assert.equal(cumple(dos, { tags: [tag('pista_conocida', 'c_a', 2), tag('pista_conocida', 'c_b', 3)] }), true);
    assert.equal(cumple({ pistas: { cantidad: 2, nivel: 1 } }, { tags: [tag('pista_conocida', 'c_a', 1), tag('pista_conocida', 'c_b', 1)] }), true);

    // Orden de la instancia: p1, p3, p2.
    assert.equal(cumple({ pistas: { habilitada: 'p1' } }), true);
    assert.equal(cumple({ pistas: { habilitada: 'p3' } }), false);
    assert.equal(cumple({ pistas: { habilitada: 'p3' } }, { tags: [tag('pista_conocida', 'c_a', 1)] }), true);
    assert.equal(cumple({ pistas: { habilitada: 'p2' } }, { tags: [tag('pista_conocida', 'c_a', 1)] }), false);
    assert.equal(ranuraHabilitada(caso({ tags: [tag('pista_conocida', 'c_c', 1)] }), 'p2'), true);
  });

  test('todas las condiciones a la vez', () => {
    const c = { requiere_hitos: ['h1'], escena: 'escena_plaza', hora: { rango: [8, 12] }, estado_evento: 'tranquilo' };
    assert.equal(cumple(c, { hitosAlcanzados: ['h1'] }), true);
    assert.equal(cumple(c, { hitosAlcanzados: ['h1'] }, { hora: 13 }), false);
  });

  test('resolver: ranuras y literales', () => {
    const e = caso();
    const m = mundo();
    assert.equal(resolver('p3', e, m), 'c_c');
    assert.equal(resolver('npc(p3)', e, m), 'npc_c');
    assert.equal(resolver('escena(p3)', e, m), 'escena_puente');
    assert.equal(resolver('escena', e, m), 'escena_plaza');
    assert.equal(resolver('Ardenhall', e, m), 'Ardenhall');
  });
});

describe('hitos: listos', () => {
  test('marca los que cumplen y no están alcanzados ni bloqueados', () => {
    const hitos = [
      hito('h1'),
      hito('h2', { requiere_hitos: ['h1'] }),
      hito('h3'),
      hito('h4'),
      hito('h5', { escena: 'escena_archivo' }),
    ];
    const r = actualizarListos(caso({ hitosAlcanzados: ['h1'], hitosBloqueados: ['h3'] }), mundo(hitos));
    assert.deepEqual(r.hitosListos, ['h2', 'h4']);
    assert.deepEqual(r.listosDesde, { h2: 10, h4: 10 });
  });

  test('no mira la escena de entrega; conserva desde cuándo está listo', () => {
    const hitos = [hito('h1', {}, { escena_entrega: 'escena_archivo' })];
    let estado = actualizarListos(caso(), mundo(hitos, { hora: 10 }));
    assert.deepEqual(estado.hitosListos, ['h1']);
    estado = actualizarListos(estado, mundo(hitos, { hora: 15 }));
    assert.deepEqual(estado.listosDesde, { h1: 10 });
  });

  test('un hito que deja de cumplir sale de listos', () => {
    const hitos = [hito('h1', { hora: { rango: [8, 12] } })];
    let estado = actualizarListos(caso(), mundo(hitos, { hora: 10 }));
    assert.deepEqual(estado.hitosListos, ['h1']);
    estado = actualizarListos(estado, mundo(hitos, { hora: 13 }));
    assert.deepEqual(estado.hitosListos, []);
    assert.deepEqual(estado.listosDesde, {});
  });

  test('anota desde qué turno no hay listos', () => {
    const hitos = [hito('h1', { requiere_hitos: ['h9'] })];
    let estado = actualizarListos(caso(), mundo(hitos, { turno: 4 }));
    assert.equal(estado.sinListosDesde, 4);
    estado = actualizarListos(estado, mundo(hitos, { turno: 7 }));
    assert.equal(estado.sinListosDesde, 4);
    estado = actualizarListos(estado, mundo([hito('h1')], { turno: 8 }));
    assert.equal(estado.sinListosDesde, null);
  });

  test('sin caso en el mundo: error', () => {
    assert.throws(() => actualizarListos(caso(), { hora: 1 }), /caso/);
  });
});

describe('hitos: elegir disparo', () => {
  const reparacion = hito('h7', {}, { es_reparacion: true });
  const queBloquea = hito('h5', {}, { bloquea: ['h6'] });
  const comunes = [hito('h3'), hito('h2')];
  const conRencor = { tags: [tag('rencor', 'npc_a', 2)] };

  test('prioridad: reparación > el que bloquea ramas > menor id', () => {
    const hitos = [...comunes, queBloquea, reparacion];
    let estado = actualizarListos(caso(conRencor), mundo(hitos));
    assert.equal(elegirDisparo(estado, mundo(hitos)).id, 'h7');

    estado = actualizarListos(caso(conRencor), mundo([...comunes, queBloquea]));
    assert.equal(elegirDisparo(estado, mundo([...comunes, queBloquea])).id, 'h5');

    estado = actualizarListos(caso(conRencor), mundo(comunes));
    assert.equal(elegirDisparo(estado, mundo(comunes)).id, 'h2');
  });

  test('la reparación sin tags medio/grave pendientes no tiene prioridad', () => {
    const hitos = [...comunes, queBloquea, reparacion];
    const estado = actualizarListos(caso(), mundo(hitos));
    assert.equal(elegirDisparo(estado, mundo(hitos)).id, 'h5');
  });

  test('menor id es numérico: h2 antes que h10', () => {
    const hitos = [hito('h10'), hito('h2')];
    const estado = actualizarListos(caso(), mundo(hitos));
    assert.equal(elegirDisparo(estado, mundo(hitos)).id, 'h2');
  });

  test('solo si el jugador está en la escena de entrega, o si es null', () => {
    const hitos = [hito('h1', {}, { escena_entrega: 'escena_archivo' }), hito('h2', {}, { escena_entrega: 'escena(p2)' }), hito('h3')];
    const estado = actualizarListos(caso(), mundo(hitos));
    assert.equal(elegirDisparo(estado, mundo(hitos)).id, 'h3');
    assert.equal(elegirDisparo(estado, mundo(hitos, { escena: 'escena_archivo' })).id, 'h1');
    assert.equal(elegirDisparo(estado, mundo(hitos, { escena: 'escena_taberna' })).id, 'h2');
    const sinLibre = actualizarListos(caso(), mundo(hitos.slice(0, 2)));
    assert.equal(elegirDisparo(sinLibre, mundo(hitos.slice(0, 2))), null);
  });

  test('máximo 1 por turno', () => {
    const hitos = [hito('h1'), hito('h2'), hito('h3')];
    const m = mundo(hitos, { turno: 5 });
    let estado = actualizarListos(caso(), m);
    const primero = elegirDisparo(estado, m);
    assert.equal(primero.id, 'h1');
    estado = actualizarListos(dispararHito(primero, estado, m).estadoCaso, m);
    assert.deepEqual(estado.hitosListos, ['h2', 'h3']);
    assert.equal(elegirDisparo(estado, m), null);
    assert.equal(elegirDisparo(estado, mundo(hitos, { turno: 6 })).id, 'h2');
  });

  test('sin listos: null', () => {
    assert.equal(elegirDisparo(caso(), mundo([hito('h1')])), null);
  });
});

describe('hitos: disparo', () => {
  test('suma el contador, fija hitoPrevio y saca el hito de listos', () => {
    const h = hito('h2');
    const m = mundo([h, hito('h3')], { hora: 34, turno: 9, escena: 'escena_archivo' });
    const antes = actualizarListos(caso({ contadorHitos: 4 }), m);
    const r = dispararHito(h, antes, m);
    assert.equal(r.hito, h);
    assert.equal(r.estadoCaso.contadorHitos, 5);
    assert.deepEqual(r.estadoCaso.hitoPrevio, { id: 'h2', hora: 34, escena: 'escena_archivo', contador: 5 });
    assert.deepEqual(r.estadoCaso.hitosAlcanzados, ['h2']);
    assert.deepEqual(r.estadoCaso.hitosListos, ['h3']);
    assert.deepEqual(r.estadoCaso.ultimoAvance, { hora: 34 });
    assert.equal(antes.contadorHitos, 4);
    assert.deepEqual(antes.hitosAlcanzados, []);
  });

  test('aplica los efectos con tags.js, resolviendo ranuras', () => {
    const h = hito('h2', {}, { efectos: [
      { tipo: 'gratitud', objetivo: 'npc(p1)', nivel: 2 },
      { tipo: 'pista_conocida', objetivo: 'p2', op: 'subir' },
      { tipo: 'chisme_activo', objetivo: 'escena', nivel: 1 },
      { tipo: 'reputacion_ciudad', objetivo: 'Ardenhall', op: 'reputacion', paso: 1 },
      { tipo: 'deuda_personal', objetivo: 'npc(p3)', op: 'quitar' },
    ] });
    const m = mundo([h], { hora: 34 });
    const antes = caso({ contadorHitos: 2, tags: [tag('deuda_personal', 'npc_c', 1), tag('gratitud', 'npc_a', 2)] });
    const { estadoCaso, estadoMundo } = dispararHito(h, antes, m);
    const t = estadoCaso.tags;
    assert.equal(nivelDeTag(t, 'gratitud', 'npc_a'), 3); // mismo nivel: +1
    assert.equal(nivelDeTag(t, 'pista_conocida', 'c_b'), 1);
    assert.equal(nivelDeTag(t, 'chisme_activo', 'escena_plaza'), 1);
    assert.equal(nivelDeTag(t, 'reputacion_ciudad', 'Ardenhall'), 1);
    assert.equal(nivelDeTag(t, 'deuda_personal', 'npc_c'), 0);
    const gratitud = t.find((x) => x.tipo === 'gratitud');
    assert.deepEqual([gratitud.creadoHora, gratitud.creadoHito, gratitud.casoId, gratitud.origen], [34, 3, 'caso_prueba', 'hito:h2']);
    // gratitud escrita en nivel 2: +5 × 2 de relación con ese NPC.
    assert.equal(estadoMundo.npcs.npc_a.relacion, 10);
    assert.equal(m.npcs.npc_a.relacion, 0);
  });

  test('aplica bloquea', () => {
    const h = hito('h4', {}, { bloquea: ['h5', 'h6'] });
    const m = mundo([h, hito('h5'), hito('h6'), hito('h7')]);
    const antes = actualizarListos(caso({ hitosBloqueados: ['h8'] }), m);
    const { estadoCaso } = dispararHito(h, antes, m);
    assert.deepEqual(estadoCaso.hitosBloqueados, ['h8', 'h5', 'h6']);
    assert.deepEqual(estadoCaso.hitosListos, ['h7']);
    assert.deepEqual(actualizarListos(estadoCaso, m).hitosListos, ['h7']);
  });

  test('aplica el decaimiento por hitos con el contador nuevo', () => {
    const h = hito('h2', {}, { efectos: [{ tipo: 'curiosidad', objetivo: 'npc(p1)', nivel: 1 }] });
    const viejos = [
      tag('desconfianza', 'npc_b', 1, { creadoHito: 1 }), // leve: 2 hitos → vence en el 3
      tag('rencor', 'npc_c', 1, { creadoHito: 1 }), // leve: 3 hitos → sigue
      tag('miedo', 'npc_b', 1, { creadoHora: 0 }), // por horas: no se toca acá
    ];
    const { estadoCaso } = dispararHito(h, caso({ contadorHitos: 2, tags: viejos }), mundo([h], { hora: 500 }));
    assert.equal(nivelDeTag(estadoCaso.tags, 'desconfianza', 'npc_b'), 0);
    assert.equal(nivelDeTag(estadoCaso.tags, 'rencor', 'npc_c'), 1);
    assert.equal(nivelDeTag(estadoCaso.tags, 'miedo', 'npc_b'), 1);
    assert.equal(nivelDeTag(estadoCaso.tags, 'curiosidad', 'npc_a'), 1);
  });

  test('hito final: queda anotado', () => {
    const h = hito('h8', {}, { final: true });
    assert.equal(dispararHito(h, caso(), mundo([h])).estadoCaso.finalAlcanzado, 'h8');
    assert.equal(dispararHito(hito('h2'), caso(), mundo([])).estadoCaso.finalAlcanzado, undefined);
  });
});

describe('hitos: reparación', () => {
  const reparacion = hito('h7', {}, { es_reparacion: true });
  const conBloqueo = (extra = {}) => mundo([reparacion], {
    npcs: {
      npc_a: { escena: 'escena_archivo', relacion: -30, bloqueadoConocimientos: true },
      npc_b: { escena: 'escena_taberna', relacion: 0, bloqueadoConocimientos: true },
      npc_c: { escena: 'escena_puente', relacion: 0, bloqueadoConocimientos: false },
    },
    ...extra,
  });

  test('quita un tag medio/grave, baja el resto 1, suma +15 y levanta el bloqueo', () => {
    const antes = caso({ tags: [tag('miedo', 'npc_a', 3), tag('desconfianza', 'npc_a', 2), tag('rencor', 'npc_a', 1), tag('gratitud', 'npc_a', 1)] });
    const r = dispararHito(reparacion, antes, conBloqueo());
    assert.equal(r.reparado, 'npc_a');
    assert.equal(nivelDeTag(r.estadoCaso.tags, 'miedo', 'npc_a'), 0);
    assert.equal(nivelDeTag(r.estadoCaso.tags, 'desconfianza', 'npc_a'), 1);
    assert.equal(nivelDeTag(r.estadoCaso.tags, 'rencor', 'npc_a'), 0);
    assert.equal(nivelDeTag(r.estadoCaso.tags, 'gratitud', 'npc_a'), 1);
    assert.equal(r.estadoMundo.npcs.npc_a.relacion, -15);
    assert.equal(r.estadoMundo.npcs.npc_a.bloqueadoConocimientos, false);
    assert.equal(r.estadoMundo.npcs.npc_b.bloqueadoConocimientos, true);
    assert.deepEqual(r.estadoCaso.reparados, ['npc_a']);
  });

  test('la relación no pasa de 100', () => {
    const m = conBloqueo();
    m.npcs.npc_a.relacion = 95;
    const r = dispararHito(reparacion, caso({ tags: [tag('miedo', 'npc_a', 2)] }), m);
    assert.equal(r.estadoMundo.npcs.npc_a.relacion, 100);
  });

  test('es repetible, una vez por NPC', () => {
    const m = conBloqueo();
    let estado = caso({ tags: [tag('rencor', 'npc_a', 2), tag('miedo', 'npc_b', 2)] });
    estado = actualizarListos(estado, m);
    let r = dispararHito(reparacion, estado, m);
    assert.equal(r.reparado, 'npc_a');

    // Sigue disponible: queda npc_b por reparar.
    estado = actualizarListos(r.estadoCaso, r.estadoMundo);
    assert.deepEqual(estado.hitosListos, ['h7']);
    r = dispararHito(reparacion, estado, { ...r.estadoMundo, turno: 2 });
    assert.equal(r.reparado, 'npc_b');
    assert.equal(r.estadoMundo.npcs.npc_b.bloqueadoConocimientos, false);
    assert.deepEqual(r.estadoCaso.reparados, ['npc_a', 'npc_b']);

    // npc_a vuelve a tener rencor medio: ya se reparó una vez, no hay segunda.
    estado = { ...r.estadoCaso, tags: [tag('rencor', 'npc_a', 2)] };
    assert.deepEqual(actualizarListos(estado, r.estadoMundo).hitosListos, []);
  });

  test('rencor grave: solo con repara_rencor_grave', () => {
    const grave = caso({ tags: [tag('rencor', 'npc_a', 3)] });
    const comun = dispararHito(reparacion, grave, conBloqueo());
    assert.equal(comun.reparado, null);
    assert.equal(nivelDeTag(comun.estadoCaso.tags, 'rencor', 'npc_a'), 3);
    assert.equal(comun.estadoMundo.npcs.npc_a.bloqueadoConocimientos, true);

    const explicita = { ...reparacion, repara_rencor_grave: true };
    const r = dispararHito(explicita, grave, conBloqueo());
    assert.equal(r.reparado, 'npc_a');
    assert.equal(nivelDeTag(r.estadoCaso.tags, 'rencor', 'npc_a'), 0);
    assert.equal(r.estadoMundo.npcs.npc_a.relacion, -15);
  });

  test('npc_reparacion fija el NPC', () => {
    const fija = { ...reparacion, npc_reparacion: 'npc(p2)' };
    const estado = caso({ tags: [tag('rencor', 'npc_a', 2), tag('miedo', 'npc_b', 2)] });
    assert.equal(dispararHito(fija, estado, conBloqueo()).reparado, 'npc_b');
  });

  test('sin nada que reparar se dispara como un hito común', () => {
    const r = dispararHito(reparacion, caso({ tags: [tag('rencor', 'npc_a', 1)] }), conBloqueo());
    assert.equal(r.reparado, null);
    assert.deepEqual(r.estadoCaso.hitosAlcanzados, ['h7']);
    assert.equal(r.estadoMundo.npcs.npc_a.relacion, -30);
    assert.deepEqual(actualizarListos(r.estadoCaso, r.estadoMundo).hitosListos, []);
  });
});

describe('hitos: gancho fuera de escena', () => {
  const enArchivo = hito('h2', {}, { escena_entrega: 'escena_archivo' });
  const enMercado = hito('h3', {}, { escena_entrega: 'escena_mercado' });

  test('hito listo fuera de su escena de entrega: gancho con escena y NPC', () => {
    const m = mundo([enArchivo]);
    const estado = actualizarListos(caso(), m);
    assert.equal(elegirDisparo(estado, m), null);
    const r = ganchoFueraDeEscena(estado, m);
    assert.deepEqual(r.gancho, { hitoId: 'h2', escena: 'escena_archivo', npcId: 'npc_a', movido: false });
    assert.equal(r.estadoCaso, estado);
  });

  test('escena de una ranura: el NPC del gancho es el de esa ranura', () => {
    const h = hito('h2', {}, { escena_entrega: 'escena(p3)' });
    const m = mundo([h]);
    const r = ganchoFueraDeEscena(actualizarListos(caso(), m), m);
    assert.deepEqual(r.gancho, { hitoId: 'h2', escena: 'escena_puente', npcId: 'npc_c', movido: false });
  });

  test('escena sin NPC de ranura: gancho sin NPC', () => {
    const m = mundo([enMercado]);
    const r = ganchoFueraDeEscena(actualizarListos(caso(), m), m);
    assert.deepEqual(r.gancho, { hitoId: 'h3', escena: 'escena_mercado', npcId: null, movido: false });
  });

  test('sin gancho si el hito se puede entregar acá o no hay listos', () => {
    const m = mundo([enArchivo], { escena: 'escena_archivo' });
    assert.equal(ganchoFueraDeEscena(actualizarListos(caso(), m), m).gancho, null);
    assert.equal(ganchoFueraDeEscena(caso(), mundo([enArchivo])).gancho, null);
    const libre = mundo([hito('h1')]);
    assert.equal(ganchoFueraDeEscena(actualizarListos(caso(), libre), libre).gancho, null);
  });

  test('a las 12 horas de reloj sin entregarse se mueve a la escena del NPC de ranura más cercano', () => {
    const distancias = { escena_archivo: 5, escena_taberna: 2, escena_puente: 3 };
    const extra = { distancia: (_, hasta) => distancias[hasta] };
    let estado = actualizarListos(caso(), mundo([enMercado], { hora: 10, ...extra }));

    let r = ganchoFueraDeEscena(estado, mundo([enMercado], { hora: 21, ...extra }));
    assert.equal(r.gancho.escena, 'escena_mercado');
    assert.equal(r.gancho.movido, false);

    // Muchos turnos sin que avance el reloj no lo mueven.
    r = ganchoFueraDeEscena(estado, mundo([enMercado], { hora: 21, turno: 900, ...extra }));
    assert.equal(r.gancho.movido, false);

    const m22 = mundo([enMercado], { hora: 22, ...extra });
    r = ganchoFueraDeEscena(estado, m22);
    assert.deepEqual(r.gancho, { hitoId: 'h3', escena: 'escena_taberna', npcId: 'npc_b', movido: true });
    assert.deepEqual(r.estadoCaso.entregasMovidas, { h3: 'escena_taberna' });
    estado = r.estadoCaso;
    assert.equal(escenaDeEntrega(enMercado, estado, m22), 'escena_taberna');

    // Ya movido: el gancho sigue apuntando ahí y el hito se entrega en la escena nueva.
    r = ganchoFueraDeEscena(estado, mundo([enMercado], { hora: 40, ...extra }));
    assert.deepEqual(r.gancho, { hitoId: 'h3', escena: 'escena_taberna', npcId: 'npc_b', movido: false });
    assert.equal(elegirDisparo(estado, mundo([enMercado], { hora: 40, escena: 'escena_taberna', ...extra })).id, 'h3');
    assert.equal(elegirDisparo(estado, mundo([enMercado], { hora: 40, escena: 'escena_mercado', ...extra })), null);
  });

  test('sin distancias: el NPC de ranura que está con el jugador, o el primero en el orden', () => {
    let estado = actualizarListos(caso(), mundo([enMercado], { hora: 0 }));
    assert.equal(ganchoFueraDeEscena(estado, mundo([enMercado], { hora: 12 })).gancho.escena, 'escena_archivo');
    estado = actualizarListos(caso(), mundo([enMercado], { hora: 0, escena: 'escena_puente' }));
    assert.equal(ganchoFueraDeEscena(estado, mundo([enMercado], { hora: 12, escena: 'escena_puente' })).gancho, null);
  });

  test('un hito con escena_alternativa: false no se mueve', () => {
    const fijo = { ...enMercado, escena_alternativa: false };
    const estado = actualizarListos(caso(), mundo([fijo], { hora: 0 }));
    const r = ganchoFueraDeEscena(estado, mundo([fijo], { hora: 50 }));
    assert.equal(r.gancho.escena, 'escena_mercado');
    assert.equal(r.gancho.movido, false);
  });
});

describe('hitos: anti-traba', () => {
  const pideEntendida = hito('h3', { tags: [{ tipo: 'pista_conocida', objetivo: 'p1', op: '>=', nivel: 2 }] });

  test('8 turnos sin listos: baja el umbral de pista del siguiente hito alcanzable', () => {
    const hitos = [hito('h2', { requiere_hitos: ['h9'], pistas: { cantidad: 1 } }), pideEntendida, hito('h4', { pistas: { cantidad: 2 } })];
    const vista = { tags: [tag('pista_conocida', 'c_a', 1)] };
    let estado = actualizarListos(caso(vista), mundo(hitos, { turno: 1 }));
    assert.deepEqual(estado.hitosListos, []);

    assert.equal(antiTrabaSinListos(estado, mundo(hitos, { turno: 8 })), estado);
    estado = antiTrabaSinListos(estado, mundo(hitos, { turno: 9 }));
    assert.deepEqual(estado.umbralesBajados, ['h3']);

    // Con el umbral bajado, "vista" alcanza.
    estado = actualizarListos(estado, mundo(hitos, { turno: 9 }));
    assert.deepEqual(estado.hitosListos, ['h3']);
    assert.equal(antiTrabaSinListos(estado, mundo(hitos, { turno: 30 })), estado);
  });

  test('8 turnos sin listos: baja de a un hito, cada 8 turnos, y también el conteo de pistas', () => {
    const hitos = [pideEntendida, hito('h4', { pistas: { cantidad: 1 } })];
    let estado = actualizarListos(caso(), mundo(hitos, { turno: 0 }));
    estado = antiTrabaSinListos(estado, mundo(hitos, { turno: 8 }));
    assert.deepEqual(estado.umbralesBajados, ['h3']);
    assert.equal(antiTrabaSinListos(estado, mundo(hitos, { turno: 15 })), estado);
    estado = antiTrabaSinListos(estado, mundo(hitos, { turno: 16 }));
    assert.deepEqual(estado.umbralesBajados, ['h3', 'h4']);

    const conVista = { ...estado, tags: [tag('pista_conocida', 'c_b', 1)] };
    assert.deepEqual(actualizarListos(conVista, mundo(hitos, { turno: 16 })).hitosListos, ['h4']);
  });

  test('8 turnos sin listos: sin hito al que bajarle el umbral no cambia nada', () => {
    const hitos = [hito('h2', { requiere_hitos: ['h9'] })];
    const estado = actualizarListos(caso(), mundo(hitos, { turno: 0 }));
    assert.equal(antiTrabaSinListos(estado, mundo(hitos, { turno: 50 })), estado);
  });

  test('rencor grave: habilita la reparación sin otras condiciones', () => {
    const reparacion = hito('h7', { requiere_hitos: ['h5'], escena: 'escena_archivo' }, { es_reparacion: true, repara_rencor_grave: true });
    const m = mundo([hito('h2'), reparacion]);
    const sinRencor = caso({ tags: [tag('rencor', 'npc_a', 2)] });
    assert.equal(antiTrabaRencorGrave(sinRencor, m), sinRencor);

    let estado = caso({ tags: [tag('rencor', 'npc_a', 3)] });
    assert.deepEqual(actualizarListos(estado, m).hitosListos, ['h2']);
    estado = antiTrabaRencorGrave(estado, m);
    assert.deepEqual(estado.reparacionHabilitada, ['h7']);
    assert.equal(antiTrabaRencorGrave(estado, m), estado);

    estado = actualizarListos(estado, m);
    assert.deepEqual(estado.hitosListos, ['h2', 'h7']);
    assert.equal(elegirDisparo(estado, m).id, 'h7');
    const r = dispararHito(reparacion, estado, m);
    assert.equal(nivelDeTag(r.estadoCaso.tags, 'rencor', 'npc_a'), 0);
    assert.deepEqual(r.estadoCaso.reparacionHabilitada, []);
    assert.equal(antiTrabaRencorGrave(r.estadoCaso, m), r.estadoCaso);
  });

  test('rencor grave: no cuenta el de un NPC fuera de las ranuras, ni una reparación común', () => {
    const comun = hito('h7', { requiere_hitos: ['h5'] }, { es_reparacion: true });
    const explicita = hito('h6', { requiere_hitos: ['h5'] }, { es_reparacion: true, repara_rencor_grave: true });
    const ajeno = caso({ tags: [tag('rencor', 'npc_z', 3)] });
    assert.equal(antiTrabaRencorGrave(ajeno, mundo([explicita])), ajeno);
    const grave = caso({ tags: [tag('rencor', 'npc_a', 3)] });
    assert.equal(antiTrabaRencorGrave(grave, mundo([comun])), grave);
  });

  test('24 horas de reloj sin avance: pista nivel 1 de la siguiente ranura habilitada', () => {
    const m = (hora, turno = 1) => mundo([], { hora, turno });
    let estado = caso(); // hitoPrevio.hora = 10
    assert.equal(antiTrabaSinAvance(estado, m(33)), estado);
    assert.equal(antiTrabaSinAvance(estado, m(10, 900)), estado); // los turnos no cuentan

    estado = antiTrabaSinAvance(estado, m(34));
    assert.equal(nivelDeTag(estado.tags, 'pista_conocida', 'c_a'), 1);
    assert.deepEqual(estado.ultimoAvance, { hora: 34 });
    assert.equal(estado.tags[0].origen, 'anti_traba:sin_avance');

    // La cuenta vuelve a empezar; la siguiente en el orden de la instancia es p3.
    assert.equal(antiTrabaSinAvance(estado, m(57)), estado);
    estado = antiTrabaSinAvance(estado, m(58));
    assert.equal(nivelDeTag(estado.tags, 'pista_conocida', 'c_c'), 1);
    assert.equal(nivelDeTag(estado.tags, 'pista_conocida', 'c_b'), 0);
    estado = antiTrabaSinAvance(estado, m(82));
    assert.equal(nivelDeTag(estado.tags, 'pista_conocida', 'c_b'), 1);
    // Sin ranuras por sembrar no hace nada.
    assert.equal(antiTrabaSinAvance(estado, m(500)), estado);
  });

  test('24 horas sin avance: un hito disparado reinicia la cuenta y no pisa una pista ya vista', () => {
    const h = hito('h2');
    const { estadoCaso } = dispararHito(h, caso({ tags: [tag('pista_conocida', 'c_a', 2)] }), mundo([h], { hora: 30 }));
    assert.equal(antiTrabaSinAvance(estadoCaso, mundo([], { hora: 53 })), estadoCaso);
    const r = antiTrabaSinAvance(estadoCaso, mundo([], { hora: 54 }));
    assert.equal(nivelDeTag(r.tags, 'pista_conocida', 'c_a'), 2);
    assert.equal(nivelDeTag(r.tags, 'pista_conocida', 'c_c'), 1);
  });

  test('todos los finales bloqueados: habilita el neutro por abandono', () => {
    const hitos = [hito('h2'), hito('h7', {}, { final: true }), hito('h8', {}, { final: true })];
    const uno = caso({ hitosBloqueados: ['h7'] });
    assert.equal(antiTrabaFinalesBloqueados(uno, mundo(hitos)), uno);
    const todos = caso({ hitosBloqueados: ['h7', 'h8'] });
    const r = antiTrabaFinalesBloqueados(todos, mundo(hitos));
    assert.equal(r.abandonoHabilitado, true);
    assert.equal(antiTrabaFinalesBloqueados(r, mundo(hitos)), r);
    const sinFinales = caso({ hitosBloqueados: ['h2'] });
    assert.equal(antiTrabaFinalesBloqueados(sinFinales, mundo([hito('h2')])), sinFinales);
  });
});

describe('hitos: esquema del documento', () => {
  // El hito de ejemplo de docs/motor-caso-v1-operativo.md, sección "Esquema de condiciones".
  const doc = readFileSync(new URL('../../docs/motor-caso-v1-operativo.md', import.meta.url), 'utf8');
  const seccion = doc.slice(doc.indexOf('## 2b. Esquema de condiciones'), doc.indexOf('## 3. Elección de caso'));
  const ejemplo = JSON.parse(seccion.match(/```json\n([\s\S]*?)```/)[1]);

  // Estado y mundo que cumplen todas las condiciones del ejemplo.
  const estadoQueCumple = () => caso({
    contadorHitos: 2,
    hitoPrevio: { id: 'h2', hora: 12, escena: 'escena_plaza', contador: 1 },
    hitosAlcanzados: ['h1', 'h2'],
    tags: [tag('pista_conocida', 'c_a', 2), tag('pista_conocida', 'c_b', 2), tag('desconfianza', 'npc_b', 1)],
  });
  // npc_b (dueño de p2) está en escena_taberna; hora 20 del día, 8 h después de hitoPrevio.
  const mundoQueCumple = (extra = {}) => mundo([ejemplo], { hora: 20, escena: 'escena_taberna', estadoEvento: 'tenso', ...extra });

  test('el ejemplo tiene todos los tipos de condición del esquema', () => {
    assert.deepEqual(Object.keys(ejemplo.condiciones), ['requiere_hitos', 'tags', 'escena', 'hora', 'contador', 'estado_evento', 'pistas']);
    assert.deepEqual(ejemplo.condiciones.tags.map((t) => t.op), ['>=', '<', 'ausente']);
    assert.deepEqual(Object.keys(ejemplo.condiciones.hora), ['rango', 'desde_previo']);
  });

  test('se cumple con un estado que cumple todo', () => {
    assert.equal(evaluarCondiciones(ejemplo, estadoQueCumple(), mundoQueCumple()), true);
    assert.equal(evaluarCondiciones(ejemplo, estadoQueCumple(), mundoQueCumple({ escena: 'escena_archivo_real' })), true);
  });

  const fallas = [
    ['requiere_hitos: falta h1', (e) => ({ ...e, hitosAlcanzados: ['h2'] }), {}],
    ['requiere_hitos: ninguno de h2 o h3', (e) => ({ ...e, hitosAlcanzados: ['h1'] }), {}],
    ['tag >=: pista p1 solo vista', (e) => ({ ...e, tags: [tag('pista_conocida', 'c_a', 1), tag('pista_conocida', 'c_b', 2), tag('pista_conocida', 'c_c', 2)] }), {}],
    ['tag <: desconfianza media del NPC de p2', (e) => ({ ...e, tags: [...e.tags, tag('desconfianza', 'npc_b', 2)].filter((t, i) => i !== 2) }), {}],
    ['tag ausente: hay rencor del NPC de p1', (e) => ({ ...e, tags: [...e.tags, tag('rencor', 'npc_a', 1)] }), {}],
    ['escena: en otra', (e) => e, { escena: 'escena_plaza' }],
    ['escena: en una de no_en', (e) => e, { escena: 'escena_puente_aduana' }],
    ['hora: fuera del rango', (e) => e, { hora: 24 + 17 }],
    ['hora: menos de 6 h desde hitoPrevio', (e) => ({ ...e, hitoPrevio: { ...e.hitoPrevio, hora: 15 } }), {}],
    ['contador: ningún hito desde hitoPrevio', (e) => ({ ...e, contadorHitos: 1 }), {}],
    ['estado_evento: tranquilo', (e) => e, { estadoEvento: 'tranquilo' }],
    ['pistas: una sola entendida', (e) => ({ ...e, tags: [tag('pista_conocida', 'c_a', 2), tag('pista_conocida', 'c_b', 1)] }), {}],
  ];
  for (const [nombre, cambiar, extraMundo] of fallas) {
    test(`no se cumple — ${nombre}`, () => {
      assert.equal(evaluarCondiciones(ejemplo, cambiar(estadoQueCumple()), mundoQueCumple(extraMundo)), false);
    });
  }

  test('pistas.habilitada: p3 pide que la anterior en el orden (p1) esté vista', () => {
    const soloHabilitada = { id: 'h9', condiciones: { pistas: { habilitada: ejemplo.condiciones.pistas.habilitada } } };
    assert.equal(evaluarCondiciones(soloHabilitada, caso(), mundoQueCumple()), false);
    assert.equal(evaluarCondiciones(soloHabilitada, estadoQueCumple(), mundoQueCumple()), true);
  });

  test('queda listo, se entrega en escena(p2) y al dispararse escribe lo que dice el esquema', () => {
    const m = mundoQueCumple({ turno: 7 });
    const estado = actualizarListos(estadoQueCumple(), m);
    assert.deepEqual(estado.hitosListos, ['h4']);
    assert.equal(escenaDeEntrega(ejemplo, estado, m), 'escena_taberna');
    assert.equal(elegirDisparo(estado, mundoQueCumple({ escena: 'escena_archivo_real' })), null);
    const elegido = elegirDisparo(estado, m);
    assert.equal(elegido.id, 'h4');

    const { estadoCaso } = dispararHito(elegido, estado, m);
    assert.equal(nivelDeTag(estadoCaso.tags, 'gratitud', 'npc_a'), 1);
    assert.equal(nivelDeTag(estadoCaso.tags, 'pista_conocida', 'c_c'), 1);
    assert.deepEqual(estadoCaso.hitoPrevio, { id: 'h4', hora: 20, escena: 'escena_taberna', contador: 3 });
    assert.deepEqual(estadoCaso.hitosBloqueados, ['h5']);
    assert.deepEqual(estadoCaso.hitosAlcanzados, ['h1', 'h2', 'h4']);
    // Los campos del estado que el documento dice que escribe el disparo.
    for (const campo of ['tags', 'contadorHitos', 'hitoPrevio', 'hitosAlcanzados', 'hitosListos', 'listosDesde', 'hitosBloqueados',
      'entregasMovidas', 'reparados', 'umbralesBajados', 'reparacionHabilitada', 'sinListosDesde', 'ultimoAvance', 'turnoUltimoDisparo']) {
      assert.ok(campo in estadoCaso, campo);
    }
    assert.equal(estadoCaso.turnoUltimoDisparo, 7);
  });
});

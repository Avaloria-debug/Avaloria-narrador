import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { nivelDeTag } from './tags.js';
import { abrirPersistenciaCasos } from './persistencia.js';
import { turnoDeCaso, aplicarAccion, elegirTexto, completarMarcadores } from './narrar.js';

// Caso de prueba: no es contenido.
const CONTENIDO = {
  npcs: [
    { id: 'npc_a', nombre: 'Ana', conocimientos: [{ id: 'c_a', contenido: 'el sello' }] },
    { id: 'npc_b', nombre: 'Beto', conocimientos: [{ id: 'c_b', contenido: 'la llave' }] },
  ],
};
const textos = (h) => [1, 2, 3, 4].map((n) => ({ id: `t_${h}_${n}`, texto: `T${n} {npc:p1} y {conocimiento:p2}.`, tono: 'neutro' }));
const CASO = {
  id: 'caso_prueba',
  hitos: [
    { id: 'h1', condiciones: { tags: [{ tipo: 'curiosidad', objetivo: 'npc(p1)', op: '>=', nivel: 1 }] }, escena_entrega: 'e_plaza', textos: textos('h1'), efectos: [{ tipo: 'pista_conocida', objetivo: 'p1', nivel: 1 }], bloquea: [] },
    { id: 'h2', condiciones: { requiere_hitos: ['h1'] }, escena_entrega: 'e_taberna', escena_alternativa: 'e_puente', textos: textos('h2'), efectos: [], bloquea: [], final: true },
    { id: 'h3', condiciones: { requiere_hitos: ['h1'] }, escena_entrega: 'e_otra', textos: textos('h3'), efectos: [], bloquea: [], es_reparacion: true, npc_reparacion: 'npc(p1)' },
  ],
  desenlaces: [
    { id: 'd_n', tipo: 'neutro', requiere: {}, prioridad: 0, efectos_post: [] },
    { id: 'd_p', tipo: 'positivo', requiere: { tags: [{ tipo: 'curiosidad', objetivo: 'npc(p1)', op: '>=', nivel: 1 }] }, prioridad: 1, efectos_post: [{ tipo: 'gratitud', objetivo: 'npc(p1)', nivel: 1 }] },
  ],
};
const estadoInicial = () => ({
  casoId: 'caso_prueba',
  instancia: { pistas: [{ ranura: 'p1', conocimientoId: 'c_a', npcId: 'npc_a', orden: 1 }, { ranura: 'p2', conocimientoId: 'c_b', npcId: 'npc_b', orden: 2 }] },
  tags: [], contadorHitos: 0, hitoPrevio: { id: null, hora: 0, escena: 'e_plaza', contador: 0 },
  hitosAlcanzados: [], hitosListos: [], hitosBloqueados: [],
});
const mundo = (extra = {}) => ({
  hora: 8, turno: 1, escena: 'e_plaza', estadoEvento: 'tranquilo',
  npcs: { npc_a: { escena: 'e_plaza', relacion: 0, bloqueadoConocimientos: false }, npc_b: { escena: 'e_taberna', relacion: 0, bloqueadoConocimientos: false } },
  ...extra,
});

describe('narrar del caso: un turno completo', () => {
  test('acción → tags → listo → disparo → texto → persistencia, y luego final y desenlace', async () => {
    const persistencia = await abrirPersistenciaCasos({ versionContenido: 'v_prueba', indexedDB: new IDBFactory() });
    const comun = { caso: CASO, contenido: CONTENIDO, persistencia, jugadorId: 'j1', partidaId: 'pa1', semilla: 7 };

    let r = await turnoDeCaso({ ...comun, estadoCaso: estadoInicial(), accion: { accionId: 'hablar_amable', npcId: 'npc_a' }, mundo: mundo(), horasAvanzadas: 1 });
    assert.equal(nivelDeTag(r.estadoCaso.tags, 'curiosidad', 'npc_a'), 1);
    assert.equal(r.hito.id, 'h1');
    assert.match(r.texto.texto, /^T\d Ana y la llave\.$/);
    assert.deepEqual(r.estadoCaso.textosUsados, [r.texto.id]);
    assert.equal(r.estadoCaso.contadorHitos, 1);
    assert.equal(nivelDeTag(r.estadoCaso.tags, 'pista_conocida', 'c_a'), 1);
    assert.equal(await persistencia.usoDeTexto('j1', r.texto.id), 1);
    assert.deepEqual((await persistencia.leerEstadoCaso('pa1')).estado, r.estadoCaso);

    // h2 listo; fuera de escena: gancho. En la escena alternativa se entrega, es final: desenlace.
    const sinAccion = { ...comun, accion: null, horasAvanzadas: 0 };
    r = await turnoDeCaso({ ...sinAccion, estadoCaso: r.estadoCaso, mundo: mundo({ turno: 2, npcs: r.npcs }) });
    assert.equal(r.hito, null);
    assert.equal(r.gancho.hitoId, 'h2');
    r = await turnoDeCaso({ ...sinAccion, estadoCaso: r.estadoCaso, mundo: mundo({ turno: 3, escena: 'e_puente', npcs: r.npcs }) });
    assert.equal(r.hito.id, 'h2');
    assert.equal(r.desenlace.id, 'd_p');
    assert.equal(r.estadoCaso.cerrado, true);
    assert.equal(nivelDeTag(r.estadoCaso.tags, 'gratitud', 'npc_a'), 1);

    // Cerrado: el turno no hace nada.
    const cerrado = await turnoDeCaso({ ...sinAccion, estadoCaso: r.estadoCaso, mundo: mundo({ turno: 4 }) });
    assert.equal(cerrado.estadoCaso, r.estadoCaso);
    persistencia.cerrar();
  });

  test('abandono: desenlace neutro default', async () => {
    const r = await turnoDeCaso({ caso: CASO, estadoCaso: estadoInicial(), mundo: mundo(), abandonar: true });
    assert.equal(r.desenlace.id, 'd_n');
    assert.equal(r.estadoCaso.cerrado, true);
  });

  test('traición sobre el NPC de npc_reparacion reinicia su progreso; sobre otro NPC no', () => {
    const conProgreso = { ...estadoInicial(), progresoReparacion: { npc_a: ['e_x', 'e_y'], npc_b: ['e_x'] }, tags: [{ tipo: 'gratitud', objetivo: 'npc_a', nivel: 3, creadoHora: 0, creadoHito: 0 }] };
    const sobreA = aplicarAccion(conProgreso, { accionId: 'amenazar', npcId: 'npc_a' }, mundo(), CASO);
    assert.deepEqual(sobreA.traicionados, ['npc_a']);
    assert.deepEqual(sobreA.estadoCaso.progresoReparacion, { npc_b: ['e_x'] });
    assert.equal(nivelDeTag(sobreA.estadoCaso.tags, 'gratitud', 'npc_a') <= 2, true);
    assert.ok(sobreA.npcs.npc_a.relacion < 0);
    const sobreB = aplicarAccion(conProgreso, { accionId: 'revelar_secreto', npcId: 'npc_b' }, mundo(), CASO);
    assert.deepEqual(sobreB.estadoCaso.progresoReparacion, conProgreso.progresoReparacion);
    const rutina = aplicarAccion(conProgreso, { accionId: 'hablar_amable', npcId: 'npc_a' }, mundo(), CASO);
    assert.deepEqual(rutina.estadoCaso.progresoReparacion, conProgreso.progresoReparacion);
  });

  test('texto: los 4 menos los usados; menor uso del jugador; marcadores', () => {
    const h = CASO.hitos[0];
    const usados = { ...estadoInicial(), textosUsados: ['t_h1_1', 't_h1_2'] };
    const usos = new Map([['t_h1_3', 5], ['t_h1_4', 1]]);
    assert.equal(elegirTexto(h, usados, usos, 1).id, 't_h1_4');
    assert.equal(completarMarcadores('{npc:p2} {npc:p9}', estadoInicial(), CONTENIDO), 'Beto {npc:p9}');
  });
});

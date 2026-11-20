import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nivelDeTag } from './tags.js';
import { antiTrabaCaminoP1, antiTrabaSinAvance, actualizarListos, TURNOS_SIN_AVANCE_CAMINO, HORAS_SIN_AVANCE } from './hitos.js';
import { turnoDeCaso } from './narrar.js';
import { validarCaso, REGLAS } from './validador.js';
import { leerContenido } from '../cargarContenido.js';

// Caso de prueba: no es contenido. h1 pide la pista de p1 y se entrega donde está su dueño, como en los casos reales.
const CONTENIDO = {
  npcs: [
    { id: 'npc_a', nombre: 'Ana', conocimientos: [{ id: 'c_a', contenido: 'el sello escondido' }] },
    { id: 'npc_b', nombre: 'Beto', conocimientos: [{ id: 'c_b', contenido: 'la llave' }] },
  ],
  escenas: [{ id: 'e_plaza', nombre: 'Plaza' }, { id: 'e_taberna', nombre: 'Taberna del puerto' }],
};
const textos = (h) => [1, 2, 3, 4].map((n) => ({ id: `t_${h}_${n}`, texto: `T${n} {npc:p1}: {conocimiento:p1}.`, tono: 'neutro' }));
const CASO = {
  id: 'caso_prueba',
  hitos: [
    { id: 'h1', condiciones: { tags: [{ tipo: 'pista_conocida', objetivo: 'p1', op: '>=', nivel: 1 }] }, escena_entrega: 'escena(p1)', textos: textos('h1'), efectos: [], bloquea: [] },
  ],
  textos_pista_camino: [
    { id: 'pc_1', texto: 'Dicen que {npc:p1} anda por {escena:p1}.' },
    { id: 'pc_2', texto: 'A {npc:p1} se la ve en {escena:p1}.' },
  ],
};
const estadoInicial = () => ({
  casoId: 'caso_prueba',
  instancia: { pistas: [{ ranura: 'p1', conocimientoId: 'c_a', npcId: 'npc_a', orden: 1 }, { ranura: 'p2', conocimientoId: 'c_b', npcId: 'npc_b', orden: 2 }] },
  tags: [{ tipo: 'curiosidad', objetivo: 'npc_b', nivel: 1 }],
  contadorHitos: 0, hitoPrevio: { id: null, hora: 0, escena: 'e_plaza', contador: 0 },
  hitosAlcanzados: [], hitosListos: [], hitosBloqueados: [],
});
const mundo = (extra = {}) => ({
  caso: CASO, hora: 8, turno: 1, escena: 'e_plaza', estadoEvento: 'tranquilo',
  npcs: { npc_a: { escena: 'e_taberna', relacion: 0, bloqueadoConocimientos: false }, npc_b: { escena: 'e_plaza', relacion: 0, bloqueadoConocimientos: false } },
  ...extra,
});

// Corre la regla turno a turno (sin avance de reloj) y devuelve en qué turno apareció la pista.
function turnoDeLaPista(m = {}, estado = estadoInicial(), hasta = 30) {
  let e = estado;
  for (let turno = 1; turno <= hasta; turno++) {
    const r = antiTrabaCaminoP1(e, mundo({ ...m, turno }));
    e = r.estadoCaso;
    if (r.camino) return { turno, camino: r.camino, estado: e };
  }
  return null;
}

describe('anti-traba: camino a p1 tras turnos sin avance', () => {
  test(`la pista nivel 1 de p1 aparece a los ${TURNOS_SIN_AVANCE_CAMINO} turnos sin avance, no antes`, () => {
    assert.equal(TURNOS_SIN_AVANCE_CAMINO, 8);
    const r = turnoDeLaPista();
    assert.equal(r.turno, 1 + TURNOS_SIN_AVANCE_CAMINO);
    assert.deepEqual(r.camino, { npcId: 'npc_a', escena: 'e_taberna' });
    assert.equal(nivelDeTag(r.estado.tags, 'pista_conocida', 'c_a'), 1);
    assert.equal(r.estado.tags.find((t) => t.tipo === 'pista_conocida').origen, 'anti_traba:camino_p1');
    // Un turno antes no hay pista ni tag.
    let e = estadoInicial();
    for (let turno = 1; turno < 1 + TURNOS_SIN_AVANCE_CAMINO; turno++) {
      const x = antiTrabaCaminoP1(e, mundo({ turno }));
      assert.equal(x.camino, null, `turno ${turno}`);
      e = x.estadoCaso;
    }
    assert.equal(nivelDeTag(e.tags, 'pista_conocida', 'c_a'), 0);
    // Una vez dada, no se repite.
    assert.equal(antiTrabaCaminoP1(r.estado, mundo({ turno: 30 })).camino, null);
  });

  test('no aparece si el jugador ya está en la escena del dueño de p1', () => {
    assert.equal(turnoDeLaPista({ escena: 'e_taberna' }), null);
  });

  test('no aparece si el hito ya está listo o ya hay hitos alcanzados', () => {
    assert.equal(turnoDeLaPista({}, { ...estadoInicial(), hitosListos: ['h1'] }), null);
    assert.equal(turnoDeLaPista({}, { ...estadoInicial(), hitosAlcanzados: ['h1'] }), null);
    const conPista = { ...estadoInicial(), tags: [{ tipo: 'pista_conocida', objetivo: 'c_a', nivel: 1 }] };
    assert.equal(turnoDeLaPista({}, conPista), null);
  });

  test('no aparece si el dueño de p1 no está en ninguna escena', () => {
    const npcs = { npc_a: { escena: null, relacion: 0, bloqueadoConocimientos: false }, npc_b: { escena: 'e_plaza', relacion: 0, bloqueadoConocimientos: false } };
    assert.equal(turnoDeLaPista({ npcs }), null);
  });

  test('la pista no revela el conocimiento ni cambia otros tags ni la relación', async () => {
    let r = { estadoCaso: estadoInicial(), npcs: mundo().npcs };
    let pista = null;
    for (let turno = 1; turno <= 1 + TURNOS_SIN_AVANCE_CAMINO; turno++) {
      const antes = r.estadoCaso;
      r = await turnoDeCaso({ estadoCaso: antes, caso: CASO, accion: null, mundo: mundo({ turno, npcs: r.npcs }), contenido: CONTENIDO, semilla: 3 });
      if (r.pistaCamino) { pista = { r, antes }; break; }
      assert.equal(r.texto, null);
    }
    assert.ok(pista, 'la pista apareció');
    const { r: final, antes } = pista;
    assert.match(final.texto.texto, /^(Dicen que Ana anda por Taberna del puerto\.|A Ana se la ve en Taberna del puerto\.)$/);
    assert.ok(!final.texto.texto.includes('sello'), 'no nombra el conocimiento');
    assert.equal(final.hito, null, 'no dispara el hito fuera de la escena del dueño');
    assert.equal(final.gancho.hitoId, 'h1');
    // Tags: solo se agrega pista_conocida de p1; el resto queda igual.
    const sinPista = (tags) => tags.filter((t) => t.tipo !== 'pista_conocida');
    assert.deepEqual(sinPista(final.estadoCaso.tags), sinPista(antes.tags));
    assert.deepEqual(final.estadoCaso.tags.filter((t) => t.tipo === 'pista_conocida').map((t) => [t.objetivo, t.nivel]), [['c_a', 1]]);
    assert.deepEqual(final.npcs, mundo().npcs);
    // En la escena del dueño, el h1 se entrega como siempre.
    const entrega = await turnoDeCaso({ estadoCaso: final.estadoCaso, caso: CASO, accion: null, mundo: mundo({ turno: 20, escena: 'e_taberna', npcs: final.npcs }), contenido: CONTENIDO, semilla: 3 });
    assert.equal(entrega.hito.id, 'h1');
  });

  test('sin textos_pista_camino, la pista queda como tag y no hay texto', async () => {
    const caso = { ...CASO, textos_pista_camino: undefined };
    let r = { estadoCaso: estadoInicial() };
    for (let turno = 1; turno <= 1 + TURNOS_SIN_AVANCE_CAMINO; turno++) {
      r = await turnoDeCaso({ estadoCaso: r.estadoCaso, caso, accion: null, mundo: mundo({ turno, caso }), contenido: CONTENIDO, semilla: 3 });
    }
    assert.equal(r.pistaCamino.texto, null);
    assert.equal(r.texto, null);
    assert.equal(nivelDeTag(r.estadoCaso.tags, 'pista_conocida', 'c_a'), 1);
  });

  test('la regla de 24 horas sigue igual', () => {
    assert.equal(HORAS_SIN_AVANCE, 24);
    const e = actualizarListos(estadoInicial(), mundo());
    assert.equal(nivelDeTag(antiTrabaSinAvance(e, mundo({ hora: 23 })).tags, 'pista_conocida', 'c_a'), 0);
    assert.equal(nivelDeTag(antiTrabaSinAvance(e, mundo({ hora: 24 })).tags, 'pista_conocida', 'c_a'), 1);
  });
});

describe('textos de pista de camino en los casos', () => {
  let contenido;
  let casos;
  before(async () => {
    contenido = await leerContenido();
    casos = JSON.parse(fs.readFileSync(new URL('../../data/contenido/casos.json', import.meta.url), 'utf8')).casos;
  });

  test('cada caso trae textos de pista de camino válidos, sin marcador de conocimiento', () => {
    for (const caso of casos) {
      assert.ok(caso.textos_pista_camino.length >= 1, caso.id);
      for (const t of caso.textos_pista_camino) assert.doesNotMatch(t.texto, /\{conocimiento:/, t.id);
      const errores = validarCaso(caso, contenido).errores ?? validarCaso(caso, contenido);
      assert.deepEqual(lista(errores).filter((e) => String(e.regla ?? e).includes('marcador')), [], caso.id);
    }
  });

  test('el validador rechaza un texto de pista que nombra el conocimiento', () => {
    const caso = { ...casos[0], textos_pista_camino: [{ id: 'x_1', texto: '{npc:p1} sabe {conocimiento:p1}.' }] };
    const r = validarCaso(caso, contenido);
    const errores = lista(r.errores ?? r);
    assert.ok(errores.some((e) => (e.regla ?? e) === REGLAS.MARCADOR || String(e.detalle ?? e.mensaje ?? e).includes('conocimiento:p1')), JSON.stringify(errores));
  });

  test('con datos reales: nombra al dueño y su escena, no el conocimiento', async () => {
    const caso = casos.find((c) => c.id === 'caso_01');
    const estado = { ...estadoInicial(), casoId: 'caso_01', tags: [], instancia: { pistas: [{ ranura: 'p1', conocimientoId: 'conocimiento_brenn_1', npcId: 'brenn_arriero', orden: 1 }] } };
    const m = (turno) => ({ caso, hora: 8, turno, escena: 'escena_mercado_circular', estadoEvento: 'tranquilo', npcs: { brenn_arriero: { escena: 'escena_plaza_cambistas', relacion: 0, bloqueadoConocimientos: false } } });
    let r = { estadoCaso: estado };
    for (let turno = 1; turno <= 1 + TURNOS_SIN_AVANCE_CAMINO; turno++) {
      r = await turnoDeCaso({ estadoCaso: r.estadoCaso, caso, accion: null, mundo: m(turno), contenido, semilla: 5 });
    }
    assert.ok(r.pistaCamino, 'apareció la pista');
    assert.match(r.texto.texto, /Brenn Holt/);
    assert.match(r.texto.texto, /Plaza de los Cambistas/);
    assert.doesNotMatch(r.texto.texto, /posada|escondida/i);
  });
});

function lista(x) { return Array.isArray(x) ? x : []; }

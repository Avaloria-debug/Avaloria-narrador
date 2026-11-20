// Umbral reducido del _1 en el primer contacto con el dueño de p1 al que se llegó por la pista de camino.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar } from './index.js';
import { UMBRAL_PRIMER_CONTACTO_PISTA, umbralDeConsulta, puedeRevelar, MOTIVOS_NO_REVELA } from './conocimientos.js';
import { antiTrabaCaminoP1, TURNOS_SIN_AVANCE_CAMINO } from './casos/hitos.js';

const SEREL = 'serel_panadero';
const S1 = 'conocimiento_serel_1'; // umbral 30
const S2 = 'conocimiento_serel_2'; // umbral 25
const marca = (extra = {}) => ({ primerContactoPista: { npcId: SEREL, usado: false, ...extra } });
const partida = (relacion, caso = null) => {
  const e = crearPartida({ semilla: 11 });
  return { ...e, caso, npcs: { ...e.npcs, [SEREL]: { ...e.npcs[SEREL], relacion } } };
};
const decir = (estado, texto) => narrar(estado, { tipo: 'texto', texto });
const conRelacion = (estado, relacion) => ({ ...estado, npcs: { ...estado.npcs, [SEREL]: { ...estado.npcs[SEREL], relacion } } });
const HARINA = '¿qué proveedor te vende la harina?';
const HORNO = '¿a qué hora prendés el horno al alba?';

describe('umbral de primer contacto por pista', () => {
  test(`el valor propuesto es ${UMBRAL_PRIMER_CONTACTO_PISTA}`, () => {
    assert.equal(UMBRAL_PRIMER_CONTACTO_PISTA, 0);
  });

  test('sin pista seguida, el umbral es el original', async () => {
    const r = await decir(partida(15), HARINA);
    assert.deepEqual(r.estado.npcs[SEREL].conocimientosRevelados, []);
    const otroNpc = await decir(partida(15, { primerContactoPista: { npcId: 'brenn_arriero', usado: false } }), HARINA);
    assert.deepEqual(otroNpc.estado.npcs[SEREL].conocimientosRevelados, []);
    const usada = await decir(partida(15, marca({ usado: true })), HARINA);
    assert.deepEqual(usada.estado.npcs[SEREL].conocimientosRevelados, []);
  });

  test('con pista seguida, la primera consulta del _1 con relación entre 0 y 30 revela', async () => {
    for (const rel of [0, 15, 29]) {
      const r = await decir(partida(rel, marca()), HARINA);
      assert.deepEqual(r.estado.npcs[SEREL].conocimientosRevelados, [S1], `relación ${rel}`);
    }
    // Hostil: por debajo del umbral reducido no revela.
    const hostil = await decir(partida(-5, marca()), HARINA);
    assert.deepEqual(hostil.estado.npcs[SEREL].conocimientosRevelados, []);
  });

  test('la segunda consulta vuelve a exigir el umbral original', async () => {
    const primera = await decir(partida(-5, marca()), HARINA);
    assert.deepEqual(primera.estado.npcs[SEREL].conocimientosRevelados, []);
    assert.equal(primera.estado.caso.primerContactoPista.usado, true);
    const segunda = await decir(conRelacion(primera.estado, 15), HARINA);
    assert.deepEqual(segunda.estado.npcs[SEREL].conocimientosRevelados, []);
    const tercera = await decir(conRelacion(segunda.estado, 30), HARINA);
    assert.deepEqual(tercera.estado.npcs[SEREL].conocimientosRevelados, [S1]);
  });

  test('el _2 nunca revela por este cambio', async () => {
    const r = await decir(partida(15, marca()), HORNO);
    assert.deepEqual(r.estado.npcs[SEREL].conocimientosRevelados, []);
    // Primero el _1 con umbral reducido; después el _2 sigue pidiendo 25.
    const conS1 = await decir(partida(15, marca()), HARINA);
    const s2 = await decir(conS1.estado, HORNO);
    assert.deepEqual(s2.estado.npcs[SEREL].conocimientosRevelados, [S1]);
    const k2 = { id: S2, umbralRelacion: 25 };
    const npcDef = { id: SEREL, conocimientos: [{ id: S1, umbralRelacion: 30 }, k2] };
    assert.equal(umbralDeConsulta(npcDef, k2, { caso: marca() }), null);
    assert.equal(puedeRevelar(k2, SEREL, { relacion: 15, conocimientosRevelados: [], bloqueadoConocimientos: false }, {}, {}, { umbral: umbralDeConsulta(npcDef, k2, { caso: marca() }) }).motivo, MOTIVOS_NO_REVELA.UMBRAL);
  });

  test('bloqueado por ataque: el umbral reducido no lo habilita', async () => {
    const e = partida(15, marca());
    const r = await decir({ ...e, npcs: { ...e.npcs, [SEREL]: { ...e.npcs[SEREL], bloqueadoConocimientos: true } } }, HARINA);
    assert.deepEqual(r.estado.npcs[SEREL].conocimientosRevelados, []);
  });

  test('la regla de camino a p1 deja la marca de primer contacto sin usar', () => {
    const estadoCaso = {
      casoId: 'c', tags: [], hitosAlcanzados: [], hitosListos: [], contadorHitos: 0,
      instancia: { pistas: [{ ranura: 'p1', conocimientoId: 'c_a', npcId: 'npc_a', orden: 1 }] },
    };
    const mundo = (turno) => ({ hora: 8, turno, escena: 'e_plaza', npcs: { npc_a: { escena: 'e_taberna' } } });
    let e = estadoCaso;
    let camino = null;
    for (let t = 1; t <= 1 + TURNOS_SIN_AVANCE_CAMINO && !camino; t++) ({ estadoCaso: e, camino } = antiTrabaCaminoP1(e, mundo(t)));
    assert.ok(camino);
    assert.deepEqual(e.primerContactoPista, { npcId: 'npc_a', usado: false });
  });
});

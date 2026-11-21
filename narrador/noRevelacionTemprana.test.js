// No revelación temprana: el segundo conocimiento (_2) de Ivor, Hollis, Elia y Oren no sale antes de su umbral.
// Se prueba de punta a punta con `narrar` (texto libre), con los diccionarios reales.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';

// NPC -> escena donde está a las 08:00 del día 1 (la partida empieza ahí).
const CASOS = [
  { npc: 'ivor_cambista', escena: 'escena_plaza_cambistas' },
  { npc: 'hollis_pastor', escena: 'escena_camino_sur' },
  { npc: 'elia_bibliotecaria', escena: 'escena_biblioteca_publica' },
  { npc: 'oren_peregrino', escena: 'escena_cruce_colinas' },
];
const def = (id) => contenido.npcs.find((n) => n.id === id);

/** Partida con el jugador en la escena del NPC y esa relación; `extra` pisa campos del estado (marcas, eventos). */
function partida({ npc, escena }, relacion, extra = {}) {
  const e = crearPartida({ semilla: 5 });
  return {
    ...e,
    ...extra,
    jugador: { ...e.jugador, escenaId: escena },
    npcs: { ...e.npcs, [npc]: { ...e.npcs[npc], relacion } },
  };
}
const frasesDe = (k) => k.palabrasClave.flatMap((p) => [`¿qué sabés de ${p}?`, p, `hablame sobre ${p}`]);
const reveladosTras = async (estado, frase, npc) => (await narrar(estado, { tipo: 'texto', texto: frase })).estado.npcs[npc].conocimientosRevelados;

describe('el _2 no se revela antes de su umbral', () => {
  for (const caso of CASOS) {
    const { npc } = caso;
    const [k1, k2] = def(npc).conocimientos;

    test(`${npc}: con relación 0 y con umbral − 1, ninguna frase de tema del _2 lo revela`, async () => {
      assert.ok(k2.umbralRelacion > 0);
      for (const relacion of [0, k2.umbralRelacion - 1]) {
        for (const frase of frasesDe(k2)) {
          const reveladas = await reveladosTras(partida(caso, relacion), frase, npc);
          assert.ok(!reveladas.includes(k2.id), `${frase} (relación ${relacion})`);
        }
      }
    });

    test(`${npc}: con el umbral exacto sí se revela, y solo una vez`, async () => {
      // Los _2 de estos cuatro NPC no piden evento ni marca; las condiciones están en el _1 (más abajo).
      assert.equal(k2.requiereEvento ?? null, null);
      assert.equal(k2.requiereMarca ?? null, null);
      for (const frase of frasesDe(k2)) {
        const reveladas = await reveladosTras(partida(caso, k2.umbralRelacion), frase, npc);
        assert.deepEqual(reveladas, [k2.id], frase);
      }
      const una = await narrar(partida(caso, k2.umbralRelacion), { tipo: 'texto', texto: `¿qué sabés de ${k2.palabrasClave[0]}?` });
      const otra = await narrar(una.estado, { tipo: 'texto', texto: `¿y de ${k2.palabrasClave[0]}?` });
      assert.deepEqual(otra.estado.npcs[npc].conocimientosRevelados, [k2.id]);
    });

    // 0.0.43: el _1 de Hollis ya no pide evento; para él se prueba el orden (sale el _1 antes que el _2).
    if (k1.requiereEvento == null && k1.requiereMarca == null) {
      test(`${npc}: el _1 no pide condición; hablando con relación máxima sale el _1 antes que el _2`, async () => {
        const r = await narrar(partida(caso, 100), { tipo: 'texto', texto: `hablar con ${def(npc).alias[0]}` });
        assert.deepEqual(r.estado.npcs[npc].conocimientosRevelados, [k1.id]);
      });
    } else test(`${npc}: hablando con él, el _2 no se revela aunque la relación sea máxima y falte la condición del _1`, async () => {
      // El _2 nunca se revela antes que el _1: por conversación, el _1 pendiente (sin su evento o marca) lo traba.
      let estado = partida(caso, 100);
      const alias = def(npc).alias[0];
      for (let i = 0; i < 6; i++) {
        estado = (await narrar(estado, { tipo: 'texto', texto: `hablar con ${alias}` })).estado;
        assert.ok(!estado.npcs[npc].conocimientosRevelados.includes(k2.id), `turno ${i + 1}`);
        if (k1.requiereEvento != null || k1.requiereMarca != null) {
          assert.deepEqual(estado.npcs[npc].conocimientosRevelados, [], `turno ${i + 1}`);
        }
      }
    });

    test(`${npc}: el _1 con el umbral exacto pide su condición (${k1.requiereEvento ?? k1.requiereMarca ?? 'ninguna'})`, async () => {
      const frase = `¿qué sabés de ${k1.palabrasClave[0]}?`;
      const base = partida(caso, k1.umbralRelacion);
      if (k1.requiereEvento != null) {
        const evento = [{ id: k1.requiereEvento, escenaId: caso.escena, turnosRestantes: 3, horaFin: null }];
        assert.deepEqual(await reveladosTras(base, frase, npc), []);
        assert.deepEqual(await reveladosTras({ ...base, eventosActivos: evento }, frase, npc), [k1.id]);
      } else if (k1.requiereMarca != null) {
        assert.deepEqual(await reveladosTras(base, frase, npc), []);
        assert.deepEqual(await reveladosTras({ ...base, marcas: [k1.requiereMarca] }, frase, npc), [k1.id]);
      } else {
        assert.deepEqual(await reveladosTras(base, frase, npc), [k1.id]);
      }
      // Un punto menos de relación: no se revela ni con la condición cumplida.
      const justo = partida(caso, k1.umbralRelacion - 1, { marcas: k1.requiereMarca ? [k1.requiereMarca] : [], eventosActivos: k1.requiereEvento ? [{ id: k1.requiereEvento, escenaId: caso.escena, turnosRestantes: 3, horaFin: null }] : [] });
      assert.deepEqual(await reveladosTras(justo, frase, npc), []);
    });
  }
});

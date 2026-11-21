// 0.0.43: el _1 de Hollis ya no pide la tormenta (opción b); el h1 lo entrega siempre.
// El mecanismo general (un hito no entrega un conocimiento con evento sin cumplir) sigue, probado con Ivor.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { hitoEsperaEvento } from './casos/narrar.js';
import { puedeRevelar, MOTIVOS_NO_REVELA as M } from './conocimientos.js';
import { npcInicial } from './npcs.js';
import { posicionesDeNpcs } from './movimientoNpcs.js';

const HOLLIS = 'hollis_pastor';
const SENDERO = 'conocimiento_sendero_sin_vigilancia'; // _1 de Hollis, sin evento desde 0.0.43
const H2 = 'conocimiento_hollis_2';
const IVOR = 'ivor_cambista';
const I1 = 'conocimiento_ivor_1'; // pide evento_deuda_impaga
const ahora = () => '2026-11-21T10:00:00Z';
const def = (id) => contenido.npcs.find((n) => n.id === id);
const textos = [1, 2, 3, 4].map((n) => ({ id: `t_h1_${n}`, texto: `Te enterás de algo (${n}): {conocimiento:p1}.`, tono: 'neutro' }));
const CASO = {
  id: 'caso_prueba',
  hitos: [{ id: 'h1', condiciones: { tags: [{ tipo: 'pista_conocida', objetivo: 'p1', op: '>=', nivel: 1 }] }, escena_entrega: null, textos, efectos: [], bloquea: [] }],
  desenlaces: [{ id: 'd_n', tipo: 'neutro', requiere: {}, prioridad: 0, efectos_post: [] }],
};
const estadoCaso = (npcId, conocimientoId, escena) => ({
  casoId: 'caso_prueba',
  instancia: { pistas: [{ ranura: 'p1', conocimientoId, npcId, orden: 1 }] },
  tags: [{ tipo: 'pista_conocida', objetivo: conocimientoId, nivel: 1, creadoHora: 8, creadoHito: 0, casoId: 'caso_prueba', origen: 'anti_traba:camino_p1' }],
  contadorHitos: 0, hitoPrevio: { id: null, hora: 8, escena, contador: 0 },
  hitosAlcanzados: [], hitosListos: [], hitosBloqueados: [],
});
const evento = (id, escenaId) => ({ id, escenaId, turnosRestantes: 5, horaFin: null });
// Jugador con el NPC, en la escena donde está a esa hora.
const partida = (npcId, conocimientoId, eventos = []) => {
  const e = crearPartida({ semilla: 5 });
  const escena = posicionesDeNpcs(e.reloj, contenido)[npcId];
  return { ...e, jugador: { ...e.jugador, escenaId: escena }, caso: estadoCaso(npcId, conocimientoId, escena), eventosActivos: eventos.map(([id]) => evento(id, escena)) };
};
const hablar = (e, npcId) => narrar(e, { tipo: 'boton', intencionId: 'intencion_hablar_con', parametros: { npcId } }, { casos: [CASO], ahora });
const textoDe = (npcId, id) => def(npcId).conocimientos.find((k) => k.id === id).contenido;

describe('0.0.43: el h1 entrega el _1 de Hollis siempre', () => {
  test('el contenido: el _1 de Hollis no pide evento; el resto del conocimiento sigue igual', () => {
    const k = def(HOLLIS).conocimientos.find((x) => x.id === SENDERO);
    assert.equal(k.requiereEvento, null);
    assert.equal(k.requiereMarca, null);
    assert.equal(k.umbralRelacion, 30);
    assert.equal(k.contenido, 'Un sendero sin vigilancia en las colinas');
    assert.deepEqual(k.palabrasClave, ['sendero', 'colinas', 'vigilancia']);
  });

  test('sin tormenta, el h1 se entrega y revela el _1', async () => {
    const r = await hablar(partida(HOLLIS, SENDERO), HOLLIS);
    assert.deepEqual(r.estado.caso.hitosAlcanzados, ['h1']);
    assert.ok(r.texto.includes(textoDe(HOLLIS, SENDERO)), r.texto);
    assert.deepEqual(r.estado.npcs[HOLLIS].conocimientosRevelados, [SENDERO]);
  });

  test('con tormenta, igual: el h1 se entrega y revela el _1', async () => {
    const r = await hablar(partida(HOLLIS, SENDERO, [['evento_tormenta_verano']]), HOLLIS);
    assert.deepEqual(r.estado.caso.hitosAlcanzados, ['h1']);
    assert.deepEqual(r.estado.npcs[HOLLIS].conocimientosRevelados, [SENDERO]);
  });

  test('el _2 no cambia: sin evento, el h1 lo entrega', async () => {
    const k2 = def(HOLLIS).conocimientos.find((x) => x.id === H2);
    assert.equal(k2.requiereEvento ?? null, null);
    const r = await hablar(partida(HOLLIS, H2), HOLLIS);
    assert.deepEqual(r.estado.caso.hitosAlcanzados, ['h1']);
    assert.deepEqual(r.estado.npcs[HOLLIS].conocimientosRevelados, [H2]);
  });

  test('los conocimientos que piden marca no cambian: siguen pidiendo leyo', () => {
    const conMarca = [['elia_bibliotecaria', 'conocimiento_elia_1', 50], ['oren_peregrino', 'conocimiento_oren_1', 30], ['brenn_arriero', 'conocimiento_brenn_2', 40]];
    for (const [npcId, id, umbral] of conMarca) {
      const k = def(npcId).conocimientos.find((x) => x.id === id);
      assert.equal(k.requiereMarca, 'leyo', id);
      assert.equal(k.requiereEvento ?? null, null, id);
      assert.equal(k.umbralRelacion, umbral, id);
      const n = { ...npcInicial(def(npcId)), relacion: 100 };
      assert.equal(puedeRevelar(k, npcId, n, { eventosActivos: [], marcas: [] }, contenido).motivo, M.MARCA, id);
      assert.equal(puedeRevelar(k, npcId, n, { eventosActivos: [], marcas: ['leyo'] }, contenido).puede, true, id);
    }
  });
});

describe('el hito sigue respetando el evento de un conocimiento que lo pide (Ivor)', () => {
  test('sin la deuda impaga, el h1 con el _1 de Ivor queda listo; con la deuda, se entrega', async () => {
    const r1 = await hablar(partida(IVOR, I1), IVOR);
    assert.deepEqual(r1.estado.caso.hitosAlcanzados, []);
    assert.ok(r1.estado.caso.hitosListos.includes('h1'));
    assert.ok(!r1.estado.npcs[IVOR].conocimientosRevelados.includes(I1));
    const conDeuda = { ...r1.estado, eventosActivos: [evento('evento_deuda_impaga', r1.estado.jugador.escenaId)] };
    const r2 = await hablar(conDeuda, IVOR);
    assert.deepEqual(r2.estado.caso.hitosAlcanzados, ['h1']);
    assert.deepEqual(r2.estado.npcs[IVOR].conocimientosRevelados, [I1]);
  });

  test('hitoEsperaEvento: Hollis no espera; Ivor espera salvo revelado, con el evento o sin eventos en el contrato', () => {
    const npcs = (id, revelados) => ({ [id]: { escena: 'x', conocimientosRevelados: revelados } });
    assert.equal(hitoEsperaEvento(CASO.hitos[0], estadoCaso(HOLLIS, SENDERO, 'x'), { eventosActivos: [], npcs: npcs(HOLLIS, []) }, contenido), false);
    const ec = estadoCaso(IVOR, I1, 'x');
    assert.equal(hitoEsperaEvento(CASO.hitos[0], ec, { eventosActivos: [], npcs: npcs(IVOR, []) }, contenido), true);
    assert.equal(hitoEsperaEvento(CASO.hitos[0], ec, { eventosActivos: [], npcs: npcs(IVOR, [I1]) }, contenido), false);
    assert.equal(hitoEsperaEvento(CASO.hitos[0], ec, { eventosActivos: [evento('evento_deuda_impaga', 'escena_x')], npcs: npcs(IVOR, []) }, contenido), false);
    assert.equal(hitoEsperaEvento(CASO.hitos[0], ec, { npcs: npcs(IVOR, []) }, contenido), false);
  });
});

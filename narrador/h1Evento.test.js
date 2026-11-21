// 0.0.43: un hito que narra un conocimiento con evento sin cumplir no se entrega; queda listo hasta que el evento esté.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { hitoEsperaEvento } from './casos/narrar.js';
import { posicionesDeNpcs } from './movimientoNpcs.js';

const HOLLIS = 'hollis_pastor';
const SENDERO = 'conocimiento_sendero_sin_vigilancia'; // _1 de Hollis, requiereEvento: evento_tormenta_verano
const H2 = 'conocimiento_hollis_2'; // _2 de Hollis, sin evento
const ahora = () => '2026-11-21T10:00:00Z';
const textos = [1, 2, 3, 4].map((n) => ({ id: `t_h1_${n}`, texto: `Te enterás de algo (${n}): {conocimiento:p1}.`, tono: 'neutro' }));
const CASO = {
  id: 'caso_prueba',
  hitos: [{ id: 'h1', condiciones: { tags: [{ tipo: 'pista_conocida', objetivo: 'p1', op: '>=', nivel: 1 }] }, escena_entrega: null, textos, efectos: [], bloquea: [] }],
  desenlaces: [{ id: 'd_n', tipo: 'neutro', requiere: {}, prioridad: 0, efectos_post: [] }],
};
const estadoCaso = (conocimientoId) => ({
  casoId: 'caso_prueba',
  instancia: { pistas: [{ ranura: 'p1', conocimientoId, npcId: HOLLIS, orden: 1 }] },
  tags: [{ tipo: 'pista_conocida', objetivo: conocimientoId, nivel: 1, creadoHora: 8, creadoHito: 0, casoId: 'caso_prueba', origen: 'anti_traba:camino_p1' }],
  contadorHitos: 0, hitoPrevio: { id: null, hora: 8, escena: 'escena_camino_sur', contador: 0 },
  hitosAlcanzados: [], hitosListos: [], hitosBloqueados: [],
});
const TORMENTA = (escenaId) => ({ id: 'evento_tormenta_verano', escenaId, turnosRestantes: 5, horaFin: null });
// Jugador con Hollis, en la escena donde está a esa hora.
const partida = (conocimientoId, eventos = []) => {
  const e = crearPartida({ semilla: 5 });
  const escena = posicionesDeNpcs(e.reloj, contenido)[HOLLIS];
  return { ...e, jugador: { ...e.jugador, escenaId: escena }, caso: estadoCaso(conocimientoId), eventosActivos: eventos.map((f) => f(escena)) };
};
const hablar = (e) => narrar(e, { tipo: 'boton', intencionId: 'intencion_hablar_con', parametros: { npcId: HOLLIS } }, { casos: [CASO], ahora });
const senderoTexto = contenido.npcs.find((n) => n.id === HOLLIS).conocimientos.find((k) => k.id === SENDERO).contenido;

describe('el h1 respeta el evento del conocimiento que narra', () => {
  test('sin la tormenta, el h1 no se entrega ni revela el _1: queda listo', async () => {
    const r = await hablar(partida(SENDERO));
    assert.deepEqual(r.estado.caso.hitosAlcanzados, []);
    assert.ok(r.estado.caso.hitosListos.includes('h1'));
    assert.ok(!r.estado.npcs[HOLLIS].conocimientosRevelados.includes(SENDERO));
    assert.ok(!r.texto.includes(senderoTexto), r.texto);
  });

  test('con la tormenta activa, el h1 se entrega y revela el _1', async () => {
    const r = await hablar(partida(SENDERO, [TORMENTA]));
    assert.deepEqual(r.estado.caso.hitosAlcanzados, ['h1']);
    assert.ok(r.texto.includes(senderoTexto), r.texto);
    assert.deepEqual(r.estado.npcs[HOLLIS].conocimientosRevelados, [SENDERO]);
  });

  test('sin tormenta queda listo, y cuando llega la tormenta se entrega', async () => {
    const r1 = await hablar(partida(SENDERO));
    assert.deepEqual(r1.estado.caso.hitosAlcanzados, []);
    const conTormenta = { ...r1.estado, eventosActivos: [TORMENTA(r1.estado.jugador.escenaId)] };
    const r2 = await hablar(conTormenta);
    assert.deepEqual(r2.estado.caso.hitosAlcanzados, ['h1']);
  });

  test('el _2 (sin evento) no cambia: el h1 se entrega sin tormenta', async () => {
    const r = await hablar(partida(H2));
    assert.deepEqual(r.estado.caso.hitosAlcanzados, ['h1']);
    assert.deepEqual(r.estado.npcs[HOLLIS].conocimientosRevelados, [H2]);
  });

  test('hitoEsperaEvento: no bloquea si el conocimiento ya está revelado o si el contrato no pasa eventos', () => {
    const ec = estadoCaso(SENDERO);
    const npcs = (revelados) => ({ [HOLLIS]: { escena: 'escena_camino_sur', conocimientosRevelados: revelados } });
    assert.equal(hitoEsperaEvento(CASO.hitos[0], ec, { eventosActivos: [], npcs: npcs([]) }, contenido), true);
    assert.equal(hitoEsperaEvento(CASO.hitos[0], ec, { eventosActivos: [], npcs: npcs([SENDERO]) }, contenido), false);
    assert.equal(hitoEsperaEvento(CASO.hitos[0], ec, { eventosActivos: [TORMENTA('escena_x')], npcs: npcs([]) }, contenido), false);
    assert.equal(hitoEsperaEvento(CASO.hitos[0], ec, { npcs: npcs([]) }, contenido), false);
  });
});

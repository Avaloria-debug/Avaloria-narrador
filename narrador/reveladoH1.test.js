// 0.0.42: el hito que narra un conocimiento lo deja revelado; el primer contacto por pista no se gasta en bloqueos ajenos a la relación.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { completar } from './narracion.js';
import { conocimientosNarrados } from './casos/narrar.js';
import { posicionesDeNpcs } from './movimientoNpcs.js';

const SEREL = 'serel_panadero';
const S1 = 'conocimiento_serel_1';
const HOLLIS = 'hollis_pastor';
const SENDERO = 'conocimiento_sendero_sin_vigilancia'; // _1 de Hollis: umbral 30, pide evento_tormenta_verano
const ahora = () => '2026-11-20T10:00:00Z';
const serel = contenido.npcs.find((n) => n.id === SEREL);
const EXITO = contenido.plantillas.revelar_conocimiento.exito.map((p) => completar(p, { npc: serel.nombre, conocimiento: serel.conocimientos[0].contenido }));
const NO_SE = contenido.plantillas.no_se.map((p) => completar(p, { npc: serel.nombre }));
const FALLO = contenido.plantillas.revelar_conocimiento.fallo.map((p) => completar(p, { npc: serel.nombre }));
// Respuesta a un conocimiento ya revelado: repite lo contado con la plantilla de éxito (decisión de 0.0.42).
const RESPUESTA_A_REVELADO = EXITO;

// Caso de prueba: h1 listo (pista de p1 conocida), se entrega al actuar y su texto narra el conocimiento de p1.
const textos = [1, 2, 3, 4].map((n) => ({ id: `t_h1_${n}`, texto: `Te enterás de algo (${n}): {conocimiento:p1}.`, tono: 'neutro' }));
const CASO = {
  id: 'caso_prueba',
  hitos: [{ id: 'h1', condiciones: { tags: [{ tipo: 'pista_conocida', objetivo: 'p1', op: '>=', nivel: 1 }] }, escena_entrega: null, textos, efectos: [], bloquea: [] }],
  desenlaces: [{ id: 'd_n', tipo: 'neutro', requiere: {}, prioridad: 0, efectos_post: [] }],
};
const estadoCaso = (extra = {}) => ({
  casoId: 'caso_prueba',
  instancia: { pistas: [{ ranura: 'p1', conocimientoId: S1, npcId: SEREL, orden: 1 }] },
  tags: [{ tipo: 'pista_conocida', objetivo: S1, nivel: 1, creadoHora: 8, creadoHito: 0, casoId: 'caso_prueba', origen: 'anti_traba:camino_p1' }],
  contadorHitos: 0, hitoPrevio: { id: null, hora: 8, escena: 'escena_mercado_circular', contador: 0 },
  hitosAlcanzados: [], hitosListos: [], hitosBloqueados: [], ...extra,
});
const opciones = { casos: [CASO], ahora };
const conNpc = (e, id, cambios) => ({ ...e, npcs: { ...e.npcs, [id]: { ...e.npcs[id], ...cambios } } });
const decir = (e, texto, o = {}) => narrar(e, { tipo: 'texto', texto }, { ahora, ...o });

describe('el h1 deja revelado el conocimiento que narra', () => {
  test('conocimientosNarrados: solo los marcadores {conocimiento:pN} con ranura', () => {
    const ec = estadoCaso();
    assert.deepEqual(conocimientosNarrados('Algo: {conocimiento:p1}. Y {npc:p1}. Y {conocimiento:p9}.', ec), [{ npcId: SEREL, conocimientoId: S1 }]);
    assert.deepEqual(conocimientosNarrados('Sin marcadores de conocimiento: {npc:p1}.', ec), []);
  });

  test('el h1 marca el _1 como revelado, sin tocar la relación', async () => {
    const e = conNpc({ ...crearPartida({ semilla: 3 }), caso: estadoCaso() }, SEREL, { relacion: 0 });
    const r = await narrar(e, { tipo: 'boton', intencionId: 'intencion_hablar_con', parametros: { npcId: SEREL } }, opciones);
    assert.deepEqual(r.estado.caso.hitosAlcanzados, ['h1']);
    assert.match(r.texto, new RegExp(serel.conocimientos[0].contenido.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.deepEqual(r.estado.npcs[SEREL].conocimientosRevelados, [S1]);
    assert.ok(r.estado.npcs[SEREL].relacion < 30, 'la relación sigue lejos del umbral');
  });

  test('la consulta siguiente no responde no_se: repite lo revelado (éxito), no fallo', async () => {
    const e = conNpc({ ...crearPartida({ semilla: 3 }), caso: estadoCaso() }, SEREL, { relacion: 0 });
    const r = await narrar(e, { tipo: 'boton', intencionId: 'intencion_hablar_con', parametros: { npcId: SEREL } }, opciones);
    const c = await decir(r.estado, '¿qué proveedor te vende la harina?', opciones);
    assert.ok(!NO_SE.includes(c.texto), c.texto);
    assert.ok(RESPUESTA_A_REVELADO.includes(c.texto), c.texto);
    assert.ok(!FALLO.includes(c.texto), c.texto);
    assert.deepEqual(c.estado.npcs[SEREL].conocimientosRevelados, [S1]);
  });

  test('sin el hito, la misma consulta con relación 0 sigue fallando por umbral', async () => {
    const e = conNpc(crearPartida({ semilla: 3 }), SEREL, { relacion: 0 });
    const c = await decir(e, '¿qué proveedor te vende la harina?');
    assert.ok(FALLO.includes(c.texto), c.texto);
    assert.deepEqual(c.estado.npcs[SEREL].conocimientosRevelados, []);
  });
});

describe('primer contacto: solo se consume si revela o falla por relación', () => {
  // Jugador en la escena donde está Hollis a esa hora, con la marca de primer contacto sin usar.
  const conHollis = (relacion) => {
    const e = crearPartida({ semilla: 5 });
    const escena = posicionesDeNpcs(e.reloj, contenido)[HOLLIS];
    assert.ok(escena, 'Hollis está en alguna escena');
    return conNpc({ ...e, jugador: { ...e.jugador, escenaId: escena }, caso: { primerContactoPista: { npcId: HOLLIS, usado: false } } }, HOLLIS, { relacion });
  };
  const SOBRE_SENDERO = 'Hollis Dren, ¿qué sabés del sendero de las colinas?';

  test('bloqueada por evento: no revela y la marca queda sin usar', async () => {
    const r = await decir(conHollis(0), SOBRE_SENDERO);
    assert.deepEqual(r.estado.npcs[HOLLIS].conocimientosRevelados, []);
    assert.equal(r.estado.caso.primerContactoPista.usado, false);
    // Con la tormenta activa, la misma consulta con relación 0 revela usando el primer contacto y lo consume.
    const tormenta = { ...r.estado, eventosActivos: [{ id: 'evento_tormenta_verano', escenaId: r.estado.jugador.escenaId, turnosRestantes: 5, horaFin: null }] };
    const r2 = await decir(tormenta, SOBRE_SENDERO);
    assert.deepEqual(r2.estado.npcs[HOLLIS].conocimientosRevelados, [SENDERO]);
    assert.equal(r2.estado.caso.primerContactoPista.usado, true);
  });

  test('la consulta que revela consume la marca', async () => {
    const e = { ...conHollis(10), eventosActivos: [{ id: 'evento_tormenta_verano', escenaId: conHollis(10).jugador.escenaId, turnosRestantes: 5, horaFin: null }] };
    const r = await decir(e, SOBRE_SENDERO);
    assert.deepEqual(r.estado.npcs[HOLLIS].conocimientosRevelados, [SENDERO]);
    assert.equal(r.estado.caso.primerContactoPista.usado, true);
  });

  test('la que falla por relación la consume (como antes)', async () => {
    const e = { ...conHollis(-10), eventosActivos: [{ id: 'evento_tormenta_verano', escenaId: conHollis(-10).jugador.escenaId, turnosRestantes: 5, horaFin: null }] };
    const r = await decir(e, SOBRE_SENDERO);
    assert.deepEqual(r.estado.npcs[HOLLIS].conocimientosRevelados, []);
    assert.equal(r.estado.caso.primerContactoPista.usado, true);
  });
});

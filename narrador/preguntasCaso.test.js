import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { armarInstancia } from './casos/instancias.js';
import { crearRng } from './azar.js';
import casosJson from '../data/contenido/casos.json' with { type: 'json' };

// Caso de prueba: no es contenido. p1 = conocimiento de Serel (escena inicial).
const textos = [1, 2, 3, 4].map((n) => ({ id: `t_prueba_${n}`, texto: `Prueba ${n}.`, tono: 'neutro' }));
const CASO = {
  id: 'caso_prueba',
  hitos: [{ id: 'h1', condiciones: { tags: [{ tipo: 'pista_conocida', objetivo: 'p1', op: '>=', nivel: 1 }] }, escena_entrega: null, textos, efectos: [], bloquea: [] }],
  desenlaces: [{ id: 'd_n', tipo: 'neutro', requiere: {}, prioridad: 0, efectos_post: [] }],
};
const ESTADO_CASO = {
  casoId: 'caso_prueba',
  instancia: { pistas: [{ ranura: 'p1', conocimientoId: 'conocimiento_serel_1', npcId: 'serel_panadero', orden: 1 }] },
  tags: [], contadorHitos: 0, hitoPrevio: { id: null, hora: 8, escena: 'escena_mercado_circular', contador: 0 },
  hitosAlcanzados: [], hitosListos: [], hitosBloqueados: [],
};
const ahora = () => '2026-11-16T10:00:00Z';
const opciones = { casos: [CASO], ahora };
const conRelacion = (e, valor) => ({ ...e, npcs: { ...e.npcs, serel_panadero: { ...e.npcs.serel_panadero, relacion: valor } } });
const partida = () => conRelacion({ ...crearPartida({ semilla: 3 }), caso: ESTADO_CASO }, 100);
const pistas = (estado) => estado.caso.tags.filter((t) => t.tipo === 'pista_conocida');

describe('preguntas en texto y motor de caso', () => {
  test('una pregunta que revela el conocimiento de p1 escribe pista_conocida una vez', async () => {
    const r = await narrar(partida(), { tipo: 'texto', texto: '¿qué sabés de la harina?' }, opciones);
    assert.deepEqual(r.errores, []);
    assert.deepEqual(pistas(r.estado).map((t) => [t.objetivo, t.nivel]), [['conocimiento_serel_1', 1]]);
    assert.ok(r.estado.caso.tags.some((t) => t.tipo === 'curiosidad' && t.objetivo === 'serel_panadero'));
    // Repetir la pregunta (ya revelado) no escribe nada más.
    const r2 = await narrar(r.estado, { tipo: 'texto', texto: '¿qué sabés de la harina?' }, opciones);
    assert.deepEqual(pistas(r2.estado).map((t) => [t.objetivo, t.nivel]), [['conocimiento_serel_1', 1]]);
    assert.equal(r2.estado.caso.tags.length, r.estado.caso.tags.length);
  });

  test('una pregunta sin tema conocido (no_se) no escribe tags', async () => {
    const r = await narrar(partida(), { tipo: 'texto', texto: '¿qué sabés del clima?' }, opciones);
    assert.equal(r.tipo, 'narracion');
    assert.deepEqual(r.estado.caso.tags, []);
  });

  test('una pregunta sin la relación que pide (fallo) no escribe tags', async () => {
    const e = conRelacion({ ...crearPartida({ semilla: 3 }), caso: ESTADO_CASO }, -100);
    const r = await narrar(e, { tipo: 'texto', texto: '¿qué sabés de la harina?' }, opciones);
    assert.deepEqual(r.estado.caso.tags, []);
  });

  test('una consulta no ejecuta desenlaces', async () => {
    const final = { ...CASO, hitos: [{ ...CASO.hitos[0], final: true }] };
    const r = await narrar(partida(), { tipo: 'texto', texto: '¿qué sabés de la harina?' }, { ...opciones, casos: [final] });
    assert.equal(r.estado.caso.cerrado, undefined);
    assert.equal(r.estado.caso.desenlaceId, undefined);
  });

  test('botón y texto de la misma acción escriben los mismos tags', async () => {
    const sinMarca = (tags) => tags.map(({ tipo, objetivo, nivel }) => ({ tipo, objetivo, nivel }));
    const boton = await narrar(partida(), { tipo: 'boton', intencionId: 'intencion_hablar_con', parametros: { npcId: 'serel_panadero' } }, opciones);
    const texto = await narrar(partida(), { tipo: 'texto', texto: 'hablar con Serel' }, opciones);
    assert.ok(boton.estado.caso.tags.length > 0);
    assert.deepEqual(sinMarca(texto.estado.caso.tags), sinMarca(boton.estado.caso.tags));
  });

  test('partida sembrada de 400 turnos con caso real, sin excepciones', async () => {
    const caso = casosJson.casos[0];
    let e = crearPartida({ semilla: 11 });
    e = { ...e, caso: { casoId: caso.id, instancia: armarInstancia(caso, {}, 11, { contenido }), tags: [], contadorHitos: 0, hitoPrevio: { id: null, hora: 8, escena: e.jugador.escenaId, contador: 0 }, hitosAlcanzados: [], hitosListos: [], hitosBloqueados: [] } };
    const rng = crearRng(11);
    const claves = contenido.npcs.flatMap((n) => (n.conocimientos ?? []).flatMap((k) => k.palabrasClave ?? []));
    for (let i = 0; i < 400; i++) {
      const intencion = contenido.intenciones[Math.floor(rng() * contenido.intenciones.length)];
      const r = rng();
      const entrada = r < 0.4
        ? { tipo: 'texto', texto: `¿qué sabés de ${claves[Math.floor(rng() * claves.length)]}?` }
        : r < 0.7 ? { tipo: 'texto', texto: intencion.formas[0] } : { tipo: 'boton', intencionId: intencion.id, parametros: {} };
      const s = await narrar(e, entrada, { casos: casosJson.casos, ahora });
      assert.ok(!s.errores.some((x) => /error_interno|^caso/.test(x)), `turno ${i}: ${s.errores.join('; ')}`);
      e = s.estado;
    }
  });
});

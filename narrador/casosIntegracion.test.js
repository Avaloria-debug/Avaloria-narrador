import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar } from './index.js';
import { nivelDeTag } from './casos/tags.js';

// Caso de prueba: no es contenido. Usa un NPC y un conocimiento que existen en contenido-v3.json.
const textos = [1, 2, 3, 4].map((n) => ({ id: `t_prueba_${n}`, texto: `Prueba ${n}: {npc:p1} te mira.`, tono: 'neutro' }));
const CASO = {
  id: 'caso_prueba',
  hitos: [
    { id: 'h1', condiciones: { tags: [{ tipo: 'curiosidad', objetivo: 'npc(p1)', op: '>=', nivel: 1 }] }, escena_entrega: null, textos, efectos: [], bloquea: [] },
  ],
  desenlaces: [{ id: 'd_n', tipo: 'neutro', requiere: {}, prioridad: 0, efectos_post: [] }],
};
const ESTADO_CASO = {
  casoId: 'caso_prueba',
  instancia: { pistas: [{ ranura: 'p1', conocimientoId: 'conocimiento_serel_1', npcId: 'serel_panadero', orden: 1 }] },
  tags: [], contadorHitos: 0, hitoPrevio: { id: null, hora: 8, escena: 'escena_mercado_circular', contador: 0 },
  hitosAlcanzados: [], hitosListos: [], hitosBloqueados: [],
};
const ahora = () => '2026-11-16T10:00:00Z';
const HABLAR = { tipo: 'boton', intencionId: 'intencion_hablar_con', parametros: { npcId: 'serel_panadero' } };

describe('narrar con motor de caso', () => {
  test('sin caso activo el turno da el mismo resultado que antes', async () => {
    for (const entrada of [HABLAR, { tipo: 'texto', texto: 'hablo con serel' }, { tipo: 'texto', texto: 'xyzzy' }]) {
      const antes = await narrar(crearPartida({ semilla: 3 }), entrada, { ahora });
      const conOpciones = await narrar(crearPartida({ semilla: 3 }), entrada, { ahora, casos: [CASO] });
      assert.deepEqual(conOpciones, antes);
      assert.equal(antes.estado.caso, null);
    }
  });

  test('con caso activo: la acción escribe tags, dispara el hito y su texto se agrega a la narración', async () => {
    const partida = { ...crearPartida({ semilla: 3 }), caso: ESTADO_CASO };
    const sinCaso = await narrar(crearPartida({ semilla: 3 }), HABLAR, { ahora });
    const r = await narrar(partida, HABLAR, { ahora, casos: [CASO] });
    assert.deepEqual(r.errores, []);
    assert.equal(nivelDeTag(r.estado.caso.tags, 'curiosidad', 'serel_panadero'), 1);
    assert.deepEqual(r.estado.caso.hitosAlcanzados, ['h1']);
    assert.equal(r.estado.caso.contadorTurnos, 1);
    assert.match(r.texto, /\n\nPrueba \d: Serel[^{}]* te mira\.$/);
    assert.ok(r.texto.startsWith(sinCaso.texto));
  });

  test('caso activo sin plantilla en opciones: el turno no cambia', async () => {
    const partida = { ...crearPartida({ semilla: 3 }), caso: ESTADO_CASO };
    const r = await narrar(partida, HABLAR, { ahora });
    assert.deepEqual(r.estado.caso, ESTADO_CASO);
    assert.deepEqual(r.errores, []);
  });
});

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCaso, validarCasos, validarAcciones, REGLAS, TONOS_VALIDOS } from './validador.js';
import { ACCIONES } from './acciones.js';

// Datos de prueba: no son contenido. e_isla no se alcanza desde el origen.
const CONTENIDO = {
  escenas: [
    { id: 'e_origen', salidas: ['e_b'] },
    { id: 'e_b', salidas: ['e_origen', 'e_c'] },
    { id: 'e_c', salidas: ['e_b'] },
    { id: 'e_isla', salidas: [] },
  ],
  npcs: [
    { id: 'n1', escenaInicialId: 'e_origen', conocimientos: [{ id: 'k1' }] },
    { id: 'n2', escenaInicialId: 'e_b', conocimientos: [{ id: 'k2' }] },
    { id: 'n3', escenaInicialId: 'e_c', conocimientos: [{ id: 'k3' }] },
    { id: 'n4', escenaInicialId: 'e_c', conocimientos: [{ id: 'k4' }] },
    { id: 'n5', escenaInicialId: 'e_b', conocimientos: [{ id: 'k5' }] },
    { id: 'n6', escenaInicialId: 'e_isla', conocimientos: [{ id: 'k6' }] },
  ],
};
const textos = (h) => [1, 2, 3, 4].map((n) => ({ id: `t_${h}_${n}`, texto: `Texto ${n} con {npc:p1}.`, tono: 'intriga' }));
const hito = (id, extra = {}) => ({ id, condiciones: { requiere_hitos: ['h1'] }, escena_entrega: null, textos: textos(id), efectos: [], bloquea: [], ...extra });
function casoValido() {
  return {
    id: 'caso_prueba',
    tono: 'intriga',
    escenas_origen: ['e_origen'],
    ranuras_pista: [
      { id: 'p1', conocimientos_validos: ['k1', 'k2'] },
      { id: 'p2', conocimientos_validos: ['k3', 'k4'] },
      { id: 'p3', conocimientos_validos: ['k5', 'k6'] },
    ],
    hitos: [
      hito('h1', { condiciones: {}, escena_entrega: 'e_origen' }),
      hito('h2', { escena_entrega: 'escena(p1)' }),
      hito('h3', { efectos: [{ tipo: 'gratitud', objetivo: 'npc(p2)', nivel: 1 }] }),
      hito('h4', { escena_entrega: 'e_c', escena_alternativa: 'e_b' }),
      hito('h5'),
      hito('h6'),
      hito('h7', { es_reparacion: true, npc_reparacion: 'npc(p1)' }),
      hito('h8', { final: true, escena_entrega: 'e_b' }),
    ],
    desenlaces: [
      { id: 'd_n', tipo: 'neutro', requiere: {}, prioridad: 0, efectos_post: [] },
      { id: 'd_p', tipo: 'positivo', requiere: { requiere_hitos: ['h8'] }, prioridad: 1, efectos_post: [{ tipo: 'gratitud', objetivo: 'npc(p1)', nivel: 1 }] },
    ],
  };
}
const reglas = (caso) => validarCaso(caso, CONTENIDO).map((e) => e.regla);
const conHito = (id, cambio) => {
  const c = casoValido();
  c.hitos = c.hitos.map((h) => (h.id === id ? { ...h, ...cambio } : h));
  return c;
};
const dispara = (caso, regla) => assert.ok(reglas(caso).includes(regla), `${regla} no salió: ${JSON.stringify(validarCaso(caso, CONTENIDO))}`);

describe('validador', () => {
  test('el caso de prueba es válido', () => {
    assert.deepEqual(validarCaso(casoValido(), CONTENIDO), []);
  });

  test('tonos: los cinco válidos pasan y cualquier otro da error', () => {
    assert.deepEqual([...TONOS_VALIDOS], ['intriga', 'calido', 'tension', 'misterio', 'cotidiano']);
    for (const tono of TONOS_VALIDOS) {
      const c = casoValido();
      c.tono = tono;
      c.hitos = c.hitos.map((h) => ({ ...h, textos: h.textos.map((t) => ({ ...t, tono })) }));
      assert.deepEqual(validarCaso(c, CONTENIDO), [], tono);
    }
    for (const tono of ['humor', 'melancolia', 'neutro', '', null, undefined]) {
      const c = casoValido();
      c.tono = tono;
      dispara(c, REGLAS.TONO_INVALIDO);
    }
    dispara(conHito('h3', { textos: textos('h3').map((t) => ({ ...t, tono: 'humor' })) }), REGLAS.TONO_INVALIDO);
  });

  test('hitos ≠ 8', () => {
    const c = casoValido();
    c.hitos = c.hitos.slice(0, 7).map((h) => ({ ...h, final: h.id === 'h2' }));
    dispara(c, REGLAS.HITOS);
  });

  test('textos ≠ 4', () => dispara(conHito('h3', { textos: textos('h3').slice(0, 3) }), REGLAS.TEXTOS));

  test('id de texto duplicado, en el caso y entre casos', () => {
    dispara(conHito('h3', { textos: textos('h2') }), REGLAS.TEXTO_DUPLICADO);
    const otro = { ...casoValido(), id: 'caso_otro' };
    assert.ok(validarCasos([casoValido(), otro], CONTENIDO).some((e) => e.regla === REGLAS.TEXTO_DUPLICADO && e.casoId === 'caso_otro'));
  });

  test('sin neutro default', () => {
    const c = casoValido();
    c.desenlaces[0] = { ...c.desenlaces[0], requiere: { requiere_hitos: ['h1'] } };
    dispara(c, REGLAS.SIN_DEFAULT);
  });

  test('sin positivo', () => {
    const c = casoValido();
    c.desenlaces = [c.desenlaces[0]];
    dispara(c, REGLAS.SIN_POSITIVO);
  });

  test('sin reparación', () => dispara(conHito('h7', { es_reparacion: false }), REGLAS.SIN_REPARACION));

  test('reparación sin npc_reparacion', () => dispara(conHito('h7', { npc_reparacion: undefined }), REGLAS.REPARACION_SIN_NPC));

  test('npc_reparacion que no existe en el contenido ni en las ranuras', () => {
    dispara(conHito('h7', { npc_reparacion: 'npc_fantasma' }), REGLAS.ID_INEXISTENTE);
    dispara(conHito('h7', { npc_reparacion: 'npc(p9)' }), REGLAS.ID_INEXISTENTE);
    assert.deepEqual(validarCaso(conHito('h7', { npc_reparacion: 'n2' }), CONTENIDO), []);
  });

  test('ninguna acción de rutina cuenta como reparación', () => {
    dispara(conHito('h7', { condiciones: {} }), REGLAS.REPARACION_POR_RUTINA);
    assert.deepEqual(validarAcciones(ACCIONES), []);
    const conRutina = { ...ACCIONES, hablar_amable: { intenciones: [], tags: [{ tipo: 'rencor', objetivo: 'npc', op: 'quitar' }] } };
    assert.equal(validarAcciones(conRutina)[0].regla, REGLAS.REPARACION_POR_RUTINA);
    assert.ok(validarCaso(casoValido(), CONTENIDO, { acciones: conRutina }).some((e) => e.regla === REGLAS.REPARACION_POR_RUTINA));
  });

  test('ni escena_entrega ni escena_alternativa alcanzable desde el origen', () => {
    dispara(conHito('h4', { escena_entrega: 'e_isla', escena_alternativa: undefined }), REGLAS.ENTREGA_INALCANZABLE);
    // Con la alternativa alcanzable vale.
    assert.deepEqual(validarCaso(conHito('h4', { escena_entrega: 'e_isla', escena_alternativa: 'e_c' }), CONTENIDO), []);
    // escena(p3) cae en e_isla cuando p3 = k6 (dueño n6): solo en esas instancias.
    dispara(conHito('h4', { escena_entrega: 'escena(p3)', escena_alternativa: undefined }), REGLAS.ENTREGA_INALCANZABLE);
    assert.deepEqual(validarCaso(conHito('h4', { escena_entrega: 'escena(p3)', escena_alternativa: 'e_b' }), CONTENIDO), []);
  });

  test('escena_alternativa mal formada', () => {
    dispara(conHito('h4', { escena_alternativa: true }), REGLAS.ALTERNATIVA_INVALIDA);
    dispara(conHito('h4', { escena_entrega: null }), REGLAS.ALTERNATIVA_INVALIDA);
    dispara(conHito('h4', { escena_alternativa: 'e_c' }), REGLAS.ALTERNATIVA_INVALIDA);
  });

  test('final inalcanzable en alguna instancia', () => {
    dispara(conHito('h8', { escena_entrega: 'e_isla' }), REGLAS.FINAL_INALCANZABLE);
    const porRequisito = conHito('h5', { escena_entrega: 'e_isla' });
    porRequisito.hitos = porRequisito.hitos.map((h) => (h.id === 'h8' ? { ...h, condiciones: { requiere_hitos: ['h5'] } } : h));
    dispara(porRequisito, REGLAS.FINAL_INALCANZABLE);
    const bloqueado = conHito('h5', { bloquea: ['h8'] });
    bloqueado.hitos = bloqueado.hitos.map((h) => (h.id === 'h8' ? { ...h, condiciones: { requiere_hitos: ['h5'] } } : h));
    dispara(bloqueado, REGLAS.FINAL_INALCANZABLE);
    dispara(conHito('h8', { final: false }), REGLAS.FINAL_INALCANZABLE);
  });

  test('menos de 4 firmas', () => {
    const c = casoValido();
    c.ranuras_pista = [
      { id: 'p1', conocimientos_validos: ['k1', 'k2'] },
      { id: 'p2', conocimientos_validos: ['k1', 'k3'] },
      { id: 'p3', conocimientos_validos: ['k2', 'k3'] },
    ];
    dispara(c, REGLAS.FIRMAS);
  });

  test('id inexistente: escena, conocimiento', () => {
    const c = casoValido();
    c.escenas_origen = ['e_origen', 'e_nada'];
    dispara(c, REGLAS.ID_INEXISTENTE);
    dispara(conHito('h3', { escena_entrega: 'e_nada' }), REGLAS.ID_INEXISTENTE);
    const k = casoValido();
    k.ranuras_pista[0] = { id: 'p1', conocimientos_validos: ['k1', 'k_nada'] };
    dispara(k, REGLAS.ID_INEXISTENTE);
  });

  test('marcador inválido: en textos, objetivos y escenas', () => {
    dispara(conHito('h3', { textos: textos('h3').map((t, i) => (i === 0 ? { ...t, texto: 'Habla {npc:p7}.' } : t)) }), REGLAS.MARCADOR);
    dispara(conHito('h3', { textos: textos('h3').map((t, i) => (i === 0 ? { ...t, texto: 'Habla {nombre}.' } : t)) }), REGLAS.MARCADOR);
    dispara(conHito('h3', { efectos: [{ tipo: 'gratitud', objetivo: 'npc(p4)', nivel: 1 }] }), REGLAS.MARCADOR);
    dispara(conHito('h3', { escena_entrega: 'escena(p5)' }), REGLAS.MARCADOR);
  });

  test('tag fuera de los 20', () => dispara(conHito('h3', { efectos: [{ tipo: 'odio', objetivo: 'npc(p2)', nivel: 1 }] }), REGLAS.TAG_DESCONOCIDO));

  test('tag en el cuerpo del jugador', () => {
    dispara(conHito('h3', { efectos: [{ tipo: 'miedo', objetivo: 'jugador.mano', nivel: 1 }] }), REGLAS.TAG_FISICO);
    dispara(conHito('h3', { efectos: [{ tipo: 'miedo', objetivo: 'herida', nivel: 1 }] }), REGLAS.TAG_FISICO);
    assert.deepEqual(validarCaso(conHito('h3', { efectos: [{ tipo: 'fama_violenta', objetivo: 'jugador', nivel: 1 }] }), CONTENIDO), []);
  });

  test('efectos_post con tag de cierre', () => {
    const c = casoValido();
    c.desenlaces[1] = { ...c.desenlaces[1], efectos_post: [{ tipo: 'pacto_caso', objetivo: 'bando_x', nivel: 1 }] };
    dispara(c, REGLAS.EFECTOS_POST_CIERRE);
  });

  test('cada regla tiene un test que la dispara', () => {
    assert.equal(Object.keys(REGLAS).length, 18);
  });
});

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIPOS_TAG } from './tags.js';
import {
  ACCIONES,
  IDS_ACCIONES,
  OBJETIVOS,
  OPS,
  ENTRADAS,
  entradaDeAccion,
  accionesSinIntencion,
  accionesDeIntencion,
  tagsDeAccion,
} from './acciones.js';

const contenido = JSON.parse(readFileSync(new URL('../../data/contenido/contenido-v3.json', import.meta.url), 'utf8'));
const intencionesDelContenido = new Set(contenido.intenciones.map((i) => i.id));

/** "tipo:objetivo=nivel" de cada operación, para comparar corto. */
const corto = (id, ctx) =>
  tagsDeAccion(id, ctx).map((t) => {
    if (t.op === OPS.QUITAR) return `-${t.tipo}:${t.objetivo}`;
    if (t.op === OPS.SUBIR) return `${t.tipo}:${t.objetivo}+1`;
    if (t.op === OPS.REPUTACION) return `${t.tipo}:${t.objetivo}${t.paso > 0 ? '+' : ''}${t.paso}`;
    return `${t.tipo}:${t.objetivo}=${t.nivel}`;
  });

describe('acciones: tabla', () => {
  test('son 20 acciones', () => {
    assert.equal(IDS_ACCIONES.length, 20);
  });

  test('cada fila usa un tipo de tag, un objetivo y una operación conocidos, con nivel 1–3', () => {
    const objetivos = Object.values(OBJETIVOS);
    const ops = Object.values(OPS);
    for (const id of IDS_ACCIONES) {
      assert.ok(ACCIONES[id].tags.length > 0, id);
      for (const fila of ACCIONES[id].tags) {
        assert.ok(TIPOS_TAG.includes(fila.tipo), `${id}: ${fila.tipo}`);
        assert.ok(objetivos.includes(fila.objetivo), `${id}: ${fila.objetivo}`);
        const op = fila.op ?? OPS.ESCRIBIR;
        assert.ok(ops.includes(op), `${id}: ${op}`);
        if (op === OPS.ESCRIBIR) {
          for (const n of [fila.nivel, fila.hasta ?? fila.nivel, fila.nivelSi?.[1] ?? fila.nivel]) {
            assert.ok(Number.isInteger(n) && n >= 1 && n <= 3, `${id}: nivel ${n}`);
          }
        }
        if (op === OPS.REPUTACION) assert.ok(fila.paso === 1 || fila.paso === -1, id);
      }
    }
  });

  test('los 20 tipos de tag salen de alguna acción', () => {
    const usados = new Set(IDS_ACCIONES.flatMap((id) => ACCIONES[id].tags.map((f) => f.tipo)));
    assert.deepEqual([...usados].sort(), [...TIPOS_TAG].sort());
  });

  test('ningún tag tiene de objetivo el cuerpo del jugador', () => {
    for (const id of IDS_ACCIONES) {
      for (const fila of ACCIONES[id].tags) assert.doesNotMatch(fila.objetivo, /cuerpo/);
    }
  });

  test('las intenciones de la tabla existen en el contenido', () => {
    for (const id of IDS_ACCIONES) {
      for (const intencion of ACCIONES[id].intenciones) {
        assert.ok(intencionesDelContenido.has(intencion), `${id}: ${intencion}`);
      }
    }
  });

  test('12 acciones no tienen intención; preguntar_clave entra por consulta y 11 no tienen entrada', () => {
    assert.deepEqual(accionesSinIntencion(), [
      'regalar_objeto', 'mentir', 'robar', 'pedir_prestado', 'pagar_deuda', 'cobrar_favor', 'preguntar_clave',
      'guardar_secreto', 'revelar_secreto', 'ponerse_de_lado', 'aliarse', 'escoltar_caravana',
    ]);
    assert.equal(entradaDeAccion('preguntar_clave'), ENTRADAS.CONSULTA);
    assert.equal(IDS_ACCIONES.filter((id) => entradaDeAccion(id) === ENTRADAS.NINGUNA).length, 11);
    assert.equal(entradaDeAccion('atacar'), ENTRADAS.INTENCION);
  });

  test('acciones de una intención', () => {
    assert.deepEqual(accionesDeIntencion('intencion_atacar'), ['atacar']);
    assert.deepEqual(accionesDeIntencion('intencion_presionar'), ['amenazar']);
    assert.deepEqual(accionesDeIntencion('intencion_descansar'), []);
  });

  test('acción desconocida: error', () => {
    assert.throws(() => tagsDeAccion('bailar'), /desconocida/);
    assert.throws(() => entradaDeAccion('bailar'), /desconocida/);
  });
});

describe('acciones: tags por acción', () => {
  const casos = [
    ['hablar_amable', {}, ['curiosidad:npc=1']],
    ['ayudar', {}, ['gratitud:npc=1', 'favor_debido:npc=1']],
    ['ayudar', { nivel: 2 }, ['gratitud:npc=2', 'favor_debido:npc=1']],
    ['ayudar', { nivel: 3 }, ['gratitud:npc=2', 'favor_debido:npc=1']],
    ['regalar_objeto', {}, ['gratitud:npc=1']],
    ['regalar_objeto', { precioAlto: true }, ['gratitud:npc=2']],
    ['mentir', {}, []],
    ['mentir', { detectado: true }, ['desconfianza:npc=1']],
    ['mentir', { detectado: true, reincide: true }, ['desconfianza:npc=2']],
    ['amenazar', {}, ['miedo:npc=2', 'rencor:npc=1', 'chisme_activo:escena=1']],
    ['amenazar', { estadoEvento: 'tenso' }, ['miedo:npc=3', 'rencor:npc=1', 'chisme_activo:escena=1']],
    ['amenazar', { estadoEvento: 'peligroso' }, ['miedo:npc=3', 'rencor:npc=1', 'chisme_activo:escena=1']],
    ['amenazar', { estadoEvento: 'social' }, ['miedo:npc=2', 'rencor:npc=1', 'chisme_activo:escena=2']],
    ['atacar', {}, ['miedo:npc=3', 'rencor:npc=2', 'fama_violenta:jugador=2', 'vigilancia_escena:escena=2', 'sospecha_crimen:jugador=1']],
    ['robar', { visto: true }, ['desconfianza:npc=2', 'vigilancia_escena:escena=2', 'sospecha_crimen:jugador=2', 'reputacion_ciudad:ciudad-1']],
    ['robar', { visto: false }, ['vigilancia_escena:escena=1']],
    ['robar', {}, ['vigilancia_escena:escena=1']],
    ['pedir_prestado', {}, ['deuda_personal:npc=1']],
    ['pagar_deuda', {}, ['-deuda_personal:npc', 'gratitud:npc=1']],
    ['cobrar_favor', {}, ['-favor_debido:npc']],
    ['preguntar_clave', {}, ['curiosidad:npc=1']],
    ['preguntar_clave', { superaUmbral: true }, ['curiosidad:npc=1']],
    ['preguntar_clave', { ranuraHabilitada: true }, ['curiosidad:npc=1']],
    ['preguntar_clave', { superaUmbral: true, ranuraHabilitada: true }, ['pista_conocida:conocimiento+1', 'curiosidad:npc=1']],
    ['examinar', {}, ['pista_conocida:conocimiento=1']],
    ['examinar', { conObjeto: true }, ['pista_conocida:conocimiento=2']],
    ['escuchar_oculto', {}, ['pista_conocida:conocimiento=1']],
    ['escuchar_oculto', { nivel: 2, fallaSigilo: true }, ['pista_conocida:conocimiento=2', 'vigilancia_escena:escena=1']],
    ['guardar_secreto', {}, ['secreto_compartido:npc=1', 'gratitud:npc=1']],
    ['revelar_secreto', {}, ['rencor:npc=2', 'chisme_activo:escena=2']],
    ['revelar_secreto', { estadoEvento: 'social' }, ['rencor:npc=2', 'chisme_activo:escena=3']],
    ['ponerse_de_lado', {}, ['pacto_caso:bando=1']],
    ['ponerse_de_lado', { nivel: 3, faccion: 'casa_aster' }, ['pacto_caso:bando=3', 'favor_casa_aster:faccion=1']],
    ['ponerse_de_lado', { nivel: 2, faccion: 'archivo' }, ['pacto_caso:bando=2', 'favor_archivo:faccion=1']],
    ['aliarse', {}, ['alianza_npc:npc=1']],
    ['viajar_camino', {}, []],
    ['viajar_camino', { noche: true }, ['alerta_camino:camino=1']],
    ['viajar_camino', { famaViolenta: 2 }, ['alerta_camino:camino=1']],
    ['viajar_camino', { famaViolenta: 1 }, []],
    ['escoltar_caravana', {}, ['lealtad_caravana:faccion=1']],
    ['escoltar_caravana', { nivel: 2 }, ['lealtad_caravana:faccion=2']],
    ['comerciar_justo', {}, ['reputacion_ciudad:ciudad+1']],
  ];

  for (const [id, ctx, esperado] of casos) {
    test(`${id} ${JSON.stringify(ctx)}`, () => {
      assert.deepEqual(corto(id, ctx), esperado);
    });
  }

  test('los casos cubren las 20 acciones', () => {
    assert.deepEqual([...new Set(casos.map(([id]) => id))], IDS_ACCIONES);
  });
});

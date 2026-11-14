import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { leerContenido, cargarContenido } from './cargarContenido.js';
import {
  validarContenido,
  resolverPlantillas,
  indexarContenido,
  exigirContenidoValido,
  CONTEOS,
  RESULTADOS,
  VERBO_A_INTENCION,
} from './contenido.js';

let base;
before(async () => {
  base = await leerContenido();
});
const copia = () => structuredClone(base);
const errores = (c) => validarContenido(c).errores;
const hay = (c, patron) => assert.ok(errores(c).some((e) => patron.test(e)), `sin error ${patron}: ${errores(c).join(' | ')}`);

describe('contenido — archivo real', () => {
  test('es válido y cumple los conteos', () => {
    const r = validarContenido(base);
    assert.deepEqual(r.errores, []);
    assert.equal(r.ok, true);
    assert.deepEqual(r.conteos, { ...CONTEOS });
  });

  test('cargarContenido devuelve el contenido validado', async () => {
    const c = await cargarContenido();
    assert.equal(c.escenas.length, 12);
  });

  test('cargarContenido lanza si la ruta no existe', async () => {
    await assert.rejects(() => cargarContenido('/no/existe.json'), /No se encontró/);
  });

  test('validar no modifica el contenido', () => {
    const c = copia();
    validarContenido(c);
    assert.deepEqual(c, base);
  });
});

describe('contenido — conteos y estructura', () => {
  test('rechaza lo que no es un objeto', () => {
    assert.equal(validarContenido(null).ok, false);
    assert.equal(validarContenido([]).ok, false);
  });

  test('detecta un conteo distinto', () => {
    const c = copia();
    c.escenas.pop();
    hay(c, /conteo de escenas: 11/);
  });

  test('detecta una clave faltante', () => {
    const c = copia();
    delete c.eventos;
    hay(c, /eventos: falta/);
  });

  test('detecta ids repetidos', () => {
    const c = copia();
    c.npcs[1].id = c.npcs[0].id;
    hay(c, /npcs: id repetido/);
  });
});

describe('contenido — referencias', () => {
  test('salida a una escena inexistente', () => {
    const c = copia();
    c.escenas[0].salidas.push('escena_fantasma');
    hay(c, /salidas: escena inexistente "escena_fantasma"/);
  });

  test('escena de un NPC', () => {
    const c = copia();
    c.npcs[0].escenaInicialId = 'Archivo Real';
    hay(c, /escenaInicialId: escena inexistente/);
  });

  test('escenas de un evento: inexistente y vacías', () => {
    const c = copia();
    c.eventos[0].escenas = ['escena_fantasma'];
    c.eventos[1].escenas = [];
    hay(c, new RegExp(`${c.eventos[0].id}\\.escenas: escena inexistente`));
    hay(c, new RegExp(`${c.eventos[1].id}: escenas vacías`));
  });

  test('NPC de un objeto narrativo', () => {
    const c = copia();
    const o = c.objetos.find((x) => x.tipo === 'narrativo');
    o.npcAsociado = 'Ysolde Varn';
    hay(c, /npcAsociado: NPC inexistente/);
  });

  test('verbo de una intención: inexistente o cruzado', () => {
    const c = copia();
    c.intenciones[0].verbo = 'Hablar con...';
    hay(c, /verbo inexistente/);
    const d = copia();
    d.intenciones[0].verbo = 'usar';
    hay(d, /corresponde a intencion_usar/);
  });

  test('efecto de evento con NPC inexistente: aviso, no error', () => {
    const c = copia();
    const ev = c.eventos.find((e) => e.efectos.some((f) => f.npcId));
    ev.efectos.find((f) => f.npcId).npcId = 'nadie';
    const r = validarContenido(c);
    assert.equal(r.ok, true);
    assert.ok(r.avisos.some((a) => /efectos\[\d+\]: NPC inexistente "nadie"/.test(a)));
  });

  test('el archivo real no tiene avisos', () => {
    assert.deepEqual(validarContenido(base).avisos, []);
  });

  const avisa = (c, patron) => {
    const r = validarContenido(c);
    assert.equal(r.ok, true);
    assert.ok(r.avisos.some((a) => patron.test(a)), `sin aviso ${patron}: ${r.avisos.join(' | ')}`);
  };
  const evento = (c, id) => c.eventos.find((e) => e.id === id);

  test('destino acepta ciudad_* del vocabulario y rechaza otros', () => {
    const c = copia();
    evento(c, 'evento_cierre_puerta').efectos[0].destino = 'ciudad_halenor';
    assert.deepEqual(validarContenido(c).avisos, []);
    evento(c, 'evento_cierre_puerta').efectos[0].destino = 'ciudad_fantasma';
    avisa(c, /destino: escena inexistente "ciudad_fantasma"/);
  });

  test('salir_escena vale en fin.verbos, no como verbo de intención', () => {
    assert.ok(evento(base, 'evento_patrulla_busqueda').fin.verbos.includes('salir_escena'));
    const c = copia();
    c.intenciones[0].verbo = 'salir_escena';
    hay(c, /verbo inexistente "salir_escena"/);
  });

  test('duracion.verbos es una lista de verbos', () => {
    assert.deepEqual(evento(base, 'evento_emboscada_sur').duracion.verbos, ['huir', 'rendirse']);
    const c = copia();
    evento(c, 'evento_emboscada_sur').duracion.verbos = ['huir_o_rendirse'];
    avisa(c, /duracion\.verbos: verbo inexistente/);
  });

  test('disparo.escenas y fin por acción sin verbos', () => {
    const c = copia();
    evento(c, 'evento_guardias_persiguen').disparo.escenas = ['ciudad'];
    evento(c, 'evento_lucha_caseta').fin.verbos = [];
    avisa(c, /disparo\.escenas: escena inexistente "ciudad"/);
    avisa(c, /evento_lucha_caseta\.fin: fin por acción sin verbos/);
  });
});

describe('contenido — plantillas', () => {
  test('cada intención necesita exito, fallo y neutro', () => {
    for (const r of RESULTADOS) {
      const c = copia();
      delete c.plantillas.intencion_usar[r];
      hay(c, new RegExp(`plantillas\\.intencion_usar: sin plantillas para ${r}`));
    }
  });

  test('lista vacía y bloque faltante', () => {
    const c = copia();
    c.plantillas.intencion_leer.fallo = [];
    delete c.plantillas.mostrar_narrativo;
    hay(c, /intencion_leer: sin plantillas para fallo/);
    hay(c, /falta el bloque mostrar_narrativo/);
  });

  test('bloque que no corresponde a ninguna intención', () => {
    const c = copia();
    c.plantillas.intencion_volar = c.plantillas.intencion_usar;
    hay(c, /bloque sin intención intencion_volar/);
  });
});

describe('resolverPlantillas — mapeo de claves de la beta', () => {
  test('resultado_<verbo>_<resultado> para los 24 verbos', () => {
    for (const [verbo, intencionId] of Object.entries(VERBO_A_INTENCION)) {
      for (const r of RESULTADOS) {
        assert.equal(resolverPlantillas(base, `resultado_${verbo}_${r}`), base.plantillas[intencionId][r]);
      }
    }
  });

  test('calmar_la_situacion resuelve a intencion_calmar', () => {
    assert.equal(
      resolverPlantillas(base, 'resultado_calmar_la_situacion_exito'),
      base.plantillas.intencion_calmar.exito,
    );
  });

  test('acepta id de bloque más resultado', () => {
    assert.equal(resolverPlantillas(base, 'revelar_conocimiento', 'exito'), base.plantillas.revelar_conocimiento.exito);
    assert.equal(resolverPlantillas(base, 'intencion_viajar', 'fallo'), base.plantillas.intencion_viajar.fallo);
    assert.equal(resolverPlantillas(base, 'viajar', 'neutro'), base.plantillas.intencion_viajar.neutro);
  });

  test('devuelve null si no existe', () => {
    assert.equal(resolverPlantillas(base, 'resultado_volar_exito'), null);
    assert.equal(resolverPlantillas(base, 'resultado_usar_quizas'), null);
    assert.equal(resolverPlantillas(base, 'intencion_usar', 'quizas'), null);
    assert.equal(resolverPlantillas(base, 'constructor', 'exito'), null);
    assert.equal(resolverPlantillas(null, 'resultado_usar_exito'), null);
  });
});

describe('índices y exigirContenidoValido', () => {
  test('indexa por id y por verbo', () => {
    const idx = indexarContenido(base);
    assert.equal(idx.escenas.get('escena_mercado_circular').nombre, 'Mercado Circular');
    assert.equal(idx.intencionPorVerbo.get('calmar_la_situacion').id, 'intencion_calmar');
    assert.equal(idx.eventos.size, 70);
  });

  test('exigirContenidoValido lanza con la lista de errores', () => {
    const c = copia();
    c.objetos.pop();
    assert.throws(() => exigirContenidoValido(c), /conteo de objetos: 39/);
    assert.equal(exigirContenidoValido(base), base);
  });
});

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
    hay(c, /escenaInicialId: "Archivo Real" es un nombre, no un id; va escena_archivo_real/);
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
    hay(c, /npcAsociado: "Ysolde Varn" es un nombre, no un id; va ysolde_pescadora/);
  });

  test('verbo de una intención: inexistente o cruzado', () => {
    const c = copia();
    c.intenciones[0].verbo = 'Hablar con...';
    hay(c, /verbo inexistente/);
    const d = copia();
    d.intenciones[0].verbo = 'usar';
    hay(d, /corresponde a intencion_usar/);
  });

  test('efecto de evento con NPC inexistente es un error', () => {
    const c = copia();
    const ev = c.eventos.find((e) => e.efectos.some((f) => f.npcId));
    ev.efectos.find((f) => f.npcId).npcId = 'nadie';
    hay(c, /efectos\[\d+\]\.npcId: NPC inexistente "nadie"/);
  });

  test('el archivo real no tiene avisos', () => {
    assert.deepEqual(validarContenido(base).avisos, []);
  });

  const avisa = (c, patron) => {
    const r = validarContenido(c);
    assert.ok(r.avisos.some((a) => patron.test(a)), `sin aviso ${patron}: ${r.avisos.join(' | ')}`);
  };
  const evento = (c, id) => c.eventos.find((e) => e.id === id);

  test('destino acepta ciudad_* del vocabulario y rechaza otros', () => {
    const c = copia();
    evento(c, 'evento_cierre_puerta').efectos[0].destino = 'ciudad_halenor';
    assert.deepEqual(validarContenido(c).avisos, []);
    evento(c, 'evento_cierre_puerta').efectos[0].destino = 'ciudad_fantasma';
    hay(c, /destino: escena inexistente "ciudad_fantasma"/);
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
    hay(c, /duracion\.verbos: verbo inexistente/);
  });

  test('disparo.escenas y fin por acción sin verbos', () => {
    const c = copia();
    evento(c, 'evento_guardias_persiguen').disparo.escenas = ['ciudad'];
    evento(c, 'evento_lucha_caseta').fin.verbos = [];
    hay(c, /disparo\.escenas: escena inexistente "ciudad"/);
    avisa(c, /evento_lucha_caseta\.fin: fin por acción sin verbos/);
  });
});

describe('contenido — nombres en lugar de ids', () => {
  const evento = (c, id) => c.eventos.find((e) => e.id === id);

  test('disparo.objetivo del archivo real usa ids de NPC', () => {
    assert.equal(evento(base, 'evento_cierre_taberna').disparo.objetivo, 'naela_tabernera');
    assert.equal(evento(base, 'evento_lucha_caseta').disparo.objetivo, 'dario_guardia');
  });

  test('disparo.objetivo con primer nombre, nombre completo o id inexistente falla', () => {
    for (const [valor, patron] of [
      ['Darío', /disparo\.objetivo: "Darío" es un nombre, no un id; va dario_guardia/],
      ['dario', /disparo\.objetivo: "dario" es un nombre, no un id; va dario_guardia/],
      [base.npcs[0].nombre, /disparo\.objetivo: .* es un nombre, no un id; va maren_archivista/],
      ['nadie_guardia', /disparo\.objetivo: NPC inexistente "nadie_guardia"/],
      ['escena_puente_aduana', /disparo\.objetivo: NPC inexistente/],
    ]) {
      const c = copia();
      evento(c, 'evento_lucha_caseta').disparo.objetivo = valor;
      const r = validarContenido(c);
      assert.equal(r.ok, false);
      assert.ok(r.errores.some((e) => patron.test(e)), `${valor}: ${r.errores.join(' | ')}`);
    }
  });

  test('un nombre falla en cada campo de referencia', () => {
    const escena = base.escenas[0];
    const npc = base.npcs[0];
    const objeto = base.objetos[0];
    const ev = base.eventos[0];
    const conEfecto = (c, campo) => c.eventos.flatMap((e) => e.efectos).find((f) => f[campo] != null);
    const casos = [
      ['escenas.salidas', (c) => c.escenas[1].salidas.push(escena.nombre), escena.id],
      ['npcs.movimiento.caminos', (c) => c.npcs.find((n) => n.movimiento).movimiento.caminos.push(escena.nombre), escena.id],
      ['npcs.conocimientos.requiereEvento', (c) => (c.npcs[0].conocimientos[0].requiereEvento = ev.nombre), ev.id],
      ['objetos.escenaVenta', (c) => (c.objetos[0].escenaVenta = escena.nombre), escena.id],
      ['objetos.escenaAparece', (c) => (c.objetos[0].escenaAparece = escena.nombre), escena.id],
      ['objetos.npcAsociado', (c) => (c.objetos[0].npcAsociado = npc.nombre), npc.id],
      ['eventos.escenas', (c) => c.eventos[0].escenas.push(escena.nombre), escena.id],
      ['eventos.disparo.escena', (c) => (c.eventos[0].disparo.escena = escena.nombre), escena.id],
      ['eventos.disparo.escenas', (c) => (c.eventos[0].disparo.escenas = [escena.nombre]), escena.id],
      ['eventos.efectos.npcId', (c) => (conEfecto(c, 'npcId').npcId = npc.nombre), npc.id],
      ['eventos.efectos.objetoId', (c) => (conEfecto(c, 'objetoId').objetoId = objeto.nombre), objeto.id],
      ['eventos.efectos.escenaId', (c) => (conEfecto(c, 'escenaId').escenaId = escena.nombre), escena.id],
      ['eventos.efectos.destino', (c) => (conEfecto(c, 'destino').destino = escena.nombre), escena.id],
    ];
    for (const [campo, romper, id] of casos) {
      const c = copia();
      romper(c);
      const r = validarContenido(c);
      assert.equal(r.ok, false, campo);
      assert.ok(
        r.errores.some((e) => e.includes(`es un nombre, no un id; va ${id}`)),
        `${campo}: ${r.errores.join(' | ')}`,
      );
    }
  });

  test('los nombres se reconocen sin tildes ni mayúsculas', () => {
    const c = copia();
    c.npcs[0].escenaInicialId = 'ARCHIVO REAL';
    hay(c, /va escena_archivo_real/);
  });

  test('verbos con nombre de la interfaz fallan en eventos', () => {
    const c = copia();
    evento(c, 'evento_lucha_caseta').disparo.verbo = 'Atacar';
    evento(c, 'evento_lucha_caseta').fin.verbos = ['Huir'];
    c.objetos[0].utilizableComo = ['Defender'];
    hay(c, /disparo\.verbo: verbo inexistente "Atacar"/);
    hay(c, /fin\.verbos: verbo inexistente "Huir"/);
    hay(c, /utilizableComo: verbo inexistente "Defender"/);
  });

  test('conocimientoId de un efecto tiene que existir en ese NPC', () => {
    const c = copia();
    const ef = c.eventos.flatMap((e) => e.efectos).find((f) => f.conocimientoId);
    ef.conocimientoId = 'Sendero sin vigilancia en las colinas';
    hay(c, /conocimientoId: conocimiento inexistente/);
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

// Diccionarios: carga y validación (todavía no se usan en la comprensión).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { leerContenido } from './cargarContenido.js';
import { cargarDiccionarios, validarDiccionario, NOMBRES_DICCIONARIOS, FORMATOS } from './diccionarios.js';

let contenido;
before(async () => {
  contenido = await leerContenido();
});

const archivo = (tipo, lineas, entradas = lineas.length) =>
  ['---', `tipo: ${tipo}`, 'version: 1', `entradas: ${entradas}`, '---', '', '## Conocimientos', '', ...lineas, ''].join('\n');
const validar = (tipo, lineas, entradas) => validarDiccionario(tipo, archivo(tipo, lineas, entradas), contenido);

const BUENAS = {
  'diccionario-lexico': 'hablar con | intencion_hablar_con | infinitivo',
  'ortografia-tipeo': 'camion | camión | tilde',
  'frases-patrones': 'hablá con {npc} | intencion_hablar_con | npc=serel_panadero | Hablá con Serel',
  'contexto-palabras': 'pan | pan duro | objeto_pan_duro | escena_mercado_circular',
  'temas-conocimiento': 'conocimiento_serel_1 | harina ; proveedor',
};

describe('diccionarios — archivos reales', () => {
  test('los cinco se cargan sin errores ni descartes, y con las entradas del front matter', async () => {
    const r = await cargarDiccionarios(contenido);
    assert.deepEqual(Object.keys(r), [...NOMBRES_DICCIONARIOS]);
    assert.equal(NOMBRES_DICCIONARIOS.length, 5);
    const cantidades = {};
    for (const [nombre, d] of Object.entries(r)) {
      assert.deepEqual(d.errores, [], nombre);
      assert.deepEqual(d.descartados, [], nombre);
      cantidades[nombre] = d.cargados.length;
    }
    assert.deepEqual(cantidades, {
      'diccionario-lexico': 1772, // + hablame y háblame (formas de hablar_con, antes en el código)
      'ortografia-tipeo': 2475,
      'frases-patrones': 610,
      'contexto-palabras': 385,
      'temas-conocimiento': 84,
    });
  });

  test('los 12 conocimientos del contenido están en temas-conocimiento', async () => {
    const r = await cargarDiccionarios(contenido);
    const enDiccionario = r['temas-conocimiento'].cargados.filter((e) => e.conocimientoId).map((e) => e.conocimientoId).sort();
    const enContenido = contenido.npcs.flatMap((n) => n.conocimientos.map((k) => k.id)).sort();
    assert.deepEqual(enDiccionario, enContenido);
  });
});

describe('diccionarios — front matter', () => {
  test('una línea buena de cada archivo se carga', () => {
    for (const [tipo, linea] of Object.entries(BUENAS)) {
      const r = validar(tipo, [linea]);
      assert.deepEqual(r.errores, [], tipo);
      assert.equal(r.cargados.length, 1, tipo);
    }
  });

  test('conteo distinto al real: error, y las líneas se cargan igual', () => {
    for (const [tipo, linea] of Object.entries(BUENAS)) {
      const r = validar(tipo, [linea, linea], 5);
      assert.equal(r.cargados.length, 2, tipo);
      assert.deepEqual(r.descartados, [], tipo);
      assert.equal(r.errores.length, 1, tipo);
      assert.match(r.errores[0], /dice 5 entradas y hay 2/);
    }
  });

  test('las líneas descartadas cuentan como entradas del archivo', () => {
    const r = validar('ortografia-tipeo', [BUENAS['ortografia-tipeo'], 'una sola columna'], 2);
    assert.equal(r.cargados.length, 1);
    assert.equal(r.descartados.length, 1);
    assert.equal(r.errores.length, 1);
  });

  test('sin front matter, con otro tipo o sin version: error', () => {
    assert.match(validarDiccionario('ortografia-tipeo', 'camion | camión | tilde\n', contenido).errores[0], /falta el front matter/);
    const otro = validarDiccionario('ortografia-tipeo', archivo('diccionario-lexico', [BUENAS['ortografia-tipeo']]), contenido);
    assert.match(otro.errores[0], /se esperaba "ortografia-tipeo"/);
    const sinVersion = validarDiccionario('ortografia-tipeo', '---\ntipo: ortografia-tipeo\nentradas: 0\n---\n', contenido);
    assert.match(sinVersion.errores[0], /version inválida/);
    const sinEntradas = validarDiccionario('ortografia-tipeo', '---\ntipo: ortografia-tipeo\nversion: 1\nentradas: muchas\n---\n', contenido);
    assert.match(sinEntradas.errores[0], /entradas inválido/);
  });
});

describe('diccionarios — columnas', () => {
  test('columnas de más o de menos: la línea se descarta y la carga sigue', () => {
    const esperadas = { 'diccionario-lexico': 3, 'ortografia-tipeo': 3, 'frases-patrones': 4, 'contexto-palabras': 4, 'temas-conocimiento': 2 };
    for (const [tipo, linea] of Object.entries(BUENAS)) {
      const deMenos = linea.split(' | ').slice(0, -1).join(' | ');
      const r = validar(tipo, [`${linea} | sobra`, deMenos, linea]);
      assert.equal(r.cargados.length, 1, tipo);
      assert.equal(r.descartados.length, 2, tipo);
      assert.equal(r.errores.length, 2, tipo);
      assert.match(r.errores[0], new RegExp(`tiene ${esperadas[tipo] + 1} columnas, se esperaban ${esperadas[tipo]}`), tipo);
      assert.match(r.errores[1], new RegExp(`tiene ${esperadas[tipo] - 1} columnas, se esperaban ${esperadas[tipo]}`), tipo);
      assert.equal(r.descartados[0].linea, 9, tipo);
    }
  });

  test('una columna vacía descarta la línea', () => {
    const r = validar('ortografia-tipeo', ['camion |  | tilde']);
    assert.equal(r.cargados.length, 0);
    assert.match(r.errores[0], /columna vacía/);
  });
});

describe('diccionarios — ids del contenido', () => {
  const malas = {
    'diccionario-lexico': ['hablar con | intencion_volar | infinitivo', 'la espada | objeto_que_no_existe | objeto', 'maren | nadie | npc', 'el mercado | escena_luna | escena'],
    'frases-patrones': [
      'volá | intencion_volar | - | Volá',
      'hablá con {npc} | intencion_hablar_con | npc=nadie | Hablá con nadie',
      'usá {objeto} | intencion_usar | objeto=objeto_que_no_existe | Usá eso',
      'viajá a {destino} | intencion_viajar | destino=ciudad_atlantida | Viajá',
      '¿qué es {tema}? | consulta | tema=conocimiento_nada | ¿Qué es?',
      'huí y volá | multi | primera=intencion_huir ; segunda=intencion_volar | Huí y volá',
    ],
    'contexto-palabras': ['pan | pan duro | objeto_que_no_existe | siempre', 'pan | pan duro | objeto_pan_duro | escena_luna'],
    'temas-conocimiento': ['conocimiento_nada | harina ; proveedor'],
  };
  for (const [tipo, lineas] of Object.entries(malas)) {
    test(`${tipo}: un id inexistente descarta esa línea, queda en errores y no corta la carga`, () => {
      const r = validar(tipo, [...lineas, BUENAS[tipo]]);
      assert.equal(r.cargados.length, 1);
      assert.equal(r.descartados.length, lineas.length);
      assert.equal(r.errores.length, lineas.length);
      for (const e of r.errores) assert.match(e, /id inexistente/);
      assert.deepEqual(r.descartados.map((d) => d.texto), lineas);
    });
  }

  test('temas generales: los NPCs tienen que existir; `*` vale por todos', () => {
    const texto = ['---', 'tipo: temas-conocimiento', 'version: 1', 'entradas: 3', '---', '## Temas generales',
      'pan | serel_panadero ; nadie', 'clima | serel_panadero ; ysolde_pescadora', 'saludo | *'].join('\n');
    const r = validarDiccionario('temas-conocimiento', texto, contenido);
    assert.equal(r.errores.length, 1);
    assert.match(r.errores[0], /temas-conocimiento\.md:7: id inexistente "nadie"/);
    assert.deepEqual(r.cargados.map((e) => e.npcs), [['serel_panadero', 'ysolde_pescadora'], ['*']]);
  });

  test('los ids válidos de cada clase se aceptan', () => {
    const r = validar('frases-patrones', [
      '¿qué es {tema}? | consulta | tema=conocimiento_serel_1 | ¿Qué es?',
      '¿qué es {tema}? | consulta | tema=ciudad_lareth | ¿Qué es?',
      'viajá a {destino} | intencion_viajar | destino=escena_camino_norte | Viajá',
      'hola | ignorar | - | Hola',
    ]);
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.cargados[0].parametros, { tema: 'conocimiento_serel_1' });
    assert.deepEqual(r.cargados[3].parametros, {});
  });
});

describe('diccionarios — tipos y valores permitidos', () => {
  const malas = {
    'diccionario-lexico': ['hablar con | intencion_hablar_con | gerundio', 'maren | maren_archivista | objeto'],
    'ortografia-tipeo': ['camion | camión | acento', 'ola | hola | valida'],
    'frases-patrones': ['hola | saludo | - | Hola', 'hablá con {npc} | intencion_hablar_con | persona=serel_panadero | Hablá', 'hablá | intencion_hablar_con | npc | Hablá'],
    'contexto-palabras': ['pan | pan duro | objeto_pan_duro | nunca', 'pan | pan duro | objeto_pan_duro | aburrido'],
    'temas-conocimiento': ['conocimiento_serel_1 | harina ; ; proveedor'],
  };
  for (const [tipo, lineas] of Object.entries(malas)) {
    test(`${tipo}: un tipo o valor no permitido descarta la línea`, () => {
      const r = validar(tipo, [...lineas, BUENAS[tipo]]);
      assert.equal(r.cargados.length, 1);
      assert.equal(r.descartados.length, lineas.length);
      assert.equal(r.errores.length, lineas.length);
    });
  }

  test('contexto-palabras: `-` como id y cada estado permitido', () => {
    const estados = ['siempre', 'tranquilo', 'social', 'sigilo', 'tenso', 'peligroso', 'combate', 'escena_archivo_real'];
    const r = validar('contexto-palabras', estados.map((e) => `fuente | origen de información | - | ${e}`));
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.cargados.map((e) => e.estado), estados);
    assert.equal(r.cargados[0].id, null);
  });
});

describe('diccionarios — archivos que faltan y entradas raras', () => {
  test('carpeta sin archivos: cada diccionario devuelve su error y nada lanza', async () => {
    const r = await cargarDiccionarios(contenido, { dir: new URL('./no-existe/', import.meta.url) });
    for (const nombre of NOMBRES_DICCIONARIOS) {
      assert.deepEqual(r[nombre].cargados, []);
      assert.deepEqual(r[nombre].descartados, []);
      assert.equal(r[nombre].errores.length, 1);
      assert.match(r[nombre].errores[0], new RegExp(`${FORMATOS[nombre].archivo}: no se pudo leer \\(no existe\\)`));
    }
  });

  test('falta un solo archivo: los otros cuatro se cargan', async () => {
    const { readFile } = await import('node:fs/promises');
    const leer = (url) => (String(url).endsWith('ortografia-tipeo.md') ? Promise.reject(new Error('sin permiso')) : readFile(url, 'utf8'));
    const r = await cargarDiccionarios(contenido, { leer });
    assert.deepEqual(r['ortografia-tipeo'], { cargados: [], descartados: [], errores: ['ortografia-tipeo.md: no se pudo leer (sin permiso)'] });
    for (const nombre of NOMBRES_DICCIONARIOS.filter((n) => n !== 'ortografia-tipeo')) assert.deepEqual(r[nombre].errores, [], nombre);
  });

  test('nunca lanza: nombre desconocido, texto que no es texto, contenido ausente', async () => {
    assert.equal(validarDiccionario('otro', '', contenido).errores.length, 1);
    assert.equal(validarDiccionario('ortografia-tipeo', null, contenido).errores.length, 1);
    const sinContenido = validarDiccionario('diccionario-lexico', archivo('diccionario-lexico', [BUENAS['diccionario-lexico']]), null);
    assert.equal(sinContenido.cargados.length, 0);
    assert.match(sinContenido.errores[0], /id inexistente/);
    const todo = await cargarDiccionarios(undefined, { leer: () => 42 });
    for (const nombre of NOMBRES_DICCIONARIOS) assert.equal(todo[nombre].errores.length, 1);
  });

  test('saltos de línea de Windows y BOM', () => {
    const texto = `﻿${archivo('ortografia-tipeo', [BUENAS['ortografia-tipeo']]).replace(/\n/g, '\r\n')}`;
    assert.deepEqual(validarDiccionario('ortografia-tipeo', texto, contenido).errores, []);
  });
});

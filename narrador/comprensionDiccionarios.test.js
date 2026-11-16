// Comprensión con diccionarios: léxico y ortografía (docs/formato-diccionarios.md).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { leerContenido } from './cargarContenido.js';
import { cargarDiccionarios } from './diccionarios.js';
import {
  decidir, coincidirIntencion, coincidirConDiccionarios, prepararDiccionarios, corregirOrtografia, MOTIVOS,
} from './comprension.js';

let contenido;
let real; // diccionarios reales, ya preparados
let cargados; // lo que devuelve cargarDiccionarios
before(async () => {
  contenido = await leerContenido();
  cargados = await cargarDiccionarios(contenido);
  real = prepararDiccionarios(cargados, contenido.intenciones);
});

const npc = (id, relacion = 0) => ({ ...contenido.npcs.find((n) => n.id === id), relacion });
const objeto = (id) => contenido.objetos.find((o) => o.id === id);
const ctx = (extra = {}) => ({
  intenciones: contenido.intenciones,
  escenas: contenido.escenas,
  escena: { id: 'escena_mercado_circular' },
  npcsPresentes: [npc('serel_panadero')],
  npcsAusentes: contenido.npcs,
  objetosAplicables: (verbo) => (verbo === 'comprar' ? [objeto('objeto_pan_fresco')] : []),
  ...extra,
});

// Diccionarios armados a mano: lo mínimo que `prepararDiccionarios` necesita.
const carga = (cargadosDe = [], errores = []) => ({ cargados: cargadosDe, descartados: [], errores });
const lex = (forma, id, tipo) => ({ forma, id, tipo });
const ort = (escrita, correcta, tipo) => ({ escrita, correcta, tipo });
const falsos = ({ lexico = [], ortografia = [] }) => ({ 'diccionario-lexico': carga(lexico), 'ortografia-tipeo': carga(ortografia) });
const con = (diccionarios, extra = {}) => ctx({ diccionarios, ...extra });

describe('léxico', () => {
  test('un sinónimo que el catálogo no tiene resuelve por léxico; sin diccionario no se entiende', () => {
    const sin = decidir('dialogar con serel', ctx());
    assert.equal(sin.tipo, 'reformular');
    assert.equal(sin.motivo, MOTIVOS.NO_ENTENDIDO);
    for (const frase of ['dialogar con serel', 'cruzar unas palabras con serel', 'chamullar con serel']) {
      const d = decidir(frase, ctx({ diccionarios: cargados }));
      assert.equal(d.tipo, 'ejecutar', frase);
      assert.equal(d.intencionId, 'intencion_hablar_con', frase);
      assert.equal(d.parametros.npcId, 'serel_panadero', frase);
    }
  });

  test('"pagá el pan" resuelve a comprar, con y sin diccionario', () => {
    for (const diccionarios of [undefined, cargados, real]) {
      const d = decidir('pagá el pan', ctx({ diccionarios }));
      assert.equal(d.tipo, 'ejecutar');
      assert.equal(d.intencionId, 'intencion_comprar');
      assert.equal(d.parametros.objetoId, 'objeto_pan_fresco');
    }
  });

  test('"pagar" está en el léxico: resuelve a comprar', () => {
    const d = prepararDiccionarios(falsos({ lexico: [lex('pagar', 'intencion_comprar', 'sinonimo')] }), contenido.intenciones);
    assert.equal(coincidirConDiccionarios('pagar el pan', [], d).coincidencia.intencionId, 'intencion_comprar');
    assert.ok(cargados['diccionario-lexico'].cargados.some((e) => e.forma === 'pagar' && e.id === 'intencion_comprar'));
  });

  test('la forma del catálogo gana sobre el léxico', () => {
    const d = falsos({ lexico: [lex('comprá', 'intencion_atacar', 'sinonimo')] });
    assert.equal(decidir('comprá pan', ctx({ diccionarios: d })).intencionId, 'intencion_comprar');
  });

  test('el léxico gana sobre la tolerancia a typos', () => {
    // "dialogr" está a una letra de "dialogar" (léxico); "hablar" no se le parece: sin léxico no hay intención.
    const d = falsos({ lexico: [lex('dialogr', 'intencion_hablar_con', 'coloquial')] });
    assert.equal(decidir('dialogr con serel', ctx({ diccionarios: d })).intencionId, 'intencion_hablar_con');
    assert.equal(decidir('dialogr con serel', ctx()).tipo, 'reformular');
  });

  test('una forma del léxico con dos intenciones distintas: no se elige, se reformula', () => {
    const d = falsos({
      lexico: [lex('zarandear', 'intencion_presionar', 'sinonimo'), lex('zarandear', 'intencion_atacar', 'coloquial')],
    });
    const r = decidir('zarandear a serel', ctx({ diccionarios: d }));
    assert.equal(r.tipo, 'reformular');
    assert.equal(r.motivo, MOTIVOS.INTENCION_AMBIGUA);
    assert.equal(r.intencionId, null);
    // Con la misma intención dos veces no hay ambigüedad.
    const igual = falsos({ lexico: [lex('zarandear', 'intencion_presionar', 'sinonimo'), lex('zarandear', 'intencion_presionar', 'coloquial')] });
    assert.equal(decidir('zarandear a serel', ctx({ diccionarios: igual })).intencionId, 'intencion_presionar');
  });

  test('léxico real: "acechar" apunta a observar y a emboscar, y se reformula', () => {
    const r = decidir('acechar a serel', ctx({ diccionarios: cargados }));
    assert.equal(r.tipo, 'reformular');
    assert.equal(r.motivo, MOTIVOS.INTENCION_AMBIGUA);
  });

  test('las formas del léxico van con las palabras juntas', () => {
    const d = falsos({ lexico: [lex('cruzar unas palabras con', 'intencion_hablar_con', 'sinonimo')] });
    assert.equal(decidir('cruzar unas palabras con serel', ctx({ diccionarios: d })).intencionId, 'intencion_hablar_con');
    assert.equal(decidir('cruzar el puente y unas palabras con serel', ctx({ diccionarios: d })).tipo, 'reformular');
  });

  test('las entradas objeto, npc y escena resuelven parámetros, no la intención', () => {
    const d = falsos({
      lexico: [
        lex('el de la harina', 'serel_panadero', 'npc'),
        lex('mendrugo', 'objeto_pan_fresco', 'objeto'),
        lex('la feria', 'escena_camino_norte', 'escena'),
      ],
    });
    // Sin una forma de verbo no hay intención: las tres entradas solas no entienden nada.
    assert.equal(decidir('la feria', ctx({ diccionarios: d })).tipo, 'reformular');
    assert.equal(decidir('hablar con el de la harina', ctx({ diccionarios: d })).parametros.npcId, 'serel_panadero');
    assert.equal(decidir('comprá un mendrugo', ctx({ diccionarios: d })).parametros.objetoId, 'objeto_pan_fresco');
    assert.equal(decidir('viajá a la feria', ctx({ diccionarios: d })).parametros.destino, 'escena_camino_norte');
    // Sin esas entradas, no.
    assert.equal(decidir('hablar con el de la harina', ctx()).tipo, 'reformular');
  });

  test('léxico real: objeto, NPC y escena', () => {
    const o = decidir('comprá un mendrugo', ctx({ diccionarios: cargados, objetosAplicables: () => [objeto('objeto_pan_duro'), objeto('objeto_pan_fresco')] }));
    assert.equal(o.parametros.objetoId, 'objeto_pan_duro');
    assert.equal(decidir('viajá a la feria', ctx({ diccionarios: cargados })).parametros.destino, 'escena_mercado_circular');
    assert.equal(decidir('hablar con el panadero', ctx({ diccionarios: cargados })).parametros.npcId, 'serel_panadero');
  });
});

describe('ortografía', () => {
  test('"ablar con serel" se corrige y resuelve a hablar_con', () => {
    assert.equal(corregirOrtografia('ablar con serel', real), 'hablar con serel');
    const d = decidir('ablar con serel', ctx({ diccionarios: cargados }));
    assert.equal(d.tipo, 'ejecutar');
    assert.equal(d.intencionId, 'intencion_hablar_con');
    assert.equal(d.parametros.npcId, 'serel_panadero');
    assert.equal(coincidirConDiccionarios('ablar con serel', contenido.intenciones, real).texto, 'hablar con serel');
  });

  test('la corrección va antes de la tolerancia: un error lejano que solo el diccionario conoce', () => {
    const d = falsos({ ortografia: [ort('jhablarrr', 'hablar', 'letra_repetida'), ort('serl', 'serel', 'letra_omitida')] });
    assert.equal(decidir('jhablarrr con serl', ctx()).tipo, 'reformular');
    const r = decidir('jhablarrr con serl', ctx({ diccionarios: d }));
    assert.equal(r.intencionId, 'intencion_hablar_con');
    assert.equal(r.parametros.npcId, 'serel_panadero');
  });

  test('se corrigen frases de varias palabras, la más larga primero', () => {
    const d = prepararDiccionarios(
      falsos({ ortografia: [ort('mercado ircular', 'mercado circular', 'letra_omitida'), ort('mercado', 'feria', 'letra_cambiada')] }),
      contenido.intenciones,
    );
    // La frase corregida sale normalizada: minúsculas y sin tildes.
    assert.equal(corregirOrtografia('Viajá al mercado ircular', d), 'viaja al mercado circular');
    assert.equal(corregirOrtografia('viajá al mercado', d), 'viaja al feria');
  });

  test('una palabra valida no se corrige', () => {
    assert.equal(corregirOrtografia('hola serel', real), null);
    assert.ok(cargados['ortografia-tipeo'].cargados.some((e) => e.tipo === 'valida' && e.escrita === 'hola'));
    // "aya" figura como error y como valida: gana valida.
    assert.equal(corregirOrtografia('aya', real), null);
    const d = prepararDiccionarios(falsos({ ortografia: [ort('hablr', 'hablar', 'letra_omitida'), ort('hablr', 'hablr', 'valida')] }), contenido.intenciones);
    assert.equal(corregirOrtografia('hablr con serel', d), null);
  });

  test('una escrita con dos correcciones distintas no se corrige', () => {
    const d = prepararDiccionarios(falsos({ ortografia: [ort('tien', 'tiene', 'letra_omitida'), ort('tien', 'tiren', 'letra_cambiada')] }), contenido.intenciones);
    assert.equal(corregirOrtografia('tien', d), null);
    assert.equal(corregirOrtografia('tien', real), null);
  });

  test('un verbo ya reconocido exacto no cambia de sentido por la ortografía', () => {
    // "xyz" figura como error de "huí" (otro verbo), pero la frase ya trae "comprá": no se toca nada.
    const d = prepararDiccionarios(falsos({ ortografia: [ort('xyz', 'huí', 'letra_cambiada')] }), contenido.intenciones);
    const r = coincidirConDiccionarios('comprá xyz', contenido.intenciones, d);
    assert.equal(r.coincidencia.intencionId, 'intencion_comprar');
    assert.equal(r.texto, 'comprá xyz');
    assert.equal(decidir('comprá xyz', ctx({ diccionarios: d })).intencionId, 'intencion_comprar');
    // Sin un verbo reconocido, la corrección sí vale.
    assert.equal(decidir('xyz', ctx({ diccionarios: d, npcsPresentes: [npc('serel_panadero')] })).intencionId, 'intencion_huir');
  });

  test('una palabra de verbo del catálogo o del léxico no se corrige nunca', () => {
    for (const palabra of ['ayuda', 'ayudar', 'hablo', 'hablar', 'comprá']) {
      assert.equal(real.correcciones.has(palabra), false, palabra);
    }
    const d = prepararDiccionarios(falsos({ ortografia: [ort('comprá', 'huí', 'letra_cambiada')] }), contenido.intenciones);
    assert.equal(corregirOrtografia('comprá', d), null);
  });

  test('las entradas del léxico real no se contradicen con las correcciones', () => {
    // Ninguna palabra de verbo del léxico queda como "error" a corregir.
    for (const e of cargados['diccionario-lexico'].cargados.filter((x) => ['infinitivo', 'conjugada'].includes(x.tipo))) {
      const [primera] = e.forma.split(' ');
      assert.equal(real.correcciones.has(primera.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()), false, e.forma);
    }
  });
});

describe('sin diccionarios', () => {
  const FRASES = [
    'hablá con serel', 'ablar con serel', 'pagá el pan', 'comprá y descansá', 'viajá al norte', 'quiero viajar al norte, ¿sabés cómo?',
    '¿sabés cómo puedo ir al norte?', 'contame lo del pozo viejo del norte', 'irme al norte', 'hola, buenas tardes',
    '¿quién te vende la harina?', 'examiná el pan fresco', 'dialogar con serel', 'zzz', '', 'acechar a serel',
  ];
  const resultados = (extra) => FRASES.map((f) => decidir(f, ctx(extra)));

  test('sin la opción, con null o con basura: los mismos resultados que antes', () => {
    const antes = resultados({});
    for (const diccionarios of [null, undefined, 42, 'x', [], {}, { 'diccionario-lexico': 7 }, () => 1]) {
      assert.deepEqual(resultados({ diccionarios }), antes, String(diccionarios));
    }
  });

  test('un diccionario con errores o sin entradas no se usa: queda el catálogo solo', () => {
    const antes = resultados({});
    const conErrores = {
      'diccionario-lexico': carga([lex('dialogar con', 'intencion_hablar_con', 'sinonimo')], ['diccionario-lexico.md:3: id inexistente']),
      'ortografia-tipeo': carga([ort('xablar', 'hablar', 'h')], ['ortografia-tipeo.md: el front matter dice 9 entradas y hay 1']),
    };
    assert.deepEqual(resultados({ diccionarios: conErrores }), antes);
    // Archivos que faltan: lo que devuelve cargarDiccionarios sin carpeta.
    const faltantes = {};
    for (const nombre of ['diccionario-lexico', 'ortografia-tipeo', 'frases-patrones', 'contexto-palabras', 'temas-conocimiento']) {
      faltantes[nombre] = carga([], [`${nombre}.md: no se pudo leer (no existe)`]);
    }
    assert.deepEqual(resultados({ diccionarios: faltantes }), antes);
    assert.equal(prepararDiccionarios(faltantes, contenido.intenciones), null);
  });

  test('un diccionario con errores no tapa al otro: el léxico sirve aunque la ortografía falte', () => {
    const d = {
      'diccionario-lexico': carga([lex('dialogar con', 'intencion_hablar_con', 'sinonimo')]),
      'ortografia-tipeo': carga([], ['ortografia-tipeo.md: no se pudo leer (no existe)']),
    };
    assert.equal(decidir('dialogar con serel', ctx({ diccionarios: d })).intencionId, 'intencion_hablar_con');
  });

  test('con los diccionarios reales, las frases que el catálogo ya entendía dan lo mismo', () => {
    const antes = resultados({});
    const con = resultados({ diccionarios: cargados });
    for (const [i, f] of FRASES.entries()) {
      // Las que el diccionario resuelve de otra forma (a propósito) se listan aparte.
      if (['dialogar con serel', 'acechar a serel'].includes(f)) continue;
      assert.deepEqual(con[i], antes[i], f);
    }
  });

  test('nunca lanza, aunque el diccionario traiga entradas rotas o trampas', () => {
    const roto = {
      'diccionario-lexico': carga([null, 7, {}, { forma: null, id: 'intencion_comprar', tipo: 'sinonimo' }, { forma: 'pagar', id: 'no_existe', tipo: 'sinonimo' }, { forma: 'x', id: 'y', tipo: 'npc' }]),
      'ortografia-tipeo': carga([null, { escrita: 3, correcta: {}, tipo: 'h' }, { escrita: '', correcta: '', tipo: 'h' }]),
    };
    const trampa = new Proxy({}, { get() { throw new Error('boom'); }, has() { throw new Error('boom'); } });
    for (const diccionarios of [roto, trampa]) {
      for (const f of FRASES) assert.doesNotThrow(() => decidir(f, ctx({ diccionarios })), f);
    }
    assert.equal(corregirOrtografia(undefined, real), null);
    assert.equal(corregirOrtografia('hola', null), null);
  });
});

describe('catálogo', () => {
  test('las formas del catálogo siguen resolviendo a su intención, con y sin diccionarios', () => {
    let total = 0;
    for (const intencion of contenido.intenciones) {
      for (const forma of intencion.formas) {
        total++;
        assert.equal(coincidirIntencion(forma, contenido.intenciones)?.intencionId, intencion.id, `sin diccionarios: ${forma}`);
        for (const diccionarios of [real, null]) {
          const r = coincidirConDiccionarios(forma, contenido.intenciones, diccionarios);
          assert.equal(r.coincidencia?.intencionId, intencion.id, `${diccionarios ? 'con' : 'sin'} diccionarios: ${forma}`);
          assert.deepEqual(r.coincidencia, coincidirIntencion(forma, contenido.intenciones), forma);
          assert.equal(r.texto, forma);
        }
      }
    }
    // El pedido decía 240; el contenido de esta versión tiene 239 formas en las 24 intenciones.
    assert.equal(total, 239);
  });
});

describe('narrar con diccionarios', () => {
  test('de punta a punta: léxico y ortografía actúan en el turno; con `diccionarios: null` se apagan', async () => {
    const { crearPartida, narrar, diccionarios } = await import('./index.js');
    assert.ok(diccionarios, 'los diccionarios reales cargan al importar index.js');
    const e = crearPartida({ semilla: 5 });
    for (const frase of ['dialogar con serel', 'ablar con serel']) {
      const con = await narrar(e, { tipo: 'texto', texto: frase });
      assert.equal(con.registro.intencion_detectada, 'intencion_hablar_con', frase);
      assert.equal(con.registro.ruta, 'grupo_1', frase);
      assert.deepEqual(con.errores, [], frase);
    }
    const sin = await narrar(e, { tipo: 'texto', texto: 'dialogar con serel' }, { diccionarios: null });
    assert.equal(sin.tipo, 'reformulacion');
  });
});

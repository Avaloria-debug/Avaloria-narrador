// Arreglos de la prueba v0.0.4: viajar solo con verbo exacto, saludos y reconocimientos, IA sin clave y versión visible.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leerContenido } from './cargarContenido.js';
import { validarContenido } from './contenido.js';
import { cargarDiccionarios } from './diccionarios.js';
import { coincidirIntencion, decidir, esSoloDeLista, MOTIVOS } from './comprension.js';
import { INTENCIONES_DE_REGISTRO, validarRegistro } from './registro.js';
import { crearPartida, narrar, contenido as contenidoDelNarrador, TIPOS_SALIDA } from './index.js';
import { VERSION } from './version.js';

const FRASE = 'contame lo del pozo viejo del norte';
let contenido;
let cargados;
before(async () => {
  contenido = await leerContenido();
  cargados = await cargarDiccionarios(contenido);
});

const ctx = (extra = {}) => ({
  intenciones: contenido.intenciones,
  escenas: contenido.escenas,
  escena: { id: 'escena_mercado_circular' },
  npcsPresentes: [{ ...contenido.npcs.find((n) => n.id === 'serel_panadero'), relacion: 0 }],
  npcsAusentes: contenido.npcs,
  objetosAplicables: [],
  ...extra,
});
const decir = (estado, texto, opciones) => narrar(estado, { tipo: 'texto', texto }, opciones);

describe('viajar solo con verbo exacto', () => {
  test('causa: la tolerancia a typos acerca "viejo" a "viajá" (2 letras) y a eso se suma el destino "norte"', () => {
    // La comparación de palabras sola ya lo confunde: es el origen del bug.
    assert.equal(coincidirIntencion(FRASE, contenido.intenciones)?.intencionId, 'intencion_viajar');
    assert.equal(coincidirIntencion(FRASE, contenido.intenciones, { exacto: true }), null);
  });

  test('la frase exacta no viaja: ni sin diccionarios ni con los reales', async () => {
    for (const diccionarios of [undefined, cargados]) {
      const d = decidir(FRASE, ctx({ diccionarios }));
      assert.notEqual(d.tipo, 'ejecutar');
      assert.notEqual(d.intencionId, 'intencion_viajar');
      assert.equal(d.motivo, MOTIVOS.NO_ENTENDIDO);
    }
    const e = crearPartida({ semilla: 3 });
    for (const opciones of [undefined, { diccionarios: null }]) {
      const r = await decir(e, FRASE, opciones);
      assert.equal(r.estado.jugador.escenaId, e.jugador.escenaId);
      assert.deepEqual(r.estado.reloj, e.reloj);
      assert.notEqual(r.registro.intencion_detectada, 'intencion_viajar');
    }
  });

  test('"viajá al norte" viaja', async () => {
    for (const diccionarios of [undefined, cargados]) {
      const d = decidir('viajá al norte', ctx({ diccionarios }));
      assert.equal(d.tipo, 'ejecutar');
      assert.equal(d.intencionId, 'intencion_viajar');
      assert.equal(d.parametros.destino, 'escena_camino_norte');
    }
    const r = await decir(crearPartida({ semilla: 3 }), 'viajá al norte');
    assert.equal(r.estado.jugador.escenaId, 'escena_camino_norte');
  });

  test('"quiero viajar al norte, ¿sabés cómo?" es consulta', () => {
    for (const diccionarios of [undefined, cargados]) {
      assert.equal(decidir('quiero viajar al norte, ¿sabés cómo?', ctx({ diccionarios })).tipo, 'consulta');
    }
  });

  test('"viajá al nrte" no viaja: el destino también tiene que estar bien escrito (reformulación)', async () => {
    for (const diccionarios of [undefined, cargados]) {
      const d = decidir('viajá al nrte', ctx({ diccionarios }));
      assert.equal(d.tipo, 'reformular');
      assert.equal(d.motivo, MOTIVOS.FALTA_DESTINO);
    }
    const e = crearPartida({ semilla: 3 });
    const r = await decir(e, 'viajá al nrte');
    assert.equal(r.tipo, TIPOS_SALIDA.REFORMULACION);
    assert.equal(r.estado.jugador.escenaId, e.jugador.escenaId);
  });

  test('un typo en el verbo nunca viaja, aunque haya destino válido', () => {
    for (const f of ['viajr al norte', 'viajaa al norte', 'biajar al norte', 'viejo al norte', 'vieja del norte', 'contame lo de la vieja del norte']) {
      for (const diccionarios of [undefined, cargados]) {
        const d = decidir(f, ctx({ diccionarios }));
        assert.equal(d.tipo, 'reformular', f);
        assert.equal(d.motivo, MOTIVOS.NO_ENTENDIDO, f);
        assert.equal(d.intencionId, null, f);
      }
    }
  });

  test('el verbo exacto viaja: sin tildes, en minúsculas, con cualquier forma del catálogo', () => {
    for (const f of ['VIAJÁ al norte', 'viaja al norte', 'viajar al Norte', 'quiero ir al norte', 'irme al norte', 'ponerme en camino al norte']) {
      const d = decidir(f, ctx());
      assert.equal(d.tipo, 'ejecutar', f);
      assert.equal(d.intencionId, 'intencion_viajar', f);
    }
  });

  test('con una pregunta, un parecido tampoco viaja', () => {
    assert.equal(decidir('¿viajr al norte?', ctx()).tipo, 'consulta');
  });
});

describe('saludos y reconocimientos', () => {
  const con = (bloque) => contenidoDelNarrador.plantillas[bloque].map((p) => p.replace('{npc}', 'Serel Norlen'));

  test('las plantillas y las listas son las pedidas', () => {
    assert.deepEqual(contenidoDelNarrador.plantillas.saludo, [
      '{npc} te saluda con un gesto.',
      '{npc} levanta la vista y te responde con un saludo.',
    ]);
    assert.deepEqual(contenidoDelNarrador.plantillas.reconocimiento, [
      '{npc} asiente sin decir nada.',
      '{npc} te mira y asiente con la cabeza.',
    ]);
    assert.deepEqual(contenidoDelNarrador.saludos, ['hola', 'buenas', 'buen dia', 'buenas tardes', 'buenas noches', 'que tal', 'hey']);
    assert.deepEqual(contenidoDelNarrador.reconocimientos, ['ok', 'gracias', 'dale', 'bien', 'listo']);
  });

  const CASOS = [
    ['hola', 'saludo'], ['buenas', 'saludo'], ['buen día', 'saludo'], ['Buenas tardes', 'saludo'], ['¿Qué tal?', 'saludo'],
    ['hey!', 'saludo'], ['hola, buenas tardes', 'saludo'],
    ['ok', 'reconocimiento'], ['gracias', 'reconocimiento'], ['Dale.', 'reconocimiento'], ['bien', 'reconocimiento'], ['listo', 'reconocimiento'],
  ];
  for (const [frase, tipo] of CASOS) {
    test(`"${frase}": narración con la plantilla ${tipo}, sin reformulación y sin IA, aunque haya clave`, async () => {
      let llamadas = 0;
      const http = () => {
        llamadas++;
        throw new Error('esto no llama a la IA');
      };
      const e = crearPartida({ semilla: 9 });
      for (const groqKey of [undefined, 'gsk_clave_de_prueba']) {
        const r = await decir(e, frase, { groqKey, http });
        assert.equal(r.tipo, TIPOS_SALIDA.NARRACION);
        assert.ok(con(tipo).includes(r.texto), r.texto);
        assert.deepEqual(r.errores, []);
        assert.equal(r.estado.reformulacionPendiente, false);
        assert.equal(r.registro.intencion_detectada, tipo);
        assert.equal(r.registro.ruta, 'grupo_1');
        assert.equal(r.registro.origen_respuesta, 'codigo');
        // Sin cambios en el mundo: ni reloj, ni lugar, ni relaciones.
        assert.deepEqual(r.estado.reloj, e.reloj);
        assert.deepEqual(r.estado.npcs, e.npcs);
        assert.deepEqual(r.estado.jugador, e.jugador);
      }
      assert.equal(llamadas, 0);
    });
  }

  test('funciona sin diccionarios: las listas son del contenido', async () => {
    const r = await decir(crearPartida({ semilla: 9 }), 'hola', { diccionarios: null });
    assert.ok(con('saludo').includes(r.texto), r.texto);
  });

  test('decidir devuelve saludo o reconocimiento con el NPC presente; sin las listas no hay', () => {
    const listas = { saludos: contenido.saludos, reconocimientos: contenido.reconocimientos };
    assert.deepEqual(decidir('hola', ctx(listas)), { tipo: 'saludo', npcId: 'serel_panadero' });
    assert.deepEqual(decidir('gracias', ctx(listas)), { tipo: 'reconocimiento', npcId: 'serel_panadero' });
    assert.equal(decidir('hola', ctx()).tipo, 'reformular');
  });

  test('una frase con otras palabras no es solo un saludo; saludo y reconocimiento juntos tampoco', async () => {
    const listas = { saludos: contenido.saludos, reconocimientos: contenido.reconocimientos };
    for (const f of ['hola, hablá con serel', 'ok, viajá al norte', 'hola ok', 'hola qwerty', 'gracias por nada', 'hola serel']) {
      assert.notEqual(decidir(f, ctx(listas)).tipo, 'saludo', f);
      assert.notEqual(decidir(f, ctx(listas)).tipo, 'reconocimiento', f);
    }
    // Un saludo con una acción hace la acción.
    assert.equal(decidir('hola, viajá al norte', ctx(listas)).intencionId, 'intencion_viajar');
  });

  test('esSoloDeLista: sin tildes, sin signos, y las frases de la lista se pueden juntar', () => {
    assert.equal(esSoloDeLista('¡¡BUEN DÍA!!', ['buen dia']), true);
    assert.equal(esSoloDeLista('hola buenas noches', ['hola', 'buenas noches']), true);
    assert.equal(esSoloDeLista('buenas', ['buenas tardes']), false);
    assert.equal(esSoloDeLista('', ['hola']), false);
    assert.equal(esSoloDeLista('hola', []), false);
    assert.equal(esSoloDeLista('hola', undefined), false);
  });

  test('saludo después de una reformulación: la limpia y no pasa a la IA', async () => {
    const e = crearPartida({ semilla: 9 });
    const uno = await decir(e, 'asdf qwer zxcv');
    assert.equal(uno.tipo, TIPOS_SALIDA.REFORMULACION);
    const dos = await decir(uno.estado, 'hola');
    assert.equal(dos.tipo, TIPOS_SALIDA.NARRACION);
    assert.ok(con('saludo').includes(dos.texto), dos.texto);
    assert.equal(dos.estado.reformulacionPendiente, false);
  });

  test('las dos variantes de cada plantilla aparecen', async () => {
    for (const [frase, tipo] of [['hola', 'saludo'], ['ok', 'reconocimiento']]) {
      const vistas = new Set();
      let e = crearPartida({ semilla: 4 });
      for (let i = 0; i < 12; i++) {
        const r = await decir(e, frase);
        vistas.add(r.texto);
        e = r.estado;
      }
      assert.deepEqual([...vistas].sort(), con(tipo).sort(), tipo);
    }
  });

  test('sin NPC en la escena no hay a quién responder: texto de respaldo, sin IA', async () => {
    const base = crearPartida({ semilla: 7 });
    const sola = { ...base, jugador: { ...base.jugador, escenaId: 'escena_camino_este' }, reloj: { dia: 1, hora: '18:00' } };
    for (const frase of ['hola', 'ok']) {
      const r = await decir(sola, frase);
      assert.equal(r.tipo, TIPOS_SALIDA.NARRACION);
      assert.ok(contenidoDelNarrador.plantillas.reformulacion.no_entendido.includes(r.texto), r.texto);
      assert.ok(!r.errores.some((e) => e.includes('sin_ia')), JSON.stringify(r.errores));
    }
  });

  test('los ids saludo y reconocimiento son intenciones de registro válidas', () => {
    assert.deepEqual([...INTENCIONES_DE_REGISTRO], ['saludo', 'reconocimiento']);
    const intenciones = [...contenido.intenciones.map((i) => i.id), ...INTENCIONES_DE_REGISTRO];
    const registro = {
      id: 'reg_000001', fecha: '2026-11-16T10:00:00', escena: 'escena_mercado_circular', estado_escena: 'tranquilo',
      ultimos_turnos: [], texto_jugador: 'hola', ruta: 'grupo_1', intento_reformulacion: false, intencion_detectada: 'saludo',
      origen_respuesta: 'codigo', respuesta_mostrada: 'Serel Norlen te saluda con un gesto.', revision: 'pendiente', notas: '', contaminacion: false,
    };
    assert.deepEqual(validarRegistro(registro, { intenciones }), []);
    assert.match(validarRegistro(registro, { intenciones: contenido.intenciones.map((i) => i.id) }).join(), /intención desconocida/);
  });

  describe('validador', () => {
    const roto = (cambio) => {
      const c = JSON.parse(JSON.stringify(contenido));
      cambio(c);
      return validarContenido(c);
    };
    test('el contenido real es válido', () => {
      const v = validarContenido(contenido);
      assert.deepEqual(v.errores, []);
      assert.deepEqual(v.avisos, []);
    });
    test('las listas tienen que existir y no estar vacías', () => {
      for (const lista of ['saludos', 'reconocimientos']) {
        for (const valor of [undefined, [], 'hola', ['hola', '']]) {
          const v = roto((c) => {
            if (valor === undefined) delete c[lista];
            else c[lista] = valor;
          });
          assert.equal(v.ok, false, `${lista} ${JSON.stringify(valor)}`);
          assert.ok(v.errores.some((e) => e.startsWith(lista)), `${lista} ${JSON.stringify(valor)}`);
        }
      }
    });
    test('una frase repetida, dentro de una lista o entre las dos, es un error que bloquea', () => {
      const dentro = roto((c) => c.saludos.push('Buen día'));
      assert.equal(dentro.ok, false);
      assert.match(dentro.errores.join('\n'), /saludos\[7\].*se repite/);
      const entre = roto((c) => c.reconocimientos.push('hola'));
      assert.equal(entre.ok, false);
      assert.match(entre.errores.join('\n'), /reconocimientos\[5\].*se repite \(ya está en saludos\[0\]\)/);
    });
    for (const bloque of ['saludo', 'reconocimiento']) {
      test(`la plantilla ${bloque} tiene que existir, con dos variantes y {npc}`, () => {
        for (const valor of [undefined, [], ['{npc} hola.'], ['Hola.', 'Chau.'], ['{npc} hola.', '{npc} hola.', 7]]) {
          const v = roto((c) => {
            if (valor === undefined) delete c.plantillas[bloque];
            else c.plantillas[bloque] = valor;
          });
          assert.equal(v.ok, false, JSON.stringify(valor));
          assert.ok(v.errores.some((e) => e.includes(`plantillas.${bloque}`)), JSON.stringify(valor));
        }
      });
    }
  });
});

describe('IA sin clave', () => {
  test('dos envíos seguidos que el código no entiende, sin clave: reformulación y después plantilla con sin_ia', async () => {
    const http = () => {
      throw new Error('sin clave no se llama a la red');
    };
    const texto = 'asdf qwer zxcv';
    const uno = await decir(crearPartida({ semilla: 7 }), texto, { http });
    assert.equal(uno.tipo, TIPOS_SALIDA.REFORMULACION);
    assert.deepEqual(uno.errores, []);
    const dos = await decir(uno.estado, texto, { http });
    assert.equal(dos.tipo, TIPOS_SALIDA.NARRACION);
    assert.ok(contenidoDelNarrador.plantillas.reformulacion.no_entendido.includes(dos.texto), dos.texto);
    assert.ok(dos.errores.some((e) => e.includes('sin_ia')), JSON.stringify(dos.errores));
    assert.ok(dos.errores.some((e) => e.includes('sin_clave')), JSON.stringify(dos.errores));
    assert.equal(dos.registro.ruta, 'grupo_2');
  });

  test('con la frase de ejemplo, que ahora es una consulta, el NPC responde y la IA no entra', async () => {
    const r = await decir(crearPartida({ semilla: 7 }), '¿qué opinás de la lluvia que viene del lago?');
    assert.ok(contenidoDelNarrador.plantillas.no_se.some((p) => p.replace('{npc}', 'Serel Norlen') === r.texto), r.texto);
    assert.deepEqual(r.errores, []);
  });
});

describe('versión visible', () => {
  test('VERSION es 0.0.10', () => {
    assert.equal(VERSION, '0.0.10');
    assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  });

  test('la página de prueba muestra la misma versión, como "v" + VERSION', async () => {
    const html = await readFile(new URL('./prueba/index.html', import.meta.url), 'utf8');
    const m = html.match(/<[^>]*id="version"[^>]*>([^<]*)</);
    assert.ok(m, 'la página tiene un elemento con id="version"');
    assert.equal(m[1].trim(), `v${VERSION}`);
    assert.equal([...html.matchAll(/id="version"/g)].length, 1);
  });
});

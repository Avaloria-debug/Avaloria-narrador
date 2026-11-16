// Arreglos de la prueba v0.0.3: viajar por parecido, saludos, IA sin clave y versión visible.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leerContenido } from './cargarContenido.js';
import { validarContenido } from './contenido.js';
import { cargarDiccionarios } from './diccionarios.js';
import { coincidirIntencion, decidir, prepararDiccionarios, MOTIVOS } from './comprension.js';
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

describe('viajar por parecido', () => {
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

  test('un typo de una letra viaja solo si hay destino válido; sin destino, no se entiende', () => {
    // "viajr" está a una letra de "viajar".
    const conDestino = decidir('viajr al norte', ctx());
    assert.equal(conDestino.tipo, 'ejecutar');
    assert.equal(conDestino.intencionId, 'intencion_viajar');
    const sinDestino = decidir('viajr a la nada', ctx());
    assert.equal(sinDestino.tipo, 'reformular');
    assert.equal(sinDestino.motivo, MOTIVOS.NO_ENTENDIDO);
    assert.equal(sinDestino.intencionId, null);
    // Escrito bien, sin destino: se sabe que quiere viajar y falta el destino.
    assert.equal(decidir('viajá a la nada', ctx()).motivo, MOTIVOS.FALTA_DESTINO);
  });

  test('dos letras de diferencia nunca viajan, aunque haya destino', () => {
    for (const f of ['viejo al norte', 'quiero un viejo camino al norte']) {
      assert.notEqual(decidir(f, ctx()).intencionId, 'intencion_viajar', f);
    }
  });

  test('con una pregunta, un parecido tampoco viaja', () => {
    assert.equal(decidir('¿viajr al norte?', ctx()).tipo, 'consulta');
  });
});

describe('saludos', () => {
  const SALUDOS = contenido => contenido.plantillas.saludo.map((p) => p.replace('{npc}', 'Serel Norlen'));

  test('la plantilla saludo tiene las dos variantes pedidas', async () => {
    assert.deepEqual(contenidoDelNarrador.plantillas.saludo, [
      '{npc} te saluda con un gesto.',
      '{npc} levanta la vista y te responde con un saludo.',
    ]);
  });

  for (const saludo of ['hola', 'buenas', 'buen día', 'Hola!', 'BUEN DIA']) {
    test(`"${saludo}": narración con la plantilla saludo, sin reformulación y sin IA`, async () => {
      let llamadas = 0;
      const http = () => {
        llamadas++;
        throw new Error('un saludo no llama a la IA');
      };
      const e = crearPartida({ semilla: 9 });
      for (const groqKey of [undefined, 'gsk_clave_de_prueba']) {
        const r = await decir(e, saludo, { groqKey, http });
        assert.equal(r.tipo, TIPOS_SALIDA.NARRACION);
        assert.ok(SALUDOS(contenidoDelNarrador).includes(r.texto), r.texto);
        assert.deepEqual(r.errores, []);
        assert.equal(r.estado.reformulacionPendiente, false);
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

  test('decidir devuelve ignorar con el NPC presente; sin diccionarios, no hay saludos', () => {
    assert.deepEqual(decidir('hola', ctx({ diccionarios: cargados })), { tipo: 'ignorar', npcId: 'serel_panadero' });
    assert.equal(decidir('hola', ctx()).tipo, 'reformular');
  });

  test('saludo después de una reformulación: la limpia y no pasa a la IA', async () => {
    const e = crearPartida({ semilla: 9 });
    const uno = await decir(e, 'asdf qwer zxcv');
    assert.equal(uno.tipo, TIPOS_SALIDA.REFORMULACION);
    const dos = await decir(uno.estado, 'hola');
    assert.equal(dos.tipo, TIPOS_SALIDA.NARRACION);
    assert.ok(SALUDOS(contenidoDelNarrador).includes(dos.texto), dos.texto);
    assert.equal(dos.estado.reformulacionPendiente, false);
  });

  test('las dos variantes aparecen', async () => {
    const vistas = new Set();
    let e = crearPartida({ semilla: 4 });
    for (let i = 0; i < 12; i++) {
      const r = await decir(e, 'hola');
      vistas.add(r.texto);
      e = r.estado;
    }
    assert.deepEqual([...vistas].sort(), SALUDOS(contenidoDelNarrador).sort());
  });

  test('una frase que es más que un saludo no es saludo', async () => {
    assert.equal((await decir(crearPartida({ semilla: 9 }), 'hola, buenas tardes')).tipo, TIPOS_SALIDA.REFORMULACION);
  });

  test('sin NPC en la escena no hay a quién saludar: texto de respaldo, sin IA', async () => {
    const base = crearPartida({ semilla: 7 });
    const sola = { ...base, jugador: { ...base.jugador, escenaId: 'escena_camino_este' }, reloj: { dia: 1, hora: '18:00' } };
    const r = await decir(sola, 'hola');
    assert.equal(r.tipo, TIPOS_SALIDA.NARRACION);
    assert.ok(contenidoDelNarrador.plantillas.reformulacion.no_entendido.includes(r.texto), r.texto);
    assert.ok(!r.errores.some((e) => e.includes('sin_ia')), JSON.stringify(r.errores));
  });

  test('validador: saludo tiene que existir con dos variantes y {npc}', () => {
    for (const valor of [undefined, [], ['{npc} hola.'], ['Hola.', 'Chau.'], ['{npc} hola.', '{npc} hola.', 7]]) {
      const c = JSON.parse(JSON.stringify(contenido));
      if (valor === undefined) delete c.plantillas.saludo;
      else c.plantillas.saludo = valor;
      assert.ok(validarContenido(c).errores.some((e) => e.includes('plantillas.saludo')), JSON.stringify(valor));
    }
    assert.deepEqual(validarContenido(contenido).errores, []);
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
  test('VERSION es 0.0.3', () => {
    assert.equal(VERSION, '0.0.3');
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

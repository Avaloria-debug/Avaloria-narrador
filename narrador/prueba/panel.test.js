import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from '../index.js';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';
import { fijarRelacion, opcionesDeEscena, entradaDeBoton, llamadaDeRespuesta, tokensDeLlamadas, armarPanel } from './panel.js';

test('opcionesDeEscena: una intención por botón y las listas de la escena inicial', () => {
  const estado = crearPartida({ semilla: 1 });
  const o = opcionesDeEscena(estado, contenido);
  assert.equal(o.escena.id, contenido.reglas.escenaInicial);
  assert.equal(o.intenciones.length, contenido.intenciones.length);
  assert.ok(o.intenciones.every((i) => i.id && i.etiqueta));
  const escena = contenido.escenas.find((e) => e.id === o.escena.id);
  assert.deepEqual(o.destinos.map((d) => d.id), escena.salidas);
  assert.ok(o.destinos.every((d) => d.nombre && d.nombre !== d.id));
  assert.equal(new Set(o.objetos.map((x) => x.id)).size, o.objetos.length);
});

test('opcionesDeEscena: escena desconocida no rompe', () => {
  const o = opcionesDeEscena({ jugador: { escenaId: 'no_existe' } }, contenido);
  assert.equal(o.escena, null);
  assert.deepEqual(o.npcs, []);
});

test('entradaDeBoton: solo manda los parámetros elegidos', () => {
  assert.deepEqual(entradaDeBoton('intencion_observar'), { tipo: 'boton', intencionId: 'intencion_observar', parametros: {} });
  assert.deepEqual(entradaDeBoton('intencion_viajar', { destino: 'escena_archivo_real', npcId: '' }).parametros, { destino: 'escena_archivo_real' });
});

test('un botón armado por la página lo acepta narrar', async () => {
  const estado = crearPartida({ semilla: 1 });
  const destino = opcionesDeEscena(estado, contenido).destinos[0].id;
  const salida = await narrar(estado, entradaDeBoton('intencion_viajar', { destino }));
  assert.equal(salida.tipo, 'narracion');
  assert.deepEqual(salida.errores, []);
});

test('tokens: sin llamadas es null; con llamadas, suma el uso', () => {
  assert.equal(tokensDeLlamadas([]), null);
  const a = llamadaDeRespuesta(200, { usage: { prompt_tokens: 300, completion_tokens: 40, total_tokens: 340 } });
  const b = llamadaDeRespuesta(429, { error: { message: 'x' } });
  assert.deepEqual(b, { status: 429, uso: null });
  assert.deepEqual(tokensDeLlamadas([b, a]), { llamadas: 2, estados: [429, 200], entrada: 300, salida: 40, total: 340 });
  assert.deepEqual(tokensDeLlamadas([b]), { llamadas: 1, estados: [429], entrada: null, salida: null, total: null });
});

test('armarPanel: turno de texto con registro', async () => {
  const salida = await narrar(crearPartida({ semilla: 1 }), { tipo: 'texto', texto: 'observar' });
  const p = armarPanel(salida, { pendientes: 1 });
  assert.equal(p.texto, salida.texto);
  assert.equal(p.tipo, salida.tipo);
  assert.equal(p.tokens, null);
  assert.deepEqual(JSON.parse(p.registroJson), salida.registro);
  assert.equal(p.pendientes, 1);
});

test('armarPanel: sin registro y con salida vacía', () => {
  assert.equal(armarPanel({ texto: 'a', tipo: 'narracion', registro: null, errores: ['ia: sin_ia'] }).registroJson, '');
  assert.deepEqual(armarPanel(null), { texto: '', tipo: '', errores: [], tokens: null, registroJson: '', pendientes: 0 });
});

test('fijarRelacion: fija, redondea y recorta, sin tocar el estado recibido', () => {
  const e = crearPartida({ semilla: 1 });
  const antes = JSON.stringify(e);
  assert.equal(fijarRelacion(e, 'serel_panadero', 39).npcs.serel_panadero.relacion, 39);
  assert.equal(fijarRelacion(e, 'serel_panadero', '40').npcs.serel_panadero.relacion, 40);
  assert.equal(fijarRelacion(e, 'serel_panadero', 500).npcs.serel_panadero.relacion, 100);
  assert.equal(fijarRelacion(e, 'serel_panadero', -500).npcs.serel_panadero.relacion, -100);
  assert.equal(fijarRelacion(e, 'serel_panadero', 12.6).npcs.serel_panadero.relacion, 13);
  assert.equal(fijarRelacion(e, 'maren_archivista', 7).npcs.serel_panadero.relacion, e.npcs.serel_panadero.relacion);
  for (const malo of ['', 'abc', NaN, null, undefined]) assert.equal(fijarRelacion(e, 'serel_panadero', malo), e);
  assert.equal(fijarRelacion(e, 'no_existe', 5), e);
  assert.equal(JSON.stringify(e), antes);
});

describe('el panel de relación solo está en la página de prueba', () => {
  const leer = (url) => readFile(new URL(url, import.meta.url), 'utf8');
  test('la página de prueba lo tiene una vez, con el aviso', async () => {
    const html = await leer('./index.html');
    assert.equal([...html.matchAll(/id="panelRelacion"/g)].length, 1);
    assert.match(html, /Relación \(solo prueba\)/);
    assert.match(html, /atajo de prueba, no es parte del juego/i);
  });

  test('ningún otro archivo del narrador, ni index.html de la raíz ni ui/, lo menciona', async () => {
    // Raíz del repo según donde está este archivo: no depende del nombre de la carpeta de la copia.
    const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
    const hallados = [];
    const revisar = async (dir) => {
      for (const e of await readdir(dir, { withFileTypes: true })) {
        const ruta = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
        if (e.isDirectory()) {
          if (e.name !== 'node_modules') await revisar(ruta);
        } else if (/\.(js|html|json)$/.test(e.name)) {
          const t = await readFile(ruta, 'utf8');
          if (/panelRelacion|solo prueba|fijarRelacion/.test(t)) hallados.push(relative(RAIZ, fileURLToPath(ruta)).split('\\').join('/'));
        }
      }
    };
    await revisar(new URL('../../narrador/', import.meta.url));
    for (const f of ['../../index.html', '../../ui/']) {
      try {
        if (f.endsWith('/')) await revisar(new URL(f, import.meta.url));
        else if (/panelRelacion|solo prueba|fijarRelacion/.test(await leer(f))) hallados.push(f);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
    const permitidos = ['narrador/prueba/index.html', 'narrador/prueba/app.js', 'narrador/prueba/panel.js', 'narrador/prueba/panel.test.js'];
    assert.deepEqual([...hallados].sort(), [...permitidos].sort()); // rutas relativas a la raíz, sin undefined
    assert.deepEqual(hallados.filter((h) => !permitidos.includes(h)), []);
  });

  test('narrador/index.js no exporta el atajo', async () => {
    const m = await import('../index.js');
    assert.equal('fijarRelacion' in m, false);
  });
});

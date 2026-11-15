import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from '../index.js';
import { opcionesDeEscena, entradaDeBoton, llamadaDeRespuesta, tokensDeLlamadas, armarPanel } from './panel.js';

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

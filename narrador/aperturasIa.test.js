import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar } from './index.js';
import { validarSalida, aperturaIa, armarContexto, MOTIVOS_SALIDA } from './ia.js';

const CLAVE = 'gsk_clave_secreta_de_prueba_123';
const AHORA = () => '2026-11-15T21:14:00Z';
const texto = (t) => ({ tipo: 'texto', texto: t });
const ok = (content) => ({ status: 200, json: async () => ({ choices: [{ message: { content } }] }) });
const esperar = async () => {};
function httpFalso(respuestas) {
  const llamadas = [];
  const http = async (url, opciones) => { llamadas.push(JSON.parse(opciones.body)); return ok(respuestas[Math.min(llamadas.length - 1, respuestas.length - 1)]); };
  http.llamadas = llamadas;
  return http;
}
// Un turno que llega a la IA: primero una reformulación, después la frase que va a la IA.
async function turnoIa(estado, http) {
  const r1 = await narrar(estado, texto('blablabla sin sentido'), { ahora: AHORA });
  assert.equal(r1.tipo, 'reformulacion');
  return narrar(r1.estado, texto('contame algo raro de este lugar'), { groqKey: CLAVE, http, esperar, ahora: AHORA });
}

test('la validación de salida rechaza lo mismo que antes', () => {
  const casos = [
    ['', MOTIVOS_SALIDA.VACIA], ['Hola {nombre}.', MOTIVOS_SALIDA.PLACEHOLDER], ['Mirá [esto].', MOTIVOS_SALIDA.CORCHETES],
    ['Hola <b>vos</b>.', MOTIVOS_SALIDA.ETIQUETA], ['Andá a escena_mercado.', MOTIVOS_SALIDA.ID], ['a'.repeat(601), MOTIVOS_SALIDA.LARGO],
    ['Uno. Dos. Tres. Cuatro.', MOTIVOS_SALIDA.ORACIONES], ['¿Qué necesitás, viajero?', null], ['Uno. Dos. Tres.', null],
  ];
  for (const [t, motivo] of casos) assert.equal(validarSalida(t).motivo, motivo, t);
});

test('apertura de IA: dos primeras palabras, sin tildes ni signos', () => {
  assert.equal(aperturaIa('¿Qué necesitás, viajero?'), 'que necesitas');
  assert.equal(aperturaIa('Mirá, no sé.'), 'mira no');
  assert.equal(aperturaIa('Claro.'), 'claro');
});

// Regla nueva (un solo pedido): reemplaza a los tests que esperaban un pedido extra al repetir.
test('dos respuestas IA seguidas: la segunda recibe en el mismo pedido la apertura a evitar', async () => {
  const http = httpFalso(['¿Qué necesitás, viajero?', 'Mirá, de eso no sé nada.']);
  const a = await turnoIa(crearPartida({ semilla: 1 }), http);
  assert.equal(a.texto, '¿Qué necesitás, viajero?');
  assert.doesNotMatch(http.llamadas[0].messages[1].content, /no arranques/);
  const b = await turnoIa(a.estado, http);
  assert.equal(b.texto, 'Mirá, de eso no sé nada.');
  assert.notEqual(aperturaIa(a.texto), aperturaIa(b.texto));
  assert.match(http.llamadas[1].messages[1].content, /no arranques con "que necesitas"/);
  assert.equal(http.llamadas.length, 2);
  assert.equal(b.estado.diagnosticoAperturasIa.aperturasRepetidas, 0);
});

test('las aperturas de las últimas 5 respuestas de IA van a evitar en el pedido; si igual repite, se acepta y se anota', async () => {
  const textos = ['Uno dice algo.', 'Dos dice algo.', 'Tres dice algo.', 'Cuatro dice algo.', 'Cinco dice algo.'];
  let e = crearPartida({ semilla: 1 });
  for (const t of textos) e = (await turnoIa(e, httpFalso([t]))).estado;
  assert.deepEqual(e.ventanaAperturasIa, ['uno dice', 'dos dice', 'tres dice', 'cuatro dice', 'cinco dice']);
  const http = httpFalso(['Dos dice otra cosa.']);
  const r = await turnoIa(e, http);
  assert.match(http.llamadas[0].messages[1].content, /no arranques con "uno dice", "dos dice", "tres dice", "cuatro dice", "cinco dice"/);
  assert.equal(r.texto, 'Dos dice otra cosa.');
  assert.deepEqual(r.estado.diagnosticoAperturasIa, { aperturasRepetidas: 1, ultimaRepetida: 'dos dice', aperturasRecortadas: 0 });
  assert.ok(!JSON.stringify(r.estado.diagnosticoAperturasIa).includes('contame'), 'sin la frase del jugador');
});

test('una sola llamada HTTP por turno aun cuando la respuesta repite apertura', async () => {
  const http = httpFalso(['¿Qué necesitás, viajero?']);
  let e = crearPartida({ semilla: 1 });
  for (let i = 1; i <= 3; i++) {
    const r = await turnoIa(e, http);
    assert.equal(r.tipo, 'dialogo_ia');
    assert.equal(http.llamadas.length, i);
    e = r.estado;
  }
  assert.equal(e.diagnosticoAperturasIa.aperturasRepetidas, 2);
});

test('contexto cargado cerca del tope: la instrucción sigue o queda registrado el recorte', () => {
  const evitar = ['que necesitas', 'mira no', 'claro que', 'no se', 'ya te'];
  const base = { escena: { nombre: 'Mercado Circular', ciudad: 'Ardenhall', estado: 'normal' }, npc: { nombre: 'Serel Norlen', rol: 'Panadero', disposicion: 'neutral' }, frase: 'contame algo', evitarAperturas: evitar };
  const sinLinea = (n) => armarContexto({ ...base, evitarAperturas: [], escena: { ...base.escena, descripcion: 'x'.repeat(n) } }).tokens;
  // Descripción que deja el contexto sin la línea a pocos tokens del tope (250).
  let n = 0;
  while (sinLinea(n + 35) <= 245) n += 35;
  const cerca = armarContexto({ ...base, escena: { ...base.escena, descripcion: 'x'.repeat(n) } });
  assert.ok(cerca.tokens <= 250);
  if (cerca.aperturasRecortadas) assert.doesNotMatch(cerca.texto, /no arranques/);
  else assert.match(cerca.texto, /no arranques con "que necesitas"/);
  console.log(`# contexto cerca del tope: ${cerca.tokens} tokens, ${cerca.aperturasRecortadas ? 'línea recortada (registrado)' : 'línea presente'}`);
  // Con margen la línea está; sin margen se recorta y se marca.
  const holgado = armarContexto(base);
  assert.equal(holgado.aperturasRecortadas, false);
  assert.match(holgado.texto, /no arranques/);
});

test('contexto cerca del tope en narrar: el recorte queda en el diagnóstico del estado', async () => {
  const http = httpFalso(['Uno dice algo.', 'Otra cosa distinta.']);
  const a = await turnoIa(crearPartida({ semilla: 1 }), http);
  const r1 = await narrar(a.estado, texto('blablabla sin sentido'), { ahora: AHORA });
  const larga = 'contame algo raro de este lugar '.repeat(8).slice(0, 240);
  const b = await narrar(r1.estado, texto(larga), { groqKey: CLAVE, http, esperar, ahora: AHORA });
  const recortada = !/no arranques/.test(http.llamadas.at(-1).messages[1].content);
  assert.equal(b.estado.diagnosticoAperturasIa.aperturasRecortadas, recortada ? 1 : 0);
  console.log(`# narrar con frase de 240 caracteres: ${recortada ? 'línea recortada, registrada en el estado' : 'línea presente'}`);
});

test('la línea de aperturas a evitar es lo primero que sale si el contexto no entra', () => {
  const base = { escena: { nombre: 'Mercado', estado: 'normal' }, frase: 'hola', evitarAperturas: ['que necesitas'] };
  assert.match(armarContexto(base).texto, /no arranques con "que necesitas"/);
  const largo = { ...base, escena: { ...base.escena, descripcion: 'x '.repeat(400) } };
  let r = null;
  try { r = armarContexto(largo); } catch (e) { r = e; }
  if (!(r instanceof Error)) assert.doesNotMatch(r.texto, /no arranques/);
});

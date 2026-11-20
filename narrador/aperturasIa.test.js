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

test('dos respuestas IA seguidas del mismo NPC no empiezan con la misma apertura de 2 palabras', async () => {
  const http = httpFalso(['¿Qué necesitás, viajero?', '¿Qué necesitás ahora?', 'Mirá, de eso no sé nada.']);
  const a = await turnoIa(crearPartida({ semilla: 1 }), http);
  assert.equal(a.tipo, 'dialogo_ia');
  assert.equal(a.texto, '¿Qué necesitás, viajero?');
  const b = await turnoIa(a.estado, http);
  assert.equal(b.tipo, 'dialogo_ia');
  assert.equal(b.texto, 'Mirá, de eso no sé nada.');
  assert.notEqual(aperturaIa(a.texto), aperturaIa(b.texto));
  assert.equal(http.llamadas.length, 3, 'un solo pedido extra por la repetición');
  assert.match(http.llamadas[1].messages[1].content, /no arranques con "que necesitas"/);
});

test('una apertura de las últimas 5 respuestas de IA se evita si hay alternativa; si no la hay, se acepta', async () => {
  const textos = ['Uno dice algo.', 'Dos dice algo.', 'Tres dice algo.', 'Cuatro dice algo.', 'Cinco dice algo.'];
  let e = crearPartida({ semilla: 1 });
  for (const t of textos) e = (await turnoIa(e, httpFalso([t]))).estado;
  assert.deepEqual(e.ventanaAperturasIa, ['uno dice', 'dos dice', 'tres dice', 'cuatro dice', 'cinco dice']);
  // Repite la de hace 4 respuestas ("dos dice") y hay alternativa: se usa la alternativa.
  const conAlternativa = await turnoIa(e, httpFalso(['Dos dice otra cosa.', 'Seis dice algo.']));
  assert.equal(conAlternativa.texto, 'Seis dice algo.');
  // Sin alternativa (la IA repite las dos veces): se acepta la primera y no se pide una tercera.
  const http = httpFalso(['Tres dice otra cosa.', 'Tres dice lo mismo.']);
  const sinAlternativa = await turnoIa(conAlternativa.estado, http);
  assert.equal(sinAlternativa.texto, 'Tres dice otra cosa.');
  assert.equal(http.llamadas.length, 2);
});

test('la línea de aperturas a evitar es lo primero que sale si el contexto no entra', () => {
  const base = { escena: { nombre: 'Mercado', estado: 'normal' }, frase: 'hola', evitarAperturas: ['que necesitas'] };
  assert.match(armarContexto(base).texto, /no arranques con "que necesitas"/);
  const largo = { ...base, escena: { ...base.escena, descripcion: 'x '.repeat(400) } };
  let r = null;
  try { r = armarContexto(largo); } catch (e) { r = e; }
  if (!(r instanceof Error)) assert.doesNotMatch(r.texto, /no arranques/);
});

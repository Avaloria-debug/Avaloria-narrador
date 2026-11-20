import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar } from './index.js';
import {
  pedirRespuestaIA, datosDeContexto, armarContexto, validarSalida, fuegoSinEvento,
  INSTRUCCION_FUEGO, MOTIVOS_IA, MOTIVOS_SALIDA,
} from './ia.js';
import { estadoInicial } from './estado.js';
import { leerContenido } from './cargarContenido.js';

const CLAVE = 'gsk_clave_secreta_de_prueba_123';
const AHORA = () => '2026-11-15T21:14:00Z';
const HUMO = 'No lo sé, pero el humo ya se siente.';
const MERCADO = 'escena_mercado_circular';
const INCENDIO = { id: 'evento_incendio_puesto', escenaId: MERCADO, turnosRestantes: 5, horaFin: null };
const texto = (t) => ({ tipo: 'texto', texto: t });
const ok = (content) => ({ status: 200, json: async () => ({ choices: [{ message: { content } }] }) });
const esperar = async () => {};
const httpCon = (content) => async () => ok(content);

let contenido;
before(async () => { contenido = await leerContenido(); });

const datos = (eventosActivos) => {
  const e = estadoInicial(contenido, { rng: () => 0.5 });
  return datosDeContexto({ ...e, eventosActivos }, contenido, { frase: 'hay alguien' });
};

// Lleva la partida a un turno que va a la IA, con los eventos activos indicados.
async function turnoIa(eventosActivos, respuesta) {
  const r1 = await narrar(crearPartida({ semilla: 1 }), texto('blablabla sin sentido'), { ahora: AHORA });
  assert.equal(r1.tipo, 'reformulacion');
  const estado = { ...r1.estado, eventosActivos };
  return narrar(estado, texto('hay alguien'), { groqKey: CLAVE, http: httpCon(respuesta), esperar, ahora: AHORA });
}

test('sin incendio activo, un texto con "humo" se rechaza y se usa la plantilla', async () => {
  const r = await pedirRespuestaIA({ groqKey: CLAVE, contexto: datos([]), http: httpCon(HUMO), esperar });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, MOTIVOS_IA.SALIDA_INVALIDA);
  assert.equal(r.detalle, MOTIVOS_SALIDA.FUEGO_SIN_EVENTO);
  const n = await turnoIa([], HUMO);
  assert.notEqual(n.tipo, 'dialogo_ia');
  assert.notEqual(n.texto, HUMO);
  assert.ok(n.errores.some((x) => x.includes(MOTIVOS_SALIDA.FUEGO_SIN_EVENTO)), n.errores.join('; '));
});

test('con evento_incendio_puesto activo en la escena, un texto con "humo" pasa', async () => {
  const r = await pedirRespuestaIA({ groqKey: CLAVE, contexto: datos([INCENDIO]), http: httpCon(HUMO), esperar });
  assert.equal(r.ok, true);
  assert.equal(r.texto, HUMO);
  const n = await turnoIa([INCENDIO], HUMO);
  assert.equal(n.tipo, 'dialogo_ia');
  assert.equal(n.texto, HUMO);
});

test('el incendio de otra escena no habilita el humo', async () => {
  const otra = { ...INCENDIO, escenaId: 'escena_plaza_cambistas' };
  const r = await pedirRespuestaIA({ groqKey: CLAVE, contexto: datos([otra]), http: httpCon(HUMO), esperar });
  assert.equal(r.detalle, MOTIVOS_SALIDA.FUEGO_SIN_EVENTO);
});

test('palabras de fuego: solo humo, fuego, incendio, llamas, quemar, como palabra entera', () => {
  for (const t of ['Hay humo.', 'Cuidado con el FUEGO.', 'Un incendio, dicen.', 'Mirá las llamas.', 'Lo van a quemar.']) {
    assert.equal(fuegoSinEvento(t, []), true, t);
    assert.equal(fuegoSinEvento(t, ['evento_incendio_puesto']), false, t);
  }
  for (const t of ['¿Cómo te llamás?', 'Es un humorista.', 'Se quemó el pan.', 'Hay una llama.', 'No lo sé, che.']) {
    assert.equal(fuegoSinEvento(t, []), false, t);
  }
});

test('el contexto lleva la instrucción de fuego y los eventos activos por nombre', () => {
  const sin = armarContexto(datos([]));
  assert.ok(sin.texto.includes(INSTRUCCION_FUEGO));
  assert.match(sin.texto, /Está pasando: nada fuera de lo común\./);
  assert.equal(sin.fuegoRecortado, false);
  const con = armarContexto(datos([INCENDIO]));
  assert.match(con.texto, /Está pasando: Incendio en un puesto\./);
  assert.ok(con.texto.includes(INSTRUCCION_FUEGO));
});

test('la validación de salida sin cambios: el humo no la afecta', () => {
  assert.equal(validarSalida(HUMO).ok, true);
  assert.equal(validarSalida('Hablá con serel_panadero.').motivo, MOTIVOS_SALIDA.ID);
});

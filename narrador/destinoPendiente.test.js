// Pregunta de destino pendiente: respuesta corta a "Hay más de un camino: …" (docs/SUPUESTOS.md).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ejecutarTurno } from './turno.js';
import { estadoInicial } from './estado.js';
import { responderDestino } from './comprension.js';
import { narrar, crearPartida, contenido as contenidoIndex } from './index.js';

const contenido = JSON.parse(readFileSync(new URL('../data/contenido/contenido-v3.json', import.meta.url), 'utf8'));
const rng = () => 0.5;


function enEscena(id) {
  const e = estadoInicial(contenido, { rng, nombre: 'Test' });
  return { ...e, jugador: { ...e.jugador, escenaId: id } };
}
const texto = (t) => ({ tipo: 'texto', texto: t });
const turno = (e, t) => ejecutarTurno(e, texto(t), { contenido, rng });

describe('respuesta a destino ambiguo', () => {
  test('el motor guarda las opciones de la última pregunta (ids, nombres, turno)', () => {
    const t = turno(enEscena('escena_mercado_circular'), 'salir de acá');
    assert.equal(t.motivo, 'destino_ambiguo');
    assert.deepEqual(t.estado.destinoPendiente.opciones, [
      { id: 'escena_archivo_real', nombre: 'Archivo Real' },
      { id: 'escena_camino_norte', nombre: 'Camino del norte' },
    ]);
    assert.equal(t.estado.destinoPendiente.turno, 1);
  });
  test('"norte" resuelve Camino del norte', () => {
    const p = turno(enEscena('escena_mercado_circular'), 'salir de acá');
    const t = turno(p.estado, 'norte');
    assert.equal(t.tipo, 'accion');
    assert.equal(t.accion.escenaNueva, 'escena_camino_norte');
    assert.equal(t.estado.destinoPendiente, null);
  });
  test('"Taberna de la campana tardía" resuelve la taberna (Plaza, 3 salidas)', () => {
    const p = turno(enEscena('escena_plaza_cambistas'), 'salir de acá');
    assert.equal(p.datos.opciones.length, 3);
    const t = turno(p.estado, 'Taberna de la campana tardía');
    assert.equal(t.tipo, 'accion');
    assert.equal(t.accion.escenaNueva, 'escena_taberna_lareth');
  });
  test('parte del nombre ("taberna") resuelve; "camino" coincide con dos y vuelve a preguntar con las mismas opciones', () => {
    const p = turno(enEscena('escena_plaza_cambistas'), 'salir de acá');
    assert.equal(turno(p.estado, 'taberna').accion.escenaNueva, 'escena_taberna_lareth');
    const t = turno(p.estado, 'camino');
    assert.equal(t.tipo, 'reformular');
    assert.equal(t.motivo, 'destino_repetido');
    assert.deepEqual(t.datos.opciones, p.datos.opciones);
    assert.deepEqual(t.estado.destinoPendiente.opciones, p.estado.destinoPendiente.opciones);
  });
  test('respuesta no válida reformula con las opciones, no con "no_entendido"', () => {
    const p = turno(enEscena('escena_mercado_circular'), 'salir de acá');
    const t = turno(p.estado, 'banana');
    assert.equal(t.tipo, 'reformular');
    assert.equal(t.motivo, 'destino_ambiguo');
    assert.deepEqual(t.datos.opciones, ['Archivo Real', 'Camino del norte']);
    // y sigue pendiente: un segundo intento válido funciona
    assert.equal(turno(t.estado, 'archivo').accion.escenaNueva, 'escena_archivo_real');
  });
  test('un turno intermedio que no es respuesta borra la pregunta', () => {
    const p = turno(enEscena('escena_mercado_circular'), 'salir de acá');
    const o = turno(p.estado, 'observar');
    assert.equal(o.estado.destinoPendiente, null);
    const t = turno(o.estado, 'norte');
    assert.equal(t.motivo, 'no_entendido');
  });
  test('sin pregunta pendiente, "norte" solo sigue sin entenderse', () => {
    assert.equal(turno(enEscena('escena_mercado_circular'), 'norte').motivo, 'no_entendido');
  });
  test('frase larga o vacía no es respuesta corta', () => {
    const op = [{ id: 'a', nombre: 'Camino del norte' }];
    assert.equal(responderDestino('', op).estado, 'ninguna');
    assert.equal(responderDestino('norte norte norte norte norte norte norte norte norte', op).estado, 'ninguna');
  });
});

describe('pregunta pendiente: texto de repetición y bloqueo de IA', () => {
  test('"camino" en Plaza da exactamente "No me quedó claro. Hay más de un camino: …"', async () => {
    let e = { ...crearPartida({ nombre: 'T' }) };
    e = { ...e, jugador: { ...e.jugador, escenaId: 'escena_plaza_cambistas' } };
    const p = await narrar(e, texto('salir de acá'));
    const r = await narrar(p.estado, texto('camino'));
    assert.equal(r.tipo, 'reformulacion');
    assert.equal(r.texto, 'No me quedó claro. Hay más de un camino: Taberna de la Campana Tardía, Camino del norte o Camino del este. ¿Por cuál vas?');
    assert.deepEqual(contenidoIndex.plantillas.reformulacion.destino_repetido, ['No me quedó claro. Hay más de un camino: {opciones}. ¿Por cuál vas?']);
    assert.equal(r.estado.destinoPendiente.opciones.length, 3); // sigue pendiente
  });
  test('frase sin sentido con pregunta pendiente: repite la pregunta y no llama a la IA (ni con reformulación previa)', async () => {
    const llamadas = [];
    const http = async (...a) => { llamadas.push(a); throw new Error('no debería llamarse'); };
    let e = crearPartida({ nombre: 'T' });
    e = { ...e, jugador: { ...e.jugador, escenaId: 'escena_mercado_circular' } };
    let r = await narrar(e, texto('salir de acá'), { groqKey: 'gsk_clave_de_prueba_123', http });
    for (const frase of ['xyzzy plugh', 'otra cosa sin sentido alguno', 'blablabla']) {
      r = await narrar(r.estado, texto(frase), { groqKey: 'gsk_clave_de_prueba_123', http });
      assert.equal(r.tipo, 'reformulacion');
      assert.equal(r.texto, 'Hay más de un camino: Archivo Real o Camino del norte. ¿Por cuál vas?');
    }
    assert.equal(llamadas.length, 0);
  });
  test('sin pregunta pendiente, la segunda frase sin sentido sí pasa a IA (regla anterior intacta)', () => {
    const e = enEscena('escena_mercado_circular');
    const a = turno(e, 'xyzzy plugh');
    assert.equal(a.tipo, 'reformular');
    assert.equal(turno(a.estado, 'plugh xyzzy').tipo, 'ia');
  });
});

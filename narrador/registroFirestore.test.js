import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearAdaptadorFirestore, crearColaFirestore, crearFirestoreEnMemoria, erroresDeEnvio,
  ErrorRegistroInvalido, COLECCION_REGISTROS, LIMITES, idDeDocumento,
} from './registroFirestore.js';
import { crearRegistro } from './registro.js';
import { crearPartida, narrar } from './index.js';

const registro = (numero, cambios = {}) => ({
  ...crearRegistro({
    numero,
    fecha: '2026-11-15T21:14:00Z',
    escena: 'escena_de_prueba',
    estadoEscena: 'neutro',
    ultimosTurnos: [],
    textoJugador: `frase ${numero}`,
    ruta: 'grupo_1',
    intencionDetectada: 'intencion_de_prueba',
    origenRespuesta: 'codigo',
    respuestaMostrada: 'respuesta de prueba',
  }),
  ...cambios,
});

const PARTIDA = 'ABCDEF';
const OTRA = 'XYZ234';

describe('registroFirestore — adaptador', () => {
  test('no crea el cliente solo: sin cliente o sin código de partida válido, lanza', () => {
    assert.throws(() => crearAdaptadorFirestore(), TypeError);
    assert.throws(() => crearAdaptadorFirestore({ db: {} }, { codigoPartida: PARTIDA }), TypeError);
    assert.throws(() => crearAdaptadorFirestore(crearFirestoreEnMemoria()), TypeError);
    assert.throws(() => crearAdaptadorFirestore(crearFirestoreEnMemoria(), { codigoPartida: 'abc' }), TypeError);
  });

  test('id del documento: reg_<codigoPartida>_<número de 6 dígitos>', () => {
    assert.equal(idDeDocumento(PARTIDA, 'reg_000123'), 'reg_ABCDEF_000123');
    assert.throws(() => idDeDocumento('OIL001', 'reg_000123'), RangeError);
    assert.throws(() => idDeDocumento(PARTIDA, 'otra_cosa'), RangeError);
  });

  test('registro válido se envía con el id reg_ABCDEF_000123', async () => {
    const fs = crearFirestoreEnMemoria();
    const adaptador = crearAdaptadorFirestore(fs, { codigoPartida: PARTIDA });
    const r = registro(123);
    assert.equal(await adaptador.enviar(r), 'reg_ABCDEF_000123');
    assert.deepEqual(Object.keys(fs.coleccion(COLECCION_REGISTROS)), ['reg_ABCDEF_000123']);
    assert.deepEqual(fs.coleccion('registros').reg_ABCDEF_000123, { ...r, id: 'reg_ABCDEF_000123' });
  });

  test('dos partidas con el mismo numeroRegistro generan ids distintos', async () => {
    const fs = crearFirestoreEnMemoria();
    const una = crearColaFirestore(fs, { codigoPartida: PARTIDA });
    const otra = crearColaFirestore(fs, { codigoPartida: OTRA });
    una.agregar(registro(1, { texto_jugador: 'de la primera' }));
    otra.agregar(registro(1, { texto_jugador: 'de la segunda' }));
    assert.deepEqual(await una.enviarPendientes(), { enviados: 1, pendientes: 0, error: null });
    assert.deepEqual(await otra.enviarPendientes(), { enviados: 1, pendientes: 0, error: null });
    const docs = fs.coleccion('registros');
    assert.deepEqual(Object.keys(docs), ['reg_ABCDEF_000001', 'reg_XYZ234_000001']);
    assert.equal(docs.reg_ABCDEF_000001.texto_jugador, 'de la primera');
    assert.equal(docs.reg_XYZ234_000001.texto_jugador, 'de la segunda');
    assert.deepEqual([una.fallidos(), otra.fallidos()], [[], []]);
  });

  test('registro inválido: enviar rechaza y no escribe', async () => {
    const fs = crearFirestoreEnMemoria();
    const adaptador = crearAdaptadorFirestore(fs, { codigoPartida: PARTIDA });
    for (const malo of [
      registro(1, { ruta: 'grupo_9' }),
      registro(1, { revision: 'aprobada' }),
      registro(1, { notas: 'algo' }),
      registro(1, { extra: 1 }),
      registro(1, { texto_jugador: 'a'.repeat(LIMITES.textoJugadorBytes + 1) }),
      registro(1, { id: 'otra_cosa' }),
      null,
      'texto',
    ]) {
      await assert.rejects(adaptador.enviar(malo), ErrorRegistroInvalido);
    }
    assert.equal(fs.escrituras(), 0);
    assert.deepEqual(erroresDeEnvio(registro(1)), []);
  });

  test('enviarLote: envía los válidos e informa los que fallaron, sin rechazar', async () => {
    const fs = crearFirestoreEnMemoria();
    const adaptador = crearAdaptadorFirestore(fs, { codigoPartida: PARTIDA });
    fs.fallarSi((ref) => ref.id === 'reg_ABCDEF_000003');
    const r = await adaptador.enviarLote([registro(1), registro(2, { ruta: 'x' }), registro(3), registro(4)]);
    assert.deepEqual(r.enviados, ['reg_ABCDEF_000001', 'reg_ABCDEF_000004']);
    assert.deepEqual(r.fallidos.map((f) => [f.id, f.invalido, f.permanente]), [['reg_000002', true, true], ['reg_000003', false, false]]);
    assert.match(r.fallidos[0].motivo, /ruta/);
    assert.deepEqual(Object.keys(fs.coleccion('registros')), ['reg_ABCDEF_000001', 'reg_ABCDEF_000004']);
  });

  test('already-exists de Firestore cuenta como enviado; permission-denied es permanente', async () => {
    const cliente = (code) => ({ db: {}, doc: () => ({}), setDoc: async () => { throw Object.assign(new Error(code), { code }); } });
    assert.equal(await crearAdaptadorFirestore(cliente('already-exists'), { codigoPartida: PARTIDA }).enviar(registro(1)), 'reg_ABCDEF_000001');
    await assert.rejects(crearAdaptadorFirestore(cliente('permission-denied'), { codigoPartida: PARTIDA }).enviar(registro(1)), (e) => e.permanente === true);
    await assert.rejects(crearAdaptadorFirestore(cliente('unavailable'), { codigoPartida: PARTIDA }).enviar(registro(1)), (e) => e.permanente !== true);
  });
});

describe('registroFirestore — cola conectada', () => {
  test('registro inválido: pasa a fallidos con motivo, no se envía y no traba a los siguientes', async () => {
    const fs = crearFirestoreEnMemoria();
    const cola = crearColaFirestore(fs, { codigoPartida: PARTIDA });
    const malo = registro(1, { origen_respuesta: 'jugador' });
    cola.agregar(malo);
    cola.agregar(registro(2));
    cola.agregar(registro(3));
    assert.deepEqual(await cola.enviarPendientes(), { enviados: 2, pendientes: 0, error: null });
    assert.deepEqual(Object.keys(fs.coleccion('registros')), ['reg_ABCDEF_000002', 'reg_ABCDEF_000003']);
    assert.deepEqual(cola.pendientes(), []);
    const [fallido, ...resto] = cola.fallidos();
    assert.deepEqual(resto, []);
    assert.equal(fallido.id, 'reg_000001');
    assert.match(fallido.motivo, /origen_respuesta/);
    assert.deepEqual(fallido.registro, malo);
    assert.equal(fs.escrituras(), 2);
    // No se reenvía solo.
    assert.deepEqual(await cola.enviarPendientes(), { enviados: 0, pendientes: 0, error: null });
    assert.equal(fs.escrituras(), 2);
  });

  test('registro rechazado por una regla: pasa a fallidos y no traba a los siguientes', async () => {
    const fs = crearFirestoreEnMemoria();
    // Ya hay un documento distinto con ese id: Firestore lo rechaza con permission-denied.
    await crearAdaptadorFirestore(fs, { codigoPartida: PARTIDA }).enviar(registro(1, { texto_jugador: 'otro texto' }));
    const cola = crearColaFirestore(fs, { codigoPartida: PARTIDA });
    for (const n of [1, 2, 3]) cola.agregar(registro(n));
    assert.deepEqual(await cola.enviarPendientes(), { enviados: 2, pendientes: 0, error: null });
    assert.deepEqual(cola.fallidos().map((f) => [f.id, f.motivo]), [['reg_000001', 'rechazado por Firestore: permission-denied']]);
    assert.equal(fs.coleccion('registros').reg_ABCDEF_000001.texto_jugador, 'otro texto');
    assert.deepEqual(Object.keys(fs.coleccion('registros')), ['reg_ABCDEF_000001', 'reg_ABCDEF_000002', 'reg_ABCDEF_000003']);
    // Los fallidos se pueden devolver a la cola a mano.
    assert.equal(cola.reintentarFallidos(), 1);
    assert.deepEqual(cola.fallidos(), []);
    assert.equal(cola.pendientes().length, 1);
  });

  test('fallo de red: el registro queda en cola y se reenvía en el siguiente lote', async () => {
    const fs = crearFirestoreEnMemoria();
    const cola = crearColaFirestore(fs, { codigoPartida: PARTIDA });
    cola.agregar(registro(1));
    fs.fallarProximas(1);
    const primero = await cola.enviarPendientes();
    assert.deepEqual(primero, { enviados: 0, pendientes: 1, error: 'unavailable' });
    assert.deepEqual(cola.motivosPendientes(), [{ id: 'reg_000001', motivo: 'unavailable' }]);
    assert.deepEqual(cola.fallidos(), []);
    assert.deepEqual(fs.coleccion('registros'), {});
    const segundo = await cola.enviarPendientes();
    assert.deepEqual(segundo, { enviados: 1, pendientes: 0, error: null });
    assert.deepEqual(cola.motivosPendientes(), []);
    assert.deepEqual(Object.keys(fs.coleccion('registros')), ['reg_ABCDEF_000001']);
  });

  test('un reintento de un registro ya enviado cuenta como enviado', async () => {
    const fs = crearFirestoreEnMemoria();
    const cola = crearColaFirestore(fs, { codigoPartida: PARTIDA });
    cola.agregar(registro(1));
    cola.agregar(registro(2));
    // El primero llega a Firestore, pero la respuesta se pierde.
    fs.perderRespuestas(1);
    assert.deepEqual(await cola.enviarPendientes(), { enviados: 0, pendientes: 2, error: 'unavailable' });
    assert.deepEqual(Object.keys(fs.coleccion('registros')), ['reg_ABCDEF_000001']);
    assert.deepEqual(await cola.enviarPendientes(), { enviados: 2, pendientes: 0, error: null });
    assert.deepEqual(cola.fallidos(), []);
    assert.equal(cola.totalEnviados(), 2);
    assert.deepEqual(Object.keys(fs.coleccion('registros')), ['reg_ABCDEF_000001', 'reg_ABCDEF_000002']);
  });

  test('sin pérdida: N registros encolados, algunos fallan, al final están todos enviados', async () => {
    const fs = crearFirestoreEnMemoria();
    const cola = crearColaFirestore(fs, { codigoPartida: PARTIDA });
    const N = 25;
    const originales = [];
    for (let i = 1; i <= N; i++) {
      originales.push(registro(i));
      cola.agregar(originales.at(-1));
    }
    // Una de cada tres escrituras falla, y algunas respuestas se pierden.
    fs.fallarSi((_ref, _datos, n) => n % 3 === 0);
    fs.perderRespuestas(4);
    let lotes = 0;
    while (cola.pendientes().length > 0) {
      await cola.enviarPendientes();
      assert.ok(++lotes < 100, 'la cola no se vacía');
    }
    assert.ok(lotes > 1);
    assert.equal(cola.totalEnviados(), N);
    assert.deepEqual(cola.fallidos(), []);
    const enviados = fs.coleccion('registros');
    assert.equal(Object.keys(enviados).length, N);
    for (const r of originales) {
      const id = idDeDocumento(PARTIDA, r.id);
      assert.deepEqual(enviados[id], { ...r, id });
    }
  });
});

describe('registroFirestore — narrar', () => {
  const AHORA = () => '2026-11-15T21:14:00Z';

  test('narrar() encola el registro del turno, y la cola lo envía', async () => {
    const fs = crearFirestoreEnMemoria();
    const cola = crearColaFirestore(fs, { codigoPartida: PARTIDA });
    let estado = crearPartida({ semilla: 1 });
    const registros = [];
    for (const texto of ['blablabla sin sentido', 'mirar alrededor', 'otra cosa rara']) {
      const r = await narrar(estado, { tipo: 'texto', texto }, { ahora: AHORA, cola });
      assert.ok(r.registro, 'un turno con texto libre tiene registro');
      registros.push(r.registro);
      estado = r.estado;
    }
    assert.deepEqual(cola.pendientes(), registros);
    assert.equal(fs.escrituras(), 0, 'narrar encola, no envía');
    await cola.enviarPendientes();
    assert.deepEqual(Object.values(fs.coleccion('registros')), registros.map((r) => ({ ...r, id: idDeDocumento(PARTIDA, r.id) })));
    assert.deepEqual(Object.keys(fs.coleccion('registros')), ['reg_ABCDEF_000001', 'reg_ABCDEF_000002', 'reg_ABCDEF_000003']);
  });

  test('un botón no encola nada, y una cola que falla no hace lanzar a narrar', async () => {
    const cola = crearColaFirestore(crearFirestoreEnMemoria(), { codigoPartida: PARTIDA });
    const estado = crearPartida({ semilla: 1 });
    const intencion = (await narrar(estado, { tipo: 'texto', texto: 'mirar alrededor' }, { ahora: AHORA })).registro?.intencion_detectada;
    if (intencion) {
      await narrar(estado, { tipo: 'boton', intencionId: intencion }, { ahora: AHORA, cola });
      assert.deepEqual(cola.pendientes(), []);
    }
    const rota = { agregar() { throw new Error('cola rota'); } };
    const r = await narrar(estado, { tipo: 'texto', texto: 'blablabla' }, { ahora: AHORA, cola: rota });
    assert.ok(r.registro);
    assert.ok(r.errores.some((e) => e.includes('cola rota')));
  });
});

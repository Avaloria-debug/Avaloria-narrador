import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearAdaptadorFirestore, crearColaFirestore, crearFirestoreEnMemoria, erroresDeEnvio,
  ErrorRegistroInvalido, COLECCION_REGISTROS, LIMITES,
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

describe('registroFirestore — adaptador', () => {
  test('no crea el cliente solo: sin cliente, lanza', () => {
    assert.throws(() => crearAdaptadorFirestore(), TypeError);
    assert.throws(() => crearAdaptadorFirestore({ db: {} }), TypeError);
  });

  test('registro válido se envía con el id reg_000123', async () => {
    const fs = crearFirestoreEnMemoria();
    const adaptador = crearAdaptadorFirestore(fs);
    const r = registro(123);
    await adaptador.enviar(r);
    assert.deepEqual(Object.keys(fs.coleccion(COLECCION_REGISTROS)), ['reg_000123']);
    assert.deepEqual(fs.coleccion('registros').reg_000123, r);
  });

  test('registro inválido: enviar rechaza y no escribe', async () => {
    const fs = crearFirestoreEnMemoria();
    const adaptador = crearAdaptadorFirestore(fs);
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
    const adaptador = crearAdaptadorFirestore(fs);
    fs.fallarSi((ref) => ref.id === 'reg_000003');
    const r = await adaptador.enviarLote([registro(1), registro(2, { ruta: 'x' }), registro(3), registro(4)]);
    assert.deepEqual(r.enviados, ['reg_000001', 'reg_000004']);
    assert.deepEqual(r.fallidos.map((f) => [f.id, f.invalido]), [['reg_000002', true], ['reg_000003', false]]);
    assert.match(r.fallidos[0].motivo, /ruta/);
    assert.deepEqual(Object.keys(fs.coleccion('registros')), ['reg_000001', 'reg_000004']);
  });
});

describe('registroFirestore — cola conectada', () => {
  test('registro inválido queda en cola con motivo, no se envía, y no frena a los demás', async () => {
    const fs = crearFirestoreEnMemoria();
    const cola = crearColaFirestore(fs);
    cola.agregar(registro(1, { origen_respuesta: 'jugador' }));
    cola.agregar(registro(2));
    const r = await cola.enviarPendientes();
    assert.deepEqual(r, { enviados: 1, pendientes: 1, error: null });
    assert.deepEqual(Object.keys(fs.coleccion('registros')), ['reg_000002']);
    assert.deepEqual(cola.pendientes().map((p) => p.id), ['reg_000001']);
    const [motivo] = cola.motivosPendientes();
    assert.equal(motivo.id, 'reg_000001');
    assert.match(motivo.motivo, /origen_respuesta/);
    assert.equal(fs.escrituras(), 1);
  });

  test('fallo de red: el registro queda en cola y se reenvía en el siguiente lote', async () => {
    const fs = crearFirestoreEnMemoria();
    const cola = crearColaFirestore(fs);
    cola.agregar(registro(1));
    fs.fallarProximas(1);
    const primero = await cola.enviarPendientes();
    assert.deepEqual(primero, { enviados: 0, pendientes: 1, error: 'unavailable' });
    assert.deepEqual(cola.motivosPendientes(), [{ id: 'reg_000001', motivo: 'unavailable' }]);
    assert.deepEqual(fs.coleccion('registros'), {});
    const segundo = await cola.enviarPendientes();
    assert.deepEqual(segundo, { enviados: 1, pendientes: 0, error: null });
    assert.deepEqual(cola.motivosPendientes(), []);
    assert.deepEqual(Object.keys(fs.coleccion('registros')), ['reg_000001']);
  });

  test('sin pérdida: N registros encolados, algunos fallan, al final están todos enviados', async () => {
    const fs = crearFirestoreEnMemoria();
    const cola = crearColaFirestore(fs);
    const N = 25;
    const originales = [];
    for (let i = 1; i <= N; i++) {
      originales.push(registro(i));
      cola.agregar(originales.at(-1));
    }
    // Una de cada tres escrituras falla.
    fs.fallarSi((_ref, _datos, n) => n % 3 === 0);
    let lotes = 0;
    while (cola.pendientes().length > 0) {
      await cola.enviarPendientes();
      assert.ok(++lotes < 100, 'la cola no se vacía');
    }
    assert.ok(lotes > 1);
    assert.equal(cola.totalEnviados(), N);
    const enviados = fs.coleccion('registros');
    assert.equal(Object.keys(enviados).length, N);
    for (const r of originales) assert.deepEqual(enviados[r.id], r);
  });
});

describe('registroFirestore — narrar', () => {
  const AHORA = () => '2026-11-15T21:14:00Z';

  test('narrar() encola el registro del turno, y la cola lo envía', async () => {
    const fs = crearFirestoreEnMemoria();
    const cola = crearColaFirestore(fs);
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
    assert.deepEqual(Object.values(fs.coleccion('registros')), registros);
    assert.deepEqual(Object.keys(fs.coleccion('registros')), ['reg_000001', 'reg_000002', 'reg_000003']);
  });

  test('un botón no encola nada, y una cola que falla no hace lanzar a narrar', async () => {
    const cola = crearColaFirestore(crearFirestoreEnMemoria());
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

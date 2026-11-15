// Pruebas de firestore.rules para la colección `registros`, con el emulador de Firestore.
// Sin emulador (sin FIRESTORE_EMULATOR_HOST) se saltean: `npm test` sigue en verde.
// Cómo correrlas (las dependencias no están en package.json):
//   npm install --no-save firebase-tools firebase @firebase/rules-unit-testing
//   npx firebase emulators:exec --only firestore --project demo-avaloria "node --test tests/reglas/registros.rules.test.js"
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const ADMIN_UID = 'REEMPLAZAR_POR_TU_UID';

const registro = (numero = 123, cambios = {}) => ({
  id: `reg_ABCDEF_${String(numero).padStart(6, '0')}`,
  fecha: '2026-11-15T21:14:00',
  escena: 'escena_de_prueba',
  estado_escena: 'neutro',
  ultimos_turnos: ['Hablar con alguien'],
  texto_jugador: 'texto exacto que escribió el jugador',
  ruta: 'grupo_1',
  intento_reformulacion: false,
  intencion_detectada: 'intencion_de_prueba',
  origen_respuesta: 'codigo',
  respuesta_mostrada: 'texto exacto que vio el jugador',
  revision: 'pendiente',
  notas: '',
  contaminacion: false,
  ...cambios,
});
const sin = (objeto, campo) => Object.fromEntries(Object.entries(objeto).filter(([k]) => k !== campo));

describe('reglas — registros', { skip: HOST ? false : 'sin emulador de Firestore (FIRESTORE_EMULATOR_HOST)' }, () => {
  let entorno;
  let pruebas;
  let fs;
  const anonimo = () => entorno.authenticatedContext('jugador_anonimo', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const admin = () => entorno.authenticatedContext(ADMIN_UID).firestore();
  const sinSesion = () => entorno.unauthenticatedContext().firestore();
  const crear = (db, r, id = r.id) => fs.setDoc(fs.doc(db, 'registros', id), r);

  before(async () => {
    pruebas = await import('@firebase/rules-unit-testing');
    fs = await import('firebase/firestore');
    const [host, puerto] = HOST.split(':');
    entorno = await pruebas.initializeTestEnvironment({
      projectId: 'demo-avaloria',
      firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host, port: Number(puerto) },
    });
  });
  after(async () => {
    await entorno?.cleanup();
  });
  beforeEach(async () => {
    await entorno.clearFirestore();
  });

  test('create: con sesión anónima y un registro válido', async () => {
    await pruebas.assertSucceeds(crear(anonimo(), registro()));
    await pruebas.assertSucceeds(crear(anonimo(), registro(2, { intencion_detectada: null, ultimos_turnos: [] })));
    await pruebas.assertSucceeds(crear(anonimo(), registro(3, { ruta: 'grupo_2', origen_respuesta: 'ia', intencion_detectada: null })));
  });

  test('create: sin sesión, no', async () => {
    await pruebas.assertFails(crear(sinSesion(), registro()));
  });

  test('create: el id del documento es reg_<codigoPartida>_<número> y coincide con el campo id', async () => {
    await pruebas.assertFails(crear(anonimo(), registro(), 'reg_ABCDEF_000999'));
    for (const id of ['otra_cosa', 'reg_000123', 'reg_ABCDEF_12', 'reg_ABCDE_000123', 'reg_abcdef_000123', 'reg_ABCDE1_000123', 'reg_ABCDEO_000123', 'reg_ABCDEF_000123_x']) {
      await pruebas.assertFails(crear(anonimo(), registro(1, { id }), id));
    }
  });

  test('create: dos partidas con el mismo número de registro no chocan', async () => {
    await pruebas.assertSucceeds(crear(anonimo(), registro(1)));
    await pruebas.assertSucceeds(crear(anonimo(), registro(1, { id: 'reg_XYZ234_000001', texto_jugador: 'otra partida' })));
  });

  test('create: campos de más o de menos, no', async () => {
    await pruebas.assertFails(crear(anonimo(), registro(1, { groqKey: 'gsk_x' })));
    for (const campo of Object.keys(registro())) {
      if (campo === 'id') continue;
      await pruebas.assertFails(crear(anonimo(), sin(registro(), campo)));
    }
  });

  test('create: tipos y valores fuera del esquema, no', async () => {
    const malos = [
      { fecha: '15/11/2026' }, { fecha: 5 }, { escena: '' }, { escena: 7 }, { estado_escena: null },
      { ultimos_turnos: 'uno' }, { ultimos_turnos: [1] }, { ultimos_turnos: ['a', 'b', 'c', 'd'] },
      { ultimos_turnos: ['a'.repeat(201)] }, { texto_jugador: '' }, { texto_jugador: 9 }, { ruta: 'grupo_3' },
      { intento_reformulacion: 'no' }, { intencion_detectada: 4 }, { intencion_detectada: '' },
      { origen_respuesta: 'jugador' }, { origen_respuesta: 'ia' },
      { ruta: 'grupo_2', origen_respuesta: 'ia' }, { respuesta_mostrada: '' }, { respuesta_mostrada: [] },
      { revision: 'aprobada' }, { notas: 'nota del jugador' }, { contaminacion: 'si' },
    ];
    for (const cambios of malos) await pruebas.assertFails(crear(anonimo(), registro(1, cambios)));
  });

  test('create: tamaño acotado (el documento queda por debajo de 16 KB)', async () => {
    await pruebas.assertSucceeds(crear(anonimo(), registro(1, { texto_jugador: 'a'.repeat(6000), respuesta_mostrada: 'b'.repeat(4000) })));
    await pruebas.assertFails(crear(anonimo(), registro(2, { texto_jugador: 'a'.repeat(6001) })));
    await pruebas.assertFails(crear(anonimo(), registro(3, { texto_jugador: 'ñ'.repeat(3001) })));
    await pruebas.assertFails(crear(anonimo(), registro(4, { respuesta_mostrada: 'b'.repeat(4001) })));
    await pruebas.assertFails(crear(anonimo(), registro(5, { texto_jugador: 'a'.repeat(16 * 1024) })));
  });

  test('read: solo el administrador', async () => {
    await entorno.withSecurityRulesDisabled((ctx) => crear(ctx.firestore(), registro()));
    await pruebas.assertSucceeds(fs.getDoc(fs.doc(admin(), 'registros', 'reg_ABCDEF_000123')));
    await pruebas.assertSucceeds(fs.getDocs(fs.collection(admin(), 'registros')));
    await pruebas.assertFails(fs.getDoc(fs.doc(anonimo(), 'registros', 'reg_ABCDEF_000123')));
    await pruebas.assertFails(fs.getDocs(fs.collection(anonimo(), 'registros')));
    await pruebas.assertFails(fs.getDoc(fs.doc(sinSesion(), 'registros', 'reg_ABCDEF_000123')));
  });

  test('update y delete: nadie, ni el administrador', async () => {
    await entorno.withSecurityRulesDisabled((ctx) => crear(ctx.firestore(), registro()));
    for (const db of [anonimo(), admin(), sinSesion()]) {
      await pruebas.assertFails(crear(db, registro(123, { texto_jugador: 'otro texto' })));
      await pruebas.assertFails(crear(db, registro(123, { contaminacion: true })));
      await pruebas.assertFails(fs.updateDoc(fs.doc(db, 'registros', 'reg_ABCDEF_000123'), { revision: 'aprobada' }));
      await pruebas.assertFails(fs.deleteDoc(fs.doc(db, 'registros', 'reg_ABCDEF_000123')));
    }
  });

  test('reenviar el mismo registro, idéntico, se acepta y no cambia nada (solo con sesión)', async () => {
    await pruebas.assertSucceeds(crear(anonimo(), registro()));
    await pruebas.assertSucceeds(crear(anonimo(), registro()));
    await pruebas.assertFails(crear(sinSesion(), registro()));
    const leido = await fs.getDoc(fs.doc(admin(), 'registros', 'reg_ABCDEF_000123'));
    assert.deepEqual(leido.data(), registro());
  });

  test('el adaptador del narrador, con el SDK real, pasa las reglas', async () => {
    const { crearColaFirestore } = await import('../../narrador/registroFirestore.js');
    const { crearPartida, narrar } = await import('../../narrador/index.js');
    const cliente = { db: anonimo(), doc: fs.doc, setDoc: fs.setDoc };
    const cola = crearColaFirestore(cliente, { codigoPartida: 'ABCDEF' });
    let estado = crearPartida({ semilla: 1 });
    for (const texto of ['blablabla sin sentido', 'mirar alrededor', 'ñandú ¿qué?']) {
      estado = (await narrar(estado, { tipo: 'texto', texto }, { cola })).estado;
    }
    assert.deepEqual(await cola.enviarPendientes(), { enviados: 3, pendientes: 0, error: null });
    const leidos = await fs.getDocs(fs.collection(admin(), 'registros'));
    assert.deepEqual(leidos.docs.map((d) => d.id), ['reg_ABCDEF_000001', 'reg_ABCDEF_000002', 'reg_ABCDEF_000003']);
    // Reintento de uno ya enviado: cuenta como enviado. Uno distinto con el mismo id: rechazo permanente, a fallidos.
    const { crearRegistro } = await import('../../narrador/registro.js');
    const otro = (numero) => crearRegistro({
      numero, fecha: '2026-11-15T21:14:00Z', escena: 'escena_de_prueba', estadoEscena: 'neutro', textoJugador: 'otro texto',
      ruta: 'grupo_1', intencionDetectada: null, origenRespuesta: 'codigo', respuestaMostrada: 'respuesta',
    });
    const segunda = crearColaFirestore(cliente, { codigoPartida: 'ABCDEF' });
    segunda.agregar(leidos.docs[0].data() && { ...leidos.docs[0].data(), id: 'reg_000001' });
    segunda.agregar(otro(2));
    segunda.agregar(otro(4));
    assert.deepEqual(await segunda.enviarPendientes(), { enviados: 2, pendientes: 0, error: null });
    assert.deepEqual(segunda.fallidos().map((f) => [f.id, f.motivo]), [['reg_000002', 'rechazado por Firestore: permission-denied']]);
  });

  test('partidas: las reglas que ya existían siguen igual', async () => {
    const partida = { versionEsquema: 1, codigoPartida: 'ABCDEF', ultimaModificacion: 1 };
    await pruebas.assertSucceeds(fs.setDoc(fs.doc(anonimo(), 'partidas', 'ABCDEF'), partida));
    await pruebas.assertSucceeds(fs.getDoc(fs.doc(anonimo(), 'partidas', 'ABCDEF')));
    await pruebas.assertFails(fs.setDoc(fs.doc(sinSesion(), 'partidas', 'ABCDEF'), partida));
    await pruebas.assertFails(fs.deleteDoc(fs.doc(anonimo(), 'partidas', 'ABCDEF')));
  });
});

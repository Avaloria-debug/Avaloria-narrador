import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { abrirPersistenciaCasos, STORES, NOMBRE_BD, VERSION_ESQUEMA } from './persistencia.js';

const V = 'v3.1';
const abrir = (indexedDB, versionContenido = V) => abrirPersistenciaCasos({ indexedDB, versionContenido });

const ESTADO = {
  casoId: 'caso_07',
  firma: 'p1=conocimiento_a|p2=conocimiento_c|p3=conocimiento_e',
  pistas: [{ ranura: 'p1', conocimientoId: 'conocimiento_a', npcId: 'maren_archivista', orden: 1 }],
  semilla: 7,
  contadorHitos: 3,
  hitoPrevio: { hora: 34, escena: 'escena_archivo_real', contador: 3, turno: 21 },
  tags: [{ tipo: 'rencor', objetivo: 'maren_archivista', nivel: 2, creadoHora: 34, creadoHito: 3, casoId: 'caso_07', origen: 'accion:amenazar' }],
  textosUsados: ['h1_t2'],
};

describe('persistencia de casos: base', () => {
  test('crea los seis stores con su clave', async () => {
    const idb = new IDBFactory();
    const bd = await abrir(idb);
    bd.cerrar();
    const cruda = await new Promise((ok, mal) => {
      const p = idb.open(NOMBRE_BD);
      p.onsuccess = () => ok(p.result);
      p.onerror = () => mal(p.error);
    });
    assert.equal(cruda.version, VERSION_ESQUEMA);
    assert.deepEqual([...cruda.objectStoreNames].sort(), Object.keys(STORES).sort());
    const tx = cruda.transaction([...cruda.objectStoreNames]);
    for (const [nombre, clave] of Object.entries(STORES)) {
      assert.deepEqual(tx.objectStore(nombre).keyPath, clave, nombre);
    }
    cruda.close();
  });

  test('sin indexedDB o sin versionContenido: error', async () => {
    await assert.rejects(abrirPersistenciaCasos({ indexedDB: null, versionContenido: V }), /indexedDB/);
    await assert.rejects(abrirPersistenciaCasos({ indexedDB: new IDBFactory() }), /versionContenido/);
  });
});

describe('persistencia de casos: estado del caso', () => {
  test('guardar, cerrar, reabrir, leer igual', async () => {
    const idb = new IDBFactory();
    let bd = await abrir(idb);
    await bd.guardarEstadoCaso('partida_1', ESTADO);
    bd.cerrar();

    bd = await abrir(idb);
    const leido = await bd.leerEstadoCaso('partida_1');
    assert.deepEqual(leido.estado, ESTADO);
    assert.notEqual(leido.estado, ESTADO);
    assert.equal(leido.versionContenido, V);
    assert.equal(leido.compatible, true);
    bd.cerrar();
  });

  test('partida sin estado: null; cada partida tiene el suyo', async () => {
    const bd = await abrir(new IDBFactory());
    assert.equal(await bd.leerEstadoCaso('partida_1'), null);
    await bd.guardarEstadoCaso('partida_1', ESTADO);
    await bd.guardarEstadoCaso('partida_2', { ...ESTADO, casoId: 'caso_03' });
    assert.equal((await bd.leerEstadoCaso('partida_1')).estado.casoId, 'caso_07');
    assert.equal((await bd.leerEstadoCaso('partida_2')).estado.casoId, 'caso_03');
    bd.cerrar();
  });

  test('guardar de nuevo reemplaza', async () => {
    const bd = await abrir(new IDBFactory());
    await bd.guardarEstadoCaso('partida_1', ESTADO);
    await bd.guardarEstadoCaso('partida_1', { ...ESTADO, contadorHitos: 4 });
    assert.equal((await bd.leerEstadoCaso('partida_1')).estado.contadorHitos, 4);
    bd.cerrar();
  });

  test('guardado con otra versión del contenido: se lee marcado como incompatible', async () => {
    const idb = new IDBFactory();
    let bd = await abrir(idb, 'v3.0');
    await bd.guardarEstadoCaso('partida_1', ESTADO);
    bd.cerrar();
    bd = await abrir(idb, V);
    const leido = await bd.leerEstadoCaso('partida_1');
    assert.equal(leido.versionContenido, 'v3.0');
    assert.equal(leido.compatible, false);
    bd.cerrar();
  });
});

describe('persistencia de casos: usos', () => {
  test('uso de instancia: suma por (jugador, caso, firma) y sobrevive a reabrir', async () => {
    const idb = new IDBFactory();
    let bd = await abrir(idb);
    assert.equal(await bd.usoDeInstancia('jugador_1', 'caso_07', 'f1'), 0);
    assert.equal(await bd.sumarUsoInstancia('jugador_1', 'caso_07', 'f1', { hora: 10, orden: 'p1>p2>p3' }), 1);
    assert.equal(await bd.sumarUsoInstancia('jugador_1', 'caso_07', 'f1', { hora: 50, orden: 'p1>p2>p3' }), 2);
    assert.equal(await bd.sumarUsoInstancia('jugador_1', 'caso_07', 'f2', { hora: 20 }), 1);
    assert.equal(await bd.sumarUsoInstancia('jugador_2', 'caso_07', 'f1'), 1);
    assert.equal(await bd.sumarUsoInstancia('jugador_1', 'caso_03', 'f1'), 1);
    bd.cerrar();

    bd = await abrir(idb);
    assert.equal(await bd.usoDeInstancia('jugador_1', 'caso_07', 'f1'), 2);
    assert.deepEqual(await bd.instanciasDeCaso('jugador_1', 'caso_07'), [
      { firma: 'f1', usos: 2, ultimaHora: 50, ordenes: { 'p1>p2>p3': 2 } },
      { firma: 'f2', usos: 1, ultimaHora: 20, ordenes: {} },
    ]);
    assert.deepEqual(await bd.instanciasDeCaso('jugador_3', 'caso_07'), []);
    bd.cerrar();
  });

  test('uso de texto: suma por (jugador, texto) y sobrevive a reabrir', async () => {
    const idb = new IDBFactory();
    let bd = await abrir(idb);
    assert.equal(await bd.usoDeTexto('jugador_1', 'h1_t1'), 0);
    assert.equal(await bd.sumarUsoTexto('jugador_1', 'h1_t1'), 1);
    assert.equal(await bd.sumarUsoTexto('jugador_1', 'h1_t1'), 2);
    assert.equal(await bd.sumarUsoTexto('jugador_1', 'h1_t2'), 1);
    assert.equal(await bd.sumarUsoTexto('jugador_2', 'h1_t1'), 1);
    bd.cerrar();

    bd = await abrir(idb);
    assert.equal(await bd.usoDeTexto('jugador_1', 'h1_t1'), 2);
    assert.equal(await bd.usoDeTexto('jugador_1', 'h1_t2'), 1);
    assert.equal(await bd.usoDeTexto('jugador_2', 'h1_t1'), 1);
    bd.cerrar();
  });

  test('faltan ids: error', async () => {
    const bd = await abrir(new IDBFactory());
    await assert.rejects(bd.sumarUsoTexto('jugador_1', ''), /textoId/);
    await assert.rejects(bd.sumarUsoInstancia('jugador_1', 'caso_07'), /firma/);
    await assert.rejects(bd.guardarEstadoCaso('', ESTADO), /partidaId/);
    bd.cerrar();
  });
});

describe('persistencia de casos: los otros stores', () => {
  test('partida, tonos y reacciones aprobadas van y vuelven', async () => {
    const idb = new IDBFactory();
    let bd = await abrir(idb);
    await bd.guardarPartida('partida_1', { reloj: { hora: 12 }, caso: null });
    await bd.agregarTono('jugador_1', 'tenso');
    await bd.agregarTono('jugador_1', 'social');
    await bd.guardarReaccionAprobada({ id: 'reaccion_1', familia: 'miedo', texto: 'x' });
    bd.cerrar();

    bd = await abrir(idb);
    assert.deepEqual((await bd.leerPartida('partida_1')).partida, { reloj: { hora: 12 }, caso: null });
    assert.deepEqual(await bd.leerTonos('jugador_1'), ['tenso', 'social']);
    assert.deepEqual(await bd.leerTonos('jugador_2'), []);
    assert.equal((await bd.leerReaccionAprobada('reaccion_1')).familia, 'miedo');
    assert.equal(await bd.leerReaccionAprobada('reaccion_2'), null);
    bd.cerrar();
  });
});

describe('persistencia de casos: una transacción por turno', () => {
  /** Cuenta las transacciones de escritura que abre la base. */
  function contarEscrituras(idb) {
    const cuenta = { n: 0 };
    const abrirOriginal = idb.open.bind(idb);
    idb.open = (...args) => {
      const pedido = abrirOriginal(...args);
      pedido.addEventListener('success', () => {
        const bd = pedido.result;
        const original = bd.transaction.bind(bd);
        bd.transaction = (stores, modo, ...resto) => {
          if (modo === 'readwrite') cuenta.n += 1;
          return original(stores, modo, ...resto);
        };
      });
      return pedido;
    };
    return cuenta;
  }

  test('todo lo del turno se guarda en una sola transacción', async () => {
    const idb = new IDBFactory();
    const cuenta = contarEscrituras(idb);
    let bd = await abrir(idb);
    const usos = await bd.turno(async (t) => {
      await t.guardarPartida('partida_1', { reloj: { hora: 35 } });
      await t.guardarEstadoCaso('partida_1', ESTADO);
      await t.sumarUsoInstancia('jugador_1', 'caso_07', ESTADO.firma, { hora: 35 });
      await t.agregarTono('jugador_1', 'tenso');
      await t.sumarUsoTexto('jugador_1', 'h1_t2');
      return t.sumarUsoTexto('jugador_1', 'h1_t2');
    });
    assert.equal(usos, 2);
    assert.equal(cuenta.n, 1);
    bd.cerrar();

    bd = await abrir(idb);
    assert.deepEqual((await bd.leerEstadoCaso('partida_1')).estado, ESTADO);
    assert.equal(await bd.usoDeInstancia('jugador_1', 'caso_07', ESTADO.firma), 1);
    assert.equal(await bd.usoDeTexto('jugador_1', 'h1_t2'), 2);
    assert.deepEqual(await bd.leerTonos('jugador_1'), ['tenso']);
    bd.cerrar();
  });

  test('si el turno falla, no se guarda nada', async () => {
    const idb = new IDBFactory();
    let bd = await abrir(idb);
    await bd.guardarEstadoCaso('partida_1', ESTADO);
    await assert.rejects(
      bd.turno(async (t) => {
        await t.guardarEstadoCaso('partida_1', { ...ESTADO, contadorHitos: 99 });
        await t.sumarUsoTexto('jugador_1', 'h1_t1');
        throw new Error('falla a mitad del turno');
      }),
      /falla a mitad del turno/,
    );
    bd.cerrar();

    bd = await abrir(idb);
    assert.equal((await bd.leerEstadoCaso('partida_1')).estado.contadorHitos, 3);
    assert.equal(await bd.usoDeTexto('jugador_1', 'h1_t1'), 0);
    bd.cerrar();
  });
});

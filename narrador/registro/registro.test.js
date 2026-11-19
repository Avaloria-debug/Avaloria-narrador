import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../version.js';
import { crearRegistroTurno, erroresDeRegistroTurno, registroDesdeTurno, RegistroTurnos, CAMPOS_REGISTRO_TURNO, VERSION_ESQUEMA } from './registroTurnos.js';
import { ExportacionArchivo } from './exportacionArchivo.js';
import { FirestoreRegistro } from './firestoreRegistro.js';
import { firebaseConfig, COLECCION_REGISTROS_TURNOS } from './firebaseConfig.js';
import { narrar, crearPartida } from '../index.js';

const base = (extra = {}) => crearRegistroTurno({ version: VERSION, fecha: '2026-11-19T10:00:00.000Z', escena: 'escena_mercado_circular', frase: '¿Qué onda, Serel?', ...extra });

describe('formato del registro de turno', () => {
  test('un registro real (de narrar) trae todos los campos fijos', async () => {
    const estado = crearPartida({ semilla: 1 });
    const entrada = { tipo: 'texto', texto: 'hablar con serel' };
    const salida = await narrar(estado, entrada, { ahora: () => '2026-11-19T10:00:00Z' });
    const r = registroDesdeTurno({ version: VERSION, fecha: new Date('2026-11-19T10:00:00Z'), entrada, estadoAntes: estado, salida });
    assert.deepEqual(Object.keys(r), CAMPOS_REGISTRO_TURNO);
    assert.equal(r.version, VERSION);
    assert.equal(r.versionEsquema, '1');
    assert.equal(r.fecha, '2026-11-19T10:00:00.000Z');
    assert.equal(r.escena, estado.jugador.escenaId);
    assert.equal(r.relacion, null);
    assert.equal(r.frase, 'hablar con serel'); // texto exacto
    assert.equal(r.respuestaIA, null); // sin llamada a la IA
    assert.equal(r.sinDatosPersonales, true);
    assert.deepEqual(erroresDeRegistroTurno(r), []);
  });
  test('los botones no se registran y la respuesta de la IA solo va si hubo IA', () => {
    const estadoAntes = { jugador: { escenaId: 'e' } };
    assert.equal(registroDesdeTurno({ version: 'v', fecha: 0, entrada: { tipo: 'boton' }, estadoAntes, salida: { tipo: 'narracion' } }), null);
    const ia = registroDesdeTurno({ version: 'v', fecha: 0, entrada: { tipo: 'texto', texto: 'x' }, estadoAntes, salida: { tipo: 'dialogo_ia', texto: 'respuesta' } });
    assert.equal(ia.respuestaIA, 'respuesta');
  });
  test('validación: version obligatoria, esquema, fecha ISO, campos extra y claves de Groq', () => {
    assert.equal(VERSION_ESQUEMA, '1');
    assert.ok(erroresDeRegistroTurno(base({ version: undefined })).some((e) => e.startsWith('version')));
    assert.ok(erroresDeRegistroTurno(base({ version: '' })).length > 0);
    assert.ok(erroresDeRegistroTurno({ ...base(), versionEsquema: '2' }).length > 0);
    assert.ok(erroresDeRegistroTurno(base({ fecha: 'ayer' })).length > 0);
    assert.ok(erroresDeRegistroTurno({ ...base(), groqKey: 'x' }).some((e) => e.includes('desconocido')));
    assert.ok(erroresDeRegistroTurno({ ...base(), sinDatosPersonales: false }).length > 0);
    assert.ok(erroresDeRegistroTurno(base({ frase: 'mi clave es gsk_abcdef123456' })).length > 0);
  });
  test('RegistroTurnos.guardar devuelve una promesa', async () => {
    const p = new RegistroTurnos().guardar(base());
    assert.ok(p instanceof Promise);
    await assert.rejects(p);
  });
});

describe('ExportacionArchivo', () => {
  test('una línea JSON válida por registro, sin red', async () => {
    const llamadas = [];
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = (...a) => { llamadas.push(a); throw new Error('sin red'); };
    try {
      const x = new ExportacionArchivo();
      await x.guardar(base({ frase: 'uno\ncon salto' }));
      await x.guardar(base({ frase: 'dos', intencion: 'intencion_observar' }));
      const lineas = x.aJsonLines().split('\n');
      assert.equal(lineas.at(-1), '');
      const parseadas = lineas.slice(0, -1).map((l) => JSON.parse(l));
      assert.equal(parseadas.length, 2);
      assert.equal(parseadas[0].frase, 'uno\ncon salto');
      assert.deepEqual(parseadas.map((p) => p.frase), ['uno\ncon salto', 'dos']);
      assert.equal(llamadas.length, 0);
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });
  test('rechaza un registro inválido y no lo acumula', async () => {
    const x = new ExportacionArchivo();
    await assert.rejects(x.guardar(base({ version: null })));
    assert.equal(x.cantidad, 0);
    assert.equal(x.aJsonLines(), '');
  });
  test('descargar arma un Blob .jsonl y un enlace de descarga (entorno simulado)', async () => {
    const x = new ExportacionArchivo();
    await x.guardar(base());
    const hechos = [];
    const entorno = {
      Blob: class { constructor(partes, o) { hechos.push(['blob', partes.join(''), o.type]); } },
      URL: { createObjectURL: () => 'blob:x', revokeObjectURL: (u) => hechos.push(['revoke', u]) },
      document: { createElement: () => ({ click: () => hechos.push(['click']), remove() {} }), body: { append() {} } },
    };
    x.descargar('r.jsonl', entorno);
    assert.equal(hechos[0][1], x.aJsonLines());
    assert.deepEqual(hechos.slice(1).map((h) => h[0]), ['click', 'revoke']);
  });
});

describe('FirestoreRegistro', () => {
  const doble = () => {
    const llamadas = [];
    const sdk = {
      initializeApp: (c) => { llamadas.push(['initializeApp', c]); return { app: true }; },
      getFirestore: () => { llamadas.push(['getFirestore']); return { db: true }; },
      collection: (db, nombre) => { llamadas.push(['collection', nombre]); return { nombre }; },
      addDoc: async (ref, datos) => { llamadas.push(['addDoc', ref.nombre, datos]); return { id: 'doc1' }; },
    };
    return { sdk, llamadas };
  };
  test('desactivado por defecto: no llama al SDK', async () => {
    const { sdk, llamadas } = doble();
    const f = new FirestoreRegistro({ sdk });
    assert.equal(f.habilitado, false);
    assert.deepEqual(await f.guardar(base()), { guardado: false, motivo: 'desactivado' });
    assert.deepEqual(await new FirestoreRegistro({ sdk, habilitarFirestore: 'true' }).guardar(base()), { guardado: false, motivo: 'desactivado' });
    assert.equal(llamadas.length, 0);
  });
  test('activado sin version rechaza sin llamar al SDK', async () => {
    const { sdk, llamadas } = doble();
    const f = new FirestoreRegistro({ sdk, habilitarFirestore: true });
    await assert.rejects(f.guardar(base({ version: undefined })), /version/);
    const sinCampo = { ...base() };
    delete sinCampo.version;
    await assert.rejects(f.guardar(sinCampo), /version/);
    assert.equal(llamadas.length, 0);
  });
  test('activado con registro válido escribe en registros_turnos con initializeApp y getFirestore', async () => {
    const { sdk, llamadas } = doble();
    const r = await new FirestoreRegistro({ sdk, habilitarFirestore: true }).guardar(base());
    assert.deepEqual(r, { guardado: true, id: 'doc1' });
    assert.deepEqual(llamadas.map((l) => l[0]), ['initializeApp', 'getFirestore', 'collection', 'addDoc']);
    assert.equal(llamadas[0][1].projectId, 'cronicas-de-avaloria');
    assert.equal(llamadas[2][1], 'registros_turnos');
  });
  test('config: solo projectId, sin Analytics; ningún módulo del narrador lo activa', () => {
    assert.deepEqual({ ...firebaseConfig }, { projectId: 'cronicas-de-avaloria' });
    assert.equal(COLECCION_REGISTROS_TURNOS, 'registros_turnos');
    for (const f of ['../index.js', '../prueba/app.js', '../turno.js']) {
      assert.ok(!/habilitarFirestore\s*:\s*true|FirestoreRegistro/.test(readFileSync(new URL(f, import.meta.url), 'utf8')), f);
    }
  });
  test('el módulo no importa firebase al cargarse (el SDK se carga solo si está activado)', () => {
    assert.ok(!/^import .*from 'firebase/m.test(readFileSync(new URL('./firestoreRegistro.js', import.meta.url), 'utf8')));
  });
});

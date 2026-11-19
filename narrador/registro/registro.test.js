import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../version.js';
import { crearRegistroTurno, erroresDeRegistroTurno, registroDeTurnoNoResuelto, MOTIVOS_REGISTRABLES, MOTIVOS_DE_ACLARACION, RegistroTurnos, CAMPOS_REGISTRO_TURNO, VERSION_ESQUEMA } from './registroTurnos.js';
import { ExportacionArchivo } from './exportacionArchivo.js';
import { FirestoreRegistro } from './firestoreRegistro.js';
import { firebaseConfig, COLECCION_REGISTROS_TURNOS } from './firebaseConfig.js';
import { narrar, crearPartida, cargarPartida, contenido } from '../index.js';
import { MOTIVOS } from '../motivos.js';
import { CAMPOS_REGISTRO, crearColaDeRegistros } from '../registro.js';
import { npcsPresentes } from '../turno.js';

const base = (extra = {}) => crearRegistroTurno({ version: VERSION, fecha: '2026-11-19T10:00:00.000Z', escena: 'escena_mercado_circular', frase: '¿Qué onda, Serel?', ...extra });

const texto = (t) => ({ tipo: 'texto', texto: t });
const BOTON = { tipo: 'boton', intencionId: 'intencion_observar' };
// Un turno de botón cierra la reformulación pendiente (su línea se escribe al cerrar ese turno).
const cerrar = (estado, x) => narrar(estado, BOTON, { registroTurnos: x });
describe('formato del registro de turno', () => {
  test('un registro real (de narrar) trae todos los campos fijos', async () => {
    const exportacion = new ExportacionArchivo();
    const estado = crearPartida({ semilla: 1 });
    const r0 = await narrar(estado, texto('banana xyz'), { ahora: () => '2026-11-19T10:00:00Z', registroTurnos: exportacion });
    assert.equal(r0.tipo, 'reformulacion');
    assert.equal(exportacion.cantidad, 0); // pendiente hasta el turno siguiente
    await cerrar(r0.estado, exportacion);
    const [r] = exportacion.registros();
    assert.deepEqual(Object.keys(r), CAMPOS_REGISTRO_TURNO);
    assert.equal(r.version, VERSION);
    assert.equal(r.versionEsquema, '1');
    assert.equal(r.fecha, '2026-11-19T10:00:00.000Z');
    assert.equal(r.escena, estado.jugador.escenaId);
    assert.equal(r.frase, 'banana xyz'); // texto exacto
    assert.equal(r.motivo, 'no_entendido'); // el que devolvió decidir()
    assert.equal(r.respuestaIA, null); // sin llamada a la IA
    assert.equal(r.sinDatosPersonales, true);
    assert.deepEqual(erroresDeRegistroTurno(r), []);
  });
  test('turno resuelto por regla no genera registro (acción, consulta, saludo, botón)', async () => {
    const exportacion = new ExportacionArchivo();
    let e = crearPartida({ semilla: 1 });
    for (const frase of ['hablar con marem', 'hablar con serel', 'hola', 'observar', 'ir al archivo real']) {
      e = (await narrar(e, texto(frase), { registroTurnos: exportacion })).estado;
    }
    e = (await narrar(e, { tipo: 'boton', intencionId: 'intencion_observar' }, { registroTurnos: exportacion })).estado;
    assert.equal(exportacion.cantidad, 0);
  });
  test('falta_destino (pedido de aclaración) no se registra; sin registroTurnos no pasa nada', async () => {
    const exportacion = new ExportacionArchivo();
    const e = crearPartida({ semilla: 1 });
    const r = await narrar(e, texto('viajar'), { registroTurnos: exportacion });
    assert.equal(r.tipo, 'reformulacion');
    assert.equal(exportacion.cantidad, 0);
    await narrar(e, texto('banana xyz')); // sin registroTurnos
    assert.equal(exportacion.cantidad, 0);
  });
  const respuestaIA = { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Serel se encoge de hombros.' } }], usage: {} }), text: async () => '' };
  const conIa = (exportacion, groqKey = 'gsk_prueba_prueba_123') => ({ registroTurnos: exportacion, groqKey, http: async () => respuestaIA, esperar: async () => {} });

  test('frase no entendida + segunda sin sentido que pasa a la IA: motivo no_entendido y respuestaIA no null', async () => {
    const x = new ExportacionArchivo();
    let e = crearPartida({ semilla: 1 });
    e = (await narrar(e, texto('banana xyz'), conIa(x))).estado;
    assert.equal(e.motivoReformulacion, 'no_entendido');
    const ia = await narrar(e, texto('plugh xyzzy'), conIa(x));
    assert.equal(ia.tipo, 'dialogo_ia');
    const regs = x.registros();
    assert.deepEqual(regs.map((r) => [r.frase, r.motivo]), [['plugh xyzzy', 'no_entendido']]); // una sola línea, la de la IA
    assert.equal(regs[0].respuestaIA, ia.texto);
    assert.equal(ia.estado.motivoReformulacion, null); // el turno de IA no deja motivo
  });
  test('la IA registra el motivo ORIGINAL de la reformulación (aunque sea de aclaración), no no_entendido', async () => {
    const x = new ExportacionArchivo();
    let e = crearPartida({ semilla: 1 });
    const r1 = await narrar(e, texto('viajar'), conIa(x)); // falta_destino: no se registra
    assert.equal(x.cantidad, 0);
    assert.equal(r1.estado.motivoReformulacion, 'falta_destino');
    const ia = await narrar(r1.estado, texto('plugh xyzzy'), conIa(x));
    assert.equal(ia.tipo, 'dialogo_ia');
    const [reg] = x.registros();
    assert.equal(reg.motivo, 'falta_destino');
    assert.equal(reg.respuestaIA, ia.texto);
    assert.notEqual(reg.respuestaIA, null);
  });
  test('sin clave: el turno que pasa a plantilla sin_ia también lleva el motivo original y respuestaIA null', async () => {
    const x = new ExportacionArchivo();
    const e = (await narrar(crearPartida({ semilla: 1 }), texto('viajar'), { registroTurnos: x })).estado;
    await narrar(e, texto('plugh xyzzy'), { registroTurnos: x });
    assert.deepEqual(x.registros().map((r) => [r.motivo, r.respuestaIA]), [['falta_destino', null]]);
  });
  test('un turno entendido entre medio borra el motivo guardado', async () => {
    let e = (await narrar(crearPartida({ semilla: 1 }), texto('viajar'))).estado;
    assert.equal(e.motivoReformulacion, 'falta_destino');
    e = (await narrar(e, texto('observar'))).estado;
    assert.equal(e.motivoReformulacion, null);
  });
  test('el estado guarda solo un id de motivo: se conserva al guardar y cargar, y un valor ajeno se descarta', async () => {
    const e = (await narrar(crearPartida({ semilla: 1 }), texto('banana xyz'))).estado;
    assert.equal(cargarPartida(JSON.stringify(e)).motivoReformulacion, 'no_entendido');
    assert.equal(cargarPartida(JSON.stringify({ ...e, motivoReformulacion: 'mi frase secreta' })).motivoReformulacion, null);
    assert.equal(cargarPartida(JSON.stringify({ ...e, motivoReformulacion: 7 })).motivoReformulacion, null);
    assert.ok(!JSON.stringify(e).includes('banana')); // la frase del jugador no queda en el estado
  });
  test('relacion: número del NPC presente en la escena; null si no se conoce', async () => {
    for (const escenaId of ['escena_mercado_circular', 'escena_archivo_real', 'escena_plaza_cambistas']) {
      const x = new ExportacionArchivo();
      const base0 = crearPartida({ semilla: 1 });
      const estado = { ...base0, jugador: { ...base0.jugador, escenaId } };
      await cerrar((await narrar(estado, texto('banana xyz'), { registroTurnos: x })).estado, x);
      const presente = npcsPresentes(estado, contenido)[0];
      assert.equal(typeof x.registros()[0].relacion, 'number', escenaId);
      assert.equal(x.registros()[0].relacion, estado.npcs[presente.id].relacion, escenaId);
    }
    // Con otra relación guardada, el registro la refleja.
    const x = new ExportacionArchivo();
    const e0 = crearPartida({ semilla: 1 });
    const npcId = npcsPresentes(e0, contenido)[0].id;
    const e1 = { ...e0, npcs: { ...e0.npcs, [npcId]: { ...e0.npcs[npcId], relacion: 7 } } };
    await cerrar((await narrar(e1, texto('banana xyz'), { registroTurnos: x })).estado, x);
    assert.equal(x.registros()[0].relacion, 7);
    // Sin NPC conocido, null.
    const base2 = { version: 'v', fecha: 0, escena: 'e', entrada: texto('x'), turno: { tipo: 'reformular', motivo: 'no_entendido' } };
    assert.equal(registroDeTurnoNoResuelto(base2).relacion, null);
    assert.equal(registroDeTurnoNoResuelto({ ...base2, relacion: 3 }).relacion, 3);
  });
  test('registroDeTurnoNoResuelto: solo reformulación registrable o IA, solo texto', () => {
    const base2 = { version: 'v', fecha: 0, escena: 'e' };
    assert.equal(registroDeTurnoNoResuelto({ ...base2, entrada: { tipo: 'boton' }, turno: { tipo: 'reformular', motivo: 'no_entendido' } }), null);
    for (const tipo of ['accion', 'consulta', 'saludo', 'reconocimiento']) {
      assert.equal(registroDeTurnoNoResuelto({ ...base2, entrada: texto('x'), turno: { tipo } }), null, tipo);
    }
    assert.equal(registroDeTurnoNoResuelto({ ...base2, entrada: texto('x'), turno: { tipo: 'ia' }, origen: 'ia', respuesta: 'r', motivoPrevio: 'falta_npc' }).respuestaIA, 'r');
    assert.equal(registroDeTurnoNoResuelto({ ...base2, entrada: texto('x'), turno: { tipo: 'ia' }, motivoPrevio: 'falta_npc' }).motivo, 'falta_npc');
    assert.equal(registroDeTurnoNoResuelto({ ...base2, entrada: texto('x'), turno: { tipo: 'ia' } }).motivo, 'no_entendido');
  });
  for (const motivo of MOTIVOS_REGISTRABLES) {
    test(`motivo incluido: ${motivo} se registra`, () => {
      const r = registroDeTurnoNoResuelto({ version: 'v', fecha: 0, escena: 'e', entrada: texto('x'), turno: { tipo: 'reformular', motivo } });
      assert.equal(r.motivo, motivo);
    });
  }
  for (const motivo of MOTIVOS_DE_ACLARACION) {
    test(`motivo excluido: ${motivo} no se registra`, () => {
      assert.equal(registroDeTurnoNoResuelto({ version: 'v', fecha: 0, escena: 'e', entrada: texto('x'), turno: { tipo: 'reformular', motivo } }), null);
    });
  }
  test('la lista incluida + excluida cubre todos los motivos de reformulación del motor (menos los de uso interno)', () => {
    const todos = Object.values(MOTIVOS);
    const cubiertos = [...MOTIVOS_REGISTRABLES, ...MOTIVOS_DE_ACLARACION];
    assert.deepEqual(todos.filter((m) => !cubiertos.includes(m)), [], 'motivo nuevo sin clasificar: decidir si se registra');
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

describe('una línea por frase: la reformulación queda pendiente hasta el turno siguiente', () => {
  const respuestaIA = { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Serel se encoge de hombros.' } }], usage: {} }), text: async () => '' };
  const conIa = (x) => ({ registroTurnos: x, groqKey: 'gsk_prueba_prueba_123', http: async () => respuestaIA, esperar: async () => {} });

  test('no entendida + frase que el motor entiende: 0 líneas (ni la primera ni la segunda)', async () => {
    const x = new ExportacionArchivo();
    const r1 = await narrar(crearPartida({ semilla: 1 }), texto('banana xyz'), { registroTurnos: x });
    assert.equal(r1.tipo, 'reformulacion');
    const r2 = await narrar(r1.estado, texto('observar'), { registroTurnos: x });
    assert.equal(r2.tipo, 'narracion');
    await cerrar(r2.estado, x); // un botón después no revive la pendiente descartada
    assert.equal(x.cantidad, 0);
  });
  test('no entendida + frase que pasa a la IA: 1 línea, la de la IA, con respuestaIA y motivo original', async () => {
    const x = new ExportacionArchivo();
    const r1 = await narrar(crearPartida({ semilla: 1 }), texto('banana xyz'), conIa(x));
    const ia = await narrar(r1.estado, texto('plugh xyzzy'), conIa(x));
    assert.equal(ia.tipo, 'dialogo_ia');
    await cerrar(ia.estado, x);
    assert.deepEqual(x.registros().map((r) => [r.frase, r.motivo, r.respuestaIA]), [['plugh xyzzy', 'no_entendido', ia.texto]]);
  });
  test('no entendida + frase no entendida sin IA (sin_ia): 1 línea, motivo original y respuestaIA null', async () => {
    const x = new ExportacionArchivo();
    const r1 = await narrar(crearPartida({ semilla: 1 }), texto('banana xyz'), { registroTurnos: x });
    const r2 = await narrar(r1.estado, texto('plugh xyzzy'), { registroTurnos: x });
    assert.ok(r2.errores.some((e) => e.includes('sin_ia')), r2.errores.join());
    await cerrar(r2.estado, x);
    assert.deepEqual(x.registros().map((r) => [r.frase, r.motivo, r.respuestaIA]), [['plugh xyzzy', 'no_entendido', null]]);
  });
  test('no entendida + botón: al cerrar el botón se escribe la pendiente, una vez, con su motivo', async () => {
    const x = new ExportacionArchivo();
    const r1 = await narrar(crearPartida({ semilla: 1 }), texto('banana xyz'), { registroTurnos: x });
    assert.equal(x.cantidad, 0);
    const b1 = await cerrar(r1.estado, x);
    assert.deepEqual(x.registros().map((r) => [r.frase, r.motivo, r.respuestaIA]), [['banana xyz', 'no_entendido', null]]);
    await cerrar(b1.estado, x); // otro botón: no se repite
    await cerrar(r1.estado, x); // ni reusando el estado anterior
    assert.equal(x.cantidad, 1);
    assert.ok(!JSON.stringify(b1.estado).includes('banana')); // la frase no queda en el estado
    assert.equal(r1.estado.motivoReformulacion, 'no_entendido'); // solo el id
  });
  test('ninguna frase queda duplicada en el archivo exportado', async () => {
    const x = new ExportacionArchivo();
    let e = crearPartida({ semilla: 1 });
    const pasos = [texto('banana xyz'), texto('plugh xyzzy'), texto('blorp qwerty'), BOTON, texto('zzz yyy'), texto('observar'),
      texto('viajar'), texto('qwop asdf'), texto('frobnicar trus'), BOTON, BOTON, texto('hola'), texto('glub glub'), texto('glab glab')];
    for (const p of pasos) e = (await narrar(e, p, { registroTurnos: x })).estado;
    await cerrar(e, x);
    const frases = x.aJsonLines().trim().split('\n').map((l) => JSON.parse(l).frase);
    assert.ok(frases.length >= 4, frases.join(' | '));
    assert.equal(new Set(frases).size, frases.length, frases.join(' | '));
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

describe('la cola de la partida (registro.js) sigue igual', () => {
  test('con registroTurnos y cola a la vez: la cola recibe el registro de siempre, sin datos de análisis', async () => {
    const enviados = [];
    const cola = crearColaDeRegistros({ enviar: async (r) => { enviados.push(r); }, validarAlAgregar: false });
    const x = new ExportacionArchivo();
    const e = crearPartida({ semilla: 1 });
    // Los tres turnos de texto van a la cola (también el que no se registra en el análisis).
    let est = (await narrar(e, texto('viajar'), { cola, registroTurnos: x })).estado;
    est = (await narrar(est, texto('banana xyz'), { cola, registroTurnos: x })).estado;
    await narrar(est, texto('observar'), { cola, registroTurnos: x });
    assert.equal(cola.pendientes().length, 3);
    assert.deepEqual(x.registros().map((r) => r.motivo), ['falta_destino']); // análisis: solo el turno de IA, con el motivo original
    for (const r of cola.pendientes()) {
      assert.deepEqual(Object.keys(r), CAMPOS_REGISTRO);
      for (const k of ['motivo', 'relacion', 'respuestaIA', 'sinDatosPersonales', 'version', 'frase']) assert.ok(!(k in r), k);
    }
    assert.deepEqual(cola.pendientes().map((r) => [r.texto_jugador, r.ruta]), [['viajar', 'reformulacion'], ['banana xyz', 'grupo_2'], ['observar', 'grupo_1']]);
  });
  test('sin registroTurnos, la cola recibe lo mismo', async () => {
    const cola = crearColaDeRegistros({ enviar: async () => {}, validarAlAgregar: false });
    await narrar(crearPartida({ semilla: 1 }), texto('banana xyz'), { cola });
    assert.equal(cola.pendientes().length, 1);
    assert.deepEqual(Object.keys(cola.pendientes()[0]), CAMPOS_REGISTRO);
  });
});

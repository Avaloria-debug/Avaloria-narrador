// Consultas de tema, `no_se` y viajar frente a preguntas.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { decidir, esPregunta, resolverConsulta } from './comprension.js';
import { validarContenido } from './contenido.js';
import { leerContenido } from './cargarContenido.js';
import { crearPartida, narrar, contenido, TIPOS_SALIDA } from './index.js';
import { completar } from './narracion.js';

const SEREL = 'serel_panadero';
const HARINA = 'conocimiento_serel_1';
const presentes = (...ids) => contenido.npcs.filter((n) => ids.includes(n.id)).map((n) => ({ ...n, relacion: 0 }));
const ctx = (extra = {}) => ({
  intenciones: contenido.intenciones,
  escenas: contenido.escenas,
  escena: { id: 'escena_mercado_circular' },
  npcsPresentes: presentes(SEREL),
  npcsAusentes: contenido.npcs,
  objetosAplicables: [],
  ...extra,
});
const decir = (estado, texto) => narrar(estado, { tipo: 'texto', texto });
const conSerel = (cambios = {}, extra = {}) => {
  const e = crearPartida({ semilla: 11 });
  return { ...e, ...extra, npcs: { ...e.npcs, [SEREL]: { ...e.npcs[SEREL], ...cambios } } };
};
const textosDe = (lista, valores) => lista.map((p) => completar(p, valores));
const serel = contenido.npcs.find((n) => n.id === SEREL);
const NO_SE = textosDe(contenido.plantillas.no_se, { npc: serel.nombre });
const FALLO = textosDe(contenido.plantillas.revelar_conocimiento.fallo, { npc: serel.nombre });
const EXITO = textosDe(contenido.plantillas.revelar_conocimiento.exito, { npc: serel.nombre, conocimiento: serel.conocimientos[0].contenido });

describe('esPregunta', () => {
  test('signo de pregunta o palabra interrogativa', () => {
    for (const f of ['¿vamos?', 'vamos?', 'cómo llego', 'Cuál es', 'sabés algo', 'sabes algo', 'conviene ir']) {
      assert.equal(esPregunta(f), true, f);
    }
    for (const f of ['viajá al norte', 'trabajo como panadero', 'hola, buenas tardes', '', null]) {
      assert.equal(esPregunta(f), false, String(f));
    }
  });
});

describe('viajar frente a preguntas', () => {
  test('"¿sabés cómo puedo ir al norte?" -> consulta', () => {
    assert.equal(decidir('¿sabés cómo puedo ir al norte?', ctx()).tipo, 'consulta');
  });
  test('"viajá al norte" -> viajar', () => {
    const d = decidir('viajá al norte', ctx());
    assert.equal(d.tipo, 'ejecutar');
    assert.equal(d.intencionId, 'intencion_viajar');
    assert.equal(d.parametros.destino, 'escena_camino_norte');
  });
  test('"quiero viajar al norte, ¿sabés cómo?" -> consulta', () => {
    assert.equal(decidir('quiero viajar al norte, ¿sabés cómo?', ctx()).tipo, 'consulta');
  });
  test('"contame lo del pozo viejo del norte" -> no viajar', () => {
    const d = decidir('contame lo del pozo viejo del norte', ctx());
    assert.notEqual(d.intencionId, 'intencion_viajar');
    assert.notEqual(d.tipo, 'ejecutar');
  });
  test('sin signo, la palabra interrogativa alcanza; sin NPC presente tampoco viaja', () => {
    assert.equal(decidir('conviene ir al norte', ctx()).tipo, 'consulta');
    assert.deepEqual(decidir('¿puedo ir al norte?', ctx({ npcsPresentes: [] })), { tipo: 'consulta', npcId: null, conocimientoId: null });
  });
  test('cada verbo de viaje, sin pregunta y con destino, viaja', () => {
    for (const f of ['viajar al norte', 'quiero ir al norte', 'irme al norte', 'llegar al norte', 'salir para el norte', 'ponerme en camino al norte']) {
      const d = decidir(f, ctx());
      assert.equal(d.tipo, 'ejecutar', f);
      assert.equal(d.intencionId, 'intencion_viajar', f);
    }
  });
  test('de punta a punta: la pregunta no mueve al jugador ni gasta tiempo', async () => {
    const e = crearPartida({ semilla: 11 });
    const r = await decir(e, '¿sabés cómo puedo ir al norte?');
    assert.equal(r.tipo, TIPOS_SALIDA.NARRACION);
    assert.ok(NO_SE.includes(r.texto), r.texto);
    assert.equal(r.estado.jugador.escenaId, e.jugador.escenaId);
    assert.deepEqual(r.estado.reloj, e.reloj);
    assert.deepEqual(r.errores, []);
  });
});

describe('consultas de tema', () => {
  test('resolverConsulta: tema por palabras clave, exactas y sin tilde', () => {
    assert.deepEqual(resolverConsulta('¿quién te vende la HARINA?', presentes(SEREL)), { npcId: SEREL, conocimientoId: HARINA });
    assert.deepEqual(resolverConsulta('¿qué sabés de la lluvia?', presentes(SEREL)), { npcId: SEREL, conocimientoId: null });
    assert.deepEqual(resolverConsulta('¿hola?', []), { npcId: null, conocimientoId: null });
  });
  test('con dos NPCs, responde el nombrado o el que conoce el tema', () => {
    const dos = presentes('maren_archivista', SEREL);
    assert.equal(resolverConsulta('¿y el precio de la harina?', dos).npcId, SEREL);
    assert.deepEqual(resolverConsulta('Serel, ¿sabés algo del tratado?', dos), { npcId: SEREL, conocimientoId: null });
  });
  test('pregunta sin tema conocido: no_se, sin revelar nada', async () => {
    const r = await decir(crearPartida({ semilla: 11 }), '¿qué opinás de la lluvia que viene del lago?');
    assert.equal(r.tipo, TIPOS_SALIDA.NARRACION);
    assert.ok(NO_SE.includes(r.texto), r.texto);
    assert.deepEqual(r.estado.npcs[SEREL].conocimientosRevelados, []);
    assert.equal(r.estado.reformulacionPendiente, false);
    assert.equal(r.registro.ruta, 'grupo_1');
    assert.equal(r.registro.respuesta_mostrada, r.texto);
  });
  test('las dos variantes de no_se aparecen', async () => {
    const vistas = new Set();
    let e = crearPartida({ semilla: 3 });
    for (let i = 0; i < 6; i++) {
      const r = await decir(e, '¿qué opinás de la lluvia?');
      vistas.add(r.texto);
      e = r.estado;
    }
    assert.deepEqual([...vistas].sort(), [...NO_SE].sort());
  });
  test('tema conocido y relación suficiente: revela y lo marca', async () => {
    const r = await decir(conSerel({ relacion: 30 }), '¿qué proveedor te vende la harina?');
    assert.equal(r.tipo, TIPOS_SALIDA.NARRACION);
    assert.ok(EXITO.includes(r.texto), r.texto);
    assert.deepEqual(r.estado.npcs[SEREL].conocimientosRevelados, [HARINA]);
    // Ya revelado: la plantilla de fallo, y no se repite.
    const otra = await decir(r.estado, '¿y el precio de la harina?');
    assert.ok(FALLO.includes(otra.texto), otra.texto);
    assert.deepEqual(otra.estado.npcs[SEREL].conocimientosRevelados, [HARINA]);
  });
  test('tema conocido sin llegar al umbral: plantilla de fallo, sin revelar', async () => {
    const r = await decir(conSerel({ relacion: 29 }), '¿sabés algo de la harina?');
    assert.ok(FALLO.includes(r.texto), r.texto);
    assert.deepEqual(r.estado.npcs[SEREL].conocimientosRevelados, []);
  });
  test('tema conocido con los conocimientos bloqueados: no_se', async () => {
    const r = await decir(conSerel({ relacion: 80, bloqueadoConocimientos: true }), '¿sabés algo de la harina?');
    assert.ok(NO_SE.includes(r.texto), r.texto);
    assert.deepEqual(r.estado.npcs[SEREL].conocimientosRevelados, []);
  });
  test('evento y marca: sin ellos falla, con ellos revela', async () => {
    const en = (escenaId, npcId, extra = {}) => {
      const e = crearPartida({ semilla: 11 });
      return { ...e, ...extra, jugador: { ...e.jugador, escenaId }, npcs: { ...e.npcs, [npcId]: { ...e.npcs[npcId], relacion: 90 } } };
    };
    const ivor = 'ivor_cambista';
    const sinEvento = await decir(en('escena_plaza_cambistas', ivor), '¿quién tiene una deuda con la casa?');
    assert.deepEqual(sinEvento.estado.npcs[ivor].conocimientosRevelados, []);
    const activo = [{ id: 'evento_deuda_impaga', escenaId: 'escena_plaza_cambistas', turnosRestantes: 3, horaFin: null }];
    const conEvento = await decir(en('escena_plaza_cambistas', ivor, { eventosActivos: activo }), '¿quién tiene una deuda con la casa?');
    assert.deepEqual(conEvento.estado.npcs[ivor].conocimientosRevelados, ['conocimiento_ivor_1']);

    const elia = 'elia_bibliotecaria';
    const sinMarca = await decir(en('escena_biblioteca_publica', elia), '¿qué libro fue retirado?');
    assert.deepEqual(sinMarca.estado.npcs[elia].conocimientosRevelados, []);
    const conMarca = await decir(en('escena_biblioteca_publica', elia, { marcas: ['leyo'] }), '¿qué libro fue retirado?');
    assert.deepEqual(conMarca.estado.npcs[elia].conocimientosRevelados, ['conocimiento_elia_1']);
  });
  test('R1: una frase que no es pregunta y nombra el tema de un NPC presente es consulta con ese NPC', () => {
    const d = decidir('la harina está cara', ctx());
    assert.equal(d.tipo, 'consulta');
    assert.equal(d.conocimientoId, 'conocimiento_serel_1');
  });
});

describe('validador: palabrasClave y no_se', () => {
  const copia = async () => JSON.parse(JSON.stringify(await leerContenido()));
  test('el contenido real pasa sin errores ni avisos', async () => {
    const v = validarContenido(await copia());
    assert.deepEqual(v.errores, []);
    assert.deepEqual(v.avisos, []);
  });
  const conClaves = async (valor, otro) => {
    const c = await copia();
    c.npcs[1].conocimientos[0].palabrasClave = valor;
    if (otro) c.npcs[0].conocimientos[0].palabrasClave = otro;
    return validarContenido(c).errores.filter((e) => e.includes('palabrasClave'));
  };
  test('palabrasClave: menos de 2 es un error', async () => {
    for (const valor of [undefined, [], ['harina'], ['harina', '']]) {
      assert.equal((await conClaves(valor)).length, 1, JSON.stringify(valor));
    }
  });
  test('palabrasClave: más de 5 es un error; 2 y 5 valen', async () => {
    assert.match((await conClaves(['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis']))[0], /entre 2 y 5/);
    assert.deepEqual(await conClaves(['uno', 'dos']), []);
    assert.deepEqual(await conClaves(['uno', 'dos', 'tres', 'cuatro', 'cinco']), []);
  });
  test('palabrasClave: una palabra repetida en el mismo conocimiento es un error', async () => {
    const errores = await conClaves(['harina', 'precio', 'Harina']);
    assert.equal(errores.length, 1);
    assert.match(errores[0], /"harina" está repetida/);
  });
  test('palabrasClave: la misma palabra en dos conocimientos distintos es un error que bloquea', async () => {
    const c = await copia();
    c.npcs[1].conocimientos[0].palabrasClave = ['harina', 'tratado'];
    const v = validarContenido(c);
    assert.equal(v.ok, false);
    const errores = v.errores.filter((e) => e.includes('palabrasClave'));
    assert.equal(errores.length, 1);
    assert.match(errores[0], /"tratado" ya está en maren_archivista\.conocimientos\[0\]/);
  });
  test('palabrasClave del contenido real: las reconciliadas con los diccionarios', async () => {
    const reales = Object.fromEntries((await copia()).npcs.flatMap((n) => n.conocimientos.map((k) => [k.id, k.palabrasClave])));
    assert.deepEqual(reales, {
      conocimiento_maren_1: ['tratado', 'copia', 'guerra', 'coronas'],
      conocimiento_serel_1: ['harina', 'precio', 'proveedor'],
      conocimiento_ivor_1: ['deuda', 'deudas', 'prestamista'],
      conocimiento_naela_1: ['mercader', 'averiguaciones', 'forastero'],
      conocimiento_tiren_1: ['ruta', 'atajo', 'cartografia'],
      conocimiento_elia_1: ['libro', 'retirado', 'solicitante'],
      conocimiento_brenn_1: ['posada', 'escondida'],
      conocimiento_ysolde_1: ['isla', 'primavera', 'aves'],
      conocimiento_dario_1: ['soborno', 'sobornos', 'coima', 'aduana'],
      conocimiento_sarin_1: ['carta', 'semana', 'destinatario'],
      conocimiento_sendero_sin_vigilancia: ['sendero', 'colinas', 'vigilancia'],
      conocimiento_oren_1: ['roble', 'firma'],
      conocimiento_maren_2: ['cerradura', 'cerraduras', 'llave', 'llaves'],
      conocimiento_serel_2: ['horno', 'hornos', 'alba'],
      conocimiento_ivor_2: ['ficha', 'fichas', 'empeno'],
      conocimiento_naela_2: ['madrugada', 'parroquianos'],
      conocimiento_tiren_2: ['vado', 'crecida', 'lluvias'],
      conocimiento_elia_2: ['registro', 'paginas', 'invierno'],
      conocimiento_brenn_2: ['molino', 'ruinas', 'bajada'],
      conocimiento_ysolde_2: ['niebla', 'bote', 'farol'],
      conocimiento_dario_2: ['barrera', 'relevo', 'garita'],
      conocimiento_sarin_2: ['consigna', 'contrasena', 'santo'],
      conocimiento_hollis_2: ['lobos', 'rebano', 'fogatas'],
      conocimiento_oren_2: ['ofrenda', 'ofrendas', 'amanecer'],
    });
  });
  test('no_se tiene que existir con dos variantes', async () => {
    for (const valor of [undefined, [], [contenido.plantillas.no_se[0]], ['Nadie sabe nada.', 'Ni idea.']]) {
      const c = await copia();
      if (valor === undefined) delete c.plantillas.no_se;
      else c.plantillas.no_se = valor;
      assert.ok(validarContenido(c).errores.some((e) => e.includes('plantillas.no_se')), JSON.stringify(valor));
    }
  });
});

describe('conocimiento con evento como pista (motor-caso-v1-operativo.md, sección 4)', async () => {
  const { ejecutarTurno } = await import('./turno.js');
  const DARIO = 'dario_guardia';
  const PISTA = 'conocimiento_dario_1';
  const EVENTO = 'evento_disputa_aduana';
  const ADUANA = 'escena_puente_aduana';
  const enAduana = (eventosActivos) => {
    const e = crearPartida({ semilla: 3 });
    return { ...e, eventosActivos, jugador: { ...e.jugador, escenaId: ADUANA }, npcs: { ...e.npcs, [DARIO]: { ...e.npcs[DARIO], relacion: 100 } } };
  };
  const preguntar = (estado) => ejecutarTurno(estado, { tipo: 'texto', texto: '¿quién cobra sobornos?' }, { contenido, rng: () => 0.5 });

  test('el conocimiento pide un evento y no queda excluido como pista: se puede preguntar por él', () => {
    const k = contenido.npcs.find((n) => n.id === DARIO).conocimientos.find((c) => c.id === PISTA);
    assert.equal(k.requiereEvento, EVENTO);
    assert.equal(preguntar(enAduana([])).consulta.conocimientoId, PISTA);
  });

  test('con el evento inactivo responde no_se y no se revela; con el evento activo se revela', () => {
    const sin = preguntar(enAduana([]));
    assert.equal(sin.tipo, 'consulta');
    assert.equal(sin.consulta.resultado, 'no_se');
    assert.equal(sin.consulta.motivo, 'evento');
    assert.deepEqual(sin.estado.npcs[DARIO].conocimientosRevelados, []);
    // Queda pendiente: la misma pregunta, con el evento activo, la revela.
    const con = preguntar({ ...sin.estado, eventosActivos: [{ id: EVENTO, escenaId: ADUANA, turnosRestantes: 6, horaFin: null }] });
    assert.equal(con.consulta.resultado, 'exito');
    assert.deepEqual(con.estado.npcs[DARIO].conocimientosRevelados, [PISTA]);
  });
});

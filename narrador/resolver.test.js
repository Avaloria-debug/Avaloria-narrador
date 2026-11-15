import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolverAccion,
  aplicarEfectos,
  VERBOS_CON_CHEQUEO,
  PROBABILIDAD_EXITO,
  costoHorasDeVerbo,
  MOTIVOS_FALLO,
} from './resolver.js';
import { estadoInicial } from './estado.js';
import { leerContenido } from './cargarContenido.js';
import { rngDe, eventoActivo as ev } from './utilsPrueba.js';

let contenido;
before(async () => {
  contenido = await leerContenido();
});

/** Partida de prueba: 200 de bronce, 3 de plata, sin eventos, en el mercado. */
const partida = (extra = {}) => {
  const e = estadoInicial(contenido, { rng: () => 0.5 });
  return { ...e, eventosActivos: [], ...extra, jugador: { ...e.jugador, ...(extra.jugador ?? {}) } };
};
const intencionDe = (verbo) => contenido.intenciones.find((i) => i.verbo === verbo).id;
const resolver = (estado, verbo, parametros = {}, rng = rngDe([0.1])) =>
  resolverAccion(estado, { intencionId: intencionDe(verbo), parametros }, { contenido, rng });
const tiene = (estado, objetoId) => estado.inventario.filter((i) => i.objetoId === objetoId);

describe('estado inicial', () => {
  test('escena inicial, reloj 08:00, dinero dentro del rango y NPCs en su relación inicial', () => {
    const e = estadoInicial(contenido, { rng: () => 0.5 });
    assert.equal(e.jugador.escenaId, 'escena_mercado_circular');
    assert.deepEqual(e.reloj, { dia: 1, hora: '08:00' });
    assert.equal(e.jugador.bronce, 200);
    assert.equal(e.jugador.plata, 3);
    assert.equal(Object.keys(e.npcs).length, 12);
    assert.deepEqual(e.inventario, []);
    assert.deepEqual(e.marcas, []);
    assert.equal(e.versionContenido, contenido.version);
  });

  test('extremos del dinero inicial: 100 a 300 de bronce, 0 a 5 de plata', () => {
    const min = estadoInicial(contenido, { rng: () => 0 });
    const max = estadoInicial(contenido, { rng: () => 0.999999 });
    assert.deepEqual([min.jugador.bronce, min.jugador.plata], [100, 0]);
    assert.deepEqual([max.jugador.bronce, max.jugador.plata], [300, 5]);
  });

  test('arranca con los eventos de las 08:00 y necesita un rng', () => {
    const e = estadoInicial(contenido, { rng: () => 0.5 });
    assert.deepEqual([...new Set(e.eventosActivos.map((a) => a.id))], ['evento_feria_intercambio']);
    assert.throws(() => estadoInicial(contenido, {}), /rng/);
  });
});

describe('resolver — acciones con chequeo', () => {
  test('60% de éxito: por debajo de 0,6 éxito; desde 0,6 fallo', () => {
    assert.equal(PROBABILIDAD_EXITO, 0.6);
    for (const verbo of VERBOS_CON_CHEQUEO.filter((v) => v !== 'examinar')) {
      assert.equal(resolver(partida(), verbo, {}, rngDe([0.59])).resultado, 'exito', verbo);
      assert.equal(resolver(partida(), verbo, {}, rngDe([0.6])).resultado, 'fallo', verbo);
    }
  });

  test('consulta el rng una sola vez y gasta el costo del contenido', () => {
    const rng = rngDe([0.3]);
    const r = resolver(partida(), 'observar', {}, rng);
    assert.equal(rng.llamadas(), 1);
    assert.equal(r.costoHoras, 0);
    assert.deepEqual(r.efectos, []);
  });

  test('sin chequeo: neutro y sin consultar el rng', () => {
    for (const verbo of ['descansar', 'retirarse', 'abortar', 'rendirse']) {
      const rng = rngDe([0.1]);
      const r = resolver(partida(), verbo, {}, rng);
      assert.equal(r.resultado, 'neutro', verbo);
      assert.equal(rng.llamadas(), 0, verbo);
    }
  });

  test('examinar: sin objeto mira la escena (neutro); con objeto hay chequeo y no gasta usos', () => {
    assert.equal(resolver(partida(), 'examinar').resultado, 'neutro');
    const e = partida({ inventario: [{ objetoId: 'objeto_espada_rota', usosRestantes: 3 }] });
    const r = resolver(e, 'examinar', { objetoId: 'objeto_espada_rota' }, rngDe([0.1]));
    assert.equal(r.resultado, 'exito');
    assert.deepEqual(r.efectos, []);
  });

  test('sin rng o con intención desconocida lanza', () => {
    assert.throws(() => resolverAccion(partida(), { intencionId: 'intencion_observar' }, { contenido }), /rng/);
    assert.throws(() => resolverAccion(partida(), { intencionId: 'intencion_volar' }, { contenido, rng: () => 0 }), /desconocida/);
  });
});

describe('resolver — trabajar', () => {
  test('gana entre 20 y 60 de bronce, sin chequeo', () => {
    for (const [valor, bronce] of [[0, 20], [0.5, 40], [0.999999, 60]]) {
      const r = resolver(partida(), 'trabajar', {}, rngDe([valor]));
      assert.equal(r.resultado, 'exito');
      assert.deepEqual(r.efectos, [{ tipo: 'dinero', moneda: 'bronce', delta: bronce }]);
    }
  });

  test('el dinero se suma al aplicar los efectos', () => {
    const e = partida();
    const r = resolver(e, 'trabajar', {}, rngDe([0.5]));
    assert.equal(aplicarEfectos(e, r.efectos).jugador.bronce, 240);
    assert.equal(e.jugador.bronce, 200);
  });
});

describe('resolver — comprar', () => {
  test('con dinero: descuenta el precio y agrega el objeto con sus usos', () => {
    const e = partida();
    const r = resolver(e, 'comprar', { objetoId: 'objeto_espada_rota' });
    assert.equal(r.resultado, 'exito');
    const despues = aplicarEfectos(e, r.efectos);
    assert.equal(despues.jugador.bronce, 180);
    assert.deepEqual(despues.inventario, [{ objetoId: 'objeto_espada_rota', usosRestantes: 3 }]);
  });

  test('sin dinero: falla y no descuenta nada', () => {
    const e = partida({ jugador: { bronce: 19 } });
    const r = resolver(e, 'comprar', { objetoId: 'objeto_espada_rota' });
    assert.equal(r.resultado, 'fallo');
    assert.equal(r.motivo, MOTIVOS_FALLO.SIN_DINERO);
    assert.deepEqual(r.efectos, []);
    const despues = aplicarEfectos(e, r.efectos);
    assert.equal(despues.jugador.bronce, 19);
    assert.deepEqual(despues.inventario, []);
  });

  test('justo el precio alcanza y deja 0', () => {
    const e = partida({ jugador: { bronce: 20 } });
    const r = resolver(e, 'comprar', { objetoId: 'objeto_espada_rota' });
    assert.equal(aplicarEfectos(e, r.efectos).jugador.bronce, 0);
  });

  test('las monedas no se convierten: un precio en plata pide plata', () => {
    const plaza = { escenaId: 'escena_plaza_cambistas' };
    const sinPlata = partida({ jugador: { ...plaza, bronce: 9999, plata: 3 } });
    assert.equal(resolver(sinPlata, 'comprar', { objetoId: 'objeto_daga' }).motivo, MOTIVOS_FALLO.SIN_DINERO);
    const conPlata = partida({ jugador: { ...plaza, bronce: 0, plata: 4 } });
    const r = resolver(conPlata, 'comprar', { objetoId: 'objeto_daga' });
    assert.equal(r.resultado, 'exito');
    assert.equal(aplicarEfectos(conPlata, r.efectos).jugador.plata, 0);
  });

  test('no se vende en esta escena, o sin objeto', () => {
    assert.equal(resolver(partida(), 'comprar', { objetoId: 'objeto_daga' }).motivo, MOTIVOS_FALLO.NO_SE_VENDE);
    assert.equal(resolver(partida(), 'comprar', { objetoId: 'objeto_sello_archivo' }).motivo, MOTIVOS_FALLO.NO_SE_VENDE);
    assert.equal(resolver(partida(), 'comprar').motivo, MOTIVOS_FALLO.SIN_OBJETO);
  });

  test('precio con evento: el pan fresco cuesta el doble mientras dura', () => {
    const caro = partida({ eventosActivos: [ev('evento_precio_pan_sube', 'escena_mercado_circular')] });
    const r = resolver(caro, 'comprar', { objetoId: 'objeto_pan_fresco' });
    assert.deepEqual(r.precio, { cantidad: 20, moneda: 'bronce' });
    assert.equal(aplicarEfectos(caro, r.efectos).jugador.bronce, 180);
    assert.deepEqual(resolver(partida(), 'comprar', { objetoId: 'objeto_pan_fresco' }).precio, { cantidad: 10, moneda: 'bronce' });
  });

  test('el dinero nunca queda en negativo', () => {
    const e = partida({ jugador: { bronce: 3 } });
    assert.equal(aplicarEfectos(e, [{ tipo: 'dinero', moneda: 'bronce', delta: -10 }]).jugador.bronce, 0);
  });
});

describe('resolver — usar', () => {
  test('gasta un uso por vez y, al llegar a 0, el objeto sale del inventario', () => {
    let e = partida({ inventario: [{ objetoId: 'objeto_espada_rota', usosRestantes: 3 }] });
    for (const quedan of [2, 1]) {
      const rng = rngDe([0.9]);
      const r = resolver(e, 'usar', { objetoId: 'objeto_espada_rota' }, rng);
      assert.equal(r.resultado, 'exito');
      assert.equal(rng.llamadas(), 0);
      e = aplicarEfectos(e, r.efectos);
      assert.deepEqual(e.inventario, [{ objetoId: 'objeto_espada_rota', usosRestantes: quedan }]);
    }
    const ultimo = resolver(e, 'usar', { objetoId: 'objeto_espada_rota' });
    assert.deepEqual(ultimo.efectos, [{ tipo: 'objeto_usado', objetoId: 'objeto_espada_rota', usosRestantes: 0, agotado: true }]);
    e = aplicarEfectos(e, ultimo.efectos);
    assert.deepEqual(e.inventario, []);
    // Ya no lo tiene.
    assert.equal(resolver(e, 'usar', { objetoId: 'objeto_espada_rota' }).motivo, MOTIVOS_FALLO.SIN_OBJETO);
  });

  test('un consumible se agota en un uso; con dos iguales queda el otro', () => {
    const pan = { objetoId: 'objeto_pan_duro', usosRestantes: 1 };
    const e = partida({ inventario: [pan, { ...pan }] });
    const despues = aplicarEfectos(e, resolver(e, 'usar', { objetoId: 'objeto_pan_duro' }).efectos);
    assert.equal(tiene(despues, 'objeto_pan_duro').length, 1);
  });

  test('un objeto sin usos no se gasta', () => {
    const e = partida({ inventario: [{ objetoId: 'objeto_brujula', usosRestantes: null }] });
    const r = resolver(e, 'usar', { objetoId: 'objeto_brujula' });
    assert.equal(r.resultado, 'exito');
    assert.deepEqual(r.efectos, []);
  });

  test('un narrativo de la escena se puede usar sin tenerlo en el inventario', () => {
    const enArchivo = partida({ jugador: { escenaId: 'escena_archivo_real' } });
    assert.equal(resolver(enArchivo, 'usar', { objetoId: 'objeto_sello_archivo' }).resultado, 'exito');
    assert.equal(resolver(partida(), 'usar', { objetoId: 'objeto_sello_archivo' }).motivo, MOTIVOS_FALLO.SIN_OBJETO);
  });

  test('bloqueado por un evento en la escena: falla y no gasta usos', () => {
    const e = partida({
      jugador: { escenaId: 'escena_camino_norte' },
      inventario: [{ objetoId: 'objeto_antorcha', usosRestantes: 5 }],
      eventosActivos: [ev('evento_lluvia_suave', 'escena_camino_norte')],
    });
    const r = resolver(e, 'usar', { objetoId: 'objeto_antorcha' });
    assert.equal(r.resultado, 'fallo');
    assert.equal(r.motivo, MOTIVOS_FALLO.BLOQUEADO);
    assert.deepEqual(r.efectos, [{ tipo: 'bloqueo', eventoId: 'evento_lluvia_suave' }]);
    assert.deepEqual(aplicarEfectos(e, r.efectos).inventario, e.inventario);
    // Sin el evento, funciona.
    assert.equal(resolver({ ...e, eventosActivos: [] }, 'usar', { objetoId: 'objeto_antorcha' }).resultado, 'exito');
  });

  test('un arma usada con otro verbo también gasta un uso', () => {
    const e = partida({ inventario: [{ objetoId: 'objeto_espada_rota', usosRestantes: 3 }] });
    const r = resolver(e, 'atacar', { npcId: 'serel_panadero', objetoId: 'objeto_espada_rota' }, rngDe([0.9]));
    assert.equal(r.resultado, 'fallo');
    assert.equal(aplicarEfectos(e, r.efectos).inventario[0].usosRestantes, 2);
  });
});

describe('resolver — huir', () => {
  test('con éxito mueve al jugador a la primera salida de la escena', () => {
    const e = partida();
    const r = resolver(e, 'huir', {}, rngDe([0.1]));
    assert.equal(r.resultado, 'exito');
    assert.equal(r.escenaNueva, 'escena_archivo_real');
    assert.deepEqual(r.efectos, [{ tipo: 'movimiento', desde: 'escena_mercado_circular', hasta: 'escena_archivo_real' }]);
    assert.equal(aplicarEfectos(e, r.efectos).jugador.escenaId, 'escena_archivo_real');
    assert.equal(r.costoHoras, 0);
  });

  test('con fallo no mueve', () => {
    const e = partida();
    const r = resolver(e, 'huir', {}, rngDe([0.9]));
    assert.equal(r.resultado, 'fallo');
    assert.equal(r.escenaNueva, undefined);
    assert.deepEqual(r.efectos, []);
    assert.equal(aplicarEfectos(e, r.efectos).jugador.escenaId, 'escena_mercado_circular');
  });

  test('desde cada escena del contenido, huir con éxito lleva a una de sus salidas', () => {
    for (const escena of contenido.escenas) {
      const r = resolver(partida({ jugador: { escenaId: escena.id } }), 'huir', {}, rngDe([0]));
      assert.equal(r.escenaNueva, escena.salidas[0], escena.id);
    }
  });

  test('sin salidas, huir con éxito no mueve', () => {
    const c = { ...contenido, escenas: contenido.escenas.map((e) => (e.id === 'escena_mercado_circular' ? { ...e, salidas: [] } : e)) };
    const r = resolverAccion(partida(), { intencionId: 'intencion_huir' }, { contenido: c, rng: () => 0 });
    assert.equal(r.resultado, 'exito');
    assert.equal(r.escenaNueva, undefined);
  });
});

describe('resolver — viajar', () => {
  test('dentro de la ciudad: 1 hora y mueve', () => {
    const r = resolver(partida(), 'viajar', { destino: 'escena_archivo_real' });
    assert.equal(r.resultado, 'exito');
    assert.equal(r.costoHoras, 1);
    assert.equal(r.escenaNueva, 'escena_archivo_real');
  });

  test('a otra ciudad: las horas del camino, sin chequeo', () => {
    const rng = rngDe([0.9]);
    const r = resolver(partida(), 'viajar', { destino: 'ciudad_lareth' }, rng);
    assert.equal(r.resultado, 'exito');
    assert.equal(r.costoHoras, 36);
    assert.equal(r.escenaNueva, 'escena_plaza_cambistas');
    assert.equal(rng.llamadas(), 0);
  });

  test('a un camino o a un lugar de camino: el jugador queda ahí y el reloj avanza el costo', () => {
    const alCamino = resolver(partida(), 'viajar', { destino: 'escena_camino_norte' });
    assert.equal(alCamino.escenaNueva, 'escena_camino_norte');
    assert.equal(alCamino.costoHoras, 18);
    const enCamino = partida({ jugador: { escenaId: 'escena_camino_norte' } });
    const alLago = resolver(enCamino, 'viajar', { destino: 'escena_lago_espejos' });
    assert.equal(alLago.escenaNueva, 'escena_lago_espejos');
    assert.equal(alLago.costoHoras, 1);
    assert.equal(resolver(partida(), 'viajar', { destino: 'escena_lago_espejos' }).costoHoras, 19);
  });

  test('ya está en el destino: neutro, 0 horas, motivo ya_en_destino', () => {
    for (const destino of ['escena_mercado_circular', 'ciudad_ardenhall']) {
      const r = resolver(partida(), 'viajar', { destino });
      assert.equal(r.resultado, 'neutro');
      assert.equal(r.motivo, 'ya_en_destino');
      assert.equal(r.costoHoras, 0);
      assert.deepEqual(r.efectos, []);
    }
  });

  test('camino cortado por un evento: falla y no mueve', () => {
    const e = partida({ eventosActivos: [ev('evento_derrumbe_camino', 'escena_camino_norte')] });
    const r = resolver(e, 'viajar', { destino: 'ciudad_lareth' });
    assert.equal(r.resultado, 'fallo');
    assert.equal(r.motivo, MOTIVOS_FALLO.BLOQUEADO);
    assert.equal(r.escenaNueva, undefined);
    assert.equal(r.costoHoras, 0);
    assert.deepEqual(r.efectos, [{ tipo: 'bloqueo', eventoId: 'evento_derrumbe_camino' }]);
    // Por otro camino sí se puede.
    assert.equal(resolver(e, 'viajar', { destino: 'ciudad_halenor' }).resultado, 'exito');
  });

  test('destino inexistente o faltante: falla sin ruta', () => {
    assert.equal(resolver(partida(), 'viajar', { destino: 'escena_fantasma' }).motivo, MOTIVOS_FALLO.SIN_RUTA);
    assert.equal(resolver(partida(), 'viajar').motivo, MOTIVOS_FALLO.SIN_RUTA);
  });
});

describe('resolver — leer y la marca leyo', () => {
  test('leer en la biblioteca pública activa la marca, una sola vez', () => {
    const e = partida({ jugador: { escenaId: 'escena_biblioteca_publica' } });
    const r = resolver(e, 'leer');
    assert.equal(r.resultado, 'exito');
    assert.deepEqual(r.efectos, [{ tipo: 'marca', marca: 'leyo' }]);
    const despues = aplicarEfectos(e, r.efectos);
    assert.deepEqual(despues.marcas, ['leyo']);
    const otra = resolver(despues, 'leer');
    assert.equal(otra.resultado, 'neutro');
    assert.deepEqual(aplicarEfectos(despues, otra.efectos).marcas, ['leyo']);
  });

  test('leer en otra escena no activa nada', () => {
    const r = resolver(partida(), 'leer');
    assert.equal(r.resultado, 'neutro');
    assert.deepEqual(r.efectos, []);
  });
});

describe('resolver — pureza', () => {
  test('no modifica el estado y cada intención del contenido se resuelve', () => {
    const e = partida({ inventario: [{ objetoId: 'objeto_espada_rota', usosRestantes: 3 }] });
    const copia = structuredClone(e);
    for (const intencion of contenido.intenciones) {
      const r = resolverAccion(
        e,
        { intencionId: intencion.id, parametros: { npcId: 'serel_panadero', objetoId: 'objeto_espada_rota', destino: 'ciudad_lareth' } },
        { contenido, rng: () => 0.3 },
      );
      assert.ok(['exito', 'fallo', 'neutro'].includes(r.resultado), intencion.id);
      assert.equal(r.intencionId, intencion.id);
      assert.ok(Array.isArray(r.efectos));
      assert.ok(r.costoHoras >= 0);
      aplicarEfectos(e, r.efectos);
    }
    assert.deepEqual(e, copia);
  });
});

describe('resolver — costo de reloj por verbo', () => {
  test('cada verbo sin viaje gasta lo que dice reglas.costoHorasPorVerbo', () => {
    const costos = contenido.reglas.costoHorasPorVerbo;
    assert.deepEqual(
      Object.keys(costos).sort(),
      [...new Set(contenido.intenciones.map((i) => i.verbo))].filter((v) => v !== 'viajar').sort(),
    );
    for (const intencion of contenido.intenciones) {
      if (intencion.verbo === 'viajar') continue;
      const r = resolverAccion(partida(), { intencionId: intencion.id, parametros: {} }, { contenido, rng: rngDe([0.1]) });
      assert.equal(r.costoHoras, costos[intencion.verbo], intencion.verbo);
    }
    assert.equal(costos.descansar, 4);
    assert.equal(costos.trabajar, 4);
    assert.equal(costos.ayudar, 1);
    assert.equal(costos.hablar_con, 0);
  });

  test('un verbo sin costo en el contenido gasta 0', () => {
    assert.equal(costoHorasDeVerbo('viajar', contenido), 0);
    assert.equal(costoHorasDeVerbo('descansar', { reglas: {} }), 0);
  });

  test('trabajar paga solo bronce', () => {
    const e = partida();
    const r = resolverAccion(e, { intencionId: 'intencion_trabajar', parametros: {} }, { contenido, rng: rngDe([0.5]) });
    assert.deepEqual(r.efectos.map((x) => [x.tipo, x.moneda]), [['dinero', 'bronce']]);
    const despues = aplicarEfectos(e, r.efectos);
    assert.equal(despues.jugador.plata, e.jugador.plata);
    assert.ok(!('oro' in despues.jugador));
  });
});

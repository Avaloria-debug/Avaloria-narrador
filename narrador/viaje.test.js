import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { clasificarViaje, TIPOS_VIAJE, YA_EN_DESTINO } from './viaje.js';
import { leerContenido } from './cargarContenido.js';

let contenido;
before(async () => {
  contenido = await leerContenido();
});
const viaje = (destino, desde) => clasificarViaje(destino, desde, contenido);

describe('viaje — ya en destino', () => {
  test('destino igual a la escena actual: 0 horas y ya_en_destino', () => {
    assert.deepEqual(viaje('escena_plaza_cambistas', 'escena_plaza_cambistas'), {
      tipo: TIPOS_VIAJE.MISMA_ESCENA,
      horas: 0,
      escenaLlegada: 'escena_plaza_cambistas',
      caminos: [],
      escenasDeRuta: [],
      motivo: 'ya_en_destino',
    });
    assert.equal(viaje('escena_camino_sur', 'escena_camino_sur').motivo, YA_EN_DESTINO);
  });

  test('la ciudad donde ya está el jugador', () => {
    const r = viaje('ciudad_ardenhall', 'escena_archivo_real');
    assert.equal(r.tipo, TIPOS_VIAJE.MISMA_ESCENA);
    assert.equal(r.horas, 0);
    assert.equal(r.motivo, YA_EN_DESTINO);
    assert.equal(r.escenaLlegada, 'escena_archivo_real');
  });

  test('el texto ya_en_destino está en el contenido', () => {
    assert.deepEqual(contenido.plantillas.reformulacion[YA_EN_DESTINO], ['Ya estás en {lugar}.']);
  });
});

describe('viaje — dentro de la ciudad', () => {
  test('cuesta reglas.viajeHorasIntraCiudad, en las tres ciudades', () => {
    for (const [desde, hasta] of [
      ['escena_mercado_circular', 'escena_archivo_real'],
      ['escena_taberna_lareth', 'escena_plaza_cambistas'],
      ['escena_biblioteca_publica', 'escena_aula_cartografia'],
    ]) {
      assert.deepEqual(viaje(hasta, desde), {
        tipo: TIPOS_VIAJE.INTRA_CIUDAD,
        horas: 1,
        escenaLlegada: hasta,
        caminos: [],
        escenasDeRuta: [hasta],
      });
    }
    const otro = { ...contenido, reglas: { ...contenido.reglas, viajeHorasIntraCiudad: 3 } };
    assert.equal(clasificarViaje('escena_archivo_real', 'escena_mercado_circular', otro).horas, 3);
  });
});

describe('viaje — por camino', () => {
  test('entre ciudades: las horas del camino que las une', () => {
    const casos = [
      ['escena_mercado_circular', 'ciudad_lareth', 36, 'escena_camino_norte', 'escena_plaza_cambistas'],
      ['escena_plaza_cambistas', 'ciudad_ardenhall', 36, 'escena_camino_norte', 'escena_mercado_circular'],
      ['escena_plaza_cambistas', 'ciudad_halenor', 44, 'escena_camino_este', 'escena_aula_cartografia'],
      ['escena_aula_cartografia', 'ciudad_lareth', 44, 'escena_camino_este', 'escena_plaza_cambistas'],
      ['escena_archivo_real', 'ciudad_halenor', 52, 'escena_camino_sur', 'escena_biblioteca_publica'],
      ['escena_biblioteca_publica', 'ciudad_ardenhall', 52, 'escena_camino_sur', 'escena_archivo_real'],
    ];
    for (const [desde, destino, horas, camino, llegada] of casos) {
      assert.deepEqual(viaje(destino, desde), {
        tipo: TIPOS_VIAJE.POR_CAMINO,
        horas,
        caminos: [camino],
        escenaLlegada: llegada,
        escenasDeRuta: [camino, llegada],
      });
    }
  });

  test('Ardenhall -> Lareth directo: 36 horas', () => {
    assert.equal(viaje('ciudad_lareth', 'escena_mercado_circular').horas, 36);
  });

  test('Ardenhall -> camino del norte -> Lareth: 36 horas en total, no 72', () => {
    const ida = viaje('escena_camino_norte', 'escena_mercado_circular');
    const resto = viaje('ciudad_lareth', 'escena_camino_norte');
    assert.deepEqual(ida, {
      tipo: TIPOS_VIAJE.POR_CAMINO,
      horas: 18,
      caminos: ['escena_camino_norte'],
      escenaLlegada: 'escena_camino_norte',
      escenasDeRuta: ['escena_camino_norte'],
    });
    assert.equal(resto.horas, 18);
    assert.equal(resto.escenaLlegada, 'escena_plaza_cambistas');
    assert.equal(ida.horas + resto.horas, 36);
  });

  test('camino del norte -> Ardenhall (vuelta): 18 horas', () => {
    const vuelta = viaje('ciudad_ardenhall', 'escena_camino_norte');
    assert.equal(vuelta.horas, 18);
    assert.equal(vuelta.escenaLlegada, 'escena_mercado_circular');
    // Ida y vuelta a mitad de ruta: mitad al entrar + mitad al salir.
    assert.equal(viaje('escena_camino_norte', 'escena_mercado_circular').horas + vuelta.horas, 36);
  });

  test('detenerse en cualquier camino no duplica el costo', () => {
    for (const [camino, a, b, horas] of [
      ['escena_camino_norte', 'escena_mercado_circular', 'ciudad_lareth', 36],
      ['escena_camino_este', 'escena_plaza_cambistas', 'ciudad_halenor', 44],
      ['escena_camino_sur', 'escena_archivo_real', 'ciudad_halenor', 52],
    ]) {
      assert.equal(viaje(camino, a).horas + viaje(b, camino).horas, horas, camino);
      assert.equal(viaje(b, a).horas, horas, camino);
    }
  });

  test('mitad de un camino de horas impares: redondea hacia arriba, y el cruce completo no suma de más', () => {
    const c = { ...contenido, reglas: { ...contenido.reglas, viajeHorasPorCamino: { ...contenido.reglas.viajeHorasPorCamino, escena_camino_norte: 35 } } };
    assert.equal(clasificarViaje('escena_camino_norte', 'escena_mercado_circular', c).horas, 18);
    assert.equal(clasificarViaje('ciudad_ardenhall', 'escena_camino_norte', c).horas, 18);
    assert.equal(clasificarViaje('ciudad_lareth', 'escena_mercado_circular', c).horas, 35);
  });

  test('rutas de un camino: Ardenhall -> Halenor por el sur (52) y Lareth -> Halenor por el este (44)', () => {
    assert.deepEqual(viaje('ciudad_halenor', 'escena_mercado_circular').caminos, ['escena_camino_sur']);
    assert.equal(viaje('ciudad_halenor', 'escena_mercado_circular').horas, 52);
    assert.deepEqual(viaje('ciudad_halenor', 'escena_taberna_lareth').caminos, ['escena_camino_este']);
    assert.equal(viaje('ciudad_halenor', 'escena_taberna_lareth').horas, 44);
  });

  test('ruta que cruza dos caminos: suma cada camino una vez', () => {
    // Del mercado al camino del este: norte completo (36) + mitad del este (22).
    const r = viaje('escena_camino_este', 'escena_mercado_circular');
    assert.equal(r.horas, 58);
    assert.deepEqual(r.caminos, ['escena_camino_norte', 'escena_camino_este']);
    // Del camino del norte a Halenor: mitad del norte (18) + este completo (44), por Lareth.
    const s = viaje('ciudad_halenor', 'escena_camino_norte');
    assert.equal(s.horas, 62);
    assert.deepEqual(s.caminos, ['escena_camino_norte', 'escena_camino_este']);
    // Sin el camino del sur, de Ardenhall a Halenor se va por el norte y el este: 36 + 44.
    const sinSur = {
      ...contenido,
      escenas: contenido.escenas
        .filter((e) => e.id !== 'escena_camino_sur')
        .map((e) => ({ ...e, salidas: e.salidas.filter((x) => x !== 'escena_camino_sur') })),
    };
    const t = clasificarViaje('ciudad_halenor', 'escena_mercado_circular', sinSur);
    assert.equal(t.horas, 80);
    assert.deepEqual(t.caminos, ['escena_camino_norte', 'escena_camino_este']);
  });

  test('desde la otra escena de la ciudad no se suma la hora dentro de la ciudad', () => {
    assert.equal(viaje('ciudad_lareth', 'escena_archivo_real').horas, 36);
    assert.equal(viaje('ciudad_ardenhall', 'escena_taberna_lareth').horas, 36);
  });

  test('escena de otra ciudad: llega a esa escena, con las horas del camino', () => {
    const r = viaje('escena_taberna_lareth', 'escena_mercado_circular');
    assert.equal(r.tipo, TIPOS_VIAJE.POR_CAMINO);
    assert.equal(r.horas, 36);
    assert.equal(r.escenaLlegada, 'escena_taberna_lareth');
  });

  test('lugar de camino: 1 hora entre el lugar y su camino', () => {
    assert.equal(contenido.reglas.viajeHorasLugarCamino, 1);
    for (const [lugar, camino] of [
      ['escena_lago_espejos', 'escena_camino_norte'],
      ['escena_puente_aduana', 'escena_camino_este'],
      ['escena_cruce_colinas', 'escena_camino_sur'],
    ]) {
      assert.equal(viaje(camino, lugar).horas, 1, lugar);
      assert.equal(viaje(lugar, camino).horas, 1, lugar);
      assert.equal(viaje(lugar, camino).escenaLlegada, lugar);
    }
  });

  test('lugar de camino: se suma a la mitad del camino', () => {
    // Del lago a Lareth: 1 hasta el camino + 18 de medio camino del norte.
    assert.equal(viaje('ciudad_lareth', 'escena_lago_espejos').horas, 19);
    assert.equal(viaje('ciudad_ardenhall', 'escena_lago_espejos').horas, 19);
    assert.equal(viaje('escena_lago_espejos', 'escena_mercado_circular').horas, 19);
    // Del lago al puente: 1 + 18 (norte) + 22 (este) + 1.
    assert.equal(viaje('escena_puente_aduana', 'escena_lago_espejos').horas, 42);
    const otro = { ...contenido, reglas: { ...contenido.reglas, viajeHorasLugarCamino: 3 } };
    assert.equal(clasificarViaje('escena_lago_espejos', 'escena_camino_norte', otro).horas, 3);
  });

  test('escenasDeRuta: las escenas por las que pasa, sin la de partida', () => {
    assert.deepEqual(viaje('ciudad_lareth', 'escena_mercado_circular').escenasDeRuta, [
      'escena_camino_norte',
      'escena_plaza_cambistas',
    ]);
    assert.deepEqual(viaje('escena_archivo_real', 'escena_mercado_circular').escenasDeRuta, ['escena_archivo_real']);
  });

  test('las horas salen de reglas.viajeHorasPorCamino', () => {
    const otro = { ...contenido, reglas: { ...contenido.reglas, viajeHorasPorCamino: { ...contenido.reglas.viajeHorasPorCamino, escena_camino_norte: 10 } } };
    assert.equal(clasificarViaje('ciudad_lareth', 'escena_mercado_circular', otro).horas, 10);
  });
});

describe('viaje — sin ruta', () => {
  test('destino o escena actual inexistentes', () => {
    const sin = { tipo: TIPOS_VIAJE.SIN_RUTA, horas: null, escenaLlegada: null, caminos: [], escenasDeRuta: [] };
    assert.deepEqual(viaje('escena_fantasma', 'escena_mercado_circular'), sin);
    assert.deepEqual(viaje('ciudad_fantasma', 'escena_mercado_circular'), sin);
    assert.deepEqual(viaje('ciudad_lareth', 'escena_fantasma'), sin);
  });

  test('escena aislada', () => {
    const c = { ...contenido, escenas: [...contenido.escenas, { id: 'escena_isla', nombre: 'Isla', ciudad: null, salidas: [] }] };
    assert.equal(clasificarViaje('escena_isla', 'escena_mercado_circular', c).tipo, TIPOS_VIAJE.SIN_RUTA);
  });

  test('no modifica el contenido', () => {
    const antes = structuredClone(contenido);
    viaje('ciudad_halenor', 'escena_mercado_circular');
    assert.deepEqual(contenido, antes);
  });
});

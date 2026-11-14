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
      assert.deepEqual(viaje(hasta, desde), { tipo: TIPOS_VIAJE.INTRA_CIUDAD, horas: 1, escenaLlegada: hasta, caminos: [] });
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
      });
    }
  });

  test('desde la otra escena de la ciudad no se suma la hora dentro de la ciudad', () => {
    // El camino del norte sale del mercado; desde el archivo cuesta lo mismo.
    assert.equal(viaje('ciudad_lareth', 'escena_archivo_real').horas, 36);
    assert.equal(viaje('ciudad_halenor', 'escena_mercado_circular').horas, 52);
  });

  test('destino camino: las horas de ese camino', () => {
    assert.deepEqual(viaje('escena_camino_norte', 'escena_mercado_circular'), {
      tipo: TIPOS_VIAJE.POR_CAMINO,
      horas: 36,
      caminos: ['escena_camino_norte'],
      escenaLlegada: 'escena_camino_norte',
    });
    assert.equal(viaje('escena_camino_este', 'escena_plaza_cambistas').horas, 44);
    assert.equal(viaje('escena_camino_sur', 'escena_biblioteca_publica').horas, 52);
  });

  test('escena de otra ciudad: llega a esa escena, con las horas del camino', () => {
    const r = viaje('escena_taberna_lareth', 'escena_mercado_circular');
    assert.equal(r.tipo, TIPOS_VIAJE.POR_CAMINO);
    assert.equal(r.horas, 36);
    assert.equal(r.escenaLlegada, 'escena_taberna_lareth');
  });

  test('si no hay camino directo, se suman los caminos de la ruta más corta', () => {
    // Al camino del este no se llega desde Ardenhall sin pasar por otro camino: norte (36) + este (44).
    const r = viaje('escena_camino_este', 'escena_mercado_circular');
    assert.equal(r.horas, 80);
    assert.deepEqual(r.caminos, ['escena_camino_norte', 'escena_camino_este']);
  });

  test('desde un camino: cuenta el camino de partida', () => {
    assert.equal(viaje('ciudad_lareth', 'escena_camino_norte').horas, 36);
    assert.equal(viaje('ciudad_lareth', 'escena_lago_espejos').horas, 36);
    assert.equal(viaje('ciudad_halenor', 'escena_camino_norte').horas, 80);
  });

  test('las horas salen de reglas.viajeHorasPorCamino', () => {
    const otro = { ...contenido, reglas: { ...contenido.reglas, viajeHorasPorCamino: { ...contenido.reglas.viajeHorasPorCamino, escena_camino_norte: 10 } } };
    assert.equal(clasificarViaje('ciudad_lareth', 'escena_mercado_circular', otro).horas, 10);
  });
});

describe('viaje — sin ruta', () => {
  test('destino o escena actual inexistentes', () => {
    const sin = { tipo: TIPOS_VIAJE.SIN_RUTA, horas: null, escenaLlegada: null, caminos: [] };
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

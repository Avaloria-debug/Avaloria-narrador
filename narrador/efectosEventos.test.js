import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  efectosActivos,
  deltaDisposicionPorEventos,
  conocimientoHabilitado,
  precioEfectivo,
  eventoQueBloquea,
} from './efectosEventos.js';
import { clasificarViaje } from './viaje.js';
import { leerContenido } from './cargarContenido.js';
import { eventoActivo as ev, contenidoConSenderoPorTormenta } from './utilsPrueba.js';

let contenido;
before(async () => {
  contenido = await leerContenido();
});
const objeto = (id) => contenido.objetos.find((o) => o.id === id);
const viajeA = (destino, desde) => {
  const v = clasificarViaje(destino, desde, contenido);
  return { destino, escenaLlegada: v.escenaLlegada, escenasDeRuta: v.escenasDeRuta };
};

describe('efectos de eventos — vigencia', () => {
  test('sin eventos activos no hay efectos', () => {
    assert.deepEqual(efectosActivos([], contenido), []);
    assert.deepEqual(efectosActivos(undefined, contenido), []);
  });

  test('un evento activo en dos escenas cuenta una vez', () => {
    const activos = [ev('evento_feria_intercambio', 'escena_mercado_circular'), ev('evento_feria_intercambio', 'escena_plaza_cambistas')];
    assert.equal(efectosActivos(activos, contenido).length, 1);
    assert.equal(deltaDisposicionPorEventos('serel_panadero', activos, contenido), 1);
  });

  test('todos los efectos del contenido se leen sin error', () => {
    const activos = contenido.eventos.map((e) => ev(e.id, e.escenas[0]));
    const total = contenido.eventos.reduce((n, e) => n + e.efectos.length, 0);
    assert.equal(efectosActivos(activos, contenido).length, total);
  });
});

describe('efectos de eventos — disposicion', () => {
  test('se suma por NPC y desaparece al cerrar el evento', () => {
    const activos = [ev('evento_festividad_plaza', 'escena_plaza_cambistas'), ev('evento_moneda_nueva', 'escena_plaza_cambistas')];
    assert.equal(deltaDisposicionPorEventos('ivor_cambista', activos, contenido), 2);
    assert.equal(deltaDisposicionPorEventos('ivor_cambista', activos.slice(1), contenido), 1);
    assert.equal(deltaDisposicionPorEventos('ivor_cambista', [], contenido), 0);
    assert.equal(deltaDisposicionPorEventos('maren_archivista', activos, contenido), 0);
  });

  test('efectos opuestos se compensan', () => {
    const activos = [ev('evento_festividad_plaza', 'escena_plaza_cambistas'), ev('evento_deuda_impaga', 'escena_plaza_cambistas')];
    assert.equal(deltaDisposicionPorEventos('ivor_cambista', activos, contenido), 0);
  });
});

describe('efectos de eventos — bloqueo', () => {
  test('usar un objeto: solo en la escena del evento', () => {
    const activos = [ev('evento_lluvia_suave', 'escena_camino_norte')];
    const usar = { verbo: 'usar', objetoId: 'objeto_antorcha' };
    assert.equal(eventoQueBloquea(usar, 'escena_camino_norte', activos, contenido), 'evento_lluvia_suave');
    assert.equal(eventoQueBloquea(usar, 'escena_mercado_circular', activos, contenido), null);
    assert.equal(eventoQueBloquea({ verbo: 'usar', objetoId: 'objeto_cuerda' }, 'escena_camino_norte', activos, contenido), null);
    assert.equal(eventoQueBloquea({ verbo: 'distraer', objetoId: 'objeto_antorcha' }, 'escena_camino_norte', activos, contenido), null);
    assert.equal(eventoQueBloquea(usar, 'escena_camino_norte', [], contenido), null);
  });

  test('hablar con un NPC', () => {
    const activos = [ev('evento_cierre_taberna', 'escena_taberna_lareth')];
    assert.equal(
      eventoQueBloquea({ verbo: 'hablar_con', npcId: 'naela_tabernera' }, 'escena_taberna_lareth', activos, contenido),
      'evento_cierre_taberna',
    );
    assert.equal(eventoQueBloquea({ verbo: 'hablar_con', npcId: 'ivor_cambista' }, 'escena_taberna_lareth', activos, contenido), null);
    assert.equal(eventoQueBloquea({ verbo: 'negociar', npcId: 'naela_tabernera' }, 'escena_taberna_lareth', activos, contenido), null);
  });

  test('viajar a un destino: el cierre de la puerta bloquea ir a Ardenhall desde los caminos', () => {
    const activos = [ev('evento_cierre_puerta', 'escena_camino_norte'), ev('evento_cierre_puerta', 'escena_camino_sur')];
    const bloquea = (destino, desde) =>
      eventoQueBloquea({ verbo: 'viajar', viaje: viajeA(destino, desde) }, desde, activos, contenido);
    assert.equal(bloquea('ciudad_ardenhall', 'escena_camino_norte'), 'evento_cierre_puerta');
    assert.equal(bloquea('escena_mercado_circular', 'escena_camino_norte'), 'evento_cierre_puerta');
    assert.equal(bloquea('ciudad_ardenhall', 'escena_camino_sur'), 'evento_cierre_puerta');
    // Hacia otra ciudad, o desde un lugar sin el evento, no bloquea.
    assert.equal(bloquea('ciudad_lareth', 'escena_camino_norte'), null);
    assert.equal(bloquea('ciudad_ardenhall', 'escena_camino_este'), null);
    assert.equal(bloquea('ciudad_ardenhall', 'escena_plaza_cambistas'), null);
  });

  test('viajar por una escena: el derrumbe corta el camino del norte', () => {
    const activos = [ev('evento_derrumbe_camino', 'escena_camino_norte')];
    const bloquea = (destino, desde) =>
      eventoQueBloquea({ verbo: 'viajar', viaje: viajeA(destino, desde) }, desde, activos, contenido);
    assert.equal(bloquea('ciudad_lareth', 'escena_mercado_circular'), 'evento_derrumbe_camino');
    assert.equal(bloquea('escena_camino_norte', 'escena_plaza_cambistas'), 'evento_derrumbe_camino');
    assert.equal(bloquea('escena_lago_espejos', 'escena_mercado_circular'), 'evento_derrumbe_camino');
    // Otros caminos, y salir del camino cortado, no se bloquean.
    assert.equal(bloquea('ciudad_halenor', 'escena_mercado_circular'), null);
    assert.equal(bloquea('escena_archivo_real', 'escena_mercado_circular'), null);
    assert.equal(bloquea('ciudad_lareth', 'escena_camino_norte'), null);
  });
});

describe('efectos de eventos — habilita', () => {
  test('la tormenta habilita el conocimiento de Hollis mientras dura', () => {
    const activos = [ev('evento_tormenta_verano', 'escena_camino_sur')];
    const id = 'conocimiento_sendero_sin_vigilancia';
    const c = contenidoConSenderoPorTormenta(contenido);
    assert.equal(conocimientoHabilitado('hollis_pastor', id, activos, c), true);
    assert.equal(conocimientoHabilitado('hollis_pastor', id, [], c), false);
    assert.equal(conocimientoHabilitado('oren_peregrino', id, activos, c), false);
    assert.equal(conocimientoHabilitado('hollis_pastor', 'conocimiento_oren_1', activos, c), false);
  });
});

describe('efectos de eventos — precio', () => {
  test('multiplicador sobre un objeto', () => {
    const activos = [ev('evento_precio_pan_sube', 'escena_mercado_circular')];
    assert.deepEqual(precioEfectivo(objeto('objeto_pan_fresco'), activos, contenido), { cantidad: 20, moneda: 'bronce' });
    assert.deepEqual(precioEfectivo(objeto('objeto_pan_duro'), activos, contenido), { cantidad: 5, moneda: 'bronce' });
  });

  test('porcentaje sobre una categoría, redondeado hacia arriba', () => {
    const activos = [ev('evento_cosecha_abundante', 'escena_camino_sur')];
    assert.equal(precioEfectivo(objeto('objeto_pan_fresco'), activos, contenido).cantidad, 8);
    assert.equal(precioEfectivo(objeto('objeto_pan_duro'), activos, contenido).cantidad, 4);
    assert.equal(precioEfectivo(objeto('objeto_queso_curado'), activos, contenido).cantidad, 12);
    // 2 bronce con 20% menos son 1,6: sube a 2.
    assert.equal(precioEfectivo(objeto('objeto_agua_manantial'), activos, contenido).cantidad, 2);
    // No es consumible: no cambia.
    assert.equal(precioEfectivo(objeto('objeto_espada_rota'), activos, contenido).cantidad, 20);
  });

  test('los dos efectos juntos, y sin eventos el precio del contenido', () => {
    const activos = [ev('evento_precio_pan_sube', 'escena_mercado_circular'), ev('evento_cosecha_abundante', 'escena_camino_sur')];
    assert.equal(precioEfectivo(objeto('objeto_pan_fresco'), activos, contenido).cantidad, 16);
    assert.deepEqual(precioEfectivo(objeto('objeto_pan_fresco'), [], contenido), { cantidad: 10, moneda: 'bronce' });
  });

  test('objeto sin precio', () => {
    assert.equal(precioEfectivo(objeto('objeto_sello_archivo'), [], contenido), null);
  });
});

// Cierre de la fase 1: opciones de salida, plantillas sin_salidas y destino_ambiguo, y turnos consulta narrados.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, contenido, diccionarios } from './index.js';
import { ejecutarTurno } from './turno.js';
import { narrarTurno, formatearOpciones, completar, limpiarValores } from './narracion.js';
import { rngSembrado } from './utilsPrueba.js';

const en = (escenaId, cambios = {}) => {
  const e = crearPartida({ semilla: 4 });
  return { ...e, ...cambios, jugador: { ...e.jugador, escenaId } };
};
const jugar = (estado, texto, c = contenido) => {
  const rng = rngSembrado(9);
  const t = ejecutarTurno(estado, { tipo: 'texto', texto }, { contenido: c, rng, diccionarios });
  return { t, r: narrarTurno(t, { contenido: c, rng, aperturas: [] }) };
};
const reformulacion = contenido.plantillas.reformulacion;

describe('formato de {opciones}: nombres separados por ", " y "o" antes del último', () => {
  test('1, 2 y 3 salidas', () => {
    assert.equal(formatearOpciones(['A']), 'A');
    assert.equal(formatearOpciones(['A', 'B']), 'A o B');
    assert.equal(formatearOpciones(['A', 'B', 'C']), 'A, B o C');
    assert.equal(formatearOpciones([]), null);
    assert.equal(limpiarValores({ opciones: ['A', 'B', 'C'] }).opciones, 'A, B o C');
    assert.equal(completar('Hay más de un camino: {opciones}. ¿Por cuál vas?', { opciones: ['A', 'B'] }), 'Hay más de un camino: A o B. ¿Por cuál vas?');
  });

  test('con las escenas reales: la plantilla completa con 2 y 3 salidas', () => {
    const nombres = (id) => contenido.escenas.find((e) => e.id === id).salidas.map((s) => contenido.escenas.find((x) => x.id === s).nombre);
    const dos = nombres('escena_mercado_circular');
    const tres = nombres('escena_plaza_cambistas');
    assert.equal(dos.length, 2);
    assert.equal(tres.length, 3);
    assert.equal(jugar(en('escena_mercado_circular'), 'salir de acá').r.texto, `Hay más de un camino: ${dos[0]} o ${dos[1]}. ¿Por cuál vas?`);
    assert.equal(jugar(en('escena_plaza_cambistas'), 'salir de acá').r.texto, `Hay más de un camino: ${tres[0]}, ${tres[1]} o ${tres[2]}. ¿Por cuál vas?`);
  });
});

describe('sin_salidas y destino_ambiguo usan su plantilla, no el respaldo', () => {
  test('sin_salidas', () => {
    const sin = { ...contenido, escenas: contenido.escenas.map((e) => (e.id === 'escena_taberna_lareth' ? { ...e, salidas: [] } : e)) };
    const { t, r } = jugar(en('escena_taberna_lareth'), 'salir de acá', sin);
    assert.equal(t.motivo, 'sin_salidas');
    assert.equal(r.respaldo, false);
    assert.equal(r.texto, 'No hay por dónde seguir desde acá. Tendrás que esperar o buscar otro camino.');
    assert.deepEqual(reformulacion.sin_salidas, [r.texto]);
    const respaldoTexto = reformulacion.no_entendido;
    assert.ok(!respaldoTexto.includes(r.texto));
  });

  test('destino_ambiguo (salidas)', () => {
    const { t, r } = jugar(en('escena_plaza_cambistas'), 'salir de acá');
    assert.equal(t.motivo, 'destino_ambiguo');
    assert.equal(r.respaldo, false);
    assert.ok(r.texto.startsWith('Hay más de un camino: '), r.texto);
    assert.ok(reformulacion.destino_ambiguo.includes('Hay más de un camino: {opciones}. ¿Por cuál vas?'));
  });

  test('destino_ambiguo (viaje a un destino que nombra dos): sigue con la variante de {nombres}', () => {
    const { t, r } = jugar(en('escena_plaza_cambistas'), 'viajar a Lareth o a Halenor');
    assert.equal(t.motivo, 'destino_ambiguo');
    assert.equal(r.respaldo, false);
    assert.ok(r.texto.startsWith('¿A dónde querés ir: '), r.texto);
  });
});

describe('los turnos consulta se narran', () => {
  test('una consulta de tema produce texto de plantilla (revela o no_se), no nulo ni respaldo', () => {
    const e = en('escena_mercado_circular');
    const conRelacion = { ...e, npcs: { ...e.npcs, serel_panadero: { ...e.npcs.serel_panadero, relacion: 30 } } };
    for (const estado of [conRelacion, e]) {
      const { t, r } = jugar(estado, '¿qué sabés de la harina?');
      assert.equal(t.tipo, 'consulta');
      assert.equal(typeof r.texto, 'string');
      assert.ok(r.texto.length > 0);
      assert.equal(r.respaldo, false);
    }
  });
});

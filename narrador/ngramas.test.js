import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trigramas, similitud } from './ngramas.js';
import { decidir, coincidirPorRaiz, coincidirPorNgramas, coincidirIntencion } from './comprension.js';
import { contenido } from './index.js';

const I = contenido.intenciones;

test('ngramas: trigramas con bordes y coseno', () => {
  assert.deepEqual([...trigramas('pan').keys()], [' pa', 'pan', 'an ']);
  assert.ok(Math.abs(similitud('calmar', 'calmar') - 1) < 1e-9);
  assert.ok(similitud('tranquilisar', 'tranquilizar') >= 0.6);
  assert.ok(similitud('perro', 'calmar') < 0.2);
});

test('comprension: "calmando la situacion" se resuelve por raíz', () => {
  assert.equal(coincidirIntencion('calmando la situacion', I), null);
  const d = decidir('calmando la situacion', { intenciones: I, escenas: contenido.escenas, escena: { id: 'escena_mercado_circular' }, npcsPresentes: [], npcsAusentes: [], objetosAplicables: [] });
  assert.equal(d.tipo, 'ejecutar');
  assert.equal(d.intencionId, 'intencion_calmar');
  assert.equal(d.pasada, 'raiz');
});

test('comprension: typo resuelto por trigramas', () => {
  assert.equal(coincidirIntencion('tranquilisando', I), null);
  assert.equal(coincidirPorRaiz('tranquilisando', I), null);
  assert.equal(coincidirPorNgramas('tranquilisando', I).intencionId, 'intencion_calmar');
});

test('comprension: falso positivo no resuelve', () => {
  for (const t of ['el perro come manzanas', 'blablabla sin sentido', 'sigo sin decir nada claro', 'asdf qwer zxcv']) {
    assert.equal(coincidirPorRaiz(t, I), null, t);
    assert.equal(coincidirPorNgramas(t, I), null, t);
  }
});

test('comprension: verbos de riesgo y viajar no pasan por las pasadas de respaldo', () => {
  assert.equal(coincidirPorRaiz('atacando', I), null);
  assert.equal(coincidirPorRaiz('viajando', I), null);
});

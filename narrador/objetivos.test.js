import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avanzarObjetivos, impulsar, objetivoPasoDe, objetivosGuardados } from './objetivos.js';
import { crearPartida, narrar, cargarPartida } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const tabla = { a: { id: 'obj_a', afinidad: { ayudar: 1, presionar: -1 }, pasos: [{ avanzaCadaH: 24, prob: 0.5 }, { avanzaCadaH: 24, prob: 0.5 }, { avanzaCadaH: 24, prob: 0.5 }] } };
const r = (dia) => ({ dia, hora: '08:00' });

test('objetivos: avanzan sin el jugador con el reloj', () => {
  let e = avanzarObjetivos({}, tabla, { reloj: r(1), semillaBase: 1 });
  assert.equal(e.a.paso, 0);
  e = avanzarObjetivos(e, tabla, { reloj: r(30), semillaBase: 1 });
  assert.equal(e.a.paso, 3);
});

test('objetivos: deterministas con la semilla', () => {
  const a = avanzarObjetivos(avanzarObjetivos({}, tabla, { reloj: r(1), semillaBase: 9 }), tabla, { reloj: r(4), semillaBase: 9 });
  const b = avanzarObjetivos(avanzarObjetivos({}, tabla, { reloj: r(1), semillaBase: 9 }), tabla, { reloj: r(4), semillaBase: 9 });
  assert.deepEqual(a, b);
  assert.equal(objetivoPasoDe(a, tabla, 'a'), `obj_a.${a.a.paso}`);
});

test('objetivos: ayudar acelera y presionar frena', () => {
  const base = avanzarObjetivos({}, tabla, { reloj: r(1), semillaBase: 3 });
  let rapido = base;
  let lento = base;
  for (let i = 0; i < 5; i++) { rapido = impulsar(rapido, tabla, { npc: 'a', verbo: 'ayudar' }); lento = impulsar(lento, tabla, { npc: 'a', verbo: 'presionar' }); }
  assert.equal(rapido.a.impulso, 3);
  assert.equal(lento.a.impulso, -3);
  let pr = 0;
  let pl = 0;
  for (let s = 0; s < 40; s++) {
    pr += avanzarObjetivos({ a: { ...rapido.a } }, tabla, { reloj: r(3), semillaBase: s }).a.paso;
    pl += avanzarObjetivos({ a: { ...lento.a } }, tabla, { reloj: r(3), semillaBase: s }).a.paso;
  }
  assert.ok(pr > pl, `${pr} ${pl}`);
});

test('objetivos: persisten; partida vieja → {}', async () => {
  assert.deepEqual(objetivosGuardados(undefined), {});
  const amp = await cargarAmpliadoNode({ cargarPendientes: true, incluirCanon: true });
  let e = crearPartida({ semilla: 2 });
  for (let i = 0; i < 3; i++) e = (await narrar(e, { tipo: 'boton', intencionId: 'intencion_descansar' }, { ampliado: amp })).estado;
  assert.ok(Object.keys(e.ext.objetivos).length >= 12);
  assert.deepEqual(cargarPartida(JSON.stringify(e)).ext.objetivos, e.ext.objetivos);
});

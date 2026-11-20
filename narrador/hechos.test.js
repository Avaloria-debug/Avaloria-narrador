import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrarHecho, recortar, recuerdosDe, lineaDeMemoria, hechosGuardados, MAX_HECHOS } from './hechos.js';
import { crearRng } from './azar.js';
import { crearPartida, narrar, cargarPartida } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const reloj = (dia, hora = '10:00') => ({ dia, hora });

test('hechos: registra los verbos que cuentan, con peso', () => {
  let l = registrarHecho([], { verbo: 'ayudar', npc: 'a', escena: 'e', reloj: reloj(1) });
  l = registrarHecho(l, { verbo: 'atacar', npc: 'a', escena: 'e', reloj: reloj(1) });
  l = registrarHecho(l, { verbo: 'observar', npc: 'a', escena: 'e', reloj: reloj(1) });
  assert.deepEqual(l.map((h) => [h.tipo, h.peso]), [['ayudar', 2], ['atacar', 3]]);
});

test('hechos: tope de 200, se va el de menor peso y más viejo', () => {
  const l = Array.from({ length: MAX_HECHOS }, (_, i) => ({ id: String(i), tipo: 'ayudar', npc: 'a', tick: i + 10, peso: i === 5 ? 3 : 2 }));
  const r = recortar([...l, { id: 'n', tipo: 'atacar', npc: 'a', tick: 999, peso: 3 }]);
  assert.equal(r.length, MAX_HECHOS);
  assert.ok(!r.some((h) => h.id === '0'));
  assert.ok(r.some((h) => h.id === '5'));
});

test('hechos: reciente y lejano', () => {
  const l = registrarHecho([], { verbo: 'presionar', npc: 'a', escena: 'e', reloj: reloj(1) });
  assert.equal(recuerdosDe(l, 'a', reloj(2)).ant, 'reciente');
  assert.equal(recuerdosDe(l, 'a', reloj(4)).ant, 'lejano');
  assert.deepEqual(recuerdosDe(l, 'a', reloj(2)).rec, ['presionar']);
  assert.deepEqual(recuerdosDe(l, 'b', reloj(2)), {});
});

test('hechos: la línea de memoria elegida (propia o genérica)', () => {
  const r = recuerdosDe(registrarHecho([], { verbo: 'ayudar', npc: 'maren_archivista', escena: 'e', reloj: reloj(1) }), 'maren_archivista', reloj(1));
  assert.ok(amp.memoria.maren_archivista.ayudar[0].includes(lineaDeMemoria(amp, 'maren_archivista', r, crearRng(1))));
  const sinLinea = { ...amp, memoria: {} };
  assert.ok(amp.genericas.ayudar[0].includes(lineaDeMemoria(sinLinea, 'maren_archivista', r, crearRng(1))));
});

test('hechos: partida vieja → []; persiste con la partida', async () => {
  assert.deepEqual(hechosGuardados(undefined), []);
  let e = crearPartida({ semilla: 4 });
  const npc = Object.keys(e.npcs).find(() => true);
  for (let i = 0; i < 3; i++) e = (await narrar(e, { tipo: 'boton', intencionId: 'intencion_ayudar' }, { ampliado: amp })).estado;
  const cargada = cargarPartida(JSON.stringify(e));
  assert.deepEqual(cargada.ext.hechos, e.ext.hechos);
  assert.ok(npc);
});

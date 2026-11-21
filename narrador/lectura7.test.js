// Fase 6 (V7): varias acciones, negación y modo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';
import { leerAccion, contextoLectura, separarAcciones, extraerModo } from './lectura.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const op = { ampliado: amp, ahora: () => 0 };
const F = amp.focos;
const ctx = () => contextoLectura({ focos: F.defs, npcs: contenido.npcs, escenas: contenido.escenas, presentes: ['serel_panadero'] });

test('V7 separar: «y», «y después», «luego», coma; solo si cada parte tiene verbo; máx. 3', () => {
  assert.deepEqual(separarAcciones('miro la puerta y después toco la ventana'), ['miro la puerta', 'toco la ventana']);
  assert.deepEqual(separarAcciones('miro la isla, después escucho la lluvia'), ['miro la isla', 'escucho la lluvia']);
  assert.deepEqual(separarAcciones('miro la gata y el burro'), ['miro la gata y el burro']);
  assert.equal(separarAcciones('miro la isla y toco la puerta y sigo a la gata y escucho la lluvia').length, 3);
});
test('V7 la 2.ª acción usa las referencias de la 1.ª', () => {
  const l = leerAccion('agarro la moneda y la miro', ctx());
  assert.deepEqual(l, { accion: 'tomar', objetivo: 'moneda_suelo', luego: { accion: 'mirar', objetivo: 'moneda_suelo' } });
});
test('V7 negación: «no sigo a X» → ignorar; «no le digo nada» → callar', () => {
  assert.deepEqual(leerAccion('no sigo a la gata', ctx()), { accion: 'ignorar', objetivo: 'gata_mercado' });
  assert.deepEqual(leerAccion('no le digo nada', ctx()), { accion: 'callar' });
  assert.deepEqual(leerAccion('no le hago caso a la gata', ctx()), { accion: 'ignorar', objetivo: 'gata_mercado' });
});
test('V7 modo: sigilo y prisa como dato', () => {
  assert.equal(extraerModo(['sigo', 'a', 'escondidas']).modo, 'sigilo');
  assert.equal(leerAccion('sigo a la gata corriendo', ctx()).modo, 'prisa');
  assert.equal(leerAccion('sigo a la gata en silencio', ctx()).objetivo, 'gata_mercado');
});

async function conFocos(ids) {
  const r = await narrar(crearPartida({ semilla: 1 }), { tipo: 'texto', texto: 'observar' }, op);
  const e = structuredClone(r.estado);
  e.ext.focos = ids.map((id) => ({ id, visto: e.ext.turno, escena: e.jugador.escenaId, pasos: {}, agotado: false }));
  return e;
}
const ramas = (id, v) => (F.defs[id].ramas[v] ?? []).map((x) => x.t ?? x);
test('V7 juego: dos acciones en orden, el texto trae ambas', async () => {
  const e = await conFocos(['gata_mercado']);
  const r = await narrar(e, { tipo: 'texto', texto: 'miro la gata y después la llamo' }, op);
  assert.ok(ramas('gata_mercado', 'mirar').some((t) => r.texto.includes(t)) || F.clases.animal.mirar.some((t) => r.texto.includes(t)), r.texto);
  assert.ok(r.texto.includes('\n\n'));
  assert.equal(r.estado.ext.turno, e.ext.turno + 2);
});
test('V7 juego: «no sigo a la gata» no la sigue', async () => {
  const e = await conFocos(['gata_mercado']);
  const r = await narrar(e, { tipo: 'texto', texto: 'no sigo a la gata' }, op);
  assert.equal(r.estado.ext.siguiendo, null, r.texto);
  assert.ok(r.estado.ext.focos.find((f) => f.id === 'gata_mercado')?.agotado, r.texto);
});
test('V7 sin ampliado: una frase con «y» sigue siendo un solo turno', async () => {
  const r = await narrar(crearPartida({ semilla: 1 }), { tipo: 'texto', texto: 'observar y explorar' });
  assert.ok(!r.texto.includes('\n\n\n'));
});

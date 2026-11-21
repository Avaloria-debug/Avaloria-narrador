import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const N = amp.narracion;
const lineas = (o) => (Array.isArray(o) ? o : Object.values(o ?? {}).flat()).map((x) => x.t ?? x);
const primera = (esc) => lineas(N.escenas[esc].primera);
const regreso = (esc) => lineas(N.escenas[esc].regreso);
const transiciones = [...lineas(N.transicion.ciudad), ...lineas(N.transicion.camino)];

async function jugar(textos, densidad = 'normal', semilla = 3) {
  let e = crearPartida({ semilla }); const out = [];
  for (const t of textos) { const r = await narrar(e, { tipo: 'texto', texto: t }, { ampliado: amp, ahora: () => 0, densidad }); out.push(r); e = r.estado; }
  return out;
}

test('t39 cargado sin mezclar su cierre con el de eventos', () => {
  assert.equal(Object.keys(N.escenas).length, 12);
  assert.ok(N.cierre.hallazgo.length && !amp.cierre.hallazgo);
});
test('primera visita → primera; regreso → regreso; transición antes de la llegada', async () => {
  const r = await jugar(['observar', 'viajar al archivo', 'viajar al mercado']);
  assert.ok(primera('escena_mercado_circular').some((l) => r[0].texto.includes(l)), r[0].texto);
  assert.ok(primera('escena_archivo_real').some((l) => r[1].texto.includes(l)), r[1].texto);
  assert.ok(regreso('escena_mercado_circular').some((l) => r[2].texto.includes(l)), r[2].texto);
  for (const x of [r[1], r[2]]) {
    const tr = transiciones.find((l) => x.texto.includes(l));
    assert.ok(tr && x.texto.indexOf(tr) === 0, x.texto);
  }
});
test('ritmo de ambiente: en normal, sin dos seguidos y nunca 4 turnos sin evento ni ambiente', async () => {
  const r = await jugar(Array(40).fill('escuchar'), 'normal', 7);
  const amb = new Set([...lineas(N.escenas.escena_mercado_circular.ambiente), ...lineas(amp.ambiente.escena_mercado_circular), ...Object.values(N.actividad).flatMap(lineas)]);
  const tiene = r.map((x) => [...amb].some((l) => x.texto.includes(l)));
  const evento = r.map((x) => x.texto.includes('\n\n'));
  let sin = 0; let total = 0;
  for (let i = 1; i < r.length; i++) {
    if (tiene[i]) { total++; assert.ok(!tiene[i - 1], `ambiente seguido en ${i}`); }
    sin = tiene[i] || evento[i] ? 0 : sin + 1;
    assert.ok(sin <= 3, `4 turnos sin ambiente ni evento hasta ${i}`);
  }
  assert.ok(total >= 5, `ambiente ${total}`);
});
test('densidad breve: sin ambiente; rica: 2 líneas de primera', async () => {
  const b = await jugar(Array(12).fill('descansar'), 'breve', 7);
  const amb = lineas(N.escenas.escena_mercado_circular.ambiente);
  assert.ok(!b.slice(1).some((x) => amb.some((l) => x.texto.includes(l))));
  const [r] = await jugar(['observar'], 'rica');
  assert.equal(primera('escena_mercado_circular').filter((l) => r.texto.includes(l)).length, 2, r.texto);
});
test('sin ampliado: igual que antes (sin líneas de t39)', async () => {
  const r = await narrar(crearPartida({ semilla: 3 }), { tipo: 'texto', texto: 'observar' });
  assert.ok(!primera('escena_mercado_circular').some((l) => r.texto.includes(l)));
});

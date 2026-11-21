import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anotar, textoDiario, diarioGuardado, MAX_DIARIO } from './diario.js';
import { crearRng } from './azar.js';
import { contenido, crearPartida, narrar } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const e = (dia, tipo = 'ayudar') => ({ dia, tipo, npc: 'serel_panadero', escena: 'escena_mercado_circular' });

test('diario: orden por día y cierre', () => {
  const d = [e(1), e(2, 'viaje')];
  const t = textoDiario(d, { amp, contenido, rng: crearRng(1) });
  assert.ok(t.includes('Serel'));
  assert.ok(amp.diario.otras.cierre.some((c) => t.endsWith(c)));
});

test('diario: tope y fusión de días viejos', () => {
  let d = [];
  for (let i = 0; i < 80; i++) d = anotar(d, e(1 + Math.floor(i / 10)));
  assert.ok(d.length <= MAX_DIARIO);
  assert.equal(d.filter((x) => x.dia === 1).length, 1);
  assert.equal(d.find((x) => x.dia === 1).tipo, 'fusion');
  assert.ok(d.every((x, i) => i === 0 || d[i - 1].dia <= x.dia));
});

test('diario: partida vieja y sin hechos → línea de "vacío"', () => {
  assert.deepEqual(diarioGuardado(undefined), []);
  assert.ok(amp.diario.otras.vacio.includes(textoDiario([], { amp, contenido, rng: crearRng(1) })));
});

test('diario: el comando "diario" muestra las entradas', async () => {
  let s = crearPartida({ semilla: 1 });
  s = (await narrar(s, { tipo: 'boton', intencionId: 'intencion_ayudar', parametros: { npcId: 'serel_panadero' } }, { ampliado: amp })).estado;
  const r = await narrar(s, { tipo: 'texto', texto: 'diario' }, { ampliado: amp, ahora: () => 0 });
  assert.ok(r.texto.includes('Serel'), r.texto);
});

// Bugs de prueba real (fase 7): focos por texto del narrador, interiores sin clima, eco de la IA, saludos y preguntas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarContraTurno, similitud, MOTIVOS_SALIDA } from './ia.js';
import { detectar } from './focos.js';
import { cargarAmpliadoNode, ALIAS_BLOQUEADOS } from './contenidoAmpliado.js';
import { cumple } from './seleccion.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const F = amp.focos;

test('A1: alias bloqueados no quedan en los focos', () => {
  for (const d of Object.values(F.defs)) for (const a of d.alias ?? []) assert.ok(!ALIAS_BLOQUEADOS.has(a), a);
  assert.ok(!F.defs.carta_suelta.alias.includes('sobre'));
});
test('A1: un alias que viene de la frase del jugador no abre un foco nuevo', () => {
  const l = detectar([], 'Serel repite: la carta.', { F, turno: 1, escena: 'escena_mercado_circular', entrada: 'miro la carta' });
  assert.ok(!l.some((f) => f.id === 'carta_suelta'));
  const m = detectar([], 'Hay una carta en el suelo.', { F, turno: 1, escena: 'escena_mercado_circular', entrada: 'miro' });
  assert.ok(m.some((f) => f.id === 'carta_suelta'));
});
test('A2: en interiores, lluvia/niebla/viento solo en el turno de llegada', () => {
  const c = { cl: 'lluvia' };
  assert.equal(cumple(c, { cl: 'lluvia', interior: true }), false);
  assert.equal(cumple(c, { cl: 'lluvia', interior: true, llegada: true }), true);
  assert.equal(cumple(c, { cl: 'lluvia' }), true);
});
test('A3: eco, narración y fuera de personaje se rechazan', () => {
  const ctx = { frase: 'hola serel que haces aqui', npc: { nombre: 'Serel el panadero' } };
  assert.ok(similitud('Hola Serel, ¿qué hacés aquí?', ctx.frase) > 0.6);
  assert.equal(validarContraTurno('Hola Serel, ¿qué hacés aquí?', ctx), MOTIVOS_SALIDA.ECO);
  assert.equal(validarContraTurno('Mirás el horno un rato.', ctx), MOTIVOS_SALIDA.SIN_HABLA);
  assert.equal(validarContraTurno('Como modelo de lenguaje no puedo opinar.', ctx), MOTIVOS_SALIDA.FUERA_DE_PERSONAJE);
  assert.equal(validarContraTurno('Acá, horneando desde las cuatro.', ctx), null);
  assert.equal(validarContraTurno('Serel se encoge de hombros: «Ni idea».', ctx), null);
});

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
  const l = detectar([], 'Serel repite: la carta.', { F, turno: 1, escena: 'escena_archivo_real', entrada: 'miro la carta' });
  assert.ok(!l.some((f) => f.id === 'carta_suelta'));
  const m = detectar([], 'Hay una carta en el suelo.', { F, turno: 1, escena: 'escena_archivo_real', entrada: 'miro' });
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

test('cierre: fuera de las escenas de focos-escenas.json el alias no abre el foco', async () => {
  const { FOCOS_ESCENAS } = await import('./focos.js');
  assert.ok(!FOCOS_ESCENAS.carta_suelta.includes('escena_mercado_circular'));
  assert.deepEqual(detectar([], 'Hay una carta en el suelo.', { F, turno: 1, escena: 'escena_mercado_circular' }).filter((f) => f.id === 'carta_suelta'), []);
  assert.ok(detectar([], 'Hay una carta en el suelo.', { F, turno: 1, escena: 'escena_archivo_real' }).some((f) => f.id === 'carta_suelta'));
});
test('cierre: «dejar» = ignorar solo con animal o persona', async () => {
  const { leerAccion, contextoLectura } = await import('./lectura.js');
  const ctx = contextoLectura({ focos: F.defs, npcs: [], presentes: [] });
  assert.equal(leerAccion('dejo a la gata', ctx).accion, 'ignorar');
  assert.notEqual(leerAccion('dejo la carta', ctx).accion, 'ignorar');
});
test('cierre: falta_npc nombra por oficio a quien no se oyó', async () => {
  const { nombreVisible } = await import('./ampliado.js');
  const { contenido } = await import('./index.js');
  assert.equal(nombreVisible('Serel Norlen', contenido, {}), 'el panadero');
  assert.equal(nombreVisible('Serel Norlen', contenido, { nombresOidos: ['serel_panadero'] }), 'Serel Norlen');
});

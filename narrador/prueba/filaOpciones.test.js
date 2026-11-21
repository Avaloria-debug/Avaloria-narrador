import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from '../index.js';
import { cargarAmpliadoNode } from '../contenidoAmpliado.js';
import { leerAccion, contextoLectura } from '../lectura.js';
import { botonesDeTurno, filaOculta, guardarFilaOculta, textoParaInput, MAX_BOTONES, TEXTOS_FILA } from './filaOpciones.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const op = { ampliado: amp, ahora: () => 0 };
async function conFocos(ids) {
  const r = await narrar(crearPartida({ semilla: 1 }), { tipo: 'texto', texto: 'observar' }, op);
  const e = structuredClone(r.estado);
  e.ext.focos = ids.map((id) => ({ id, visto: e.ext.turno, escena: e.jugador.escenaId, pasos: {}, agotado: false }));
  return e;
}
const muchos = ['gata_mercado', 'moneda_suelo', 'campana_lejana', 'lampara_aceite', 'puerta_cerrada', 'ventana_abierta', 'libro_abierto', 'garza_lago', 'burro_atado'];

test('máx. 8 botones, con NPC y salida aunque haya muchos focos', async () => {
  const b = botonesDeTurno(await conFocos(muchos), { amp, contenido });
  assert.ok(b.length <= MAX_BOTONES && b.length >= 4);
  assert.ok(b.some((x) => x.tipo === 'npc'));
  assert.ok(b.some((x) => x.tipo === 'salida'));
});
test('gata → verbos de sus ramas, incluido seguir', async () => {
  const g = botonesDeTurno(await conFocos(['gata_mercado']), { amp, contenido }).find((x) => x.id === 'gata_mercado');
  assert.ok(g.verbos.some((v) => v.rotulo === 'seguir' && v.frase === 'seguir a la gata'));
});
test('NPC: hablar, preguntar por…, ignorar; salida: ir', async () => {
  const b = botonesDeTurno(await conFocos(['gata_mercado']), { amp, contenido });
  assert.deepEqual(b.find((x) => x.tipo === 'npc').verbos.map((v) => v.rotulo), ['hablar', 'preguntar por…', 'ignorar']);
  assert.deepEqual(b.find((x) => x.tipo === 'salida').verbos.map((v) => v.rotulo), ['ir']);
});
test('tocar un verbo = escribir la frase: la lectura la entiende y el turno responde', async () => {
  const e = await conFocos(['gata_mercado']);
  const ctx = contextoLectura({ focos: amp.focos.defs, npcs: contenido.npcs, escenas: contenido.escenas, presentes: ['serel_panadero'] });
  for (const x of botonesDeTurno(e, { amp, contenido })) for (const v of x.verbos) assert.notEqual(leerAccion(v.frase, ctx).accion, 'no_entendido', v.frase);
  const v = botonesDeTurno(e, { amp, contenido }).find((x) => x.id === 'gata_mercado').verbos.find((y) => y.rotulo === 'seguir');
  const r = await narrar(e, { tipo: 'texto', texto: v.frase }, op);
  assert.equal(r.estado.ext.siguiendo ?? 'fin', r.estado.ext.siguiendo ? 'gata_mercado' : 'fin');
  assert.notEqual(r.tipo, 'reformulacion');
});
test('preferencia de fila oculta con try/catch', () => {
  const m = new Map(); const s = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  assert.equal(filaOculta(s), false); guardarFilaOculta(s, true); assert.equal(filaOculta(s), true);
  const malo = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(filaOculta(malo), false); assert.doesNotThrow(() => guardarFilaOculta(malo, true));
});
test('escribir sin ejecutar: frase + espacio; textos prov; sin estado → vacío', () => {
  assert.equal(textoParaInput('seguir a la gata'), 'seguir a la gata ');
  assert.ok(TEXTOS_FILA.prov);
  assert.deepEqual(botonesDeTurno(null, { amp, contenido }), []);
});

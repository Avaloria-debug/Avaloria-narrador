// Fase 6 (V5): defaults y aclaración, en la lectura y en el juego (con ampliado).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';
import { leerAccion, contextoLectura, responderAclaracion, preguntaAclaracion, TEXTOS_ACLARACION } from './lectura.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const op = { ampliado: amp, ahora: () => 0 };
const F = amp.focos;
const ctx = (o = {}) => contextoLectura({ focos: F.defs, npcs: contenido.npcs, escenas: contenido.escenas, presentes: ['serel_panadero'], ...o });

async function conFocos(ids) {
  const r = await narrar(crearPartida({ semilla: 1 }), { tipo: 'texto', texto: 'observar' }, op);
  const e = structuredClone(r.estado);
  e.ext.focos = ids.map((id) => ({ id, visto: e.ext.turno, escena: e.jugador.escenaId, pasos: {}, agotado: false }));
  return e;
}

test('V5 defaults: hablar sin NPC → único presente; dos presentes → aclaración', () => {
  assert.deepEqual(leerAccion('hablar', ctx()), { accion: 'hablar', npc: 'serel_panadero' });
  assert.equal(leerAccion('hablar', ctx({ presentes: ['serel_panadero', 'maren_archivista'] })).accion, 'aclarar');
});
test('V5 defaults: mirar sin objeto → último foco; sin foco → «¿Qué querés mirar?»', () => {
  assert.deepEqual(leerAccion('miro', ctx({ reciente: { foco: 'isla_lago' } })), { accion: 'mirar', objetivo: 'isla_lago' });
  const l = leerAccion('mirar', ctx());
  assert.equal(l.accion, 'aclarar');
  assert.equal(l.pregunta, TEXTOS_ACLARACION.falta.replace('{verbo}', 'mirar'));
});
test('V5 aclaración con dos candidatos nombra ambos y se resuelve con respuesta corta', () => {
  const c = ctx();
  const l = leerAccion('seguir al perro', c);
  assert.deepEqual(l.opciones.sort(), ['perro_ciudad', 'perro_granja']);
  assert.equal(l.pregunta, '¿El perro o el de granja?');
  const p = { accion: 'seguir', opciones: ['perro_ciudad', 'perro_granja'] };
  assert.equal(responderAclaracion('el primero', p, c), 'perro_ciudad');
  assert.equal(responderAclaracion('el de la granja', p, c), 'perro_granja');
  assert.equal(responderAclaracion('cualquier cosa larga que no dice nada de nada', p, c), null);
  assert.ok(TEXTOS_ACLARACION.prov);
  assert.equal(preguntaAclaracion({ verbo: 'tocar' }, c), '¿Qué querés tocar?');
});
test('V5 juego: dos perros a la vista → pregunta; «el de granja» sigue al perro de granja', async () => {
  const e = await conFocos(['perro_ciudad', 'perro_granja']);
  const a = await narrar(e, { tipo: 'texto', texto: 'seguir al perro' }, op);
  assert.match(a.texto, /\?/);
  assert.deepEqual(a.estado.ext.aclaracion.opciones, ['perro_ciudad', 'perro_granja']);
  const b = await narrar(a.estado, { tipo: 'texto', texto: 'el de granja' }, op);
  const rama = F.defs.perro_granja.ramas.seguir.map((x) => x.t ?? x);
  assert.ok(rama.some((t) => b.texto.includes(t)), b.texto);
  assert.equal(b.estado.ext.aclaracion, null);
});
test('V5 juego: conjugación y enclítico sobre un foco visto', async () => {
  const e = await conFocos(['gata_mercado']);
  const a = await narrar(e, { tipo: 'texto', texto: 'persiguió la gata' }, op);
  assert.equal(a.estado.ext.siguiendo, 'gata_mercado', a.texto);
  const b = await narrar(e, { tipo: 'texto', texto: 'acariciala' }, op);
  assert.ok(!F.no_visto.some((n) => b.texto.includes(n)), b.texto);
  assert.equal(b.tipo !== 'reformulacion', true, b.texto);
});

// ---- W1 (fase 7) ----
import { tomarOTocar, esTransportable } from './lectura.js';
test('W1 rótulo por escena y por alias propio', () => {
  const c = contextoLectura({ focos: { perro_ciudad: { ...F.defs.perro_ciudad, escena: 'escena_plaza_cambistas' }, perro_granja: { ...F.defs.perro_granja, escena: 'escena_cruce_colinas' } }, escenas: contenido.escenas });
  assert.equal(leerAccion('seguir al perro', c).pregunta, '¿El perro de la plaza o el del cruce?');
  const d = contextoLectura({ focos: { perro_ciudad: F.defs.perro_ciudad, perro_granja: F.defs.perro_granja }, escenas: contenido.escenas });
  assert.equal(leerAccion('seguir al perro', d).pregunta, '¿El perro o el de granja?');
});
test('W1 agarrar: transportable → tomar; si no → tocar; inventario cuenta', () => {
  const c = ctx();
  assert.ok(esTransportable(F.defs.moneda_suelo));
  assert.equal(leerAccion('agarro la moneda', c).accion, 'tomar');
  assert.equal(leerAccion('agarro la puerta', c).accion, 'tocar');
  assert.equal(tomarOTocar('carta_suelta', contextoLectura({ focos: F.defs, inventario: ['carta_suelta'] })), 'tomar');
});
test('W1 juego: «agarro la moneda» la levanta (rama de hallazgo)', async () => {
  const e = await conFocos(['moneda_suelo']);
  const r = await narrar(e, { tipo: 'texto', texto: 'agarro la moneda' }, op);
  assert.ok(r.texto.includes(F.defs.moneda_suelo.ramas.seguir[0].t), r.texto);
});

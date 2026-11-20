import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';
import { fraseAmpliada, contexto, extInicial } from './ampliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const maren = 'maren_archivista';
const base = () => {
  const e = crearPartida({ semilla: 1 });
  return { ...e, jugador: { ...e.jugador, escenaId: 'escena_archivo_real' } };
};
const ctxDe = (estado, turno, semilla = 1) => contexto({ amp, contenido, despues: estado, turno, ext: { ...extInicial({}, semilla), turno: 1 } });

test('voces: la voz del NPC gana a la genérica en el saludo', () => {
  const turno = { tipo: 'saludo', npcId: maren };
  const r = fraseAmpliada({ amp, contenido, turno, ctx: ctxDe(base(), turno), aperturas: [] });
  const voces = amp.voces[maren].saludo.map((v) => v.t ?? v);
  assert.ok(voces.includes(r.texto), r.texto);
  assert.ok(!contenido.plantillas.saludo.includes(r.texto));
});

test('voces: charla en hablar_con sin conocimiento', () => {
  const turno = { tipo: 'accion', accion: { verbo: 'hablar_con', intencionId: 'intencion_hablar_con', resultado: 'exito', parametros: { npcId: maren }, efectos: [] } };
  const charla = new Set(amp.charla[maren].map((v) => v.t ?? v));
  let vistos = 0;
  for (let s = 0; s < 40; s++) {
    const r = fraseAmpliada({ amp, contenido, turno, ctx: ctxDe(base(), turno, s), aperturas: [] });
    if (charla.has(r.texto)) vistos++;
  }
  assert.ok(vistos > 5 && vistos < 35, String(vistos));
});

test('voces: no_se en la voz del NPC', () => {
  const turno = { tipo: 'consulta', consulta: { npcId: maren, conocimientoId: null, resultado: 'no_se' } };
  const r = fraseAmpliada({ amp, contenido, turno, ctx: ctxDe(base(), turno), aperturas: [] });
  assert.ok(amp.voces[maren].no_se.map((v) => v.t ?? v).includes(r.texto));
});

test('voces: sin ampliado, la narración es la de siempre', async () => {
  const e = crearPartida({ semilla: 9 });
  const a = await narrar(e, { tipo: 'boton', intencionId: 'intencion_explorar' });
  const b = await narrar(e, { tipo: 'boton', intencionId: 'intencion_explorar' });
  assert.equal(a.texto, b.texto);
  assert.equal(a.estado.ext, undefined);
});

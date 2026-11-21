import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { npcsPresentes } from './turno.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const nada = { tipo: 'texto', texto: 'asdf qwer zxcv' };

test('reformulación: en la voz de un NPC presente', async () => {
  const e = crearPartida({ semilla: 1 });
  const presentes = npcsPresentes(e, contenido).map((n) => n.id);
  assert.ok(presentes.length > 0);
  const r = await narrar(e, nada, { ampliado: amp, ahora: () => 0 });
  assert.equal(r.tipo, 'reformulacion');
  const voces = new Set(presentes.flatMap((id) => amp.reformulacion[id] ?? []).map((x) => x.t ?? x));
  // W3 (fase 7): a la voz del NPC se le suma «Podrías …».
  assert.ok([...voces].some((v) => r.texto.startsWith(v)), r.texto);
  assert.match(r.texto, /Podrías /);
});

test('reformulación: máx. 2 seguidas; la 3ª sugiere opciones válidas', async () => {
  let e = crearPartida({ semilla: 1 });
  const nombres = npcsPresentes(e, contenido).map((n) => n.nombre);
  const textos = [];
  for (let i = 0; i < 3; i++) {
    const r = await narrar(e, nada, { ampliado: amp, ahora: () => 0 });
    textos.push(r.texto);
    e = r.estado;
  }
  assert.equal(e.ext.noEntendidos, 3);
  assert.ok(nombres.some((n) => textos[2].includes(n)), textos[2]);
  const ok = await narrar(e, { tipo: 'boton', intencionId: 'intencion_observar' }, { ampliado: amp });
  assert.equal(ok.estado.ext.noEntendidos, 0);
});

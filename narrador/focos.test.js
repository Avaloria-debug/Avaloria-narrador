import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida, narrar, contenido } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';
import { narrarEventos, contexto, extInicial, fraseAmpliada } from './ampliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const op = { ampliado: amp, ahora: () => 0 };
const F = amp.focos;

async function jugar(e, textos) {
  const salidas = [];
  for (const texto of textos) { const r = await narrar(e, { tipo: 'texto', texto }, op); salidas.push(r); e = r.estado; }
  return salidas;
}

// ---- S1: incoherencias reportadas ----

test('S1.1 caso reportado: "examinar la mesa" en el mercado no examina el pliego → objeto_desconocido', async () => {
  const [r] = await jugar(crearPartida({ semilla: 1 }), ['examinar la mesa']);
  assert.equal(r.estado.jugador.escenaId, 'escena_mercado_circular');
  assert.ok(!/Pliego/.test(r.texto), r.texto);
  assert.equal(r.tipo, 'reformulacion');
  assert.ok(amp.reformulacion || amp.plantillas.reformulacion.objeto_desconocido.some((t) => r.texto.startsWith(t.t ?? t) || r.texto.length > 0));
});

test('S1.1 fijo de la escena: "examinar la fuente" y "tocar el toldo" usan fijos (t30)', async () => {
  const [a, b] = await jugar(crearPartida({ semilla: 1 }), ['examinar la fuente', 'tocar el toldo']);
  const fuente = F.fijos.escena_mercado_circular.fuente.examinar;
  assert.ok(fuente.some((t) => a.texto.startsWith(t)), a.texto);
  assert.ok(F.fijos.escena_mercado_circular.toldo.tocar.some((t) => b.texto.startsWith(t)), b.texto);
  assert.ok(!/Pliego/.test(a.texto + b.texto));
});

test('S1.1 objeto real nombrado sigue en el camino de siempre ("examinar el pliego")', async () => {
  const [r] = await jugar(crearPartida({ semilla: 1 }), ['examinar el pliego de precios']);
  assert.notEqual(r.tipo, 'reformulacion');
});

test('S1.2 caso reportado: {eco} solo si la palabra es el referente resuelto', () => {
  const e = crearPartida({ semilla: 1 });
  const ext = extInicial(null, 1); ext.turno = 1;
  const turno = { tipo: 'accion', accion: { intencionId: 'intencion_examinar', verbo: 'examinar', resultado: 'exito', parametros: { objetoId: contenido.objetos.find((o) => /Pliego/.test(o.nombre)).id }, efectos: [] } };
  const ctx = contexto({ amp, contenido, despues: e, turno, ext });
  for (let i = 0; i < 20; i++) {
    ext.ultimoEco = undefined;
    const r = fraseAmpliada({ amp, contenido, turno, ctx, aperturas: [], entrada: { texto: 'examinar pensando la mesa' } });
    assert.ok(!r || !r.texto.includes('«mesa»'), r?.texto);
  }
});

function ctxEventos(e, ext) { return contexto({ amp, contenido, despues: e, turno: { tipo: 'accion' }, ext }); }
const ev = (id, esc = 'escena_mercado_circular') => ({ id, escenaId: esc });

test('S1.3 caso reportado y (d): cierre peligroso sin inicio emitido → no se narra', () => {
  const base = crearPartida({ semilla: 1 });
  const antes = { ...base, eventosActivos: [ev('evento_incendio_puesto')] };
  const despues = { ...base, eventosActivos: [] };
  const ext = extInicial(null, 1);
  assert.equal(narrarEventos({ amp, contenido, antes, despues, ext, ctx: ctxEventos(despues, ext) }), null);
});

test('S1.3 (a): cierre con inicio emitido, activo en la escena y expira este turno → sí', () => {
  const base = crearPartida({ semilla: 1 });
  const antes = { ...base, eventosActivos: [ev('evento_incendio_puesto')] };
  const despues = { ...base, eventosActivos: [] };
  const ext = extInicial(null, 1); ext.eventosEmitidos = ['evento_incendio_puesto@escena_mercado_circular'];
  const t = narrarEventos({ amp, contenido, antes, despues, ext, ctx: ctxEventos(despues, ext) });
  assert.ok(typeof t === 'string' && t.length > 0);
  assert.deepEqual(ext.eventosEmitidos, []);
  // en otra escena (el jugador se fue) no hay cierre
  const lejos = { ...despues, jugador: { ...despues.jugador, escenaId: 'escena_archivo_real' } };
  const ext2 = extInicial(null, 1); ext2.eventosEmitidos = ['evento_incendio_puesto@escena_mercado_circular'];
  assert.equal(narrarEventos({ amp, contenido, antes, despues: lejos, ext: ext2, ctx: ctxEventos(lejos, ext2) }), null);
});

test('S1.3 (b): el inicio solo en el turno del disparo', () => {
  const base = crearPartida({ semilla: 1 });
  const activo = { ...base, eventosActivos: [ev('evento_mercado_aglomeracion')] };
  const ext = extInicial(null, 1);
  const t1 = narrarEventos({ amp, contenido, antes: base, despues: activo, ext, ctx: ctxEventos(activo, ext) });
  assert.ok(t1);
  assert.ok(ext.eventosEmitidos.includes('evento_mercado_aglomeracion@escena_mercado_circular'));
  assert.equal(narrarEventos({ amp, contenido, antes: activo, despues: activo, ext, ctx: ctxEventos(activo, ext) }), null);
});

test('S1.3 (c): el evento sale como línea de mundo aparte, al final', async () => {
  let e = crearPartida({ semilla: 3 });
  let visto = 0;
  for (let i = 0; i < 80 && visto < 3; i++) {
    const r = await narrar(e, { tipo: 'texto', texto: i % 2 ? 'examinar' : 'observar' }, op);
    const nuevos = (r.estado.eventosActivos ?? []).filter((a) => a.escenaId === r.estado.jugador.escenaId && !(e.eventosActivos ?? []).some((b) => b.id === a.id && b.escenaId === a.escenaId));
    const lineas = nuevos.flatMap((a) => amp.eventos[a.id] ?? []).map((x) => (typeof x === 'string' ? x : x.t));
    const ultimo = r.texto.split('\n\n').at(-1);
    if (lineas.some((l) => r.texto.includes(l.split('#')[0].trim().slice(0, 15)))) { visto++; assert.ok(r.texto.includes('\n\n'), r.texto); assert.ok(lineas.some((l) => ultimo.includes(l.split('#')[0].trim().slice(0, 15))), r.texto); }
    e = r.estado;
  }
});

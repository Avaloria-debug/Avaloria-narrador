import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conHistorial, sinRepetir, elegirLinea, anotarTexto, VENTANA_LINEAS } from './historial.js';
import { crearPartida, narrar } from './index.js';
import { cargarAmpliadoNode } from './contenidoAmpliado.js';
import { crearRng } from './azar.js';

const A = 'La primera línea, bastante larga para contar.';
const B = 'La segunda línea, también bastante larga aquí.';
const C = 'La tercera línea, larga como las otras dos.';

test('sin historial activo: la lista queda igual', () => assert.deepEqual(sinRepetir([A, B]), [A, B]));
test('excluye las usadas mientras quede otra; todas usadas → la más antigua', () => {
  conHistorial([`x ${A} y`, B], () => {
    assert.deepEqual(sinRepetir([A, B, C]), [C]);
    assert.deepEqual(sinRepetir([A, B]), [A]);
  });
});
test('elegirLinea es determinista con la semilla', () => {
  const a = conHistorial([A], () => elegirLinea([A, B, C], crearRng(3)));
  const b = conHistorial([A], () => elegirLinea([A, B, C], crearRng(3)));
  assert.equal(a, b); assert.notEqual(a, A);
});
test('anotarTexto guarda párrafos, máx. 30', () => {
  let l = [];
  for (let i = 0; i < 40; i++) l = anotarTexto(l, `línea ${i}\n\notra ${i}`);
  assert.equal(l.length, VENTANA_LINEAS);
  assert.equal(l.at(-1), 'otra 39');
});

test('200 turnos en la misma escena: una acción con ≥2 variantes no repite su línea seguida', async () => {
  const amp = await cargarAmpliadoNode({ cargarPendientes: true });
  const acciones = ['observar', 'escuchar', 'mirar eso', 'explorar', 'hablar con serel', 'seguir eso', 'descansar', 'examinar'];
  let e = crearPartida({ semilla: 5 });
  const porAccion = {}; let rep = 0; const vistas = [];
  for (let t = 0; t < 200; t++) {
    const accion = acciones[t % acciones.length];
    const r = await narrar(e, { tipo: 'texto', texto: accion }, { ampliado: amp, ahora: () => 0 });
    e = r.estado;
    assert.equal(e.jugador.escenaId, 'escena_mercado_circular');
    assert.ok(e.ext.lineas.length <= VENTANA_LINEAS);
    const ps = r.texto.split(/\n+/).map((x) => x.trim()).filter((x) => x.length >= 20);
    for (const p of ps) { if (vistas.slice(-VENTANA_LINEAS).includes(p)) rep++; vistas.push(p); }
    if (porAccion[accion] && ps[0] && accion === 'descansar') assert.notEqual(ps[0], porAccion[accion], `${accion} repitió`);
    porAccion[accion] = ps[0];
  }
  assert.ok(rep <= 25, `repeticiones en ventana: ${rep}`);
});
test('sin ampliado: el estado no guarda historial', async () => {
  const r = await narrar(crearPartida({ semilla: 5 }), { tipo: 'texto', texto: 'observar' });
  assert.equal(r.estado.ext?.lineas, undefined);
});

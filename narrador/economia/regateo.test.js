import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rasgoDinero, rebajaMaxima, montoEn, valorTrueque, MAX_RONDAS } from './regateo.js';
import { abrirSistema, turnoSistema } from '../sistemas/index.js';
import { totalBronce } from './monedas.js';
import { crearPartida, narrar, contenido } from '../index.js';
import { cargarAmpliadoNode } from '../contenidoAmpliado.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const abrir = (npc, precio = 100, extra = {}) => abrirSistema(crearPartida({ semilla: 2 }), 'regateo', { npc, producto: 'x', precio, escena: 'escena_mercado_circular', rasgoDinero: rasgoDinero(amp, npc), relacion: 0, ...extra });
const dice = (e, texto) => turnoSistema(e, { tipo: 'texto', texto }, () => 0, { contenido, amp });

test('rebaja máxima por rasgo dinero y relación', () => {
  assert.equal(rebajaMaxima(2), 0.05); assert.equal(rebajaMaxima(-2), 0.4);
  assert.ok(rebajaMaxima(0, 2) > rebajaMaxima(0, 0)); assert.ok(rebajaMaxima(0, -2) < rebajaMaxima(0, 0));
  assert.equal(montoEn('te doy 2 de plata y 5'), 205); assert.equal(montoEn('nada'), null);
});
test('por NPC: el mínimo depende del rasgo (Ivor duro, Oren blando)', () => {
  for (const npc of Object.keys(amp.economia.regateo)) {
    const e = abrir(npc);
    const s = e.ext.sistema.sub;
    assert.ok(s.minimo >= 1 && s.minimo <= 100, npc);
  }
  assert.ok(abrir('ivor_cambista').ext.sistema.sub.minimo > abrir('oren_peregrino').ext.sistema.sub.minimo);
});
test('oferta bajo el mínimo: rechaza; al 4.º intento cierra y baja relación', () => {
  let e = abrir('ivor_cambista');
  const rel = e.npcs.ivor_cambista.relacion;
  for (let i = 0; i < MAX_RONDAS; i++) { const r = dice(e, 'te doy 10'); assert.equal(r.sub.ultimo, 'rechaza'); assert.equal(r.terminado, false); e = r.estado; }
  const r = dice(e, 'te doy 10');
  assert.equal(r.terminado, true); assert.equal(r.estado.npcs.ivor_cambista.relacion, Math.max(-2, rel - 1));
  assert.equal(totalBronce(r.estado.jugador), totalBronce(e.jugador));
});
test('contraoferta y luego acepta (neutral: nunca bajo el mínimo)', () => {
  let e = abrir('oren_peregrino');
  const r1 = dice(e, 'te doy 70'); assert.equal(r1.sub.ultimo, 'contraoferta'); assert.ok(r1.sub.actual >= r1.sub.minimo);
  const r2 = dice(r1.estado, 'te doy 70'); assert.equal(r2.terminado, true); assert.equal(r2.sub.acuerdo, 70);
  assert.equal(totalBronce(r2.estado.jugador), totalBronce(e.jugador) - 70);
});
test('pagar de más sube la relación; sin dinero no compra', () => {
  const e = abrir('serel_panadero', 10);
  const rel = e.npcs.serel_panadero.relacion;
  const r = dice(e, 'pago de más');
  assert.equal(r.sub.acuerdo, 12); assert.equal(r.estado.npcs.serel_panadero.relacion, Math.min(2, rel + 1));
  const pobre = abrir('serel_panadero', 999999);
  const r2 = dice(pobre, 'acepto');
  assert.equal(r2.sub.ultimo, 'sin_dinero'); assert.equal(totalBronce(r2.estado.jugador), totalBronce(pobre.jugador));
});
test('trueque: hallazgos valen más para Ivor y Maren', () => {
  const o = contenido.objetos.find((x) => x.tipo === 'narrativo');
  assert.ok(valorTrueque(o, 'ivor_cambista') > valorTrueque(o, 'serel_panadero'));
  let e = abrir('ivor_cambista', 150);
  e = { ...e, inventario: [{ objetoId: o.id, usosRestantes: 1 }] };
  const palabra = o.nombre.split(' ').find((w) => w.length > 3);
  const r = dice(e, `te lo cambio por el ${palabra}`);
  assert.equal(r.terminado, true); assert.equal(r.sub.trueque, o.id);
  assert.ok(!r.estado.inventario.some((x) => x.objetoId === o.id));
  assert.equal(dice(abrir('ivor_cambista'), 'te cambio la piedra').sub.ultimo, 'trueque_no');
});
test('narrar: regatear con Serel y salir; cambiar de escena cierra el sistema', async () => {
  const op = { ampliado: amp, ahora: () => 0 };
  let r = await narrar(crearPartida({ semilla: 4 }), { tipo: 'texto', texto: 'quiero regatear el pan' }, op);
  assert.equal(r.estado.ext.sistema.id, 'regateo');
  const s = await narrar(r.estado, { tipo: 'texto', texto: 'me voy' }, op);
  assert.equal(s.estado.ext.sistema, null);
  const mover = { ...r.estado, jugador: { ...r.estado.jugador, escenaId: 'escena_taberna_lareth' } };
  const m = await narrar(mover, { tipo: 'texto', texto: 'miro alrededor' }, op);
  assert.ok(!m.estado.ext.sistema);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avanzarFavores, nuevoFavor, respuestaCobro, DIAS_MAX_COBRO, DIAS_RESPUESTA, DIAS_DEUDA_NPC } from './favores.js';
import { crearPartida, narrar, contenido } from '../index.js';
import { cargarAmpliadoNode } from '../contenidoAmpliado.js';
import { totalBronce } from './monedas.js';

const amp = await cargarAmpliadoNode({ cargarPendientes: true });
const op = { ampliado: amp, ahora: () => 0 };
async function decir(e, ...frases) { let r; for (const f of frases) { r = await narrar(e, { tipo: 'texto', texto: f }, op); e = r.estado; } return r; }
const conExt = (e, ext) => ({ ...e, ext: { ...(e.ext ?? {}), ...ext } });
const enDia = (e, dia) => ({ ...e, reloj: { ...e.reloj, dia } });

test('ciclo de deuda completo: fiado → cobro → saldado', async () => {
  let e = crearPartida({ semilla: 4 });
  e = { ...e, npcs: { ...e.npcs, serel_panadero: { ...e.npcs.serel_panadero, relacion: 1 } } };
  let r = await decir(e, 'cuánto cuesta el pan', 'me lo fiás');
  const plata = totalBronce(r.estado.jugador);
  assert.equal(plata, totalBronce(e.jugador));
  assert.ok(r.estado.inventario.some((x) => x.objetoId === 'objeto_pan_fresco'));
  assert.equal(r.estado.ext.favores[0].deudor, 'jugador');
  r = await decir(enDia(r.estado, 1 + DIAS_MAX_COBRO), 'miro alrededor');
  assert.equal(r.estado.ext.favores[0].estado, 'cobrando');
  r = await decir(r.estado, 'sí, lo hago');
  assert.equal(r.estado.ext.favores[0].estado, 'saldado');
});
test('incumplimiento: negarse baja la relación y deja rumor; no responder en plazo también', async () => {
  const base = crearPartida({ semilla: 4 });
  const fav = [{ npc: 'serel_panadero', deudor: 'jugador', motivo: 'x', dia: 1, estado: 'cobrando', cobro: 3 }];
  let r = await decir(enDia(conExt(base, { favores: fav }), 3), 'no, no puedo');
  assert.equal(r.estado.ext.favores[0].estado, 'incumplido');
  assert.equal(r.estado.npcs.serel_panadero.relacion, Math.max(-2, base.npcs.serel_panadero.relacion - 1));
  assert.ok(r.estado.ext.hechosSistema['rumor_incumplido:serel_panadero']);
  const a = avanzarFavores(fav, { dia: 3 + DIAS_RESPUESTA, presentes: [] });
  assert.equal(a.favores[0].estado, 'incumplido'); assert.deepEqual(a.relacion, [{ npc: 'serel_panadero', delta: -1 }]);
});
test('todos los favores terminan: deuda de NPC vence; no se duplica', () => {
  const l = nuevoFavor(nuevoFavor([], { npc: 'x', deudor: 'npc', motivo: 'a', dia: 1 }), { npc: 'x', deudor: 'npc', motivo: 'b', dia: 1 });
  assert.equal(l.length, 1);
  assert.equal(avanzarFavores(l, { dia: 2 + DIAS_DEUDA_NPC }).favores[0].estado, 'incumplido');
  let f = [{ npc: 'y', deudor: 'jugador', motivo: 'a', dia: 1, estado: 'pendiente' }];
  for (let d = 1; d < 20; d++) f = avanzarFavores(f, { dia: d, presentes: [] }).favores;
  assert.equal(f[0].estado, 'incumplido');
  assert.equal(respuestaCobro('no hay problema, lo hago'), 'saldar');
});
test('información: vale una vez; repetida o propia no vale', async () => {
  const k = contenido.npcs.find((n) => n.id === 'maren_archivista').conocimientos[0];
  let e = crearPartida({ semilla: 4 });
  e = { ...e, npcs: { ...e.npcs, maren_archivista: { ...e.npcs.maren_archivista, conocimientosRevelados: [k.id] } } };
  const frase = `le cuento a serel lo de ${k.palabrasClave[0]}`;
  const r1 = await decir(e, frase);
  assert.ok(r1.estado.ext.economia.contadas.serel_panadero.includes(k.id));
  const ganó = r1.estado.ext.economia.descuentos?.serel_panadero || r1.estado.ext.favores?.some((f) => f.npc === 'serel_panadero');
  assert.ok(ganó);
  const r2 = await decir(r1.estado, frase);
  assert.deepEqual(r2.estado.ext.economia.contadas, r1.estado.ext.economia.contadas);
  assert.match(r2.texto, /ya lo sab/i);
});
test('cobrar un favor que te deben: saldado y descuento', async () => {
  const e = conExt(crearPartida({ semilla: 4 }), { favores: [{ npc: 'serel_panadero', deudor: 'npc', motivo: 'ayuda', dia: 1, estado: 'pendiente' }] });
  const r = await decir(e, 'me debés una');
  assert.equal(r.estado.ext.favores[0].estado, 'saldado');
  assert.ok(r.estado.ext.economia.descuentos.serel_panadero > 0);
});
